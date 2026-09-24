/**
 * 純函式自我檢查。執行：npm test
 */
import assert from "node:assert";
import { parseRetryAfter } from "./groq.ts";

assert.equal(parseRetryAfter("12", ""), 12, "retry-after 標頭優先");
assert.equal(parseRetryAfter(null, "Please try again in 7.5s. Need more tokens?"), 8, "秒數無條件進位");
assert.equal(parseRetryAfter(null, "Please try again in 1m23.4s"), 84, "分＋秒");
assert.equal(parseRetryAfter(null, "Please try again in 2h3m"), 7380, "時＋分");
assert.equal(parseRetryAfter(null, "Please try again in 250ms"), 1, "毫秒");
assert.equal(parseRetryAfter(null, "unknown"), 20, "無法解析時預設 20 秒");

console.log("groq helpers: all assertions passed ✓");
