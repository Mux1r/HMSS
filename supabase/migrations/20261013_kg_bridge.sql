-- 症狀橋接（helper kg/bridge_prompt.md）：沒有藥治它的症狀，以 managed_as 連到臨床上處理它的適應症概念
-- （心悸 -> 心律不整、胸痛 -> 狹心症）。kg_search 改動兩處，其餘同 20261013_kg_dead_end.sql：
--   1. 相對門檻的基準也算有 managed_as 的概念（它們現在找得到藥了）
--   2. kin 擴展除了 is_a 上下位，也沿 managed_as 由症狀走到適應症（單向），且優先於 is_a
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
  -- 只收跟「最高分且有接藥（含 managed_as）的概念」差距 0.35 以內的；完全沒有接藥的概念時 greatest 忽略 null，退回 0.25
  select id, label, type, score from scored
  where kind = 'concept'
    and score >= greatest(0.25, (
      select max(s.score) - 0.35 from scored s
      where s.kind = 'concept'
        and exists (select 1 from kg_edges e
                    where (e.target = s.id and e.relation in ('treats', 'in_class'))
                       or (e.source = s.id and e.relation = 'managed_as'))
    ))
  order by score desc limit match_count
),
kin as (
  select distinct on (o.id) o.id, o.label, o.type, h.score * 0.85 as score, h.label as via
  from hits h
  cross join lateral (
    select case when e.source = h.id then e.target else e.source end as other
    from kg_edges e
    where (e.relation = 'is_a' and (e.source = h.id or e.target = h.id))
       or (e.relation = 'managed_as' and e.source = h.id)
    order by e.relation = 'managed_as' desc
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
