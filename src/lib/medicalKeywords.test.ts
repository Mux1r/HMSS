/**
 * 純資料自我檢查（無框架）。執行：npm test
 * 守住 ATC 前綴表的格式，避免空字串前綴（會 startsWith 命中全部藥）或小寫/畸形碼悄悄失效。
 */
import assert from "node:assert";
import { MECHANISM_ATC, MEDICAL_ALIASES } from "./medicalKeywords.ts";

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

console.log("medicalKeywords data: all assertions passed ✓");
