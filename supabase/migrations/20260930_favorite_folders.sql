-- 收藏資料夾：{"folders": ["急診常用", ...], "assign": {"藥品id": "資料夾名稱"}}。
-- 沿用 user_data 既有的 RLS（只有本人能讀寫自己那一列）。沒加這欄時網站照常運作，資料夾只存在該裝置。
alter table public.user_data add column if not exists favorite_folders jsonb;
