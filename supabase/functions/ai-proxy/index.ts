// 訪客 AI 額度：沒登入、沒自己金鑰的人由這裡轉發到 Groq，用網站的金鑰（Supabase secret GROQ_API_KEY）。
// 每台裝置（前端產生的 x-device-id）每小時：用藥建議 3 次、問題拆解 10 次；全部訪客合計每小時 60 次，保護網站額度。
// 刻意用裝置而非 IP 計算：醫院電腦多半共用同一個對外 IP。清瀏覽器資料可換新裝置 ID，由全站上限兜底。
import { createClient } from "npm:@supabase/supabase-js@2";

// 只允許前端實際用到的兩個模型；kind 決定計次的類別
const RULES: Record<string, { kind: string; perDevice: number; label: string }> = {
  "openai/gpt-oss-120b": { kind: "recommend", perDevice: 3, label: "用藥建議" },
  "openai/gpt-oss-20b": { kind: "decompose", perDevice: 10, label: "問題拆解" },
};
const GLOBAL_PER_HOUR = 60;
const MAX_TOKENS = 5000;
const HOUR = 3600_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Expose-Headers": "retry-after",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// 額度用完時：算出最早一筆滿一小時還要幾秒
function quotaResponse(message: string, oldest: string | undefined) {
  const wait = oldest ? Math.max(60, Math.ceil((new Date(oldest).getTime() + HOUR - Date.now()) / 1000)) : 3600;
  return json({ guest_quota: true, error: { message: `${message}，約 ${Math.ceil(wait / 60)} 分鐘後恢復。登入並設定自己的免費金鑰就不受限制。` } },
    429, { "retry-after": String(wait) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" || !new URL(req.url).pathname.endsWith("/chat/completions")) {
    return json({ error: { message: "只支援 /chat/completions" } }, 404);
  }

  const device = req.headers.get("x-device-id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(device)) return json({ error: { message: "缺少裝置代碼" } }, 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: { message: "內容格式錯誤" } }, 400);
  }
  const rule = RULES[String(body.model)];
  if (!rule) return json({ error: { message: "不支援的模型" } }, 400);

  const since = new Date(Date.now() - HOUR).toISOString();
  const mine = await db.from("ai_guest_usage").select("created_at")
    .eq("device_id", device).eq("kind", rule.kind).gte("created_at", since).order("created_at");
  if (mine.error) return json({ error: { message: `額度查詢失敗：${mine.error.message}` } }, 500);
  if (mine.data.length >= rule.perDevice) {
    return quotaResponse(`訪客每小時可使用 ${rule.perDevice} 次${rule.label}，已經用完`, mine.data[0]?.created_at);
  }
  const all = await db.from("ai_guest_usage").select("created_at")
    .gte("created_at", since).order("created_at").limit(GLOBAL_PER_HOUR);
  if (all.error) return json({ error: { message: `額度查詢失敗：${all.error.message}` } }, 500);
  if (all.data.length >= GLOBAL_PER_HOUR) {
    return quotaResponse("目前使用訪客額度的人太多", all.data[0]?.created_at);
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      max_completion_tokens: Math.min(Number(body.max_completion_tokens) || MAX_TOKENS, MAX_TOKENS),
    }),
  });
  // 只有 Groq 成功受理才計次；失敗（含 Groq 自己的 429）不扣使用者的次數
  if (res.ok) await db.from("ai_guest_usage").insert({ device_id: device, kind: rule.kind });

  const headers: Record<string, string> = { ...CORS, "Content-Type": res.headers.get("content-type") ?? "application/json" };
  const retry = res.headers.get("retry-after");
  if (retry) headers["retry-after"] = retry;
  return new Response(res.body, { status: res.status, headers }); // 串流原樣轉發
});
