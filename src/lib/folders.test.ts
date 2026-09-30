/** 收藏資料夾整理規則的自我檢查（無框架）。執行：npm test */
import assert from "node:assert";
import { normalizeFolders, mergeFolders, UNFILED } from "./folders.ts";

assert.deepEqual(normalizeFolders(null), { folders: [], assign: {} }, "空值 → 空資料");
assert.deepEqual(
  normalizeFolders({ folders: ["急診", "急診", "", UNFILED, 3], assign: { A: "急診", B: "不存在", C: 5 } }),
  { folders: ["急診"], assign: { A: "急診" } },
  "去重、去空白與保留字；指向不存在資料夾的藥回到未分類",
);
assert.deepEqual(
  mergeFolders(
    { folders: ["常用"], assign: { A: "常用" } },
    { folders: ["常用", "急診"], assign: { A: "急診", B: "急診" } },
  ),
  { folders: ["常用", "急診"], assign: { A: "常用", B: "急診" } },
  "合併：雲端的分類優先，本機多的資料夾與沒分類過的藥補上",
);

console.log("folders helpers: all assertions passed ✓");
