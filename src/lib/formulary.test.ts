/**
 * 純函式自我檢查（無框架）。執行：npm test
 * Node 24 原生支援 TS 型別剝離，可直接 node 執行。
 */
import assert from "node:assert";
import {
  atcMatches,
  looksLikeAtc,
  parseDrugLine,
  isPediatricContext,
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

// --- parseDrugLine ---
const isRoute = (s: string) => ["口服", "針劑", "外用", "吸入", "眼用"].includes(s);

const four = parseDrugLine("Acetaminophen(乙醯胺酚) | 口服 | N02BE01 | 退燒首選", isRoute);
assert.equal(four.ingredient, "Acetaminophen(乙醯胺酚)");
assert.equal(four.route, "口服");
assert.equal(four.atc, "N02BE01");
assert.equal(four.reason, "退燒首選");

// 三欄（AI 漏給 ATC）：仍能解析途徑與理由
const three = parseDrugLine("Amlodipine(脈優) | 口服 | 降血壓控制", isRoute);
assert.equal(three.ingredient, "Amlodipine(脈優)");
assert.equal(three.route, "口服");
assert.equal(three.atc, "");
assert.equal(three.reason, "降血壓控制");

// 行首編號去除
const numbered = parseDrugLine("1. Metformin | 口服 | A10BA02 | 第一線", isRoute);
assert.equal(numbered.ingredient, "Metformin");
assert.equal(numbered.atc, "A10BA02");

// --- isPediatricContext ---
assert.equal(isPediatricContext("3歲男童發燒"), true, "幼齡");
assert.equal(isPediatricContext("小兒咳嗽"), true, "兒科關鍵字");
assert.equal(isPediatricContext("6個月大嬰兒"), true, "月大");
assert.equal(isPediatricContext("65歲高血壓"), false, "高齡非兒科");
assert.equal(isPediatricContext("成人發燒"), false, "成人");

console.log("formulary helpers: all assertions passed ✓");
