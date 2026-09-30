import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2, Plus, Pencil, FolderClosed, X, PanelLeftClose, PanelLeftOpen, Check } from "lucide-react";
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
const SIDEBAR_KEY = "hmss_fav_sidebar_open";

// 資料夾欄預設：記住上次的開合；沒記錄時手機收起、電腦展開
function initialSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) return saved === "1";
  } catch {}
  return window.innerWidth >= 768;
}

export default function FavoritesPage({
  theme, meds, folders, selectedId, onOpen, onRemove, onBack, onChangeFolders, codeStyle,
}: Props) {
  const dark = theme === "dark";
  const muted = dark ? "text-zinc-400" : "text-slate-500";
  const [folder, setFolder] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [editing, setEditing] = useState(false);
  // 新增或改名中的資料夾：target＝要改名的原名稱，null＝新增
  const [draft, setDraft] = useState<{ target: string | null; value: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
    } catch {}
  }, [sidebarOpen]);

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

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.value.trim();
    if (!name) return setError("請輸入資料夾名稱");
    if (name.length > MAX_NAME) return setError(`名稱最多 ${MAX_NAME} 個字`);
    if (name === UNFILED || (folders.folders.includes(name) && name !== draft.target)) {
      return setError("已經有同名的資料夾");
    }
    if (draft.target === null) {
      onChangeFolders({ ...folders, folders: [...folders.folders, name] });
    } else {
      const old = draft.target;
      const assign = Object.fromEntries(Object.entries(folders.assign).map(([id, f]) => [id, f === old ? name : f]));
      onChangeFolders({ folders: folders.folders.map((f) => (f === old ? name : f)), assign });
      if (folder === old) setFolder(name);
    }
    setDraft(null);
    setError("");
  };

  const deleteFolder = (name: string) => {
    if (!window.confirm(`刪除資料夾「${name}」？裡面的藥不會被刪掉，會移到「未分類」。`)) return;
    const assign = Object.fromEntries(Object.entries(folders.assign).filter(([, f]) => f !== name));
    onChangeFolders({ folders: folders.folders.filter((f) => f !== name), assign });
    if (folder === name) setFolder(ALL);
  };

  const moveTo = (id: string, target: string) => {
    const assign = { ...folders.assign };
    if (target === UNFILED) delete assign[id];
    else assign[id] = target;
    onChangeFolders({ ...folders, assign });
  };

  const draftInput = (
    <form onSubmit={(e) => { e.preventDefault(); saveDraft(); }} className="space-y-1">
      <div className="flex gap-1">
        <input
          autoFocus
          value={draft?.value ?? ""}
          onChange={(e) => setDraft(draft && { ...draft, value: e.target.value })}
          maxLength={MAX_NAME}
          placeholder="資料夾名稱"
          aria-label="資料夾名稱"
          className={cn("flex-1 min-w-0 px-2 h-8 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-brand-accent/40",
            dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}
        />
        <button type="submit" aria-label="儲存" className="px-2 h-8 rounded-lg bg-brand-accent text-white">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" aria-label="取消" onClick={() => { setDraft(null); setError(""); }} className={cn("px-1.5 h-8", muted)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-500">{error}</p>}
    </form>
  );

  const folderRow = (key: string, label: string, count: number, custom: boolean) => {
    if (draft?.target === key) return <li key={key}>{draftInput}</li>;
    return (
      <li key={key} className="flex items-center gap-1">
        <button
          onClick={() => {
            setFolder(key);
            if (!editing && window.innerWidth < 768) setSidebarOpen(false); // 手機：選好就收起抽屜
          }}
          aria-current={folder === key ? "true" : undefined}
          className={cn(
            "flex-1 min-w-0 flex items-center gap-2 px-2.5 h-9 rounded-lg text-left text-sm transition-colors",
            folder === key
              ? "bg-brand-accent/15 text-brand-accent font-bold"
              : dark ? "hover:bg-white/5" : "hover:bg-slate-200/60",
          )}
        >
          {custom && <FolderClosed className="w-4 h-4 shrink-0 opacity-70" />}
          <span className="flex-1 truncate">{label}</span>
          <span className="text-xs font-mono opacity-60">{count}</span>
        </button>
        {editing && custom && (
          <>
            <button onClick={() => { setDraft({ target: key, value: key }); setError(""); }} aria-label={`重新命名「${label}」`} className={cn("p-1.5 rounded-md", muted, "hover:text-brand-accent")}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteFolder(key)} aria-label={`刪除「${label}」`} className={cn("p-1.5 rounded-md", muted, "hover:text-rose-500")}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <div className={cn("absolute inset-0 z-[50] flex flex-col backdrop-blur-xl", dark ? "bg-zinc-950/90 text-white" : "bg-slate-50/95 text-slate-900")}>
      {/* 標題列 */}
      <div className={cn("shrink-0 flex items-center gap-2 px-3 h-14 border-b", dark ? "border-white/10" : "border-slate-200")}>
        <button onClick={onBack} aria-label="返回" className={cn("flex items-center gap-1 pl-1 pr-2 h-9 rounded-full text-xs font-bold", dark ? "hover:bg-white/10" : "hover:bg-slate-200")}>
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? "收起資料夾" : "展開資料夾"}
          aria-expanded={sidebarOpen}
          className={cn("p-2 rounded-lg", dark ? "hover:bg-white/10" : "hover:bg-slate-200")}
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
        <h2 className="text-base font-bold truncate">
          {folder === ALL ? "我的收藏" : folder}
        </h2>
        <span className={cn("text-xs shrink-0", muted)}>{shown.length} 個</span>
      </div>

      <div className="relative flex-1 flex min-h-0">
        {/* 左側資料夾欄（可收起）：手機浮在清單上方當抽屜，電腦與清單並排 */}
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-10 bg-black/30" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        {sidebarOpen && (
          <aside className={cn(
            "absolute md:static inset-y-0 left-0 z-20 w-60 md:w-56 shrink-0 flex flex-col border-r shadow-2xl md:shadow-none",
            dark ? "border-white/10 bg-zinc-900 md:bg-white/[0.02]" : "border-slate-200 bg-slate-50 md:bg-white/40",
          )}>
            <div className="flex items-center justify-between px-3 h-10">
              <span className={cn("text-xs font-bold", muted)}>資料夾</span>
              <button
                onClick={() => { setEditing((e) => !e); setDraft(null); setError(""); }}
                aria-pressed={editing}
                className={cn("flex items-center gap-1 px-2 h-7 rounded-md text-xs font-bold",
                  editing ? "bg-brand-accent text-white" : cn(muted, dark ? "hover:bg-white/10" : "hover:bg-slate-200"))}
              >
                {editing ? <><Check className="w-3.5 h-3.5" />完成</> : <><Pencil className="w-3.5 h-3.5" />編輯</>}
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 custom-scrollbar">
              {folderRow(ALL, "全部", meds.length, false)}
              {folderRow(UNFILED, UNFILED, counts[UNFILED] ?? 0, false)}
              {folders.folders.map((f) => folderRow(f, f, counts[f] ?? 0, true))}
              {editing && (
                <li className="pt-1">
                  {draft?.target === null ? draftInput : (
                    <button
                      onClick={() => { setDraft({ target: null, value: "" }); setError(""); }}
                      className={cn("w-full flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-dashed text-xs font-bold",
                        dark ? "border-white/20 text-zinc-300" : "border-slate-300 text-slate-600")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新資料夾
                    </button>
                  )}
                </li>
              )}
            </ul>
          </aside>
        )}

        {/* 清單 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="shrink-0 px-3 pt-3">
            <label className={cn("flex items-center gap-2 px-3 h-10 rounded-xl border", dark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
              <Search className="w-4 h-4 opacity-50 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋收藏"
                aria-label="搜尋收藏"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-50"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="清除搜尋" className="p-1 opacity-60 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </label>
            {editing && <p className={cn("text-[11px] mt-2", muted)}>編輯中：用藥品右邊的選單換資料夾，或移出收藏。</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
            {meds.length === 0 ? (
              <p className={cn("text-center text-sm py-16", muted)}>還沒有收藏。回到主畫面，點藥品旁邊的星星就能加入。</p>
            ) : shown.length === 0 ? (
              <p className={cn("text-center text-sm py-16", muted)}>
                {query ? "沒有符合的收藏" : "這個資料夾還是空的。按資料夾欄的「編輯」，就能把藥移進來。"}
              </p>
            ) : (
              shown.map((med) => {
                const style = codeStyle(med.code);
                return (
                  <div
                    key={med.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 p-3 rounded-2xl border transition-colors",
                      selectedId === med.id
                        ? "border-brand-accent/60 bg-brand-accent/10"
                        : dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white/70 border-slate-200 hover:bg-white",
                    )}
                  >
                    <button onClick={() => onOpen(med)} className="flex-1 min-w-[11rem] flex items-center gap-3 text-left">
                      <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider shrink-0", style.text, style.bg)}>
                        {med.code}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold truncate">{med.component || med.brandName}</span>
                        <span className={cn("block text-xs truncate", muted)}>
                          {med.brandName}{med.chineseName ? ` · ${med.chineseName}` : ""}
                        </span>
                      </span>
                    </button>
                    {/* 分組選單和移出按鈕只在編輯時出現，平常保持清爽 */}
                    {editing && (
                      <div className="flex items-center gap-2 ml-auto">
                        <select
                          value={folderOf(med.id)}
                          onChange={(e) => moveTo(med.id, e.target.value)}
                          aria-label={`${med.code} 的資料夾`}
                          className={cn("max-w-[7rem] h-8 px-2 rounded-lg border text-xs shrink-0",
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
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
