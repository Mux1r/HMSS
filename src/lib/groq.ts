// Groq 呼叫：使用者自備的免費金鑰，瀏覽器直連 api.groq.com（官方允許 CORS）。
// 金鑰只存在本機 localStorage，不經過任何 HMSS 後端。

// llama-3.3-70b-versatile 已於 2026-08-16 被 Groq 下架，改用官方建議替代模型。
// 用藥建議（準確度優先）用 120B；問題拆解等輕量任務用 20B。
// Groq 免費額度按模型分開計算，分流可降低撞到每分鐘上限的機率。
export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_MODEL_FAST = "openai/gpt-oss-20b";
export const GROQ_KEYS_URL = "https://console.groq.com/keys";

const API_BASE = "https://api.groq.com/openai/v1";
const KEY_STORAGE = "hmss_groq_api_key";

// 金鑰缺漏或失效 —— 呼叫端據此開啟金鑰設定引導，而非當一般錯誤重試。
export class GroqKeyError extends Error {}

// 免費額度暫時用盡（HTTP 429）。retryAfter＝Groq 建議的等待秒數。
export class GroqRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("AI 免費額度暫時用盡");
    this.retryAfter = retryAfter;
  }
}

// Groq 429 訊息格式如「Please try again in 7.5s」「in 1m23.4s」「in 2h3m」。
export function parseRetryAfter(header: string | null, message: string): number {
  const h = Number(header);
  if (header && Number.isFinite(h) && h > 0) return Math.ceil(h);
  if (/try again in\s+[\d.]+ms/i.test(message)) return 1;
  const m = message.match(/try again in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i);
  if (m && (m[1] || m[2] || m[3])) {
    return Math.ceil(Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0));
  }
  return 20;
}

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
  if (res.status === 429) {
    throw new GroqRateLimitError(parseRetryAfter(res.headers.get("retry-after"), await readError(res)));
  }
  // 訊息保留狀態碼，讓 retryWithBackoff 能辨識 503 等暫時性錯誤。
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

/**
 * 串流呼叫：每收到一段內容就以「目前累積全文」呼叫 onText，結束時回傳全文。
 * Groq 以 SSE 傳送（data: {...}\n\n，結尾 data: [DONE]）。
 */
export async function groqChatStream(
  key: string,
  body: Record<string, any>,
  onText: (full: string) => void,
): Promise<string> {
  const res = await request(key, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.body) throw new Error("AI 服務未回傳內容");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!line.trim().startsWith("data:") || !data || data === "[DONE]") continue;
      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk?.error) throw new Error(`AI 服務錯誤: ${chunk.error.message || JSON.stringify(chunk.error)}`);
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        onText(full);
      }
    }
  }
  return full;
}
