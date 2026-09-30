// 共用 Supabase client：藥品資料讀取與 Google 登入（Supabase Auth）共用同一個實例。
// 登入狀態依「記住這台裝置」存 localStorage 或 sessionStorage（見 device.ts）。
import { createClient } from "@supabase/supabase-js";
import { deviceStorage } from "./device";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: deviceStorage,
    },
  },
);
