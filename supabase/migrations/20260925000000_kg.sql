-- 藥物知識圖（來源：helper repo 的 kg-out/，由 helper/kg/upload_supabase.py 上傳）
-- 只給 Edge Function kg-search（service role）讀：刻意不開 anon policy，向量不對外公開。

create extension if not exists vector;

create table if not exists kg_nodes (
  id        text primary key,
  kind      text not null check (kind in ('concept', 'drug')),
  label     text not null,
  type      text not null,
  code      text,                          -- drug：藥品編碼（= medications.id）
  aliases   text[] not null default '{}',  -- 已小寫，字面命中用
  -- 4096 維超過 pgvector 索引上限（2000），刻意不建索引：約 4 千筆逐筆比對夠快
  embedding vector(4096) not null
);

create table if not exists kg_edges (
  source   text not null,
  relation text not null,
  target   text not null,
  primary key (source, relation, target)
);
create index if not exists kg_edges_target on kg_edges (target, relation);
create index if not exists kg_edges_source on kg_edges (source, relation);

alter table kg_nodes enable row level security;
alter table kg_edges enable row level security;

-- 照搬 helper kg/search.py 的 local 模式：
--   向量相似度 + 字面命中加 0.35 → 分數地板 0.25 → 概念沿 is_a 上下各擴一跳（×0.85）
--   → 沿 treats 找到藥（×0.8）；另外直接回傳向量最像的藥品。
-- 只走 treats：查症狀要的是「治這個的藥」，不是「會引起這個的藥」。
create or replace function kg_search(query_embedding vector(4096), query_text text, match_count int default 12)
returns jsonb
language sql stable
set search_path = public, extensions
as $$
with scored as materialized (
  select n.id, n.kind, n.label, n.type, n.code,
         -(n.embedding <#> query_embedding)   -- 向量已正規化，內積 = cosine
         + case when exists (select 1 from unnest(n.aliases) a
                             where strpos(lower(query_text), a) > 0) then 0.35 else 0 end as score
  from kg_nodes n
),
hits as (
  select id, label, type, score from scored
  where kind = 'concept' and score >= 0.25
  order by score desc limit match_count
),
kin as (
  select distinct on (o.id) o.id, o.label, o.type, h.score * 0.85 as score, h.label as via
  from hits h
  cross join lateral (
    select case when e.source = h.id then e.target else e.source end as other
    from kg_edges e
    where e.relation = 'is_a' and (e.source = h.id or e.target = h.id)
    limit 6
  ) x
  join kg_nodes o on o.id = x.other and o.kind = 'concept'
  where o.id not in (select id from hits)
  order by o.id, h.score desc
),
concepts as (
  select id, label, type, score, null::text as via from hits
  union all
  select id, label, type, score, via from kin
),
links as (
  select d.code, c.label as concept, c.score * 0.8 as score
  from concepts c
  join kg_edges e on e.target = c.id and e.relation = 'treats'
  join kg_nodes d on d.id = e.source and d.kind = 'drug'
),
direct as (
  select code, score from scored
  where kind = 'drug' and score >= 0.25
  order by score desc limit match_count
)
select jsonb_build_object(
  'concepts', coalesce((select jsonb_agg(to_jsonb(c) order by c.score desc) from concepts c), '[]'::jsonb),
  'links',    coalesce((select jsonb_agg(to_jsonb(l)) from links l), '[]'::jsonb),
  'drugs',    coalesce((select jsonb_agg(to_jsonb(d) order by d.score desc) from direct d), '[]'::jsonb)
);
$$;

revoke execute on function kg_search(vector, text, int) from public, anon, authenticated;
