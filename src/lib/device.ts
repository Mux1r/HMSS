// 「記住這台裝置」：登入時由使用者二選一（公用電腦／個人裝置）。
//   "1"＝個人裝置：登入狀態與 AI 金鑰存 localStorage，一直保持登入。
//   其他＝公用電腦或未登入：只存 sessionStorage，關掉分頁就消失。
// 獨立成檔，讓 groq.ts 不必引入 Supabase client（自我檢查在 Node 裡跑）。
const REMEMBER_KEY = "hmss_remember_device";

function safeGet(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}

// 舊版登入一律存 localStorage：已經登入的裝置視為個人裝置，升級後不會被登出。
try {
  if (localStorage.getItem(REMEMBER_KEY) === null &&
      Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))) {
    localStorage.setItem(REMEMBER_KEY, "1");
  }
} catch {}

export function isDeviceRemembered(): boolean {
  return safeGet(() => localStorage, REMEMBER_KEY) === "1";
}

export function setDeviceRemembered(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {}
}

// 公用電腦模式登入中的標記：正常登出會清掉；若關分頁／關瀏覽器沒登出，下次開啟時據此清掉上一位留下的資料。
const EPHEMERAL_KEY = "hmss_ephemeral_account";

export function markEphemeralAccount(on: boolean) {
  try {
    if (on) localStorage.setItem(EPHEMERAL_KEY, "1");
    else localStorage.removeItem(EPHEMERAL_KEY);
  } catch {}
}

/**
 * 開啟時同步判斷：上次是公用電腦模式登入、這個分頁已沒有登入資料、也不是剛從 Google 登入回來
 * ＝上一位沒正常登出。回傳 true 並清掉標記，由呼叫端清收藏與 AI 紀錄。只在啟動時呼叫一次。
 */
export function consumeStaleEphemeral(): boolean {
  try {
    if (localStorage.getItem(EPHEMERAL_KEY) !== "1") return false;
    const hasSession = Object.keys(sessionStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    const returningFromLogin = new URLSearchParams(window.location.search).has("code");
    if (hasSession || returningFromLogin) return false;
    localStorage.removeItem(EPHEMERAL_KEY);
    return true;
  } catch {
    return false;
  }
}

const pick = () => (isDeviceRemembered() ? localStorage : sessionStorage);

/** 依「記住這台裝置」決定存哪裡；讀取時兩邊都看，移除兩邊都清。 */
export const deviceStorage = {
  getItem: (key: string) => safeGet(pick, key) ?? safeGet(() => localStorage, key),
  setItem: (key: string, value: string) => {
    try {
      pick().setItem(key, value);
    } catch {}
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  },
};
