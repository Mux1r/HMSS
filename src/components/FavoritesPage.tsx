import { useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2, Plus, Pencil, FolderClosed, X } from "lucide-react";
import { cn } from "../lib/utils";
import type { Medication } from "../services/medicationService";
import { UNFILED, type FavoriteFolders } from "../lib/folders";

interface Props {
  theme: "light" | "dark";
  meds: Medication[]; // 已收藏的藥（依收藏順序）
  folders: FavoriteFolders;
  selectedId?: string;
  onOpen: (med: Medication) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onChangeFolders: (next: FavoriteFolders) => void;
  codeStyle: (code: string) => { text: string; bg: string };
}

const MAX_NAME = 20;
const ALL = "__all__";

export default function FavoritesPage({
  theme, meds, folders, selectedId, onOpen, onRemove, onBack, onChangeFolders, codeStyle,
}: Props) {
  const dark = theme === "dark";
  const [folder, setFolder] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  // 建立或改名時的輸入框：mode=null 代表沒在編輯
  const [edit, setEdit] = useState<{ mode: "create" | "rename"; value: string } | null>(null);
  const [error, setError] = useState("");

  const folderOf = (id: string) => folders.assign[id] ?? UNFILED;
  const counts = useMemo(() => {
    const c: Record<string, number> = { [UNFILED]: 0 };
    for (const f of folders.folders) c[f] = 0;
    for (const m of meds) c[folderOf(m.id)] = (c[folderOf(m.id)] ?? 0) + 1;
    return c;
  }, [meds, folders]);

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    return meds.filter((m) => {
      if (folder !== ALL && folderOf(m.id) !== folder) return false;
      if (!q) return true;
      return [m.component, m.code, m.brandName, m.chineseName, m.genericName, m.indications]
        .some((f) => f?.toLowerCase().includes(q));
    });
  }, [meds, folders, folder, query]);

  const submitEdit = () => {
    if (!edit) return;
    const name = edit.value.trim();
    if (!name) return setError("請輸入資料夾名稱");
    if (name.length > MAX_NAME) return setError(`名稱最多 ${MAX_NAME} 個字`);
    if (name === UNFILED || (folders.folders.includes(name) && !(edit.mode === "rename" && name === folder))) {
      return setError("已經有同名的資料夾");
    }
    if (edit.mode === "create") {
      onChangeFolders({ ...folders, folders: [...folders.folders, name] });
    } else {
      const assign = Object.fromEntries(
        Object.entries(folders.assign).map(([id, f]) => [id, f === folder ? name : f]),
      );
      onChangeFolders({ folders: folders.folders.map((f) => (f === folder ? name : f)), assign });
    }
    setFolder(name);
    setEdit(null);
    setError("");
  };

  const deleteFolder = () => {
    if (!window.confirm(`刪除資料夾「${folder}」？裡面的藥不會被刪掉，會移到「未分類」。`)) return;
    const assign = Object.fromEntries(Object.entries(folders.assign).filter(([, f]) => f !== folder));
    onChangeFolders({ folders: folders.folders.filter((f) => f !== folder), assign });
    setFolder(ALL);
  };

  const moveTo = (id: string, target: string) => {
    const assign = { ...folders.assign };
    if (target === UNFILED) delete assign[id];
    else assign[id] = target;
    onChangeFolders({ ...folders, assign });
  };

  const chip = (key: string, label: string, count: number) => (
    <button
      key={key}
      onClick={() => { setFolder(key); setEdit(null); setError(""); }}
      aria-pressed={folder === key}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full border text-xs font-bold transition-colors",
        folder === key
          ? "bg-brand-accent text-white border-brand-accent"
          : dark ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-white/70 border-slate-200 text-slate-700 hover:bg-white",
      )}
    >
      {key !== ALL && key !== UNFILED && <FolderClosed className="w-3.5 h-3.5" />}
      {label}
      <span className="opacity-70 font-mono">{count}</span>
    </button>
  );

  const muted = dark ? "text-zinc-400" : "text-slate-500";
  const isCustom = folder !== ALL && folder !== UNFILED;

  return (
    <div className={cn("absolute inset-0 z-[50] flex flex-col backdrop-blur-xl", dark ? "bg-zinc-950/90 text-white" : "bg-slate-50/95 text-slate-900")}>
      {/* 標題與搜尋 */}
      <div className={cn("shrink-0 px-4 pt-4 pb-3 space-y-3 border-b", dark ? "border-white/10" : "border-slate-200")}>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="返回"
            className={cn("flex items-center gap-1 pl-1 pr-2.5 h-9 rounded-full text-xs font-bold", dark ? "hover:bg-white/10" : "hover:bg-slate-200")}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <h2 className="text-base font-bold">我的收藏</h2>
          <span className={cn("text-xs", muted)}>{meds.length} 個藥品</span>
        </div>
        <label className={cn("flex items-center gap-2 px-3 h-10 rounded-xl border", dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
          <Search className="w-4 h-4 opacity-50 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋收藏的藥名、成分、代碼或適應症"
            aria-label="搜尋收藏"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-50"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="清除搜尋" className="p-1 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </label>

        {/* 資料夾 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {chip(ALL, "全部", meds.length)}
          {chip(UNFILED, UNFILED, counts[UNFILED] ?? 0)}
          {folders.folders.map((f) => chip(f, f, counts[f] ?? 0))}
          <button
            onClick={() => { setEdit({ mode: "create", value: "" }); setError(""); }}
            className={cn("shrink-0 flex items-center gap-1 px-3 h-9 rounded-full border border-dashed text-xs font-bold",
              dark ? "border-white/20 text-zinc-300" : "border-slate-300 text-slate-600")}
          >
            <Plus className="w-3.5 h-3.5" />
            新資料夾
          </button>
        </div>

        {edit ? (
          <form
            onSubmit={(e) => { e.preventDefault(); submitEdit(); }}
            className="space-y-1.5"
          >
            <div className="flex gap-2">
              <input
                autoFocus
                value={edit.value}
                onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                maxLength={MAX_NAME}
                placeholder={edit.mode === "create" ? "新資料夾名稱，例如：急診常用" : "新的名稱"}
                aria-label="資料夾名稱"
                className={cn("flex-1 min-w-0 px-3 h-9 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-brand-accent/40",
                  dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}
              />
              <button type="submit" className="px-3 h-9 rounded-xl bg-brand-accent text-white text-xs font-bold">
                {edit.mode === "create" ? "建立" : "改名"}
              </button>
              <button type="button" onClick={() => { setEdit(null); setError(""); }} className={cn("px-3 h-9 rounded-xl text-xs font-bold", muted)}>
                取消
              </button>
            </div>
            {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          </form>
        ) : isCustom ? (
          <div className="flex gap-3 text-xs font-bold">
            <button onClick={() => setEdit({ mode: "rename", value: folder })} className="flex items-center gap-1 text-brand-accent">
              <Pencil className="w-3.5 h-3.5" /> 重新命名
            </button>
            <button onClick={deleteFolder} className="flex items-center gap-1 text-rose-500">
              <Trash2 className="w-3.5 h-3.5" /> 刪除資料夾
            </button>
          </div>
        ) : null}
      </div>

      {/* 清單 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
        {meds.length === 0 ? (
          <p className={cn("text-center text-sm py-16", muted)}>還沒有收藏。回到主畫面，點藥品旁邊的星星就能加入。</p>
        ) : shown.length === 0 ? (
          <p className={cn("text-center text-sm py-16", muted)}>
            {query ? "沒有符合的收藏" : "這個資料夾還是空的。在其他藥品右邊的選單可以把藥移進來。"}
          </p>
        ) : (
          shown.map((med) => {
            const style = codeStyle(med.code);
            return (
              <div
                key={med.id}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-2xl border transition-colors",
                  selectedId === med.id
                    ? "border-brand-accent/60 bg-brand-accent/10"
                    : dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white/70 border-slate-200 hover:bg-white",
                )}
              >
                <button onClick={() => onOpen(med)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider border border-current/20 shrink-0", style.text, style.bg)}>
                    {med.code}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{med.component || med.brandName}</span>
                    <span className={cn("block text-xs truncate", muted)}>
                      {med.brandName}{med.chineseName ? ` · ${med.chineseName}` : ""}
                    </span>
                  </span>
                </button>
                <select
                  value={folderOf(med.id)}
                  onChange={(e) => moveTo(med.id, e.target.value)}
                  aria-label={`${med.code} 的資料夾`}
                  className={cn("max-w-[7.5rem] h-8 px-2 rounded-lg border text-xs shrink-0",
                    dark ? "bg-zinc-900 border-white/10 text-zinc-200" : "bg-white border-slate-200 text-slate-700")}
                >
                  <option value={UNFILED}>{UNFILED}</option>
                  {folders.folders.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button
                  onClick={() => onRemove(med.id)}
                  aria-label={`把 ${med.code} 移出收藏`}
                  className="p-2 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
