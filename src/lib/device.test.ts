/**
 * 公用電腦模式的清理判斷自我檢查（無框架）。執行：npm test
 * 用 Map 假裝瀏覽器的 localStorage / sessionStorage / 網址。
 */
import assert from "node:assert";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  keys() { return [...this.m.keys()]; }
}
const local = new MemStorage();
const session = new MemStorage();
// Object.keys(storage) 在瀏覽器會列出所有鍵；用 Proxy 模擬
const asStorage = (s: MemStorage) =>
  new Proxy(s, { ownKeys: () => s.keys(), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
const g = globalThis as any;
g.localStorage = asStorage(local);
g.sessionStorage = asStorage(session);
g.window = { location: { search: "" } };

const { consumeStaleEphemeral, markEphemeralAccount } = await import("./device.ts");
const reset = (search = "") => { local.clear(); session.clear(); g.window.location.search = search; };

reset();
assert.equal(consumeStaleEphemeral(), false, "沒用過公用電腦模式：不清");

reset();
markEphemeralAccount(true);
assert.equal(consumeStaleEphemeral(), true, "公用電腦模式、分頁已無登入資料：上一位沒登出，要清");
assert.equal(consumeStaleEphemeral(), false, "清過一次就不會再清");

reset();
markEphemeralAccount(true);
session.setItem("sb-abc-auth-token", "{}");
assert.equal(consumeStaleEphemeral(), false, "同一個分頁還在登入中（例如重新整理）：不清");

reset("?code=xyz");
markEphemeralAccount(true);
assert.equal(consumeStaleEphemeral(), false, "剛從 Google 登入回來、還沒換到登入資料：不清");

console.log("device helpers: all assertions passed ✓");
