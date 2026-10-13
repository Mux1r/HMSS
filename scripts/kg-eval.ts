/**
 * 圖譜症狀查詢考題：值班常見症狀 → 應該出現的院內藥（以成分名比對）。
 * 改圖譜（helper 的 kg/）、改 kg_search SQL、改前端查詢字串之後跑一次，看有沒有哪題變差。
 *
 * 執行：npm run eval:kg   （要連線，打線上的 kg-search 和 medications 表，讀 .env 的 VITE_SUPABASE_*）
 *
 * 判定：expect 每個成分都要在前 TOP 名內（同分算同名次，不受劑型排序影響）；avoid 的成分一個都不能出現。
 * 排名只看圖譜分數，模擬 App 圖譜命中那一層；App 另外加的字面比對分數不算在內。
 */
import { readFileSync } from "node:fs";
import { isOppositeLevel, kgRequestText } from "../src/lib/medicalKeywords.ts";

const TOP = 20;

// expect / avoid 都是成分名（generic_name 或 component 的小寫片段），只放院內有的藥。
const CASES: { q: string; expect: string[]; avoid?: string[] }[] = [
  // 疼痛、發燒
  { q: "喉嚨痛", expect: ["benzydamine", "acetaminophen", "ibuprofen"], avoid: ["vaccine"] },
  { q: "發燒", expect: ["acetaminophen", "ibuprofen"] },
  { q: "頭痛", expect: ["acetaminophen", "ibuprofen"] },
  { q: "疼痛", expect: ["acetaminophen", "tramadol", "morphine"] },
  { q: "神經痛", expect: ["gabapentin", "pregabalin"] },
  { q: "痛風", expect: ["colchicine"] },
  // 心血管
  { q: "胸痛", expect: ["nitroglycerin", "isosorbide"] },
  { q: "心悸", expect: ["amiodarone", "digoxin"] },
  { q: "高血壓", expect: ["nifedipine", "labetalol", "captopril"] },
  { q: "低血壓", expect: ["norepinephrine", "dopamine"] },
  { q: "心跳過慢", expect: ["atropine"] },
  { q: "水腫", expect: ["furosemide"] },
  // 神經、精神
  { q: "抽搐", expect: ["levetiracetam", "phenytoin"] },
  { q: "頭暈", expect: ["betahistine", "meclizine"] },
  { q: "失眠", expect: ["zolpidem"] },
  { q: "焦慮", expect: ["alprazolam", "lorazepam"] },
  { q: "譫妄", expect: ["haloperidol", "quetiapine"] },
  { q: "躁動", expect: ["haloperidol", "olanzapine"] },
  // 腸胃
  { q: "胃痛", expect: ["pantoprazole", "famotidine"] },
  { q: "胃食道逆流", expect: ["pantoprazole", "esomeprazole"] },
  { q: "噁心", expect: ["metoclopramide", "ondansetron"] },
  { q: "嘔吐", expect: ["metoclopramide", "ondansetron"] },
  { q: "腹瀉", expect: ["loperamide"] },
  { q: "便秘", expect: ["sennoside", "bisacodyl", "magnesium oxide", "lactulose"] },
  { q: "脹氣", expect: ["simethicone"] },
  // 呼吸道、過敏
  { q: "咳嗽", expect: ["dextromethorphan", "codeine"] },
  { q: "有痰", expect: ["acetylcysteine", "ambroxol"] },
  { q: "氣喘", expect: ["salbutamol", "ipratropium", "budesonide"] },
  { q: "鼻塞", expect: ["cetirizine", "loratadine"] },
  { q: "搔癢", expect: ["cetirizine", "chlorpheniramine"] },
  { q: "蕁麻疹", expect: ["cetirizine"] },
  { q: "過敏反應", expect: ["epinephrine", "hydrocortisone"] },
  { q: "流感", expect: ["oseltamivir"] },
  // 代謝、電解質
  { q: "低血糖", expect: ["glucagon", "dextrose"] },
  { q: "高血糖", expect: ["insulin"] },
  { q: "低血鉀", expect: ["potassium chloride"], avoid: ["polystyrene"] },
  { q: "高血鉀", expect: ["polystyrene", "calcium gluconate"], avoid: ["potassium chloride"] },
  { q: "低血鎂", expect: ["magnesium sulfate"] },
  { q: "代謝性酸中毒", expect: ["sodium bicarbonate"] },
  // 其他
  { q: "尿滯留", expect: ["bethanechol", "tamsulosin"] },
  { q: "嗎啡過量", expect: ["naloxone"] },
  { q: "疥瘡", expect: ["permethrin"] },
];

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
);
const URL_ = env.VITE_SUPABASE_URL;
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };

// 藥品編碼 → 成分字串（medications 表一次最多回 1000 筆，要分頁）
const names: Record<string, string> = {};
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(`${URL_}/rest/v1/medications?select=id,generic_name,component&order=id&offset=${offset}&limit=1000`, { headers });
  if (!res.ok) throw new Error(`讀 medications 失敗 ${res.status}`);
  const rows: { id: string; generic_name: string | null; component: string | null }[] = await res.json();
  for (const r of rows) names[r.id.trim().toUpperCase()] = `${r.generic_name || ""} ${r.component || ""}`.toLowerCase();
  if (rows.length < 1000) break;
}

/** 同 medicationService.searchKg：送出共用查詢字串、濾掉高低相反的概念、有連結就只用連結。 */
async function search(q: string): Promise<Record<string, number>> {
  const res = await fetch(`${URL_}/functions/v1/kg-search`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ q: kgRequestText(q) }),
  });
  if (!res.ok) throw new Error(`kg-search「${q}」失敗 ${res.status}`);
  const data = await res.json();
  const links = (data.links || []).filter((l: { concept: string }) => !isOppositeLevel(q, l.concept));
  const direct: { code: string; score: number }[] = data.drugs || [];
  const top = Math.max(0, ...direct.map((d) => d.score));
  const picked = links.length > 0 ? links : direct.filter((d) => d.score >= top - 0.1);
  const hits: Record<string, number> = {};
  for (const { code, score } of picked) {
    const k = String(code || "").trim().toUpperCase();
    if (k && !(hits[k] >= score)) hits[k] = score;
  }
  return hits;
}

// 同時打太多會被 Edge Function 限流，一次 6 題
const results: { q: string; ok: boolean; line: string }[] = [];
for (let i = 0; i < CASES.length; i += 6) {
  results.push(...(await Promise.all(CASES.slice(i, i + 6).map(async ({ q, expect, avoid = [] }) => {
    const hits = await search(q);
    const scores = Object.values(hits);
    const rankOf = (ing: string) => {
      const best = Math.max(-1, ...Object.entries(hits).filter(([c]) => names[c]?.includes(ing)).map(([, s]) => s));
      return best < 0 ? null : 1 + scores.filter((s) => s > best).length; // 同分同名次
    };
    const parts = expect.map((ing) => ({ ing, rank: rankOf(ing) }));
    const bad = avoid.filter((ing) => rankOf(ing) !== null);
    const ok = parts.every((p) => p.rank !== null && p.rank <= TOP) && bad.length === 0;
    const line = parts.map((p) => `${p.ing} ${p.rank === null ? "✗" : "#" + p.rank}`).join("、")
      + (bad.length ? `｜不該出現：${bad.join("、")}` : "");
    return { q, ok, line: `${String(Object.keys(hits).length).padStart(3)} 顆｜${line}` };
  }))));
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.q.padEnd(6, "　")}${r.line}`);
const pass = results.filter((r) => r.ok).length;
console.log(`\n通過 ${pass}/${results.length}（每題的藥都要在前 ${TOP} 名、且沒有不該出現的藥）`);
