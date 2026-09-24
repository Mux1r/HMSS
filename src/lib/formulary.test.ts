/**
 * 純函式自我檢查（無框架）。執行：npm test
 * Node 24 原生支援 TS 型別剝離，可直接 node 執行。
 */
import assert from "node:assert";
import {
  atcMatches,
  looksLikeAtc,
  isPediatricContext,
  normalizeIngredient,
  ingredientMatches,
  parseRecommendation,
} from "./formulary.ts";

// --- atcMatches ---
assert.equal(atcMatches("N02BE01", "N02BE01"), true, "精確相等");
assert.equal(atcMatches("N02BE01N02AJ13", "N02BE01"), true, "合併製劑多碼包含");
assert.equal(atcMatches("D10", "N02BE01"), false, "完全不同");
assert.equal(atcMatches("N02BE01", "N02"), false, "AI 碼太短(<5)不前綴比對");
assert.equal(atcMatches("", "N02BE01"), false, "院內無碼");

// --- looksLikeAtc ---
assert.equal(looksLikeAtc("N02BE01"), true);
assert.equal(looksLikeAtc("D10"), true);
assert.equal(looksLikeAtc("口服"), false);
assert.equal(looksLikeAtc("Acetaminophen"), false);

// --- normalizeIngredient / ingredientMatches ---
assert.equal(normalizeIngredient("Metformin HCl"), "metformin", "去鹽類");
assert.equal(normalizeIngredient("Amlodipine(脈優)"), "amlodipine", "去括號註記");
assert.equal(normalizeIngredient("Valproic acid"), "valproate", "-ic acid → -ate");
assert.equal(normalizeIngredient("Paracetamol"), "acetaminophen", "INN → 標準名");
assert.equal(normalizeIngredient("Co-amoxiclav"), "amoxicillin clavulanate", "複方別名");
assert.equal(normalizeIngredient("Sodium Chloride"), "sodium chloride", "去鹽後為空則保留");
assert.equal(normalizeIngredient("Metformin 500 mg"), "metformin", "去劑量");
assert.equal(normalizeIngredient("Vitamin K1"), "phytonadione", "字母後數字保留");

assert.equal(ingredientMatches(["Amoxicillin + Clavulanic acid"], "Amoxicillin/Clavulanate"), true, "複方寫法不同");
assert.equal(ingredientMatches(["Salbutamol sulfate"], "Albuterol"), true, "USAN ↔ INN");
assert.equal(ingredientMatches(["Metformin Hydrochloride"], "Metformin"), true, "鹽類不同");
assert.equal(ingredientMatches(["Sodium Chloride 0.9%"], "Sodium chloride"), true, "純鹽類成分");
assert.equal(ingredientMatches(["Hydralazine"], "Hydroxyzine"), false, "名稱相近但不同藥");
assert.equal(ingredientMatches(["Amlodipine"], "Nifedipine"), false, "同類不同藥");
assert.equal(ingredientMatches([undefined, ""], "Metformin"), false, "空欄位");

// --- parseRecommendation ---
const ndjson = [
  '```json',
  '{"type":"summary","text":"整體策略"}',
  '{"type":"problem","name":"高血壓"}',
  '{"type":"drug","name":"Amlodipine","zh":"脈優","route":"口服","atc":"c08ca01","tier":"首選","reason":"CCB"},',
  '{"type":"drug","name":"Losartan","route":"口服","atc":"N/A","tier":"替代","reason":"ARB"}',
  '{"type":"problem","name":"脂肪肝"}',
  '{"type":"advice","text":"減重與飲食控制"}',
  '{"type":"drug","name":"Metfor',
].join("\n");
const rec = parseRecommendation(ndjson);
assert.deepEqual(rec.summary, ["整體策略"]);
assert.equal(rec.groups.length, 2);
assert.equal(rec.groups[0].problem, "高血壓");
assert.equal(rec.groups[0].drugs.length, 2);
assert.equal(rec.groups[0].drugs[0].atc, "C08CA01", "ATC 轉大寫");
assert.equal(rec.groups[0].drugs[0].zh, "脈優");
assert.equal(rec.groups[0].drugs[1].atc, "", "非 ATC 樣式清空");
assert.equal(rec.groups[0].drugs[1].tier, "替代");
assert.deepEqual(rec.groups[1].advice, ["減重與飲食控制"]);
assert.equal(rec.groups[1].drugs.length, 0, "串流中未完成的行略過");
assert.equal(parseRecommendation('{"type":"drug","name":"X"}').groups[0].problem, "整體建議", "無問題時歸入整體建議");

// --- isPediatricContext ---
assert.equal(isPediatricContext("3歲男童發燒"), true, "幼齡");
assert.equal(isPediatricContext("小兒咳嗽"), true, "兒科關鍵字");
assert.equal(isPediatricContext("6個月大嬰兒"), true, "月大");
assert.equal(isPediatricContext("65歲高血壓"), false, "高齡非兒科");
assert.equal(isPediatricContext("成人發燒"), false, "成人");

console.log("formulary helpers: all assertions passed ✓");
