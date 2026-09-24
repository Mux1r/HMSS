// Google 登入（Supabase Auth）與收藏跨裝置同步（user_favorites 資料表，RLS 限本人讀寫）。

import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type { User };

/** 訂閱登入狀態；回傳取消訂閱函式。 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
    // OAuth 回跳後網址帶 ?code=，登入完成即清掉，避免重新整理時重複交換。
    if (session && new URLSearchParams(window.location.search).has("code")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  });
  return () => data.subscription.unsubscribe();
}

/** Supabase 專案是否已啟用 Google 登入（公開的 /auth/v1/settings）。 */
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
    });
    if (!res.ok) return true; // 無法確認時照常嘗試，交由 Supabase 回報
    const data = await res.json();
    return !!data?.external?.google;
  } catch {
    return true;
  }
}

/** 導向 Google 登入，完成後回到目前頁面。 */
export async function signInWithGoogle(): Promise<void> {
  if (!(await isGoogleEnabled())) {
    throw new Error("Google 登入尚未啟用，請管理員於 Supabase 開啟 Google 登入");
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 讀取雲端收藏；尚無資料回傳 null。 */
export async function fetchRemoteFavorites(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("favorites")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.favorites as string[]) : null;
}

export async function pushRemoteFavorites(userId: string, favorites: string[]): Promise<void> {
  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: userId, favorites, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** 聯集合併（雲端順序在前，本機新增的接在後），不重複。 */
export function mergeFavorites(remote: string[], local: string[]): string[] {
  return [...new Set([...remote, ...local])];
}

// 這台裝置是否已與該帳號同步過：第一次同步時合併本機收藏，之後以雲端為準（刪除才能跨裝置生效）。
const syncedFlag = (userId: string) => `hmss_fav_synced_${userId}`;
export function hasSyncedOnDevice(userId: string): boolean {
  try {
    return localStorage.getItem(syncedFlag(userId)) === "1";
  } catch {
    return false;
  }
}
export function markSyncedOnDevice(userId: string) {
  try {
    localStorage.setItem(syncedFlag(userId), "1");
  } catch {}
}
