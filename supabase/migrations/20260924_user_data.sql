-- 使用者資料（Google 登入後綁定帳號、跨裝置同步）：收藏與 Groq AI 金鑰。每位使用者一列。
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorites text[] not null default '{}',
  groq_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- 只能讀寫自己的那一列。
create policy "read own data" on public.user_data
  for select using (auth.uid() = user_id);
create policy "insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "update own data" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
