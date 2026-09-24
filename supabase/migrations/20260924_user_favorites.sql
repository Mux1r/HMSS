-- 使用者收藏（Google 登入後跨裝置同步）。每位使用者一列，收藏為藥物 id 陣列。
create table if not exists public.user_favorites (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorites text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_favorites enable row level security;

-- 只能讀寫自己的那一列。
create policy "read own favorites" on public.user_favorites
  for select using (auth.uid() = user_id);
create policy "insert own favorites" on public.user_favorites
  for insert with check (auth.uid() = user_id);
create policy "update own favorites" on public.user_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
