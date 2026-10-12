/**
 * 純資料自我檢查（無框架）。執行：npm test
 * 守住 ATC 前綴表的格式，避免空字串前綴（會 startsWith 命中全部藥）或小寫/畸形碼悄悄失效。
 */
import assert from "node:assert";
import { MECHANISM_ATC, MEDICAL_ALIASES, SYMPTOM_TERMS, isOppositeLevel, isSymptomQuery, kgQueryText, mechanismKey } from "./medicalKeywords.ts";

const ATC_PREFIX = /^[A-Z]\d{2}[A-Z]{0,2}\d{0,2}$/; // 例 C09A, C10AA, C09DX04

for (const [key, prefixes] of Object.entries(MECHANISM_ATC)) {
  assert.ok(prefixes.length > 0, `${key} 前綴不可為空陣列`);
  for (const p of prefixes) {
    assert.ok(p.length >= 3, `${key} 前綴「${p}」過短，恐命中過廣`);
    assert.ok(ATC_PREFIX.test(p), `${key} 前綴「${p}」格式不符 ATC（需大寫、如 C09A）`);
  }
}

// 兩張表的鍵不應衝突（同一縮寫落在兩套比對邏輯會重複計分）
for (const key of Object.keys(MECHANISM_ATC)) {
  assert.ok(!(key in MEDICAL_ALIASES), `${key} 同時存在於兩張表，請擇一`);
}

// 常見寫法都要對到同一組藥
for (const q of ["Cox 2", "COX-2", "cox2", "COX-2 inhibitors", "cox 2 inhibitor", "Coxib"]) {
  assert.deepEqual(MECHANISM_ATC[mechanismKey(q)], ["M01AH"], `「${q}」應對到 COX-2 抑制劑`);
}
assert.equal(mechanismKey("SGLT2 inhibitor"), "sglt2i");
for (const [q, key] of [["5-ARI", "5ari"], ["PDE5 inhibitor", "pde5i"], ["P2Y12 inhibitors", "p2y12i"], ["TMP-SMX", "tmpsmx"], ["5-HT3 RA", "5ht3ra"], ["JAK inhibitor", "jaki"]]) {
  assert.equal(mechanismKey(q), key, `「${q}」應整理成 ${key}`);
  assert.ok(MECHANISM_ATC[key], `${key} 應在縮寫表內`);
}

// 症狀詞表：不可有空字串（會命中所有查詢）、單字（太廣）或重複
assert.equal(new Set(SYMPTOM_TERMS).size, SYMPTOM_TERMS.length, "SYMPTOM_TERMS 有重複詞");
for (const t of SYMPTOM_TERMS) assert.ok(t.trim().length >= 2, `症狀詞「${t}」過短`);
for (const q of ["喉嚨痛", "偏頭痛", "我頭痛", "拉肚子", "感冒"]) assert.ok(isSymptomQuery(q), `「${q}」應為症狀查詢`);
for (const q of ["Panadol", "PPI", "普拿疼", "痛", ""]) assert.ok(!isSymptomQuery(q), `「${q}」不應為症狀查詢`);

// 症狀 → 適應症用詞
assert.equal(kgQueryText("抽搐"), "抽搐 癲癇");
assert.equal(kgQueryText("病人發燒咳嗽"), "病人發燒咳嗽 解熱 退燒 鎮咳");
assert.equal(kgQueryText("喉嚨痛"), "喉嚨痛");
// 高低方向
assert.ok(isOppositeLevel("低血鉀", "高血鉀症"));
assert.ok(isOppositeLevel("高血鉀", "低鉀血症"));
assert.ok(isOppositeLevel("低血糖", "高血糖"));
assert.ok(!isOppositeLevel("低血鉀", "鉀缺乏症"));
assert.ok(!isOppositeLevel("降低血壓", "高血壓"), "降低血壓要的是高血壓藥");
assert.ok(!isOppositeLevel("喉嚨痛", "高血壓"));

console.log("medicalKeywords data: all assertions passed ✓");
