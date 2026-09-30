// 收藏資料夾：folders＝自訂資料夾名稱（依建立順序），assign＝藥品 id → 資料夾名稱（沒有就是未分類）。
export interface FavoriteFolders {
  folders: string[];
  assign: Record<string, string>;
}

export const UNFILED = "未分類";
export const EMPTY_FOLDERS: FavoriteFolders = { folders: [], assign: {} };

/** 從儲存或帳號讀回的資料可能是舊格式或被改壞：只留合法的部分，指向不存在資料夾的藥回到未分類。 */
export function normalizeFolders(raw: unknown): FavoriteFolders {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FavoriteFolders>;
  const folders = [...new Set((Array.isArray(r.folders) ? r.folders : [])
    .filter((f): f is string => typeof f === "string" && f.trim() !== "" && f !== UNFILED))];
  const assign: Record<string, string> = {};
  for (const [id, f] of Object.entries(r.assign && typeof r.assign === "object" ? r.assign : {})) {
    if (typeof f === "string" && folders.includes(f)) assign[id] = f;
  }
  return { folders, assign };
}

/** 第一次在這台裝置同步：雲端為主，補上本機多出來的資料夾與雲端沒分類過的藥。 */
export function mergeFolders(remote: FavoriteFolders, local: FavoriteFolders): FavoriteFolders {
  const folders = [...new Set([...remote.folders, ...local.folders])];
  return normalizeFolders({ folders, assign: { ...local.assign, ...remote.assign } });
}
