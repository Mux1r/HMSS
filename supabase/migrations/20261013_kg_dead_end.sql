-- 概念命中的相對門檻改以「有連到藥的概念」的最高分為基準（只改 hits，其餘同 20260930_kg_class.sql）。
-- 原因：查「喉嚨痛」字面命中同名概念拿 1.08 分，但它沒有任何 treats/in_class 連結（死路），
-- 門檻被它拉到 0.73，咽喉疼痛、疼痛、發炎這些有接 NSAID 的概念全被擋掉，最後只剩疫苗等向量雜訊。
-- 第一名本身有接藥時基準不變，結果與舊版相同。
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
  -- 只收跟「最高分且有接藥的概念」差距 0.35 以內的；完全沒有接藥的概念時 greatest 忽略 null，退回 0.25
  select id, label, type, score from scored
  where kind = 'concept'
    and score >= greatest(0.25, (
      select max(s.score) - 0.35 from scored s
      where s.kind = 'concept'
        and exists (select 1 from kg_edges e where e.target = s.id and e.relation in ('treats', 'in_class'))
    ))
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
