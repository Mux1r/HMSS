-- 知識圖加入藥理機轉類別（ATC 4/5 碼，type = drug_class），藥以 in_class 連到所屬類別。
-- kg_search 找藥時除了 treats 也走 in_class：查「COX-2」「質子幫浦抑制劑」會命中類別節點，再找到類別內的藥。
-- 另外概念命中改成相對門檻（見 hits），其餘邏輯與 20260925000000_kg.sql 相同。
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
  -- 只收跟第一名差距 0.35 以內的：第一名很明確時（如 COX-2 類別 0.82），後面 0.4 多的雜訊就不列
  select id, label, type, score from scored
  where kind = 'concept'
    and score >= greatest(0.25, (select max(score) from scored where kind = 'concept') - 0.35)
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
  join kg_edges e on e.target = c.id and e.relation in ('treats', 'in_class')
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
