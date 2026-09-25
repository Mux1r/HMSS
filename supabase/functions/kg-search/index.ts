// 知識圖向量搜尋：查詢字串 → OpenRouter 算向量 → kg_search（見 migrations/*_kg.sql）。
// OpenRouter 金鑰只存在 Supabase secrets（OPENROUTER_API_KEY），不進前端。
import { createClient } from "npm:@supabase/supabase-js@2";

// 必須與 helper kg/embed.py 建庫時用的模型相同，否則向量無法比對。
const EMBED_MODEL = "qwen/qwen3-embedding-8b";
const MAX_QUERY = 200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let q = "";
  try {
    q = String((await req.json())?.q ?? "").trim();
  } catch {
    // 非 JSON 內容 → 視為空查詢
  }
  if (!q || q.length > MAX_QUERY) return json({ error: `q 需為 1–${MAX_QUERY} 字` }, 400);

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
      "X-Title": "HMSS",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: q, encoding_format: "float" }),
  });
  if (!res.ok) return json({ error: `embedding 失敗 ${res.status}` }, 502);
  const vec: number[] | undefined = (await res.json())?.data?.[0]?.embedding;
  if (!vec?.length) return json({ error: "embedding 回傳空值" }, 502);

  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  const { data, error } = await supabase.rpc("kg_search", {
    query_embedding: JSON.stringify(vec.map((x) => x / norm)),
    query_text: q,
    match_count: 12,
  });
  if (error) return json({ error: error.message }, 500);
  return json(data);
});
