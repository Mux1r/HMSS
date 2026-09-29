-- 意見回報：訊息寫進 feedback 表，截圖放 storage 的 feedback 桶（私有）。
-- 任何人（含未登入）都能送出，但沒有人能從網站讀回來；只有管理者在 Supabase 後台看得到。
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 1 and 2000),
  screenshot text,              -- storage 路徑（feedback 桶內），沒附圖為 null
  email text,                   -- 有登入才會帶
  app_version text,
  user_agent text check (char_length(user_agent) <= 300)
);

alter table public.feedback enable row level security;

create policy "anyone can send feedback" on public.feedback
  for insert to anon, authenticated with check (true);

-- 截圖：私有桶，單檔上限 5 MB，只收圖片；只開放上傳，不開放讀取。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "anyone can upload feedback screenshots" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'feedback');
