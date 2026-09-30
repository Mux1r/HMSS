-- 訪客 AI 額度的使用紀錄（Edge Function ai-proxy 以 service role 讀寫）。
-- 只記裝置代碼、類別與時間，不記查詢內容。刻意不開任何 policy：網站前端讀寫不到。
create table if not exists public.ai_guest_usage (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  kind text not null check (kind in ('recommend', 'decompose')),
  created_at timestamptz not null default now()
);
create index if not exists ai_guest_usage_device on public.ai_guest_usage (device_id, kind, created_at);
create index if not exists ai_guest_usage_time on public.ai_guest_usage (created_at);

alter table public.ai_guest_usage enable row level security;
