// Groq 呼叫：使用者自備的免費金鑰，瀏覽器直連 api.groq.com（官方允許 CORS）。
// 金鑰只存在本機 localStorage，不經過任何 HMSS 後端。

// llama-3.3-70b-versatile 已於 2026-08-16 被 Groq 下架，改用官方建議替代模型。
export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_KEYS_URL = "https://console.groq.com/keys";

const API_BASE = "https://api.groq.com/openai/v1";
const KEY_STORAGE = "hmss_groq_api_key";

// 金鑰缺漏或失效 —— 呼叫端據此開啟金鑰設定引導，而非當一般錯誤重試。
export class GroqKeyError extends Error {}

export function loadGroqKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function saveGroqKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {}
}

export function clearGroqKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

async function request(key: string, path: string, init: RequestInit = {}): Promise<Response> {
  if (!key) throw new GroqKeyError("尚未設定 AI 金鑰");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new GroqKeyError("AI 金鑰無效或已被刪除，請重新設定");
  }
  // 訊息保留狀態碼，讓 retryWithBackoff 能辨識 429/503 等暫時性錯誤。
  if (!res.ok) throw new Error(`AI 服務錯誤 ${res.status}: ${await readError(res)}`);
  return res;
}

export async function verifyGroqKey(key: string): Promise<void> {
  await request(key, "/models");
}

export async function groqChat(key: string, body: Record<string, any>): Promise<any> {
  const res = await request(key, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({ ...body, stream: false }),
  });
  return res.json();
}
