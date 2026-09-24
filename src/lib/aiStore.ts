// AI 諮詢紀錄與用藥建議快取：存於 IndexedDB，重新整理或自動更新後仍保留。

import { get, set } from "idb-keyval";

const HISTORY_KEY = "hmss_ai_history_v1";
const CACHE_KEY = "hmss_ai_recommend_cache_v1";
const CACHE_LIMIT = 30;

export async function loadAiHistory<T>(): Promise<T[]> {
  try {
    const stored = await get(HISTORY_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function saveAiHistory<T>(items: T[]) {
  set(HISTORY_KEY, items).catch(() => {});
}

// 用藥建議快取（同一描述＋問題＋安全資訊不重打 API）；保留最近 CACHE_LIMIT 筆。
class RecommendationCache {
  private map = new Map<string, string>();

  constructor() {
    get(CACHE_KEY)
      .then((entries) => {
        if (!Array.isArray(entries)) return;
        // 啟動期間已寫入的新結果優先，不被舊資料覆蓋。
        for (const [k, v] of entries) if (!this.map.has(k)) this.map.set(k, v);
      })
      .catch(() => {});
  }

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  set(key: string, value: string) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > CACHE_LIMIT) {
      this.map.delete(this.map.keys().next().value as string);
    }
    set(CACHE_KEY, [...this.map]).catch(() => {});
  }
}

export const aiRecommendCache = new RecommendationCache();
