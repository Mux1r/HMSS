/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ponytail: bare identifier so Vite define replaces it at build time
declare const __BUILD_TIME__: string;

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
  FormEvent,
} from "react";
import Fuse from "fuse.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Pill,
  Filter,
  ChevronRight,
  ChevronDown,
  Loader2,
  X,
  CheckCircle2,
  Trash2,
  Database,
  Menu,
  Sparkles,
  ArrowRight,
  History,
  User,
  Sun,
  Moon,
  Smartphone,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";

const getDosageColor = (code: string) => {
  const firstChar = code?.charAt(0)?.toUpperCase();
  const base = "border-l";
  switch (firstChar) {
    case "E":
      return { border: `${base} border-l-blue-500`, glow: "bg-blue-500", text: "text-blue-500", accent: "text-blue-400", bg: "bg-blue-500/10", borderMain: "border-blue-500/20", gradientRgb: "59,130,246" }; // 外用
    case "T":
      return { border: `${base} border-l-orange-500`, glow: "bg-orange-500", text: "text-orange-500", accent: "text-orange-400", bg: "bg-orange-500/10", borderMain: "border-orange-500/20", gradientRgb: "249,115,22" }; // 錠劑
    case "I":
      return { border: `${base} border-l-red-500`, glow: "bg-red-500", text: "text-red-500", accent: "text-red-400", bg: "bg-red-500/10", borderMain: "border-red-500/20", gradientRgb: "239,68,68" }; // 針劑
    case "L":
      return { border: `${base} border-l-teal-500`, glow: "bg-teal-500", text: "text-teal-500", accent: "text-teal-400", bg: "bg-teal-500/10", borderMain: "border-teal-500/20", gradientRgb: "20,184,166" }; // 藥水
    case "O":
      return { border: `${base} border-l-emerald-500`, glow: "bg-emerald-500", text: "text-emerald-500", accent: "text-emerald-400", bg: "bg-emerald-500/10", borderMain: "border-emerald-500/20", gradientRgb: "16,185,129" }; // 眼用
    case "S":
      return { border: `${base} border-l-amber-500`, glow: "bg-amber-500", text: "text-amber-500", accent: "text-amber-400", bg: "bg-amber-500/10", borderMain: "border-amber-500/20", gradientRgb: "245,158,11" }; // 噴劑
    case "Z":
      return { border: `${base} border-l-zinc-500`, glow: "bg-zinc-500", text: "text-zinc-500", accent: "text-zinc-400", bg: "bg-zinc-500/10", borderMain: "border-zinc-500/20", gradientRgb: "113,113,122" }; // 試驗
    case "V":
      return { border: `${base} border-l-violet-500`, glow: "bg-violet-500", text: "text-violet-500", accent: "text-violet-400", bg: "bg-violet-500/10", borderMain: "border-violet-500/20", gradientRgb: "139,92,246" }; // 塞劑
    default:
      return { border: `${base} border-l-brand-accent`, glow: "bg-brand-accent", text: "text-brand-accent", accent: "text-brand-accent/80", bg: "bg-brand-accent/10", borderMain: "border-brand-accent/20", gradientRgb: "13,148,136" };
  }
};

const DOSAGE_FORM_MAP: Record<string, string> = {
  T: "錠劑",
  B: "膠囊",
  C: "顆粒",
  D: "粉末",
  E: "外用藥",
  F: "膜衣錠",
  G: "腸溶錠",
  H: "軟膠囊",
  I: "針劑",
  K: "膏劑/乳膏",
  L: "內服液/藥水",
  O: "眼用藥",
  P: "貼片",
  R: "栓劑",
  S: "噴劑/吸入",
  V: "塞劑",
  W: "洗劑",
  Y: "糖漿",
  Z: "其他/試驗",
  A: "錠劑",
};

const getDosageName = (code: string) => {
  const char = code?.charAt(0)?.toUpperCase();
  return char && DOSAGE_FORM_MAP[char]
    ? `${char} - ${DOSAGE_FORM_MAP[char]}`
    : char || "?";
};

// 給藥途徑 → 對應的劑型代碼字母（藥品碼首字母）。
// 用於 AI 建議成分後，本地依「臨床途徑」挑選正確劑型（避免全身性疾病誤配外用劑型）。
const ROUTE_FORM_LETTERS: Record<string, string[]> = {
  // 順序＝臨床常用偏好：錠劑/膜衣錠/腸溶錠 → 膠囊 → 顆粒/粉末 → 藥水/糖漿（液體最後）。
  口服: ["T", "A", "F", "G", "B", "H", "C", "D", "L", "Y"],
  針劑: ["I"],
  外用: ["E", "K", "W"],
  眼用: ["O"],
  吸入: ["S"],
  栓劑: ["R", "V"],
  貼片: ["P"],
};
// 全身性給藥途徑（口服 + 針劑）；全身性疾病不可用外用/局部劑型。
const SYSTEMIC_FORM_LETTERS = new Set([
  ...ROUTE_FORM_LETTERS["口服"],
  ...ROUTE_FORM_LETTERS["針劑"],
]);

// 劑型常用度分數：體現臨床「全身性給藥(口服/針劑)優先於其他局部劑型」原則。
// 口服固體(錠/膜衣/腸溶/膠囊) > 口服液體(顆粒/粉末/藥水/糖漿) ≈ 針劑 > 外用/眼用/吸入等。
// 用於搜尋排序與「AI 未指定途徑」時的劑型挑選。
const FORM_PREFERENCE_SCORE: Record<string, number> = {
  T: 400, A: 400, F: 400, G: 400, B: 400, H: 400, // 口服固體
  C: 250, D: 250, L: 250, Y: 250,                 // 口服液體/顆粒/粉末
  I: 250,                                         // 針劑
};
const formPrefScore = (code?: string): number =>
  FORM_PREFERENCE_SCORE[(code?.charAt(0) || "").toUpperCase()] ?? 0;

// 口服液劑：L=內服液/藥水、Y=糖漿。除兒科外不主動推薦（有其他劑型時降級剔除）。
const LIQUID_FORM_LETTERS = new Set(["L", "Y"]);

// 將 AI 寫的各種途徑用語正規化為標準途徑鍵。無法辨識回傳 ""。
const ROUTE_ALIASES: [RegExp, string][] = [
  [/針劑|注射|靜脈|靜注|肌肉?注射|肌注|點滴|輸注|IV|IM|injection/i, "針劑"],
  [/口服|內服|PO|oral|錠|膠囊|糖漿|口含/i, "口服"],
  [/外用|局部|塗抹|凝膠|軟膏|乳膏|藥膏|洗劑|gel|cream|ointment|topical/i, "外用"],
  [/眼用|眼|耳用|滴眼|點眼/i, "眼用"],
  [/吸入|噴霧|噴劑|inhal|spray|nebuli/i, "吸入"],
  [/栓劑|塞劑|肛門|陰道|直腸|suppos/i, "栓劑"],
  [/貼片|貼劑|穿皮|經皮|patch|transderm/i, "貼片"],
];
const normalizeRoute = (raw: string): string => {
  const s = (raw || "").trim();
  if (!s) return "";
  if (ROUTE_FORM_LETTERS[s]) return s; // 已是標準鍵
  for (const [re, key] of ROUTE_ALIASES) {
    if (re.test(s)) return key;
  }
  return "";
};

const SharpStar = ({
  className,
  fill = "none",
}: {
  className?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="square"
    strokeLinejoin="miter"
    strokeMiterlimit="10"
    className={className}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

import {
  localMedicationService,
  Medication,
} from "./services/medicationService";
import { cn } from "./lib/utils";
import { MEDICAL_ALIASES, MECHANISM_ATC } from "./lib/medicalKeywords";
import { atcMatches, parseDrugLine, isPediatricContext } from "./lib/formulary";

const retryWithBackoff = async <T = any>(
  fn: () => Promise<T>,
  retries = 4,
  delay = 1000,
  backoffFactor = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isTransientError =
      error?.status === 429 ||
      error?.statusCode === 429 ||
      error?.error?.code === 429 ||
      error?.status === 503 ||
      error?.statusCode === 503 ||
      error?.error?.code === 503 ||
      (error?.message && (
        error.message.includes("429") ||
        error.message.includes("503") ||
        error.message.toLowerCase().includes("too many requests") ||
        error.message.toLowerCase().includes("quota") ||
        error.message.toLowerCase().includes("exhausted") ||
        error.message.toLowerCase().includes("unavailable") ||
        error.message.toLowerCase().includes("high demand") ||
        error.message.toLowerCase().includes("temporary")
      ));

    if (retries > 0 && isTransientError) {
      console.warn(`Groq API error (transient). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
};

// Groq 模型：REASONING 用於症狀理解/問題拆解/用藥建議（準確度優先）；
// FAST 留給未來純格式化等輕量任務。要換模型改這裡即可。
const GROQ_MODEL_REASONING = "llama-3.3-70b-versatile";

// Groq 代理端點（Apps Script doPost，key 藏在後端）。與藥物資料(doGet)分屬不同
// Apps Script 專案，故獨立一條網址。此網址非機密，可放前端。
const GROQ_PROXY_URL =
  "https://script.google.com/macros/s/AKfycby-RlIM41-muVbHmYQFNncbfSkBryCwGzJfGFXu66ExMWKXnqdrxKhVP-lKDtVghU7s9Q/exec";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [displayLimit, setDisplayLimit] = useState(100);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedSystem, setSelectedSystem] = useState("全部系統");
  const [selectedClass, setSelectedClass] = useState("全部藥理");
  const [selectedDosageForms, setSelectedDosageForms] = useState<string[]>([]);
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isDosageFormOpen, setIsDosageFormOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aiSymptomMapping, setAiSymptomMapping] = useState<{ classes: string[], systems: string[], keywords: string[], recommendedIngredients: string[] } | null>(null);
  const [isSymptomAnalyzing, setIsSymptomAnalyzing] = useState(false);
  const [isAiSymptomRequested, setIsAiSymptomRequested] = useState(false);
  const [aiSymptomError, setAiSymptomError] = useState<string | null>(null);
  const aiSymptomCacheRef = useRef<Record<string, { classes: string[], systems: string[], keywords: string[], recommendedIngredients: string[] }>>({});
  const aiRecommendCacheRef = useRef<Map<string, string>>(new Map());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavoritesManagerOpen, setIsFavoritesManagerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("favorites");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  const buildVersion = useMemo(() => {
    try {
      const time = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();
      const date = new Date(time);
      // Force conversion to UTC+8 (Taiwan Time) for a consistent, precise version completion string
      const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
      const twDate = new Date(utcTime + 3600000 * 8);
      const yyyy = twDate.getFullYear();
      const mm = String(twDate.getMonth() + 1).padStart(2, "0");
      const dd = String(twDate.getDate()).padStart(2, "0");
      const hh = String(twDate.getHours()).padStart(2, "0");
      const min = String(twDate.getMinutes()).padStart(2, "0");
      return `${yyyy}${mm}${dd}.${hh}${min}`;
    } catch (e) {
      return "20260611.2355";
    }
  }, []);

  const isIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("beforeinstallprompt fired");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const handleInstallApp = async () => {
    if (isIframe) {
      alert(
        "請點擊右上方『在分頁中開啟』圖示，進入正式網址後即可看到安裝按鈕。",
      );
      return;
    }

    if (!deferredPrompt) {
      // If prompt is not available but user clicked, show a guide or toast
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;
      if (isIOS) {
        alert("iOS 裝置請點擊瀏覽器下方的『分享』圖示，並選擇『加入主畫面』。");
      } else {
        alert(
          "Chrome 瀏覽器請點擊右上角『⋮』選單，選擇『安裝應用程式』或『加入主畫面』。\n\n提示：若您剛開啟網頁，請稍候幾秒或稍微捲動頁面，安裝選項通常會隨即出現。",
        );
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  // AI Mode States
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast({ message: `已成功複製藥物代碼：${code}`, type: "success" });
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = code;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setToast({ message: `已成功複製藥物代碼：${code}`, type: "success" });
      } catch (error) {
        console.error("Copy failed", error);
        setToast({ message: "複製失敗，請手動複製", type: "error" });
      }
      document.body.removeChild(textArea);
    }
  };

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const startLongPress = (code: string) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      handleCopyCode(code);
    }, 600); // 600ms threshold for long press
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const [isAiMode, setIsAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<
    {
      query: string;
      response: string;
      timestamp: number;
      filteredCount?: number;
      totalCount?: number;
      phase?: "decomposing" | "selecting" | "recommending" | "done";
      mainProblems?: string[];
      secondaryProblems?: string[];
      selectedSecondary?: string[];
    }[]
  >([]);
  // 各筆對話的「其他伴隨症狀」自填輸入暫存
  const [customSymptomInputs, setCustomSymptomInputs] = useState<Record<number, string>>({});
  const [aiVisibleLimits, setAiVisibleLimits] = useState<
    Record<string, number>
  >({});
  const [aiExpandedMeds, setAiExpandedMeds] = useState<Record<string, boolean>>(
    {},
  );
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    return "dark";
  });

  // --- Browser Back Button & Navigation Sync ---
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isNavigatingRef.current = true;
      const state = event.state;

      if (!state) {
        // Initial state
        setSelectedMed(null);
        setIsAiMode(false);
      } else {
        // Navigation case
        if (state.type === "ai_with_med") {
          setIsAiMode(true);
          const med = medications.find((m) => m.id === state.medId);
          if (med) setSelectedMed(med); setMobileExpanded(false);
        } else if (state.type === "ai") {
          setIsAiMode(true);
          // If the state says it's just AI, but we came from a med selection,
          // we might want to stay in HMSS if that's what's logic dictates,
          // or just follow the state exactly.
          if (state.medId) {
            const med = medications.find((m) => m.id === state.medId);
            if (med) setSelectedMed(med); setMobileExpanded(false);
          } else {
            setSelectedMed(null);
          }
        } else if (state.type === "med") {
          setIsAiMode(false);
          const med = medications.find((m) => m.id === state.id);
          if (med) setSelectedMed(med); setMobileExpanded(false);
        } else if (state.type === "hmss") {
          setIsAiMode(false);
          setSelectedMed(null);
        }
      }

      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [medications, selectedMed, isAiMode]);

  // Sync state changes to browser history with detailed state
  useEffect(() => {
    if (isNavigatingRef.current) return;

    if (isAiMode && selectedMed) {
      window.history.pushState(
        { type: "ai_with_med", medId: selectedMed.id },
        "",
      );
    } else if (isAiMode) {
      window.history.pushState({ type: "ai" }, "");
    } else if (selectedMed) {
      window.history.pushState({ type: "med", id: selectedMed.id }, "");
    } else {
      // Basic HMSS mode
      window.history.replaceState({ type: "hmss" }, "");
    }
  }, [selectedMed, isAiMode]);

  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Manual close handlers
  const closeDetail = () => { setSelectedMed(null); setMobileExpanded(false); };
  const exitAiMode = () => setIsAiMode(false);
  // -----------------------------------

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", isAiMode ? "ai" : "hmss");
  }, [isAiMode]);

  // 透過 Apps Script 後端代打 Groq：key 藏在 Apps Script，瀏覽器看不到。
  // 用 text/plain 送 POST 以避開 CORS preflight（Apps Script 不處理 OPTIONS）。
  // Apps Script 不支援串流，故一律非串流；回傳即標準 Groq/OpenAI completions JSON。
  const groqViaProxy = useCallback(
    async (body: Record<string, any>): Promise<any> => {
      const res = await fetch(GROQ_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...body, stream: false }),
      });
      if (!res.ok) throw new Error(`AI 代理錯誤: ${res.status}`);
      const data = await res.json();
      if (data?.error) throw new Error(`AI 代理錯誤: ${JSON.stringify(data.error)}`);
      return data;
    },
    [],
  );

  // 將 AI 建議的「成分名」比對院內藥庫，找出實際可用品項（含藥品碼）。
  const formularyFuse = useMemo(
    () =>
      new Fuse(medications, {
        keys: ["component", "genericName", "chineseName", "brandName"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [medications],
  );

  // 依 ATC 碼（為主）或成分名（後備）+（可選）給藥途徑比對院內藥庫，
  // 回傳「所有」臨床正確劑型的相符品項（依劑型偏好排序，去重，上限 8 筆）。
  const FORMULARY_MATCH_CAP = 8;
  const findFormularyMatches = (
    atcCode: string,
    ingredient: string,
    route: string | undefined,
    allowLiquid: boolean,
  ): Medication[] => {
    const letterOf = (m: Medication) => (m.code?.charAt(0) || "").toUpperCase();
    // 非兒科 → 有非液劑替代時，剔除藥水/糖漿（液劑為唯一選擇時仍保留）。
    const demoteLiquid = (list: Medication[]): Medication[] => {
      if (allowLiquid) return list;
      const nonLiquid = list.filter((m) => !LIQUID_FORM_LETTERS.has(letterOf(m)));
      return nonLiquid.length > 0 ? nonLiquid : list;
    };

    // 成分名正規化：去除 salt form 後綴，讓 "Metformin HCl" 能比到 "Metformin Hydrochloride"
    const normalizeIngredient = (s: string) =>
      s.toLowerCase()
        .replace(/\s*(hydrochloride|hcl|sodium|chloride|sulfate|maleate|tartrate|fumarate|acetate|phosphate|bromide|mesylate|besylate|monohydrate|potassium|calcium)\b/g, "")
        .replace(/[/＋+]/g, " ")  // Ampicillin/Sulbactam → Ampicillin Sulbactam
        .replace(/\s+/g, " ")
        .trim();

    // 1. 建立候選池：ATC 為主，5碼 prefix 緩衝，比不到才退回成分名。
    let candidates: Medication[] = [];
    const atc = (atcCode || "").trim();
    if (atc) {
      candidates = medications.filter((m) => atcMatches(m.atcCode, atc));
      // ATC 後兩碼可能給錯 → 試 5 碼 subgroup prefix
      if (candidates.length === 0 && atc.length > 5) {
        const prefix = atc.slice(0, 5);
        candidates = medications.filter((m) => atcMatches(m.atcCode, prefix));
      }
    }
    if (candidates.length === 0) {
      const q = normalizeIngredient(ingredient);
      if (q) {
        candidates = medications.filter((m) => {
          const fields = [m.component, m.genericName, m.chineseName, m.brandName]
            .filter(Boolean)
            .map((f) => normalizeIngredient(f as string));
          return fields.some((f) => f.includes(q) || (f.length > 4 && q.includes(f)));
        });
        if (candidates.length === 0) {
          candidates = formularyFuse.search(ingredient).slice(0, 5).map((r) => r.item);
        }
      }
    }
    if (candidates.length === 0) return [];

    // 去重（依藥品碼）並截斷的小工具
    const finalize = (list: Medication[]): Medication[] => {
      const seen = new Set<string>();
      const out: Medication[] = [];
      for (const m of list) {
        const key = m.code || m.id;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(m);
        }
        if (out.length >= FORMULARY_MATCH_CAP) break;
      }
      return out;
    };

    // 2. 依臨床途徑過濾並排序劑型
    const r = normalizeRoute(route || "");
    if (r) {
      const wantLetters = ROUTE_FORM_LETTERS[r] || [];
      const isSystemic = r === "口服" || r === "針劑";
      // 全身性途徑：僅接受全身性劑型；其他途徑：僅接受該途徑劑型。
      // 避免把全身性疾病錯配到外用劑型（如膽囊炎配到 MetroGel 外用凝膠）。
      const pool = candidates.filter((m) =>
        isSystemic
          ? SYSTEMIC_FORM_LETTERS.has(letterOf(m))
          : wantLetters.includes(letterOf(m)),
      );
      if (pool.length === 0) return []; // 院內無對應途徑品項 → 標示「院內無此品項」
      // 依 wantLetters 的臨床偏好順序排（口服優先於針劑；同途徑內錠劑/膠囊優先於藥水/糖漿）。
      const rank = (m: Medication) => {
        const i = wantLetters.indexOf(letterOf(m));
        return i === -1 ? 999 : i;
      };
      return finalize(demoteLiquid([...pool].sort((a, b) => rank(a) - rank(b))));
    }

    // AI 未指定途徑 → 仍依劑型偏好排：全身性(口服/針劑)優先於局部劑型。
    return finalize(
      demoteLiquid(
        [...candidates].sort((a, b) => formPrefScore(b.code) - formPrefScore(a.code)),
      ),
    );
  };

  const medicationCodeSet = useMemo(
    () => new Set(medications.map((m) => m.code?.trim().toUpperCase()).filter(Boolean)),
    [medications],
  );

  const isQueryValidForAi = useMemo(() => {
    const query = searchQuery.trim();
    if (!query || query.length < 2) return false;
    // 完全吻合已知藥品碼 → 不顯示 AI 按鈕；其他一律顯示
    return !medicationCodeSet.has(query.toUpperCase());
  }, [searchQuery, medicationCodeSet]);

  // Reset AI request when search query changes
  useEffect(() => {
    setIsAiSymptomRequested(false);
    setAiSymptomMapping(null);
    setAiSymptomError(null);
  }, [searchQuery]);

  useEffect(() => {
    if (!isAiSymptomRequested) {
      setAiSymptomMapping(null);
      setIsSymptomAnalyzing(false);
      setAiSymptomError(null);
      return;
    }

    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setAiSymptomMapping(null);
      setIsSymptomAnalyzing(false);
      return;
    }

    if (medicationCodeSet.has(query.toUpperCase())) {
      setAiSymptomMapping(null);
      setIsSymptomAnalyzing(false);
      return;
    }

    if (aiSymptomCacheRef.current[query]) {
      setAiSymptomMapping(aiSymptomCacheRef.current[query]);
      setIsSymptomAnalyzing(false);
      return;
    }

    setIsSymptomAnalyzing(true);
    const delayTimer = setTimeout(async () => {
      try {
        const classesList = Array.from(new Set(medications.map(m => m.pharmacologicalClass).filter(Boolean)));
        const systemsList = Array.from(new Set(medications.map(m => m.anatomicalSystem).filter(Boolean)));

        const prompt = `您是一位專業的醫院臨床藥師。
使用者正在醫院藥物查詢系統的搜尋框中，輸入了一個模糊的「症狀或副作用描述」或非精準藥物名稱：「${query}」。
請幫忙判斷這個描述可能與我們現有哪些「藥理分類 (Pharmacological Class)」或「生理系統 (Anatomical System)」最直接相關。
同時，請為該症狀推薦最合適、最常用的 2~4 個首選特效藥物成分英文/中文名稱 (recommended ingredients / generic names，例如: "Dextromethorphan", "Codeine", "Acetaminophen", "Cetirizine" 等)。

現有藥理分類 (Pharmacological Class) 列表：
${JSON.stringify(classesList)}

現有生理系統 (Anatomical System) 列表：
${JSON.stringify(systemsList)}

請回傳一個符合以下 JSON 格式的內容，絕不要包含任何 Markdown 格式標籤（如 \`\`\`json ），也絕不要有任何前後引言說明，直接輸出純 JSON 字串即可：
{
  "classes": [匹配的最相關藥理分類名稱列表，必須完全吻合上述列表中的字串項目],
  "systems": [匹配的最相關生理系統名稱列表，必須完全吻合上述列表中的字串項目],
  "keywords": [3~8個可能出現在藥品「適應症」欄位中的中文病名/症狀/治療用語，中英文皆可，用於比對藥品適應症文字，例如查咳嗽 → "咳嗽", "鎮咳", "祛痰", "化痰", "感冒"],
  "recommendedIngredients": [最合適、最常用且最符合適應症的首選西藥成分名稱列表，建議用常見英文學名如 "dextromethorphan"、或是常用中文成分名稱，依據常用度及臨床首選順序由高到低排列]
}

注意：如果沒有任何相關的，請回傳空陣列形式。`;

        const response = await retryWithBackoff<any>(() =>
          groqViaProxy({
            model: GROQ_MODEL_REASONING,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          })
        );
        const resultText = response.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(resultText);
        aiSymptomCacheRef.current[query] = parsed;
        setAiSymptomMapping(parsed);
      } catch (error: any) {
        console.error("AI Symptom mapping error:", error);
        setAiSymptomError(error?.message || "AI 分析失敗，請稍後再試");
      } finally {
        setIsSymptomAnalyzing(false);
      }
    }, 450);

    return () => clearTimeout(delayTimer);
  }, [isAiSymptomRequested, searchQuery, medications, medicationCodeSet, groqViaProxy]);

  // Remove global click listener in favor of local onBlur for better focus management
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".dropdown-container") &&
        !target.closest(".filter-popover-container")
      ) {
        setIsSystemOpen(false);
        setIsClassOpen(false);
        setIsDosageFormOpen(false);
        setShowFilters(false);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setImportStatus("正在連線至 Supabase 資料庫...");
    try {
      const { meds, hash } = await localMedicationService.fetchFromSupabase();
      setImportStatus(`正在存儲 ${meds.length} 筆資料至本地庫...`);
      await localMedicationService.saveAll(meds, hash);
      setMedications(meds);
      setImportStatus(`同步成功！已更新 ${meds.length} 筆資料`);
    } catch (error) {
      setImportStatus("同步失敗，請檢查網路連線");
      console.error(error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const stored = await localMedicationService.getAll();
        if (stored.length > 0) {
          setMedications(stored);
          // 背景靜默比對遠端筆數，有差異自動更新（不阻塞 UI）
          localMedicationService.getSupabaseCount().then(remoteCount => {
            if (remoteCount > 0 && remoteCount !== stored.length) {
              handleSync();
            }
          }).catch(() => {});
        } else {
          const { meds, hash } = await localMedicationService.fetchFromSupabase();
          await localMedicationService.saveAll(meds, hash);
          setMedications(meds);
        }
      } catch (error) {
        console.error("Failed to load local database:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 第一階段：拆解病患描述為「主要問題」與「次要問題/症狀」（快速 8B 模型，JSON）
  const decomposeProblems = async (
    query: string,
  ): Promise<{ mainProblems: string[]; secondaryProblems: string[] }> => {
    const prompt = `你是一位專業臨床藥師。請分析以下病患描述，拆解臨床問題，並回傳純 JSON（絕不要 Markdown 標籤，也不要任何前後說明）。
規則：
- "mainProblems"：病患「主動描述」的主要問題/主訴（疾病本身或明確不適），通常 1-3 個，每項簡短（2-12 字）。
- "secondaryProblems"：由主要問題「臨床上可能伴隨或衍生、但描述中尚未明確提及」的次要症狀或併發問題，供病患勾選確認是否存在。請列出 3-8 個最常見且相關的項目，一個症狀一項，每項簡短（2-12 字），不要與 mainProblems 重複。
- 疾病本身與各症狀必須分開。
回傳格式：{"mainProblems":["..."],"secondaryProblems":["..."]}
病患描述：「${query}」`;
    const response = await retryWithBackoff<any>(() =>
      groqViaProxy({
        model: GROQ_MODEL_REASONING,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    );
    const text = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    const clean = (arr: any): string[] =>
      Array.isArray(arr)
        ? arr.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
        : [];
    return {
      mainProblems: clean(parsed.mainProblems),
      secondaryProblems: clean(parsed.secondaryProblems),
    };
  };

  // 第二階段：針對「已確認的問題清單」產生用藥建議（70B 串流）
  const runRecommendation = async (
    timestamp: number,
    query: string,
    mainProblems: string[],
    selectedSecondary: string[],
  ) => {
    setIsAiLoading(true);
    setAiHistory((prev) =>
      prev.map((it) =>
        it.timestamp === timestamp ? { ...it, phase: "recommending", response: "" } : it,
      ),
    );
    try {
      const confirmedProblems = [
        ...mainProblems.map((p) => `${p}（主要問題）`),
        ...selectedSecondary.map((p) => `${p}（次要問題/症狀）`),
      ];
      const cacheKey = query + "\x00" + [...confirmedProblems].sort().join("\x01");
      const cached = aiRecommendCacheRef.current.get(cacheKey);
      if (cached) {
        setAiHistory((prev) =>
          prev.map((it) =>
            it.timestamp === timestamp ? { ...it, response: cached, phase: "done" } : it,
          ),
        );
        setIsAiLoading(false);
        return;
      }
      const problemListText =
        confirmedProblems.length > 0
          ? confirmedProblems.map((p) => `- ${p}`).join("\n")
          : `- ${query}`;

      const prompt = `# Role
你是一位全能且精通臨床藥理學的主治醫師，具備嚴謹的臨床推理能力與多重用藥（Polypharmacy）審視經驗。

# Context
用戶提供一段病患健康狀況描述，以及一份「已確認需要處理的臨床問題清單」。請依你的臨床藥理知識，僅針對清單中的問題給出用藥建議；系統會自動把你建議的成分名比對院內藥庫，找出實際可用品項與藥品碼。

# Task
針對「已確認的臨床問題清單」中的「每一個問題」分別給出建議：
1. 若該問題可由特定藥物治療：建議最適切的藥物成分（generic/學名）並提供選擇理由。
2. 若該問題（尤其是主要問題）並非由特定藥物直接解決（例如需要生活型態調整、飲食控制、手術、轉診或進一步檢查），「不要硬湊藥物」，改給臨床建議。
最後撰寫一份整體用藥策略總結（80-150 字）。

# Constraints & Safety [臨床重要指引與鐵律]
- 【🚨 只處理清單內問題】：只能針對「已確認問題清單」中的問題給建議，絕對不要自行新增清單以外的問題。
- 【🚨 非藥物問題給建議即可】：若某問題無特定藥物可直接治療，請在該問題下「不要列藥物」，改輸出一行以「※」開頭的臨床建議文字（例如：「※ 建議低脂飲食並安排腹部超音波評估，必要時外科會診」）。
- 【🚨 問題絕不可混合】：每個「問題：」群組只能放專屬於該問題的藥物，嚴禁把不同問題（不同症狀、或疾病本身 vs 症狀）的藥物混在同一群組。若某藥可同時處理多個問題，請放在最主要的那個問題即可。
- 【🚨 每個問題至少 5 種藥物】：對於可用藥的問題，「每一個問題」都必須列出「至少 5 種」藥物成分（盡量 8-12 種不同機制或劑型的替代成分），數量不足視為未完成。讓醫師有充分備選。
- 【🚨 盡量命中院內藥庫】：系統會以你提供的「ATC 碼」為主比對一份院內藥庫清單並呈現所有庫內相符品項。故請「優先選擇臨床常用、各級醫院藥局普遍會備的標準成分」（用通用英文學名），避免冷門、罕用或已淘汰的成分，以提高命中、盡量讓更多建議能對應到院內實際品項。同一機轉若有多個常用成分，可一併列出以增加命中機會。
- 【務必使用「成分名/學名」】：藥物行請以「藥物成分學名」開頭（優先通用英文學名，例如 Metformin、Amlodipine；可在括號附中文名）。「絕對不要」自行編造任何藥品代碼或編號，系統會自動比對。
- 【🚨 必須附 WHO ATC 碼】：每個藥物行都要填入該成分的 WHO ATC 碼（5-7 碼，例如 Acetaminophen=N02BE01、Amlodipine=C08CA01、Metformin=A10BA02）。系統用它精準對到院內品項。若確定 5 碼 subgroup 但不確定後 2 碼，可只填 5 碼（如 A10BA）——系統支援 prefix 比對。若連 5 碼都不確定，請將該欄「留空」（系統會改用成分名比對）——「絕對不要杜撰」錯誤的 ATC 碼。
- 【🚨 必須指定「給藥途徑」且須符合臨床情境】：每個藥物建議都必須標明給藥途徑，從以下擇一：口服、針劑、外用、眼用、吸入、栓劑、貼片。途徑必須符合臨床！全身性疾病（如膽囊炎、肺炎、敗血症等）必須用「口服」或「針劑」，絕對不可建議「外用」等局部劑型（例如膽囊炎需全身性 Metronidazole 口服/針劑，而非 MetroGel 外用凝膠）；局部病灶（如皮膚感染、結膜炎）才用外用/眼用。
- 【🚨 劑型須由綜合臨床因素判斷】：每個藥物的給藥途徑/劑型，請依以下因素「綜合判斷」，而非套公式：
  (1) 病灶範圍：全身性疾病用全身性劑型（口服/針劑）；單純局部病灶（皮膚、眼、外耳、局部黏膜）才用對應局部劑型。
  (2) 嚴重度與急迫性：病情穩定/輕中度/門診可處理者「優先口服」；重症、敗血、需快速起效或高血中濃度、無法吞嚥/禁食/嘔吐者用「針劑」。
  (3) 疾病本身特性與臨床指引：依該疾病的標準治療途徑（如氣喘控制用吸入、嚴重感染用靜脈、慢性病維持用口服）。
  (4) 病人可行性：意識、吞嚥能力、腸胃吸收狀況。
  原則：全身性問題一律以口服/針劑為主，能口服則優先口服，不得用外用等局部劑型替代全身治療。請在「理由」中簡述為何選此劑型（如「重症需靜脈」「門診可口服」）。
- 【🚨 成人避免口服液劑】：除非病患描述為「兒科/嬰幼兒/吞嚥困難」，否則「不要建議口服液劑（藥水、糖漿、internal solution、syrup）」，口服一律以錠劑/膠囊為主。
- 【🚨 理由須詳細且為一段敘述】：每個藥物的「理由」欄寫成「一段連貫的文字」（約 40-90 字），自然融合藥理機轉與此情境的選擇理由（臨床首選地位／指引建議／療效優勢／安全性或副作用考量／適應症契合），可帶出關鍵注意事項（如腎功能、低血鉀、出血風險）。「絕對不要」出現「作用機轉」「選擇理由」等標題字樣，也不要編號或分點，直接以臨床語言一段帶過。例如：「選擇性阻斷 β1 受體、降低心率與心肌耗氧，為心衰竭與心絞痛的指引首選，須留意心搏過緩與氣喘禁忌」。
- 藥物審視：嚴格審視藥物交互作用（DDI）、重複用藥及潛在副作用；所有建議須符合現行臨床指引。
- 資訊邊界：若資訊不足以確立診斷，應指出需進一步評估的臨床指標（如肝腎功能、實驗室數據），不可憑空猜測。

# Output Format (強制嚴格執行，以利系統解析)
不要輸出「第一部分」「第二部分」等標題。

[整體用藥策略與臨床總結段落]
請直接在第一段輸出 80-150 字的整體臨床分析與用藥策略總結（重點式、可條列；此段中絕對不可包含「問題：」或「Problem:」字樣）。

接著針對清單中每個問題各自一個「問題：」群組。藥物行固定四欄，用「 | 」分隔：「成分學名(中文名) | 途徑 | ATC碼 | 理由」；ATC 碼不確定時該欄可留空但分隔符仍保留；非藥物建議則用「※ 建議內容」。

問題：[問題名稱 1]
成分學名(中文名) | 口服 | N02BE01 | [機轉＋選擇理由，約40-90字]
成分學名(中文名) | 針劑 | [ATC碼或留空] | [機轉＋選擇理由，約40-90字]
...（每個可用藥問題至少 5 行）

問題：[非藥物可治療的問題名稱]
※ [臨床建議文字，例如生活型態調整、轉診或進一步檢查]

---
已確認需要處理的臨床問題清單：
${problemListText}

病患狀況描述：
${query}
`;

      // Apps Script 不支援串流 → 一次取回完整結果。ponytail: 失去逐字跳出，換到 key 不外洩。
      const response = await retryWithBackoff<any>(() =>
        groqViaProxy({
          model: GROQ_MODEL_REASONING,
          messages: [{ role: "user", content: prompt }],
        }),
      );
      const fullResponse = response.choices?.[0]?.message?.content || "";
      aiRecommendCacheRef.current.set(cacheKey, fullResponse);
      setAiHistory((prev) =>
        prev.map((it) =>
          it.timestamp === timestamp ? { ...it, response: fullResponse, phase: "done" } : it,
        ),
      );
    } catch (error: any) {
      console.error("AI recommendation error:", error);
      const errorMsg = error?.message || "AI 搜尋發生錯誤，請稍後再試。";
      setAiHistory((prev) =>
        prev.map((it) =>
          it.timestamp === timestamp
            ? { ...it, phase: "done", response: `⚠️ 錯誤：${errorMsg}` }
            : it,
        ),
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // 切換次要問題勾選狀態
  const toggleSecondaryProblem = (timestamp: number, problem: string) => {
    setAiHistory((prev) =>
      prev.map((it) => {
        if (it.timestamp !== timestamp) return it;
        const sel = it.selectedSecondary || [];
        return {
          ...it,
          selectedSecondary: sel.includes(problem)
            ? sel.filter((p) => p !== problem)
            : [...sel, problem],
        };
      }),
    );
  };

  // 新增自填的伴隨症狀（加入清單並預設勾選）
  const addCustomSymptom = (timestamp: number) => {
    const raw = (customSymptomInputs[timestamp] || "").trim();
    if (!raw) return;
    setAiHistory((prev) =>
      prev.map((it) => {
        if (it.timestamp !== timestamp) return it;
        const secondary = it.secondaryProblems || [];
        if (secondary.includes(raw)) return it; // 已存在則不重複新增
        return {
          ...it,
          secondaryProblems: [...secondary, raw],
          selectedSecondary: [...(it.selectedSecondary || []), raw],
        };
      }),
    );
    setCustomSymptomInputs((prev) => ({ ...prev, [timestamp]: "" }));
  };

  // 從建議結果退回問題勾選階段
  const handleBackToSelecting = (timestamp: number) => {
    setAiHistory((prev) =>
      prev.map((it) =>
        it.timestamp === timestamp ? { ...it, phase: "selecting", response: "" } : it,
      ),
    );
  };

  // 使用者勾選完畢，按「產生建議」→ 進入第二階段
  const handleGenerateRecommendation = (timestamp: number) => {
    if (isAiLoading) return;
    const item = aiHistory.find((it) => it.timestamp === timestamp);
    if (!item) return;
    runRecommendation(
      timestamp,
      item.query,
      item.mainProblems || [],
      item.selectedSecondary || [],
    );
  };

  // 入口：第一階段拆解問題
  const handleAiSearch = async (e?: FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const targetQuery = directQuery !== undefined ? directQuery : aiQuery;
    if (!targetQuery.trim() || isAiLoading) return;

    setIsAiLoading(true);

    const currentQuery = targetQuery;
    const currentTimestamp = Date.now();

    setAiHistory((prev) => {
      const list = prev.filter(
        (item) => !(item.query === currentQuery && item.response.includes("⚠️ 錯誤：")),
      );
      return [
        {
          query: currentQuery,
          response: "",
          timestamp: currentTimestamp,
          phase: "decomposing",
          mainProblems: [],
          secondaryProblems: [],
          selectedSecondary: [],
        },
        ...list,
      ].slice(0, 20);
    });

    if (directQuery === undefined) {
      setAiQuery("");
    }

    try {
      const { mainProblems, secondaryProblems } = await decomposeProblems(currentQuery);

      if (secondaryProblems.length === 0) {
        // 無次要問題可確認 → 直接產生建議
        setAiHistory((prev) =>
          prev.map((it) =>
            it.timestamp === currentTimestamp
              ? { ...it, mainProblems, secondaryProblems: [], selectedSecondary: [] }
              : it,
          ),
        );
        await runRecommendation(currentTimestamp, currentQuery, mainProblems, []);
      } else {
        // 進入勾選階段，等待使用者確認
        setAiHistory((prev) =>
          prev.map((it) =>
            it.timestamp === currentTimestamp
              ? { ...it, phase: "selecting", mainProblems, secondaryProblems, selectedSecondary: [] }
              : it,
          ),
        );
        setIsAiLoading(false);
      }
    } catch (error: any) {
      console.error("AI decompose error:", error);
      // 拆解失敗 → 退化為直接以原始描述產生建議
      try {
        await runRecommendation(currentTimestamp, currentQuery, [], []);
      } catch {
        setAiHistory((prev) =>
          prev.map((it) =>
            it.timestamp === currentTimestamp
              ? { ...it, phase: "done", response: `⚠️ 錯誤：${error?.message || "AI 分析發生錯誤，請稍後再試。"}` }
              : it,
          ),
        );
        setIsAiLoading(false);
      }
    }
  };



  const anatomicalSystems = useMemo(() => {
    const systems = new Set(medications.map((m) => m.anatomicalSystem));
    return ["全部系統", ...Array.from(systems).sort()];
  }, [medications]);

  const pharmacologicalClasses = useMemo(() => {
    // 根據選取的系統過濾藥理分類
    const filteredMeds =
      selectedSystem === "全部系統"
        ? medications
        : medications.filter((m) => m.anatomicalSystem === selectedSystem);

    const classes = new Set(filteredMeds.map((m) => m.pharmacologicalClass));
    return ["全部藥理", ...Array.from(classes).sort()];
  }, [medications, selectedSystem]);

  const dosageForms = useMemo(() => {
    const forms = new Set(
      medications
        .map((m) => m.dosageForm || m.code?.charAt(0)?.toUpperCase() || "?")
        .filter((f) => f && f !== "?"),
    );
    return ["全部劑型", ...Array.from(forms).sort()];
  }, [medications]);

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(100);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [deferredSearchQuery, selectedSystem, selectedClass, selectedDosageForms]);

  const isSearchingOrFiltering = useMemo(() => {
    return (
      deferredSearchQuery.trim() !== "" ||
      selectedSystem !== "全部系統" ||
      selectedClass !== "全部藥理" ||
      selectedDosageForms.length > 0 ||
      onlyFavorites
    );
  }, [
    deferredSearchQuery,
    selectedSystem,
    selectedClass,
    selectedDosageForms,
    onlyFavorites,
  ]);

  const filteredMedications = useMemo(() => {
    if (!isSearchingOrFiltering) {
      return [];
    }

    const query = deferredSearchQuery.toLowerCase().trim();
    const synonyms = MEDICAL_ALIASES[query] || [];
    const atcPrefixes = MECHANISM_ATC[query] || [];

    let baseMeds = medications;

    if (query) {
      const minPrefixLength = 3;
      const queryLen = query.length;

      const fuse = new Fuse(baseMeds, {
        keys: ["code", "component", "brandName", "genericName", "chineseName", "bagLabelName", "indications", "searchKeywords"],
        threshold: 0.45,
      });

      // 1. 完全或縮寫匹配 (最優先)
      const exactMatches = medications.filter((m) => {
        const mCode = m.code?.toLowerCase();
        const mComp = m.component?.toLowerCase();
        const mBrand = m.brandName?.toLowerCase();

        // 直接完全匹配
        const isExact = mCode === query || mComp === query || mBrand === query;
        if (isExact) return true;

        // 縮寫/別名匹配 (例如打 NS 找到 Normal Saline)
        if (synonyms.length > 0) {
          const searchable = `${mCode} ${mComp} ${mBrand} ${m.genericName?.toLowerCase()} ${m.chineseName?.toLowerCase()} ${m.pharmacologicalClass?.toLowerCase()}`;
          return synonyms.some((s) => searchable.includes(s.toLowerCase()));
        }
        return false;
      });

      // 1.05 機轉 ATC 前綴匹配：打 acei/statin/ppi 等縮寫時，用 ATC 碼撈到該類在庫每一顆藥
      // （比自訂學名清單窮盡，且可到 5~7 碼細粒度隔出如 statin C10AA）
      const atcClassMatches = atcPrefixes.length > 0
        ? medications.filter((m) => {
            const atc = (m.atcCode || "").toUpperCase();
            return atc.length > 0 && atcPrefixes.some((p) => p && atc.startsWith(p));
          })
        : [];

      // 1.1 醫學屬性匹配 (機轉、分類等)
      const medicalIntentMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;

        const pharmacological = m.pharmacologicalClass?.toLowerCase() || "";
        const system = m.anatomicalSystem?.toLowerCase() || "";
        const indications = m.indications?.toLowerCase() || "";
        // 刻意不比對 sideEffects：症狀查詢應撈「治療該症狀」的藥，而非「會引起該症狀」的藥。
        if (pharmacological.includes(query) || system.includes(query) || indications.includes(query))
          return true;

        if (synonyms.length > 0) {
          return synonyms.some(
            (s) =>
              pharmacological.includes(s.toLowerCase()) ||
              system.includes(s.toLowerCase()) ||
              indications.includes(s.toLowerCase()),
          );
        }
        return false;
      });

      // 輔助函式：取得從第一個英文字母開始的字串部分
      const getAlphaStart = (str: string) => {
        if (!str) return "";
        const m = str.match(/[a-zA-Z].*/);
        return m ? m[0].toLowerCase() : str.toLowerCase();
      };

      // 第二層： 字串絕對開頭匹配 (String Start - 字首精準匹配)
      const stringStartMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        const targets = [m.code, m.component, m.brandName, m.genericName, m.chineseName, m.bagLabelName];
        return targets.some((t) => t?.toLowerCase().startsWith(query));
      });

      // 第三層： 第一個「字母/中文字」單字開頭匹配 (例如解決 "10% Dextrose" 的 "Dextrose" 開頭，或中文開頭)
      const firstAlphaStartMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        if (stringStartMatches.some((sm) => sm.id === m.id)) return false;
        const targets = [m.component, m.brandName, m.genericName, m.chineseName, m.bagLabelName];
        return targets.some((t) => {
          if (!t) return false;
          const alphaT = getAlphaStart(t);
          return alphaT.startsWith(query);
        });
      });

      // 第四層： 其他單字開頭 (Word Boundary Match - 單字字首開頭)
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}`, "i");
      const wordBoundaryMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        if (stringStartMatches.some((sm) => sm.id === m.id)) return false;
        if (firstAlphaStartMatches.some((am) => am.id === m.id)) return false;

        const searchPool = `${m.component} ${m.brandName} ${m.genericName} ${m.chineseName} ${m.bagLabelName || ""} ${m.searchKeywords || ""}`;
        return wordBoundaryRegex.test(searchPool);
      });

      // 第五層： 字串包含（含字尾匹配）
      const containsMatches = queryLen >= minPrefixLength ? medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        if (stringStartMatches.some((sm) => sm.id === m.id)) return false;
        if (firstAlphaStartMatches.some((am) => am.id === m.id)) return false;
        if (wordBoundaryMatches.some((wm) => wm.id === m.id)) return false;
        const targets = [m.component, m.brandName, m.genericName, m.chineseName, m.bagLabelName, m.code];
        return targets.some((t) => t?.toLowerCase().includes(query));
      }) : [];

      // 第五層： 全域模糊搜尋 (Global Fuzzy Match) - 僅在符合特定條件時顯示
      const fuzzyResults = fuse.search(query);

      // 過濾與限制模糊搜尋結果
      const constrainedFuzzy = fuzzyResults
        .filter((result) => {
          const item = result.item as any;
          if (exactMatches.some((em) => em.id === item.id)) return false;
          if (medicalIntentMatches.some((mm) => mm.id === item.id))
            return false;
          if (stringStartMatches.some((sm) => sm.id === item.id)) return false;
          if (firstAlphaStartMatches.some((am) => am.id === item.id))
            return false;
          if (wordBoundaryMatches.some((wm) => wm.id === item.id)) return false;

          // 核心限制：避免短關鍵字（如 3 碼以下）匹配到單字中間
          if (queryLen < minPrefixLength) return false;

          // 動態閾值調整：短關鍵字需更精準，長關鍵字容許較多模糊
          let dynamicThreshold = 0.4;
          if (queryLen === 3) dynamicThreshold = 0.18;
          else if (queryLen === 4) dynamicThreshold = 0.25;
          else if (queryLen <= 6) dynamicThreshold = 0.32;

          if (result.score === undefined || result.score > dynamicThreshold)
            return false;

          // 避免長度差異過大造成的誤判
          const primaryName = item.component || item.brandName || "";
          if (result.score > 0.2 && primaryName.length > queryLen + 10) {
            return false;
          }

          return true;
        })
        .map((r) => r.item as any);

      // 症狀與 AI 關聯匹配 (Low Latency AI Symptom Match)
      const aiSymptomMatches = medications.filter((m) => {
        if (!aiSymptomMapping) return false;
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;

        const isClassMatch = aiSymptomMapping.classes.includes(m.pharmacologicalClass);
        const isSystemMatch = aiSymptomMapping.systems.includes(m.anatomicalSystem);
        const isKeywordMatch = aiSymptomMapping.keywords.some((kw) => {
          const pool = `${m.component} ${m.brandName} ${m.genericName} ${m.chineseName} ${m.indications} ${m.pharmacologicalClass}`.toLowerCase();
          return pool.includes(kw);
        });
        // 成分名比對：AI 推薦的首選成分若實際存在於院內藥庫就撈進來。
        // 這條比 class 精確字串比對可靠得多 —— 8B/70B 都難一字不差複製院內分類字串，
        // 但成分學名是穩定的。ponytail: 成分名是主訊號，class/system 只是輔助。
        const nameFields = [m.component, m.genericName, m.chineseName, m.brandName]
          .filter(Boolean)
          .map((f) => (f as string).toLowerCase());
        const isIngredientMatch = aiSymptomMapping.recommendedIngredients.some((ing) => {
          const q = ing.toLowerCase().trim();
          return q.length > 2 && nameFields.some((f) => f.includes(q) || q.includes(f));
        });

        return isClassMatch || isSystemMatch || isKeywordMatch || isIngredientMatch;
      });

      // 整合與去重，保持基礎匹配類別 (使用 Set 保證完全無重複 key)
      const combinedMeds: typeof medications = [];
      const seenMeds = new Set<string>();

      const addUniqueMeds = (list: typeof medications) => {
        for (const m of list) {
          if (!seenMeds.has(m.id)) {
            seenMeds.add(m.id);
            combinedMeds.push(m);
          }
        }
      };

      addUniqueMeds(exactMatches);
      addUniqueMeds(atcClassMatches);
      addUniqueMeds(medicalIntentMatches);
      addUniqueMeds(aiSymptomMatches);
      addUniqueMeds(stringStartMatches);
      addUniqueMeds(firstAlphaStartMatches);
      addUniqueMeds(wordBoundaryMatches);
      addUniqueMeds(containsMatches);

      // 合併模糊匹配結果 (去重)
      constrainedFuzzy.forEach((fm: any) => {
        if (!seenMeds.has(fm.id)) {
          seenMeds.add(fm.id);
          combinedMeds.push(fm);
        }
      });

      // 建立通用高頻臨床首選常用西藥英文成分與拼音對照表，在無 AI 反映或一般搜尋時優先置前
      const GENERAL_COMMON_INGREDIENTS = [
        "acetaminophen", "ibuprofen", "diclofenac", "mefenamic", "aspirin", // 止痛消炎
        "cetirizine", "loratadine", "fexofenadine", "chlorpheniramine", "levocetirizine", // 抗敏
        "dextromethorphan", "codeine", "acetylcysteine", "medicon", "ambroxol", "cough", "levodropropizine", // 咳嗽
        "metformin", "glipizide", "gliclazide", "empagliflozin", // 血糖
        "atorvastatin", "rosuvastatin", "simvastatin", // 血脂
        "amlodipine", "valsartan", "propranolol", "atenolol", "losartan", "bisoprolol", // 血壓
        "famotidine", "pantoprazole", "lansoprazole", "magnesium oxide", "rabeprazole", // 腸胃
        "amoxicillin", "cephalexin", "azithromycin", "ciprofloxacin", // 感染抗生素
        "salbutamol", "albuterol", "budesonide", "fluticasone", "terbutaline", // 呼吸喘
        "prednisolone", "dexamethasone" // 類固醇
      ];

      // 計算藥物契合程度之評分演算法 (優先考量主治適應症與臨床首選頻率，而非劑型字母 A, B, C 等順序)
      const getSortingScore = (m: Medication) => {
        let score = 0;

        const indicationsLower = (m.indications || "").toLowerCase();
        const chineseNameLower = (m.chineseName || "").toLowerCase();
        const componentLower = (m.component || "").toLowerCase();
        const brandNameLower = (m.brandName || "").toLowerCase();
        const pharmacologicalLower = (m.pharmacologicalClass || "").toLowerCase();
        const genericLower = (m.genericName || "").toLowerCase();

        // AI 佐證訊號：機轉分類/系統匹配的藥，還需適應症命中 AI 關鍵詞或被 AI 點名成分，
        // 才算真正符合需求；否則降權排後（不排除）。
        const recoIndex = aiSymptomMapping
          ? aiSymptomMapping.recommendedIngredients.findIndex((ing) => {
              const cleanIng = ing.toLowerCase();
              return componentLower.includes(cleanIng) || genericLower.includes(cleanIng) || cleanIng.includes(componentLower);
            })
          : -1;
        const aiIndicationHit = !!aiSymptomMapping &&
          aiSymptomMapping.keywords.some((kw) => indicationsLower.includes(kw.toLowerCase()));
        const aiCorroborated = aiIndicationHit || recoIndex !== -1;

        // 1. 各層級之基礎匹配權重
        if (exactMatches.some((em) => em.id === m.id)) {
          score += 12000;
        } else if (atcClassMatches.some((am) => am.id === m.id)) {
          // 明確機轉縮寫 → 該類藥為主要結果，僅次於精確名稱/代碼匹配
          score += 9500;
        } else if (stringStartMatches.some((sm) => sm.id === m.id)) {
          score += 10000;
        } else if (firstAlphaStartMatches.some((am) => am.id === m.id)) {
          score += 9000;
        } else if (wordBoundaryMatches.some((wm) => wm.id === m.id)) {
          score += 8000;
        } else if (medicalIntentMatches.some((mm) => mm.id === m.id)) {
          score += 7000;
        } else if (aiSymptomMatches.some((sm) => sm.id === m.id)) {
          // 有適應症佐證維持高分；僅分類/系統吻合者降至 contains(5000) 之後、門檻(3000)之上
          score += aiCorroborated ? 6000 : 3500;
        } else if (containsMatches.some((cm) => cm.id === m.id)) {
          score += 5000;
        } else {
          score += 1000;
        }

        // 2. 適應症(Indications)之精確契合度優選分數 (解決「最符合使用 indication 的藥物作排序」)

        // 2.1 主治適應症欄位包含搜尋關鍵字，大幅度提升其排序
        if (indicationsLower.includes(query)) {
          score += 2000; // 賦予極高權重使之突出
        }
        if (chineseNameLower.includes(query) || componentLower.includes(query) || brandNameLower.includes(query)) {
          score += 1000;
        }
        if (pharmacologicalLower.includes(query)) {
          score += 800;
        }

        // 2.2 同義詞/關聯詞之契合加分
        synonyms.forEach((syn) => {
          const s = syn.toLowerCase();
          if (indicationsLower.includes(s)) score += 800;
          if (chineseNameLower.includes(s)) score += 500;
          if (componentLower.includes(s)) score += 500;
        });

        // 2.3 字首與首字匹配追加超高加權 (Emphasis on Prefix/Word boundary start matching)
        const checkPrefix = (str?: string) => {
          if (!str) return false;
          const s = str.toLowerCase();
          return s.startsWith(query) || s.split(/[\s+\-_/()]+/).some(w => w.startsWith(query));
        };

        if (checkPrefix(m.component) || checkPrefix(m.brandName) || checkPrefix(m.chineseName) || checkPrefix(m.genericName) || checkPrefix(m.code)) {
          score += 1000;
        }

        // 3. 整合 AI 臨床首選與推薦藥物成分 (與臨床最常用、治療契合度排序對接)
        if (aiSymptomMapping) {
          // 3.1 AI 主動推薦的特效/常用成分 (recoIndex 已於上方計算)
          if (recoIndex !== -1) {
            // 排名越靠前(recoIndex越小)，分數加成越高
            score += Math.max(200, 3000 - recoIndex * 400);
          }

          // 3.2 / 3.3 分類與系統加成僅在有適應症佐證時給予，避免無佐證藥靠加成回升
          if (aiCorroborated) {
            if (aiSymptomMapping.classes.includes(m.pharmacologicalClass)) {
              score += 1500;
            }
            if (aiSymptomMapping.systems.includes(m.anatomicalSystem)) {
              score += 800;
            }
          }
        }

        // 4. 對臨床常見/常用成分常數加分 (保障基線常用度排序)
        const isCommonComponent = GENERAL_COMMON_INGREDIENTS.some((gci) => {
          return componentLower.includes(gci) || genericLower.includes(gci);
        });
        if (isCommonComponent) {
          score += 500;
        }

        // 5. 劑型常用度微調：全身性(口服/針劑)優先於局部劑型，口服固體又優先於液體。
        //    分數刻意小，僅打破同分，不影響臨床匹配大權重。
        score += formPrefScore(m.code);

        return score;
      };

      // 弱關聯門檻：純 Fuse 模糊雜訊（~1000）低於此值即剔除；
      // 字串包含（含字尾）5000、詞邊界 8000 以上均可通過。
      const MIN_RELEVANCE_SCORE = 3000;

      // 計算一次分數、剔除弱關聯、再排序（同時避免排序時重複計分）
      baseMeds = combinedMeds
        .map((m) => ({ m, score: getSortingScore(m) }))
        .filter((x) => x.score >= MIN_RELEVANCE_SCORE)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // 分數相同時，將品牌藥名長度短的、或者常用藥名排在前面，以防偏僻特殊物料卡在首位
          return (a.m.brandName || "").length - (b.m.brandName || "").length;
        })
        .map((x) => x.m);
    }

    return baseMeds.filter((med) => {
      const matchesFavorite = !onlyFavorites || isFavorite(med.id);

      const matchesSystem =
        selectedSystem === "全部系統" ||
        med.anatomicalSystem === selectedSystem;

      const matchesClass =
        selectedClass === "全部藥理" ||
        med.pharmacologicalClass === selectedClass;

      const matchesDosageForm =
        selectedDosageForms.length === 0 ||
        selectedDosageForms.includes(
          med.dosageForm || med.code?.charAt(0)?.toUpperCase() || "?",
        );

      return (
        matchesFavorite && matchesSystem && matchesClass && matchesDosageForm
      );
    });
  }, [
    medications,
    deferredSearchQuery,
    selectedSystem,
    selectedClass,
    selectedDosageForms,
    onlyFavorites,
    favorites,
    aiSymptomMapping,
  ]);

  const displayedMedications = useMemo(() => {
    return filteredMedications.slice(0, displayLimit);
  }, [filteredMedications, displayLimit]);

  if (loading) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center transition-colors duration-500",
          theme === "dark"
            ? "bg-gradient-to-br from-[#1F2232] via-[#0D0E16] to-[#030305]"
            : "bg-gradient-to-br from-slate-50 via-slate-100 to-white",
        )}
      >
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen font-sans flex flex-col overflow-hidden relative">
      {/* Settings Sidebar Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-transparent z-[100]"
            />
            <motion.div
              initial={{ x: "-105%" }}
              animate={{ x: 0 }}
              exit={{ x: "-105%" }}
              transition={{
                type: "spring",
                damping: 32,
                stiffness: 280,
                mass: 0.8,
                restDelta: 0.001,
              }}
              className={cn(
                "fixed inset-y-0 left-0 w-40 z-[110] shadow-2xl flex flex-col",
                theme === "dark"
                  ? "bg-zinc-950/30 border-r border-white/10 text-white backdrop-blur-md"
                  : "bg-white/30 border-r border-slate-200 text-slate-900 backdrop-blur-md",
              )}
            >
              {/* Header: Identity */}
              <div className="p-4 pt-10 pb-6 border-b border-inherit">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">
                      控制中心
                    </h2>
                    <p
                      className={cn(
                        "text-[8px] font-black uppercase tracking-[0.2em] opacity-60 mt-1",
                        theme === "dark" ? "text-zinc-400" : "text-slate-600",
                      )}
                    >
                      Preferences
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
                {/* Favorites Management Entry - Direct Button */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsFavoritesManagerOpen(true);
                      setIsSettingsOpen(false);
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all text-xs flex items-center justify-between group cursor-pointer shadow-sm",
                      theme === "dark"
                        ? "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-200 hover:border-brand-accent/30"
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-800 hover:border-brand-accent/30",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SharpStar
                        className={cn(
                          "w-3.5 h-3.5 text-amber-500",
                          favorites.length > 0 && "fill-amber-500",
                        )}
                      />
                      <span className="font-bold">收藏</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none",
                          theme === "dark"
                            ? "bg-white/10 text-zinc-400"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {favorites.length}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-brand-secondary-accent shrink-0" />
                  </button>
                </div>

                {/* Section: Mode/Theme - Segmented Switcher */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div
                      className={cn(
                        "p-1 rounded-xl flex items-center gap-1 border relative transition-colors h-10",
                        theme === "dark"
                          ? "bg-white/5 border-white/10"
                          : "bg-slate-100 border-slate-200",
                      )}
                    >
                      <motion.div
                        className={cn(
                          "absolute h-[calc(100%-8px)] rounded-lg shadow-md z-0",
                          theme === "dark"
                            ? "bg-zinc-800 border border-white/10"
                            : "bg-white border border-slate-200",
                        )}
                        initial={false}
                        animate={{
                          left: theme === "dark" ? "calc(50% + 1px)" : "4px",
                          width: "calc(50% - 5px)",
                        }}
                        transition={{
                          type: "spring",
                          bounce: 0.1,
                          duration: 0.5,
                        }}
                      />

                      <button
                        onClick={() => setTheme("light")}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === "light"
                            ? "text-amber-500"
                            : "text-zinc-500 hover:text-zinc-400",
                        )}
                      >
                        <Sun className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setTheme("dark")}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === "dark"
                            ? "text-indigo-400"
                            : "text-zinc-500 hover:text-zinc-400",
                        )}
                      >
                        <Moon className="w-4 h-4" />
                      </button>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-[0.2em] text-center opacity-60",
                        theme === "dark" ? "text-zinc-400" : "text-slate-600",
                      )}
                    >
                      Theme Mode
                    </span>
                  </div>
                </div>

                {/* Integrated Status & Sync */}
                <div className="pt-6 border-t border-inherit flex flex-col items-center gap-4">
                  <div className="relative group">
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all relative overflow-hidden",
                        theme === "dark"
                          ? "bg-white/5 hover:bg-brand-accent/20 border border-white/5 text-zinc-400 hover:text-brand-accent"
                          : "bg-slate-50 hover:bg-brand-accent/10 border border-slate-100 text-slate-400 hover:text-brand-accent shadow-sm",
                      )}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                      {!isSyncing && isUpdateAvailable && (
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-inherit animate-pulse" />
                      )}
                    </button>
                  </div>
                  <div className="text-center space-y-1">
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-[0.1em] block",
                        isSyncing ? "text-amber-500" : "text-emerald-500",
                      )}
                    >
                      {isSyncing ? "Syncing..." : "Connected"}
                    </span>
                    <span
                      className={cn(
                        "text-[8px] font-medium opacity-60 block",
                        theme === "dark" ? "text-zinc-500" : "text-slate-600",
                      )}
                    >
                      API Status
                    </span>
                  </div>
                </div>

                {/* PWA Install */}
                {!isStandalone && (
                  <div className="pt-6 border-t border-inherit">
                    <button
                      onClick={handleInstallApp}
                      className={cn(
                        "w-full flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 group hover:scale-[1.02] active:scale-95",
                        theme === "dark"
                          ? "bg-brand-accent/20 border border-brand-accent/30"
                          : "bg-brand-accent/10 border border-brand-accent/20 shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center bg-brand-accent text-white shadow-lg shadow-brand-accent/20 group-hover:rotate-12 transition-transform",
                        )}
                      >
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-brand-accent block">
                          安裝應用程式
                        </span>
                        <span
                          className={cn(
                            "text-[8px] font-medium opacity-60 block",
                            theme === "dark"
                              ? "text-zinc-500"
                              : "text-slate-600",
                          )}
                        >
                          {deferredPrompt
                            ? "Install Web App"
                            : "Add to Home Screen (Guide)"}
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Build Info */}
                <div className="pt-6 border-t border-inherit space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        theme === "dark"
                          ? "bg-white/5"
                          : "bg-slate-50 border border-slate-100",
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <div className="text-center space-y-1">
                      <span
                        className={cn(
                          "text-[10px] font-bold block",
                          theme === "dark" ? "text-zinc-400" : "text-slate-600",
                        )}
                      >
                        Build Ver.
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-mono px-2 py-0.5 rounded border border-inherit leading-none block",
                          theme === "dark"
                            ? "bg-zinc-800 text-zinc-300 border-white/10"
                            : "bg-slate-50 text-slate-600 border-slate-200",
                        )}
                      >
                        {buildVersion}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                className={cn(
                  "p-6 border-t border-inherit",
                  theme === "dark" ? "bg-black/20" : "bg-slate-50/50",
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 opacity-20">
                    <span className="text-[9px] font-black tracking-[0.4em] uppercase">
                      HMSS
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-[8px] text-center leading-tight opacity-50 font-medium",
                      theme === "dark" ? "text-zinc-400" : "text-slate-600",
                    )}
                  >
                    Professional Ref Only.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Enhanced Background Glows for Glass Visibility */}
      <div
        className={cn(
          "absolute top-[-5%] right-[-5%] w-[50%] h-[50%] blur-[140px] rounded-full pointer-events-none z-0 animate-pulse",
          theme === "dark" ? "bg-brand-accent/10" : "bg-brand-accent/5",
        )}
      ></div>
      <div
        className={cn(
          "absolute bottom-[10%] left-[-10%] w-[45%] h-[45%] blur-[120px] rounded-full pointer-events-none z-0",
          theme === "dark" ? "bg-brand-secondary-accent/5" : "bg-brand-secondary-accent/3",
        )}
      ></div>
      <div
        className={cn(
          "absolute top-[30%] left-[20%] w-[30%] h-[30%] blur-[100px] rounded-full pointer-events-none z-0",
          theme === "dark" ? "bg-blue-500/5" : "bg-blue-500/3",
        )}
      ></div>

      {/* Decorative Background Lines */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke={
                  theme === "dark"
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.03)"
                }
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <line
            x1="10%"
            y1="0"
            x2="40%"
            y2="100%"
            stroke={
              theme === "dark"
                ? (isAiMode ? "rgba(139,92,246,0.08)" : "rgba(13,148,136,0.08)")
                : (isAiMode ? "rgba(139,92,246,0.12)" : "rgba(13,148,136,0.12)")
            }
            strokeWidth="1"
          />
          <line
            x1="60%"
            y1="0"
            x2="30%"
            y2="100%"
            stroke={
              theme === "dark"
                ? (isAiMode ? "rgba(249,115,22,0.05)" : "rgba(6,182,212,0.05)")
                : (isAiMode ? "rgba(249,115,22,0.08)" : "rgba(6,182,212,0.08)")
            }
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="20%"
            x2="100%"
            y2="40%"
            stroke={
              theme === "dark"
                ? (isAiMode ? "rgba(139,92,246,0.04)" : "rgba(13,148,136,0.04)")
                : (isAiMode ? "rgba(139,92,246,0.06)" : "rgba(13,148,136,0.06)")
            }
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="80%"
            x2="100%"
            y2="60%"
            stroke={
              theme === "dark"
                ? (isAiMode ? "rgba(249,115,22,0.06)" : "rgba(6,182,212,0.06)")
                : (isAiMode ? "rgba(249,115,22,0.1)" : "rgba(6,182,212,0.1)")
            }
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Header */}
      <header
        className={cn(
          "h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-2xl transition-all duration-500",
          isAiMode
            ? "border-purple-500/20 bg-brand-header/40 backdrop-blur-3xl shadow-purple-500/5"
            : cn(
                "backdrop-blur-3xl",
                theme === "dark"
                  ? "border-white/5 bg-brand-header/30 shadow-black/50"
                  : "border-slate-200 bg-white/70 shadow-slate-200/50",
              ),
        )}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
              "p-2 rounded-xl border transition-all duration-300",
              theme === "dark"
                ? "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
            )}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-6">
            {/* Segmented Tab Switcher */}
            <div
              className={cn(
                "p-1 rounded-xl flex items-center gap-1 border relative w-48 sm:w-64 transition-colors",
                theme === "dark"
                  ? "bg-white/5 border-white/10"
                  : "bg-slate-100 border-slate-200",
              )}
            >
              {/* Sliding background */}
              <motion.div
                layoutId="activeTab"
                className={cn(
                  "absolute h-[calc(100%-8px)] rounded-lg shadow-lg z-0",
                  isAiMode
                    ? "bg-gradient-to-r from-violet-600 to-orange-500"
                    : "bg-gradient-to-r from-teal-600 to-cyan-500",
                )}
                initial={false}
                animate={{
                  left: isAiMode ? "calc(50% + 2px)" : "4px",
                  width: "calc(50% - 6px)",
                }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.6 }}
              />

              <button
                onClick={exitAiMode}
                className={cn(
                  "relative z-10 flex-1 py-2 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2",
                  !isAiMode
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Pill
                  className={cn(
                    "w-4 h-4 transition-colors",
                    !isAiMode ? "text-white" : "text-zinc-500",
                  )}
                />
                <span className="hidden sm:inline whitespace-nowrap">
                  HMSS 查詢
                </span>
                <span className="sm:hidden">HMSS</span>
              </button>

              <button
                onClick={() => setIsAiMode(true)}
                className={cn(
                  "relative z-10 flex-1 py-2 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2",
                  isAiMode ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Sparkles
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isAiMode ? "text-white" : "text-zinc-500",
                  )}
                />
                <span className="hidden sm:inline whitespace-nowrap">
                  AI 助理
                </span>
                <span className="sm:hidden">AI</span>
              </button>
            </div>

            <div className="hidden lg:flex flex-col">
              <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                {isAiMode ? "Smart Analysis" : "Hospital System"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {importStatus && (
            <div className="hidden lg:flex items-center gap-2 text-[9px] text-brand-accent font-bold bg-brand-accent/5 px-3 py-1.5 rounded-full border border-brand-accent/20 animate-pulse">
              <CheckCircle2 className="w-3 h-3" /> {importStatus}
            </div>
          )}

          <div className="hidden md:flex flex-col items-end mr-1">
            <p className="text-[8px] text-brand-accent font-bold uppercase tracking-widest leading-none">
              {isSyncing ? "Cloud Syncing" : "Connected"}
            </p>
          </div>

          <button
            id="help-button"
            onClick={() => setIsHelpOpen(true)}
            className={cn(
              "p-2 rounded-xl border transition-all duration-300 flex items-center justify-center gap-1.5",
              theme === "dark"
                ? "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
            )}
            title="操作指引與幫助"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">幫助</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Area */}
        <main className="flex-1 flex flex-col bg-transparent overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {!isAiMode ? (
              <motion.div
                key="standard-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.5 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Top Search & Filter Toolbar */}
                <div className="absolute top-0 left-0 right-0 z-40 bg-transparent p-3 md:p-4 pointer-events-none">
                  <div className="flex items-center gap-3 pointer-events-auto">
                    {/* Global Search */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.querySelector("input");
                        if (input) input.blur();
                      }}
                      className={cn(
                        "relative flex-1 group dropdown-container p-[1.5px] rounded-2xl transition-all shadow-2xl",
                        theme === "dark"
                          ? "bg-gradient-to-r from-teal-600/60 to-cyan-500/60 focus-within:from-teal-600 focus-within:to-cyan-500 shadow-brand-accent/20"
                          : "bg-gradient-to-r from-teal-600/40 to-cyan-500/40 focus-within:from-teal-605 focus-within:to-cyan-500/70 shadow-slate-200",
                      )}
                    >
                      <Search
                        className={cn(
                          "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors",
                          theme === "dark"
                            ? "text-zinc-500 group-focus-within:text-brand-accent"
                            : "text-slate-400 group-focus-within:text-brand-accent",
                        )}
                      />
                      <input
                        ref={searchInputRef}
                        type="text"
                        enterKeyHint="search"
                        placeholder="搜尋成分、代碼、適應症..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className={cn(
                          "w-full backdrop-blur-3xl border-none rounded-[15px] pl-11 py-3 text-sm focus:outline-none focus:ring-0 transition-all font-medium",
                          searchQuery ? "pr-20 md:pr-12" : "pr-4 md:pr-4",
                          theme === "dark"
                            ? "bg-black/90 text-white placeholder:text-zinc-600"
                            : "bg-white/90 text-slate-800 placeholder:text-slate-400",
                        )}
                      />

                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {searchQuery && (
                          <button
                            type="submit"
                            className="md:hidden p-1.5 text-brand-accent hover:text-brand-secondary-accent transition-colors"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Compact Filter Toggle */}
                    <div className="relative filter-popover-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFilters(!showFilters);
                        }}
                        className={cn(
                          "h-[46px] px-4 rounded-xl border transition-all flex items-center justify-center gap-2 shadow-sm font-bold text-xs uppercase tracking-widest",
                          showFilters ||
                            selectedSystem !== "全部系統" ||
                            selectedClass !== "全部藥理" ||
                            selectedDosageForms.length > 0
                            ? "bg-brand-accent/20 border-brand-accent/40 text-brand-accent"
                            : cn(
                                "transition-colors",
                                theme === "dark"
                                  ? "bg-white/[0.03] border-white/10 text-brand-muted hover:text-white hover:bg-white/[0.05]"
                                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm shadow-slate-200",
                              ),
                        )}
                      >
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">篩選</span>
                        {(selectedSystem !== "全部系統" ||
                          selectedClass !== "全部藥理" ||
                          selectedDosageForms.length > 0 ||
                          onlyFavorites) && (
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full bg-brand-accent absolute -top-1 -right-1 shadow-lg border animate-pulse",
                              theme === "dark"
                                ? "shadow-brand-accent/50 border-brand-bg"
                                : "shadow-brand-accent/30 border-white",
                            )}
                          />
                        )}
                      </button>

                      <AnimatePresence>
                        {showFilters && (
                          <motion.div
                            key="filter-popover"
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{
                              ease: [0.22, 1, 0.36, 1],
                              duration: 0.5,
                            }}
                            className={cn(
                              "absolute top-full right-0 mt-3 w-80 backdrop-blur-3xl border rounded-2xl shadow-2xl z-[100] p-4 flex flex-col gap-4",
                              theme === "dark"
                                ? "bg-brand-sidebar/95 border-white/10 shadow-black/50"
                                : "bg-white border-slate-200 shadow-slate-200/60",
                            )}
                          >
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em]">
                                分類篩選
                              </span>
                              <button
                                onClick={() => setShowFilters(false)}
                                className={cn(
                                  "transition-colors",
                                  theme === "dark"
                                    ? "text-zinc-500 hover:text-white"
                                    : "text-slate-400 hover:text-slate-600",
                                )}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-4">
                              <div className="space-y-3">
                                {/* Compact Favorites Toggle */}
                                <div
                                  className="flex items-center justify-between p-2 pl-3 rounded-lg border transition-colors group cursor-pointer"
                                  onClick={() =>
                                    setOnlyFavorites(!onlyFavorites)
                                  }
                                  style={{
                                    backgroundColor:
                                      theme === "dark"
                                        ? "rgba(255,255,255,0.02)"
                                        : "rgba(0,0,0,0.01)",
                                    borderColor:
                                      theme === "dark"
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.05)",
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <SharpStar
                                      className={cn(
                                        "w-3 h-3",
                                        onlyFavorites
                                          ? "fill-amber-500 text-amber-500"
                                          : theme === "dark"
                                            ? "text-zinc-600"
                                            : "text-slate-300",
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider",
                                        theme === "dark"
                                          ? "text-zinc-300"
                                          : "text-slate-700",
                                      )}
                                    >
                                      僅顯示收藏
                                    </span>
                                  </div>
                                  <div
                                    className={cn(
                                      "w-8 h-4 rounded-full relative transition-colors border p-0.5",
                                      onlyFavorites
                                        ? "bg-brand-accent border-brand-accent"
                                        : theme === "dark"
                                          ? "bg-zinc-800 border-white/10"
                                          : "bg-slate-200 border-slate-300",
                                    )}
                                  >
                                    <motion.div
                                      animate={{ x: onlyFavorites ? 16 : 0 }}
                                      className="w-2.5 h-2.5 rounded-full bg-white shadow-sm"
                                    />
                                  </div>
                                </div>

                                {/* System & Class combined in a grid */}
                                <div className="grid grid-cols-2 gap-2">
                                  {/* Anatomical System Filter */}
                                  <div className="space-y-1 overflow-visible dropdown-container">
                                    <label
                                      className={cn(
                                        "text-[9px] font-bold uppercase tracking-widest pl-1",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      系統
                                    </label>
                                    <div
                                      className="relative"
                                      onBlur={(e) => {
                                        if (
                                          !e.currentTarget.contains(
                                            e.relatedTarget as Node,
                                          )
                                        ) {
                                          setIsSystemOpen(false);
                                        }
                                      }}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsSystemOpen(!isSystemOpen);
                                          setIsClassOpen(false);
                                          setIsDosageFormOpen(false);
                                        }}
                                        className={cn(
                                          "w-full border rounded-lg pl-3 pr-2 py-2 text-[10px] flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all shadow-sm group",
                                          theme === "dark"
                                            ? "bg-white/5 border-white/10 text-zinc-200"
                                            : "bg-slate-50 border-slate-200 text-slate-700",
                                        )}
                                      >
                                        <span className="truncate font-medium">
                                          {selectedSystem === "全部系統"
                                            ? "全部系統"
                                            : selectedSystem}
                                        </span>
                                        <ChevronDown
                                          className={cn(
                                            "w-3 h-3 text-brand-muted shrink-0 transition-transform",
                                            isSystemOpen && "rotate-180",
                                          )}
                                        />
                                      </button>

                                      <AnimatePresence>
                                        {isSystemOpen && (
                                          <motion.div
                                            key="system-dropdown"
                                            initial={{
                                              opacity: 0,
                                              scale: 0.95,
                                            }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={cn(
                                              "absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl z-[110] max-h-48 overflow-y-auto p-1",
                                              theme === "dark"
                                                ? "bg-brand-header border-white/10"
                                                : "bg-white border-slate-200",
                                            )}
                                          >
                                            {anatomicalSystems.map((s) => (
                                              <button
                                                key={s}
                                                onClick={() => {
                                                  setSelectedSystem(s);
                                                  setSelectedClass("全部藥理");
                                                  setIsSystemOpen(false);
                                                }}
                                                className={cn(
                                                  "w-full text-left px-2 py-1.5 rounded-md text-[10px] transition-all flex items-center justify-between",
                                                  selectedSystem === s
                                                    ? "bg-brand-accent/20 text-brand-accent font-bold"
                                                    : theme === "dark"
                                                      ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                      : "text-slate-600 hover:bg-slate-50 hover:text-brand-accent",
                                                )}
                                              >
                                                {s}
                                              </button>
                                            ))}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>

                                  {/* Pharmacological Class Filter */}
                                  <div className="space-y-1 overflow-visible dropdown-container">
                                    <label
                                      className={cn(
                                        "text-[9px] font-bold uppercase tracking-widest pl-1",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      藥理
                                    </label>
                                    <div
                                      className="relative"
                                      onBlur={(e) => {
                                        if (
                                          !e.currentTarget.contains(
                                            e.relatedTarget as Node,
                                          )
                                        ) {
                                          setIsClassOpen(false);
                                        }
                                      }}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsClassOpen(!isClassOpen);
                                          setIsSystemOpen(false);
                                          setIsDosageFormOpen(false);
                                        }}
                                        className={cn(
                                          "w-full border rounded-lg pl-3 pr-2 py-2 text-[10px] flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all shadow-sm group",
                                          theme === "dark"
                                            ? "bg-white/5 border-white/10 text-zinc-200"
                                            : "bg-slate-50 border-slate-200 text-slate-700",
                                        )}
                                      >
                                        <span className="truncate font-medium">
                                          {selectedClass === "全部藥理"
                                            ? "全部藥理"
                                            : selectedClass}
                                        </span>
                                        <ChevronDown
                                          className={cn(
                                            "w-3 h-3 text-brand-muted shrink-0 transition-transform",
                                            isClassOpen && "rotate-180",
                                          )}
                                        />
                                      </button>

                                      <AnimatePresence>
                                        {isClassOpen && (
                                          <motion.div
                                            key="class-dropdown"
                                            initial={{
                                              opacity: 0,
                                              scale: 0.95,
                                            }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={cn(
                                              "absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl z-[110] max-h-48 overflow-y-auto p-1",
                                              theme === "dark"
                                                ? "bg-brand-header border-white/10"
                                                : "bg-white border-slate-200",
                                            )}
                                          >
                                            {pharmacologicalClasses.map((c) => (
                                              <button
                                                key={c}
                                                onClick={() => {
                                                  setSelectedClass(c);
                                                  setIsClassOpen(false);
                                                }}
                                                className={cn(
                                                  "w-full text-left px-2 py-1.5 rounded-md text-[10px] transition-all flex items-center justify-between",
                                                  selectedClass === c
                                                    ? "bg-brand-accent/20 text-brand-accent font-bold"
                                                    : theme === "dark"
                                                      ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                      : "text-slate-600 hover:bg-slate-50 hover:text-brand-accent",
                                                )}
                                              >
                                                {c}
                                              </button>
                                            ))}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                </div>

                                {/* Dosage Form Filter - Multi-select Tags */}
                                <div className="space-y-2 overflow-visible">
                                  <div className="flex items-center justify-between px-1">
                                    <label
                                      className={cn(
                                        "text-[9px] font-bold uppercase tracking-widest",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      劑型 (多選)
                                    </label>
                                    {selectedDosageForms.length > 0 && (
                                      <button
                                        onClick={() =>
                                          setSelectedDosageForms([])
                                        }
                                        className="text-[9px] text-brand-accent font-bold hover:underline"
                                      >
                                        重設
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 p-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                                    {dosageForms
                                      .filter((f) => f !== "全部劑型")
                                      .map((f) => {
                                        const isSelected =
                                          selectedDosageForms.includes(f);
                                        const dosageStyle = getDosageColor(f);
                                        return (
                                          <button
                                            key={f}
                                            onClick={() => {
                                              setSelectedDosageForms((prev) =>
                                                prev.includes(f)
                                                  ? prev.filter(
                                                      (item) => item !== f,
                                                    )
                                                  : [...prev, f],
                                              );
                                            }}
                                            className={cn(
                                              "px-2 py-1 rounded-md text-[9px] font-bold transition-all border flex items-center gap-1.5",
                                              isSelected
                                                ? cn(
                                                    dosageStyle.bg,
                                                    dosageStyle.text,
                                                    "border-transparent",
                                                  )
                                                : theme === "dark"
                                                  ? "bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10"
                                                  : "bg-slate-100/50 border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                isSelected
                                                  ? dosageStyle.glow
                                                  : "bg-zinc-700",
                                              )}
                                            />
                                            {getDosageName(f)}
                                          </button>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5">
                              <button
                                onClick={() => {
                                  setSelectedSystem("全部系統");
                                  setSelectedClass("全部藥理");
                                  setSelectedDosageForms([]);
                                  setShowFilters(false);
                                }}
                                className="w-full py-2 text-[10px] text-zinc-500 hover:text-brand-accent font-bold uppercase tracking-[0.2em] transition-all"
                              >
                                重設篩選條件
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div
                  ref={scrollContainerRef}
                  className={cn(
                    "flex-1 pt-[72px] md:pt-[80px] px-3 md:px-5 overflow-y-auto custom-scrollbar bg-gradient-to-b from-white/[0.02] to-transparent transition-all duration-500",
                    selectedMed ? "pb-[40vh] md:pb-5" : "pb-5",
                  )}
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    if (
                      target.scrollHeight -
                        target.scrollTop -
                        target.clientHeight <
                      200
                    ) {
                      if (displayLimit < filteredMedications.length) {
                        setDisplayLimit((prev) => prev + 100);
                      }
                    }
                  }}
                >
                  {/* AI Symptom Recognition Banner (由使用者點選開啟) */}
                  {isQueryValidForAi && !isAiSymptomRequested && (
                    <motion.button
                      id="ai-symptom-trigger-btn"
                      onClick={() => setIsAiSymptomRequested(true)}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "w-full mb-3.5 px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs shadow-sm transition-all duration-300",
                        theme === "dark"
                          ? "bg-brand-accent/[0.03] hover:bg-brand-accent/[0.08] border-brand-accent/20 hover:border-brand-accent/40 text-brand-accent"
                          : "bg-brand-accent/[0.015] hover:bg-brand-accent/[0.04] border-brand-accent/15 hover:border-brand-accent/30 text-brand-accent",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI 輔助機轉查詢</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-medium opacity-80 shrink-0">
                        <span>分析</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.button>
                  )}

                  {isAiSymptomRequested && (isSymptomAnalyzing || aiSymptomMapping || aiSymptomError) && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "mb-3.5 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center gap-2 text-xs shadow-sm shadow-brand-accent/5",
                        aiSymptomError
                          ? theme === "dark"
                            ? "bg-red-500/[0.05] border-red-500/20 text-zinc-300"
                            : "bg-red-500/[0.04] border-red-500/15 text-slate-700"
                          : theme === "dark"
                            ? "bg-brand-accent/[0.03] border-brand-accent/20 text-zinc-300"
                            : "bg-brand-accent/[0.015] border-brand-accent/15 text-slate-700",
                      )}
                    >
                      <div className="flex items-center gap-1.5 shrink-0 font-bold text-brand-accent">
                        <Sparkles className={cn("w-3.5 h-3.5", isSymptomAnalyzing && "animate-pulse")} />
                        <span>關聯機轉：</span>
                      </div>

                      {isSymptomAnalyzing ? (
                        <span className="text-[11px] text-brand-accent/70 animate-pulse font-medium">分析中...</span>
                      ) : aiSymptomError ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-red-400 font-medium">{aiSymptomError}</span>
                          <button
                            onClick={() => { setAiSymptomError(null); setIsAiSymptomRequested(false); setTimeout(() => setIsAiSymptomRequested(true), 0); }}
                            className="text-[10px] font-bold text-brand-accent underline underline-offset-2"
                          >重試</button>
                        </div>
                      ) : (aiSymptomMapping && (aiSymptomMapping.classes.length > 0 || aiSymptomMapping.systems.length > 0)) ? (
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          {aiSymptomMapping?.classes.map((cls) => (
                            <span key={cls} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/25">
                              {cls}
                            </span>
                          ))}
                          {aiSymptomMapping?.systems.map((sys) => (
                            <span key={sys} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-secondary-accent/10 text-brand-secondary-accent border border-brand-secondary-accent/25">
                              {sys}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">未查得顯著相關之藥理分類/生理系統機轉</span>
                      )}
                    </motion.div>
                  )}

                  <div className="flex flex-col md:flex-row md:items-end justify-end gap-3 mb-2 md:mb-2.5">
                    {(searchQuery ||
                      selectedSystem !== "全部系統" ||
                      selectedClass !== "全部藥理" ||
                      selectedDosageForms.length > 0) && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedSystem("全部系統");
                          setSelectedClass("全部藥理");
                          setSelectedDosageForms([]);
                        }}
                        className="flex items-center gap-2 text-[10px] font-black text-brand-muted hover:text-brand-accent transition-all uppercase tracking-[0.2em] self-start px-3 py-1.5 rounded-lg hover:bg-brand-accent/5"
                      >
                        重設所有篩選 <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {displayedMedications.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {displayedMedications.map((med) => {
                          const dosageStyle = getDosageColor(med.code);
                          return (
                            <motion.div
                              key={med.id}
                              layout="position"
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.98 }}
                              transition={{
                                type: "spring",
                                bounce: 0,
                                duration: 0.4,
                                layout: {
                                  type: "spring",
                                  bounce: 0.1,
                                  duration: 0.6,
                                },
                              }}
                              onClick={() => {
                                if (isLongPressRef.current) {
                                  isLongPressRef.current = false;
                                  return;
                                }
                                setSelectedMed(med); setMobileExpanded(false);
                              }}
                              onMouseDown={() => startLongPress(med.code)}
                              onMouseUp={cancelLongPress}
                              onMouseLeave={cancelLongPress}
                              onTouchStart={() => startLongPress(med.code)}
                              onTouchEnd={cancelLongPress}
                              onTouchMove={cancelLongPress}
                              className={cn(
                                "medication-card group bg-transparent border border-transparent p-2 md:p-2.5 rounded-xl transition-all flex flex-col gap-1 items-start relative overflow-hidden select-none",
                                theme === "dark"
                                  ? "hover:bg-white/[0.05] hover:shadow-2xl cursor-pointer"
                                  : "hover:bg-white hover:shadow-xl hover:shadow-slate-200/60 cursor-pointer",
                              )}
                              title="點擊開啟藥物詳情，長按亦可直接複製代碼"
                            >
                              {/* Left Vertical Bar Decoration */}
                              <div
                                className={cn(
                                  "absolute top-0 left-0 bottom-0 w-[1px] transition-[width] group-hover:w-[2px]",
                                  dosageStyle.glow,
                                )}
                              />

                              <div className="flex gap-2 items-start w-full pl-1.5">
                                <div className="flex-1 min-w-0">
                                  {/* Top Row: Code & Class */}
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyCode(med.code);
                                        }}
                                        className={cn(
                                          "inline-flex items-center px-1.5 py-[0.5px] rounded text-[9px] font-black tracking-widest uppercase shrink-0 border transition-all active:scale-95 cursor-pointer selection:bg-transparent",
                                          theme === "dark"
                                            ? "border-white/20 bg-white/[0.02] hover:bg-white/[0.1]"
                                            : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                                          dosageStyle.text,
                                        )}
                                        title="點擊直接複製藥物代碼"
                                      >
                                        <span>{med.code}</span>
                                      </button>
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold uppercase tracking-wider truncate",
                                          theme === "dark"
                                            ? "text-brand-accent/90"
                                            : "text-brand-accent",
                                        )}
                                      >
                                        {med.pharmacologicalClass}
                                      </span>
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFavorite(med.id);
                                      }}
                                      className="p-1 -mr-1 group/fav cursor-pointer"
                                    >
                                      <SharpStar
                                        className={cn(
                                          "w-3.5 h-3.5 transition-colors",
                                          isFavorite(med.id)
                                            ? "fill-amber-400 text-amber-400"
                                            : theme === "dark"
                                              ? "text-zinc-800 group-hover/fav:text-amber-400/50"
                                              : "text-slate-200 group-hover/fav:text-amber-400/50",
                                        )}
                                      />
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between mb-0.5 gap-1.5">
                                    <h3
                                      className={cn(
                                        "text-[13px] md:text-[15px] font-bold transition-colors truncate leading-tight flex items-center gap-1.5",
                                        theme === "dark"
                                          ? "text-white group-hover:text-brand-accent"
                                          : "text-slate-800 group-hover:text-brand-accent",
                                      )}
                                    >
                                      <span className="truncate">
                                        {med.component}
                                      </span>
                                    </h3>
                                  </div>

                                  <div className="flex flex-col gap-0.5">
                                    <span
                                      className={cn(
                                        "text-[10px] font-medium truncate opacity-70",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-500",
                                      )}
                                    >
                                      {med.genericName}{" "}
                                      {med.chineseName &&
                                        `• ${med.chineseName}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      {displayLimit < filteredMedications.length && (
                        <div className="col-span-full py-8 flex flex-col items-center gap-4">
                          <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                          <button
                            onClick={() =>
                              setDisplayLimit((prev) => prev + 100)
                            }
                            className="flex items-center gap-2 text-[10px] font-black text-brand-muted hover:text-brand-accent transition-all uppercase tracking-[0.2em] px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08]"
                          >
                            載入更多藥物 (
                            {filteredMedications.length - displayLimit} 筆)
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : isSearchingOrFiltering ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <Search className="w-16 h-16 text-brand-muted mb-4 stroke-[0.5]" />
                      <h3
                        className={cn(
                          "text-xl font-medium mb-2",
                          theme === "dark" ? "text-white" : "text-slate-700",
                        )}
                      >
                        查無相關結果
                      </h3>
                      <p className="text-brand-muted text-sm mb-8">
                        請嘗試不同的診斷名、成分或藥品碼
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 md:py-20 px-4 max-w-xl mx-auto">
                      <div
                        className={cn(
                          "w-16 h-16 rounded-3xl flex items-center justify-center border mb-6 shadow-lg",
                          theme === "dark"
                            ? "bg-brand-accent/10 border-brand-accent/20 text-brand-accent shadow-brand-accent/5"
                            : "bg-brand-accent/10 border-brand-accent/20 text-brand-accent shadow-brand-accent/10",
                        )}
                      >
                        <Pill className="w-8 h-8 stroke-[1.25]" />
                      </div>
                      <h3
                        className={cn(
                          "text-lg md:text-xl font-bold tracking-tight mb-2.5",
                          theme === "dark" ? "text-white" : "text-slate-800",
                        )}
                      >
                        院內藥物查詢系統
                      </h3>
                      <p
                        className={cn(
                          "text-xs md:text-sm max-w-sm mb-8 leading-relaxed",
                          theme === "dark" ? "text-zinc-500" : "text-slate-500",
                        )}
                      >
                        請在上方輸入關鍵字開始搜尋，或使用篩選按鈕依據系統、藥理分類、劑型進行篩選。
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                        <div
                          onClick={() => {
                            searchInputRef.current?.focus();
                          }}
                          className={cn(
                            "p-4 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer",
                            theme === "dark"
                              ? "bg-white/[0.02] border-white/5 hover:border-brand-accent/40 hover:bg-brand-accent/[0.03]"
                              : "bg-slate-50/50 border-slate-200/60 hover:border-brand-accent/30 hover:bg-brand-accent/[0.02] shadow-sm shadow-slate-100",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Search className="w-4 h-4 text-brand-accent" />
                            <h4
                              className={cn(
                                "text-xs font-bold",
                                theme === "dark"
                                  ? "text-zinc-300"
                                  : "text-slate-700",
                              )}
                            >
                              快速關鍵字搜尋
                            </h4>
                          </div>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed",
                              theme === "dark"
                                ? "text-zinc-500"
                                : "text-slate-400",
                            )}
                          >
                            支援輸入藥品成分（如
                            Dextrose）、商品名、英文簡寫（如
                            NS）、中文名或特定適應症群。
                          </p>
                        </div>

                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFilters(true);
                          }}
                          className={cn(
                            "p-4 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer",
                            theme === "dark"
                              ? "bg-white/[0.02] border-white/5 hover:border-brand-accent/40 hover:bg-brand-accent/[0.03]"
                              : "bg-slate-50/50 border-slate-200/60 hover:border-brand-accent/30 hover:bg-brand-accent/[0.02] shadow-sm shadow-slate-100",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Filter className="w-4 h-4 text-brand-accent" />
                            <h4
                              className={cn(
                                "text-xs font-bold",
                                theme === "dark"
                                  ? "text-zinc-300"
                                  : "text-slate-700",
                              )}
                            >
                              進階屬性篩選
                            </h4>
                          </div>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed",
                              theme === "dark"
                                ? "text-zinc-500"
                                : "text-slate-400",
                            )}
                          >
                            點擊搜尋框右側的「篩選」按鈕，即可選取特定生理系統、特定藥理分類或給藥劑型進行組合檢驗。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="ai-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.5 }}
                className="flex-1 flex flex-col overflow-hidden p-4 md:p-8"
              >
                <div className="max-w-4xl mx-auto w-full flex flex-col h-full gap-6">
                  <div className="flex-1 min-h-0 flex flex-col relative">
                    <div className="flex-1 p-[1px] rounded-[32px] bg-gradient-to-br from-blue-500/15 via-purple-500/15 to-orange-500/15 overflow-hidden shadow-2xl">
                      <div className="h-full w-full bg-brand-bg/40 backdrop-blur-3xl rounded-[31px] overflow-hidden flex flex-col relative">
                        {/* Floating Search Bar Overlay */}
                        <div className="absolute top-0 left-0 right-0 z-40 p-2 md:p-3 bg-transparent pointer-events-none">
                          <form
                            onSubmit={handleAiSearch}
                            className="relative group p-[1.5px] rounded-2xl bg-gradient-to-r from-blue-500/60 via-purple-500/60 to-orange-500/60 focus-within:from-blue-500 focus-within:via-purple-500 focus-within:to-orange-500 transition-all shadow-2xl pointer-events-auto"
                          >
                            <input
                              type="text"
                              placeholder="輸入臨床情境分析藥物"
                              value={aiQuery}
                              onChange={(e) => setAiQuery(e.target.value)}
                              className={cn(
                                "w-full backdrop-blur-xl border-none rounded-[15px] pl-5 pr-14 py-3 text-sm md:text-base focus:outline-none focus:ring-0 transition-all font-medium shadow-2xl",
                                theme === "dark"
                                  ? "bg-black/80 text-white placeholder:text-zinc-500"
                                  : "bg-white/95 text-slate-800 placeholder:text-slate-400",
                              )}
                            />
                            <button
                              type="submit"
                              disabled={isAiLoading || !aiQuery.trim()}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-orange-500 text-white flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-95"
                            >
                              {isAiLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ArrowRight className="w-4 h-4" />
                              )}
                            </button>
                          </form>
                        </div>

                        {/* Content Area */}
                        <div
                          className={cn(
                            "flex-1 overflow-y-auto custom-scrollbar pt-[62px] md:pt-[70px] px-4 md:px-8 transition-all duration-500",
                            selectedMed ? "pb-[40vh] md:pb-8" : "pb-8",
                          )}
                        >
                          {aiHistory.length === 0 && !isAiLoading && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20">
                              <Database className="w-12 h-12 mb-4 stroke-1" />
                              <p className="text-zinc-400 font-medium tracking-wide">
                                等待輸入諮詢內容...
                              </p>
                            </div>
                          )}

                          <div className="space-y-12">
                            {/* Conversation History (Include current results) */}
                            {aiHistory.length > 0 && (
                              <div className="space-y-6">
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                  <div className="flex items-center gap-2">
                                    <History className="w-4 h-4 text-zinc-500" />
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                                      諮詢對話
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setAiHistory([])}
                                    className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors uppercase tracking-widest font-bold"
                                  >
                                    清除紀錄
                                  </button>
                                </div>

                                <div className="space-y-8">
                                  {aiHistory.map((item, hIdx) => (
                                    <motion.div
                                      key={`history-${item.timestamp}`}
                                      initial={{ opacity: 0, scale: 0.99 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{
                                        ease: [0.22, 1, 0.36, 1],
                                        duration: 0.6,
                                      }}
                                      className="space-y-3"
                                    >
                                      {/* User Question */}
                                      <div className="flex items-start gap-3">
                                        <div
                                          className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border shadow-lg",
                                            theme === "dark"
                                              ? "bg-white/10 border-white/10"
                                              : "bg-slate-100 border-slate-200 shadow-slate-200",
                                          )}
                                        >
                                          <User
                                            className={cn(
                                              "w-3.5 h-3.5",
                                              theme === "dark"
                                                ? "text-zinc-400"
                                                : "text-slate-500",
                                            )}
                                          />
                                        </div>
                                        <div
                                          className={cn(
                                            "px-4 py-2.5 rounded-2xl rounded-tl-none border text-xs md:text-sm font-medium shadow-xl max-w-[85%]",
                                            theme === "dark"
                                              ? "bg-white/5 border-white/5 text-zinc-300"
                                              : "bg-white border-slate-100 text-slate-700 shadow-slate-200",
                                          )}
                                        >
                                          {item.query}
                                        </div>
                                      </div>

                                      {/* AI Response */}
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] font-black bg-gradient-to-r from-blue-400/60 via-purple-400/60 to-orange-400/60 bg-clip-text text-transparent uppercase tracking-widest">
                                            AI 建議
                                          </span>
                                          <div className="h-[1px] flex-1 min-w-[20px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10" />
                                        </div>

                                        {item.phase === "decomposing" && (
                                          <div className="flex items-center gap-2 text-xs text-brand-accent/80 px-1 py-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span className="animate-pulse font-medium">正在拆解臨床問題…</span>
                                          </div>
                                        )}

                                        {item.phase === "selecting" && (
                                          <div className="w-full space-y-3.5">
                                            {(item.mainProblems?.length ?? 0) > 0 && (
                                              <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                                                  主要問題（將自動提供建議）
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {item.mainProblems?.map((p) => (
                                                    <span
                                                      key={p}
                                                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/25"
                                                    >
                                                      {p}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            <div className="flex flex-col gap-1.5">
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                伴隨症狀
                                              </span>
                                              <div className="flex flex-col gap-1.5">
                                                {item.secondaryProblems?.map((p) => {
                                                  const checked = item.selectedSecondary?.includes(p);
                                                  return (
                                                    <button
                                                      key={p}
                                                      onClick={() => toggleSecondaryProblem(item.timestamp, p)}
                                                      className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all",
                                                        checked
                                                          ? "bg-brand-accent/10 border-brand-accent/40 text-brand-accent font-bold"
                                                          : theme === "dark"
                                                            ? "bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/[0.05]"
                                                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white",
                                                      )}
                                                    >
                                                      <span
                                                        className={cn(
                                                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                                          checked
                                                            ? "bg-brand-accent border-brand-accent"
                                                            : "border-current opacity-40",
                                                        )}
                                                      >
                                                        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                      </span>
                                                      <span>{p}</span>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                              {/* 其他：自填伴隨症狀 */}
                                              <div className="flex items-center gap-2 mt-0.5">
                                                <input
                                                  type="text"
                                                  value={customSymptomInputs[item.timestamp] || ""}
                                                  onChange={(e) =>
                                                    setCustomSymptomInputs((prev) => ({
                                                      ...prev,
                                                      [item.timestamp]: e.target.value,
                                                    }))
                                                  }
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                      e.preventDefault();
                                                      addCustomSymptom(item.timestamp);
                                                    }
                                                  }}
                                                  placeholder="其他：自行輸入伴隨症狀…"
                                                  className={cn(
                                                    "flex-1 min-w-0 px-3 py-2 rounded-lg border text-xs outline-none transition-all focus:border-brand-accent/50",
                                                    theme === "dark"
                                                      ? "bg-white/[0.02] border-white/10 text-zinc-200 placeholder:text-zinc-500"
                                                      : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400",
                                                  )}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => addCustomSymptom(item.timestamp)}
                                                  disabled={!(customSymptomInputs[item.timestamp] || "").trim()}
                                                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border border-brand-accent/30 text-brand-accent hover:bg-brand-accent/10 transition-all disabled:opacity-40"
                                                >
                                                  新增
                                                </button>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleGenerateRecommendation(item.timestamp)}
                                              disabled={isAiLoading}
                                              className="w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 text-white shadow-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                                            >
                                              <Sparkles className="w-3.5 h-3.5" />
                                              產生用藥建議
                                            </button>
                                          </div>
                                        )}

                                        {(item.phase === "recommending" ||
                                          item.phase === "done" ||
                                          !item.phase) && (
                                        <div className="w-full space-y-4">
                                          {(() => {
                                            const lines = item.response
                                              .split("\n")
                                              .filter((line) => line.trim());
                                            const groups: {
                                              problem: string;
                                              items: string[];
                                            }[] = [];
                                            let currentGroup: {
                                              problem: string;
                                              items: string[];
                                            } | null = null;
                                            const summaryLines: string[] = [];

                                            lines.forEach((line) => {
                                              if (
                                                line.includes("第一部分") ||
                                                line.includes("第二部分") ||
                                                line.includes(
                                                  "用藥策略與總結",
                                                ) ||
                                                line.includes(
                                                  "用藥策略與建議",
                                                ) ||
                                                line.includes(
                                                  "臨床問題與建議藥物",
                                                )
                                              ) {
                                                return;
                                              }
                                              const problemMatch = line.match(
                                                /^(問題|Problem)[:：]\s*(.*)$/i,
                                              );
                                              if (problemMatch) {
                                                currentGroup = {
                                                  problem:
                                                    problemMatch[2].trim(),
                                                  items: [],
                                                };
                                                groups.push(currentGroup);
                                              } else if (currentGroup) {
                                                currentGroup.items.push(line);
                                              } else {
                                                const cleaned = line
                                                  .replace(
                                                    /^[#\s\*]*【?第一部分：[^】\s]+】?[#\s\*]*/,
                                                    "",
                                                  )
                                                  .replace(
                                                    /^[#\s\*]*處方總結[#\s\*]*/,
                                                    "",
                                                  )
                                                  .replace(
                                                    /^[#\s\*]*整體用藥策略與總結建議[#\s\*]*/,
                                                    "",
                                                  )
                                                  .trim();
                                                if (
                                                  cleaned &&
                                                  !cleaned.match(
                                                    /^[-=\*_]{3,}$/,
                                                  )
                                                ) {
                                                  summaryLines.push(cleaned);
                                                }
                                              }
                                            });

                                            const groupsSection = groups.map(
                                              (group, gIdx) => {
                                                const limitKey = `${hIdx}-${gIdx}`;
                                                const limit =
                                                  aiVisibleLimits[limitKey] ||
                                                  3;
                                                const visibleItems =
                                                  group.items.slice(0, limit);
                                                const hasMore =
                                                  group.items.length > limit;

                                                return (
                                                  <div
                                                    key={`group-${hIdx}-${gIdx}`}
                                                    className="space-y-3 w-full max-w-full min-w-0 overflow-hidden"
                                                  >
                                                    <div className="flex items-center gap-2.5 px-1 w-full max-w-full min-w-0 overflow-hidden">
                                                      <div className="w-[3px] h-3 bg-gradient-to-b from-blue-500 via-purple-500 to-orange-500 rounded-full rotate-[15deg] shadow-lg shadow-purple-500/20 shrink-0" />
                                                      <span className="text-[11px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-[0.2em] truncate flex-1 min-w-0">
                                                        {group.problem}
                                                      </span>
                                                    </div>

                                                    <div className="grid gap-2 w-full max-w-full min-w-0 overflow-hidden box-border">
                                                      {visibleItems.map(
                                                        (line, lIdx) => {
                                                          // 非藥物的臨床建議行（以「※」開頭）→ 顯示為建議提示，不做藥物比對。
                                                          const adviceText = line
                                                            .replace(/^\s*[-*•]?\s*[※*]\s*/, "")
                                                            .trim();
                                                          if (/^\s*[-*•]?\s*※/.test(line)) {
                                                            return (
                                                              <div
                                                                key={lIdx}
                                                                className={cn(
                                                                  "w-full max-w-full min-w-0 flex items-start gap-2 text-xs p-3 rounded-xl border overflow-hidden box-border break-words",
                                                                  theme === "dark"
                                                                    ? "bg-blue-500/[0.04] border-blue-400/20 text-zinc-300"
                                                                    : "bg-blue-50 border-blue-200 text-slate-600",
                                                                )}
                                                              >
                                                                <span className="text-blue-500 shrink-0 font-bold">※</span>
                                                                <span className="leading-relaxed">{adviceText}</span>
                                                              </div>
                                                            );
                                                          }
                                                          // AI 藥物行：成分學名(中文) | 途徑 | ATC碼 | 理由（樣式判斷解析）。
                                                          const parsed = parseDrugLine(
                                                            line,
                                                            (s) => !!normalizeRoute(s),
                                                          );
                                                          const ingredientRaw = parsed.ingredient;
                                                          const routeRaw = parsed.route;
                                                          const funcPart = parsed.reason
                                                            .replace(/^[\[】【]|[\]】]/g, "")
                                                            .trim();
                                                          // 比對用的乾淨成分名（去除括號內中文/註記）
                                                          const ingredientForMatch = ingredientRaw.replace(/[（(].*?[）)]/g, "").trim();
                                                          // 以 ATC 為主、成分名後備，比對院內藥庫，回傳所有相符品項。
                                                          // 非兒科病患不主動推薦口服液劑（藥水/糖漿）。
                                                          const matches = findFormularyMatches(
                                                            parsed.atc,
                                                            ingredientForMatch || ingredientRaw,
                                                            routeRaw,
                                                            isPediatricContext(item.query),
                                                          );

                                                          // 比對不到院內品項：仍顯示 AI 建議成分與理由，並標示「院內無此品項」
                                                          if (matches.length === 0) {
                                                            const name = ingredientRaw;
                                                            if (!name) return null;
                                                            return (
                                                              <div
                                                                key={lIdx}
                                                                className={cn(
                                                                  "w-full max-w-full min-w-0 flex flex-col gap-1 text-xs p-3 rounded-xl border border-dashed overflow-hidden box-border",
                                                                  theme === "dark"
                                                                    ? "bg-white/[0.01] border-white/10 text-zinc-400"
                                                                    : "bg-slate-50/50 border-slate-200 text-slate-500",
                                                                )}
                                                              >
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                  <span className="font-bold text-xs md:text-sm break-words">
                                                                    {name}
                                                                  </span>
                                                                  {normalizeRoute(routeRaw) && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/15 shrink-0">
                                                                      {normalizeRoute(routeRaw)}
                                                                    </span>
                                                                  )}
                                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                                                                    院內無此品項
                                                                  </span>
                                                                </div>
                                                                {funcPart && (
                                                                  <span className="text-[11px] leading-relaxed break-words opacity-80">
                                                                    {funcPart}
                                                                  </span>
                                                                )}
                                                              </div>
                                                            );
                                                          }

                                                          return matches.map((med, mIdx) => {
                                                            const code = med.code;
                                                            const name =
                                                              med.component || med.brandName || med.genericName || ingredientRaw;
                                                            const itemKey = `${hIdx}-${gIdx}-${lIdx}-${code}`;
                                                            const isExpanded = !!aiExpandedMeds[itemKey];
                                                            return (
                                                            <div
                                                              key={`${lIdx}-${code}-${mIdx}`}
                                                              onMouseDown={() => startLongPress(code)}
                                                              onMouseUp={cancelLongPress}
                                                              onMouseLeave={cancelLongPress}
                                                              onTouchStart={() => startLongPress(code)}
                                                              onTouchEnd={cancelLongPress}
                                                              onTouchMove={cancelLongPress}
                                                              onContextMenu={(e) => {
                                                                e.preventDefault();
                                                                handleCopyCode(code);
                                                              }}
                                                              className={cn(
                                                                "w-full max-w-full min-w-0 flex flex-col gap-2.5 text-xs p-3.5 rounded-xl transition-all group border text-left overflow-hidden box-border select-none",
                                                                theme === "dark"
                                                                  ? "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10"
                                                                  : "bg-slate-50 hover:bg-white border-slate-100/50 hover:border-slate-200 shadow-sm shadow-slate-100",
                                                              )}
                                                              title="點擊左半部開啟藥物詳情，點擊右半部展開或收合機轉，長按或秒點滑鼠右鍵可複製藥品碼"
                                                            >
                                                              <div className="flex items-center justify-between w-full gap-2">
                                                                {/* Left Part: Code & Name - triggers details modal */}
                                                                <div 
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const medLookup =
                                                                      medications.find(
                                                                        (m) =>
                                                                          m.code ===
                                                                          code,
                                                                      );
                                                                    if (medLookup) {
                                                                      setSelectedMed(medLookup);
                                                                    }
                                                                  }}
                                                                  className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-transform"
                                                                >
                                                                  <div
                                                                    className={cn(
                                                                      "font-mono font-bold shrink-0 px-2 py-0.5 rounded text-[10px]",
                                                                      theme ===
                                                                        "dark"
                                                                        ? "bg-white/10 text-zinc-300"
                                                                        : "bg-white border shadow-sm text-slate-800",
                                                                      getDosageColor(
                                                                        code,
                                                                      ).text,
                                                                    )}
                                                                  >
                                                                    {code}
                                                                  </div>
                                                                  <span
                                                                    className={cn(
                                                                      "font-bold truncate text-xs md:text-sm",
                                                                      theme ===
                                                                        "dark"
                                                                        ? "text-zinc-200"
                                                                        : "text-slate-800",
                                                                    )}
                                                                  >
                                                                    {name}
                                                                  </span>
                                                                </div>

                                                                {/* Right Part: Mechanism text or chevron - triggers expand/collapse */}
                                                                <div 
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAiExpandedMeds(
                                                                      (prev) => ({
                                                                        ...prev,
                                                                        [itemKey]:
                                                                          !prev[
                                                                            itemKey
                                                                          ],
                                                                      }),
                                                                    );
                                                                  }}
                                                                  className="flex items-center gap-1.5 shrink-0 max-w-[50%] md:max-w-[70%] cursor-pointer hover:bg-zinc-500/10 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
                                                                >
                                                                  {!isExpanded &&
                                                                    funcPart && (
                                                                      <span
                                                                        className={cn(
                                                                          "truncate text-right transition-colors uppercase text-[10px] tracking-tight",
                                                                          theme ===
                                                                            "dark"
                                                                            ? "text-zinc-500 group-hover:text-zinc-400"
                                                                            : "text-slate-400 group-hover:text-slate-600",
                                                                        )}
                                                                      >
                                                                        {
                                                                          funcPart
                                                                        }
                                                                      </span>
                                                                    )}
                                                                  <ChevronDown
                                                                    className={cn(
                                                                      "w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600 transition-transform duration-200",
                                                                      isExpanded &&
                                                                        "rotate-180",
                                                                    )}
                                                                  />
                                                                </div>
                                                              </div>

                                                              {funcPart &&
                                                                isExpanded && (
                                                                  <div
                                                                    className={cn(
                                                                      "w-full text-xs leading-relaxed border-t pt-2.5 mt-0.5 transition-all duration-300 animate-fadeIn whitespace-normal break-words",
                                                                      theme ===
                                                                        "dark"
                                                                        ? "border-white/5 text-zinc-400"
                                                                        : "border-slate-100 text-slate-600",
                                                                    )}
                                                                  >
                                                                    <span className="whitespace-normal break-words inline text-[11px] font-normal leading-relaxed">
                                                                      {
                                                                        funcPart
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                            </div>
                                                          );
                                                          });
                                                        },
                                                      )}
                                                    </div>

                                                    {hasMore && (
                                                      <button
                                                        onClick={() =>
                                                          setAiVisibleLimits(
                                                            (prev) => ({
                                                              ...prev,
                                                              [limitKey]:
                                                                limit + 5,
                                                            }),
                                                          )
                                                        }
                                                        className="w-full mt-2 py-3 text-[10px] font-black text-brand-accent hover:text-white bg-brand-accent/10 hover:bg-brand-accent/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl border border-brand-accent/20 shadow-lg shadow-brand-accent/5 backdrop-blur-sm"
                                                      >
                                                        查看更多建議 (
                                                        {group.items.length -
                                                          limit}{" "}
                                                        筆)
                                                        <ChevronDown className="w-3 h-3" />
                                                      </button>
                                                    )}
                                                  </div>
                                                );
                                              },
                                            );

                                            return (
                                              <div className="space-y-6">
                                                {summaryLines.length > 0 && (
                                                  <div
                                                    className={cn(
                                                      "p-4 rounded-xl border text-xs md:text-sm shadow-sm leading-relaxed font-normal text-justify",
                                                      theme === "dark"
                                                        ? "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-orange-500/5 border-white/5 text-zinc-300"
                                                        : "bg-gradient-to-br from-blue-500/[0.04] via-purple-500/[0.04] to-orange-500/[0.02] border-slate-100 text-slate-700",
                                                    )}
                                                  >
                                                    <div className="space-y-2">
                                                      {summaryLines.map(
                                                        (sLine, sIdx) => {
                                                          const isBullet =
                                                            sLine.startsWith(
                                                              "- ",
                                                            ) ||
                                                            sLine.startsWith(
                                                              "* ",
                                                            ) ||
                                                            sLine.startsWith(
                                                              "• ",
                                                            );
                                                          const cleanText =
                                                            isBullet
                                                              ? sLine.substring(
                                                                  2,
                                                                )
                                                              : sLine;
                                                          return (
                                                            <p
                                                              key={sIdx}
                                                              className={cn(
                                                                "text-xs md:text-sm leading-relaxed",
                                                                isBullet &&
                                                                  "pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-zinc-400",
                                                              )}
                                                            >
                                                              {cleanText}
                                                            </p>
                                                          );
                                                        },
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                {groupsSection}
                                              </div>
                                            );
                                          })()}
                                          {item.phase === "done" && item.response.startsWith("⚠️ 錯誤：") && (
                                            <button
                                              onClick={() => handleAiSearch(undefined, item.query)}
                                              disabled={isAiLoading}
                                              className="w-full py-2 rounded-xl font-bold text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                                            >
                                              重試
                                            </button>
                                          )}
                                          {item.phase === "done" && !item.response.startsWith("⚠️ 錯誤：") && (item.mainProblems?.length ?? 0) > 0 && (
                                            <button
                                              onClick={() => handleBackToSelecting(item.timestamp)}
                                              disabled={isAiLoading}
                                              className={cn(
                                                "w-full py-2 rounded-xl font-bold text-xs border transition-all disabled:opacity-50",
                                                theme === "dark"
                                                  ? "border-white/10 text-zinc-400 hover:bg-white/5"
                                                  : "border-slate-200 text-slate-400 hover:bg-slate-50",
                                              )}
                                            >
                                              ↩ 重新選擇問題
                                            </button>
                                          )}
                                          {hIdx === 0 && isAiLoading && (
                                            <div
                                              className={cn(
                                                "flex items-center gap-3 text-brand-accent font-bold animate-pulse tracking-widest text-[10px] uppercase px-4 py-2.5 rounded-xl border mt-1.5",
                                                theme === "dark"
                                                  ? "bg-white/[0.03] border-white/5"
                                                  : "bg-slate-50 border-slate-100 shadow-sm",
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "w-full h-1 rounded-full overflow-hidden",
                                                  theme === "dark"
                                                    ? "bg-white/5"
                                                    : "bg-slate-200",
                                                )}
                                              >
                                                <motion.div
                                                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500"
                                                  initial={{ width: "0%" }}
                                                  animate={{ width: "100%" }}
                                                  transition={{
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    ease: "linear",
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Side Detail Panel (Desktop) */}
        <AnimatePresence>
          {selectedMed && (
            <motion.aside
              key="detail-panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 220,
                mass: 1,
              }}
              className={cn(
                "hidden md:flex flex-col border-l relative z-[60] overflow-hidden shadow-2xl shrink-0 w-[400px] lg:w-[480px]",
                theme === "dark" ? "border-white/10" : "border-slate-200 bg-white",
              )}
              style={theme === "dark" && selectedMed ? {
                background: `linear-gradient(160deg, rgba(${getDosageColor(selectedMed.code).gradientRgb},0.13) 0%, rgba(18,18,20,1) 50%)`,
              } : undefined}
            >
              <div
                className={cn(
                  "py-2 px-6 border-b flex items-center justify-between shrink-0",
                  theme === "dark"
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-slate-100 bg-slate-50",
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <h2
                    className={cn(
                      "text-[10px] font-bold tracking-[0.15em] truncate uppercase",
                      theme === "dark" ? "text-zinc-400" : "text-slate-500",
                    )}
                  >
                    Data Sheet{" "}
                    <span
                      className={
                        theme === "dark"
                          ? "text-zinc-700"
                          : "text-slate-300 mx-1 font-normal"
                      }
                    >
                      /
                    </span>{" "}
                    <span
                      className={cn(
                        "transition-colors",
                        getDosageColor(selectedMed.code).text,
                      )}
                    >
                      藥物詳情
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(selectedMed.id)}
                    className="p-1.5 rounded-full transition-all group relative cursor-pointer"
                    title={isFavorite(selectedMed.id) ? "移除收藏" : "加入收藏"}
                  >
                    <SharpStar
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isFavorite(selectedMed.id)
                          ? "fill-amber-400 text-amber-500"
                          : theme === "dark"
                            ? "text-zinc-600 group-hover:text-amber-400"
                            : "text-slate-300 group-hover:text-amber-400",
                      )}
                    />
                  </button>
                  <button
                    onClick={closeDetail}
                    className={cn(
                      "p-1 px-2 rounded-md transition-all border flex items-center gap-2",
                      theme === "dark"
                        ? "hover:bg-white/5 text-brand-muted hover:text-white border-transparent hover:border-white/10"
                        : "hover:bg-slate-100 text-slate-400 hover:text-slate-700 border-transparent hover:border-slate-200",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">
                      Close
                    </span>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "flex-1 overflow-y-auto px-6 md:px-8 pt-6 pb-16 scrollbar-thin",
                  theme === "dark"
                    ? "bg-transparent scrollbar-thumb-white/10"
                    : "bg-white scrollbar-thumb-slate-200",
                )}
              >
                {/* ── Hero ── */}
                <div className="mb-6">
                  <button
                    onClick={() => handleCopyCode(selectedMed.code)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border mb-3 transition-all active:scale-95 group/code cursor-pointer",
                      getDosageColor(selectedMed.code).bg,
                      getDosageColor(selectedMed.code).borderMain,
                    )}
                    title="點擊複製"
                  >
                    <span className={cn("font-mono font-black text-sm tracking-widest", getDosageColor(selectedMed.code).text)}>{selectedMed.code}</span>
                    <Copy className="w-3 h-3 opacity-30 group-hover/code:opacity-80 transition-opacity text-brand-muted" />
                  </button>
                  <h1 className={cn("text-2xl font-bold leading-tight mb-1", theme === "dark" ? "text-white" : "text-slate-900")}>
                    {selectedMed.component}
                  </h1>
                  <p className={cn("text-base font-medium", getDosageColor(selectedMed.code).accent)}>{selectedMed.genericName}</p>
                  {(selectedMed.brandName || selectedMed.chineseName) && (
                    <p className={cn("text-sm mt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>
                      {[selectedMed.brandName, selectedMed.chineseName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {/* ── 資訊列 ── */}
                <div className={cn("divide-y text-sm", theme === "dark" ? "divide-white/[0.07]" : "divide-slate-100")}>
                  {selectedMed.content && (
                    <div className="flex gap-4 py-3">
                      <span className={cn("w-14 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>含量</span>
                      <span className={cn("flex-1 leading-relaxed", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>{selectedMed.content}</span>
                    </div>
                  )}
                  <div className="flex gap-4 py-3">
                    <span className={cn("w-14 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>系統</span>
                    <button onClick={() => setSearchQuery(selectedMed.anatomicalSystem)} className={cn("flex-1 text-left leading-relaxed hover:text-brand-accent transition-colors", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>
                      {selectedMed.anatomicalSystem}
                    </button>
                  </div>
                  <div className="flex gap-4 py-3">
                    <span className={cn("w-14 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>藥理</span>
                    <button onClick={() => setSearchQuery(selectedMed.pharmacologicalClass)} className={cn("flex-1 text-left leading-relaxed hover:text-brand-accent transition-colors", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>
                      {selectedMed.pharmacologicalClass}
                    </button>
                  </div>
                </div>

                {/* ── 適應症 ── */}
                {selectedMed.indications && (
                  <div className={cn("border-t mt-6 pt-5", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-xs uppercase tracking-wider mb-2", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>適應症</p>
                    <p className={cn("text-sm leading-relaxed", theme === "dark" ? "text-zinc-300" : "text-slate-600")}>{selectedMed.indications}</p>
                  </div>
                )}

                {/* ── 不良反應 ── */}
                {selectedMed.sideEffects && (
                  <div className={cn("border-t mt-6 pt-5", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-xs uppercase tracking-wider mb-2", theme === "dark" ? "text-red-400/70" : "text-red-400")}>不良反應</p>
                    <p className={cn("text-sm leading-relaxed", theme === "dark" ? "text-red-300/80" : "text-red-600/80")}>{selectedMed.sideEffects}</p>
                  </div>
                )}

                {/* ── 價格 ── */}
                {(selectedMed.priceNhi || selectedMed.priceRegular) && (
                  <div className={cn("border-t mt-6 pt-5", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-xs uppercase tracking-wider mb-3", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>價格</p>
                    <div className="flex gap-8">
                      {selectedMed.priceNhi ? (
                        <div>
                          <p className={cn("text-xs mb-1", theme === "dark" ? "text-blue-400" : "text-blue-500")}>健保</p>
                          <p className={cn("text-2xl font-bold", theme === "dark" ? "text-zinc-100" : "text-slate-800")}>${selectedMed.priceNhi.toFixed(1)}</p>
                        </div>
                      ) : null}
                      {selectedMed.priceRegular ? (
                        <div>
                          <p className={cn("text-xs mb-1", theme === "dark" ? "text-zinc-400" : "text-slate-500")}>自費</p>
                          <p className={cn("text-2xl font-bold", theme === "dark" ? "text-zinc-100" : "text-slate-800")}>${selectedMed.priceRegular.toFixed(1)}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* ── Keywords ── */}
                <div className={cn("border-t mt-6 pt-5", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                  <div className="flex flex-wrap gap-2">
                    {selectedMed.searchKeywords.map((k, i) => (
                      <button
                        key={`${k}-${i}`}
                        onClick={() => setSearchQuery(k)}
                        className={cn(
                          "px-3 py-1 border rounded text-[10px] font-mono transition-all cursor-pointer",
                          theme === "dark"
                            ? "border-white/10 text-zinc-500 hover:border-brand-accent/50 hover:text-brand-accent"
                            : "border-slate-200 text-slate-400 hover:border-brand-accent/50 hover:text-brand-accentShadow",
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile: 統一形變元素 — Dynamic Island pill ↔ full sheet */}
        <AnimatePresence>
          {selectedMed && (
            <motion.div
              key="mobile-container"
              className="md:hidden fixed inset-x-0 bottom-0 z-[100] flex justify-center items-end pointer-events-none"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "120%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
            >
              <motion.div
                layout
                transition={{ layout: { type: "spring", damping: 36, stiffness: 420 } }}
                className={cn(
                  "pointer-events-auto overflow-hidden flex flex-col border",
                  "shadow-[0_-8px_50px_rgba(0,0,0,0.55)]",
                  mobileExpanded
                    ? "w-full rounded-t-3xl mb-0"
                    : "rounded-full mb-5",
                  theme === "dark"
                    ? "border-white/[0.12]"
                    : mobileExpanded ? "bg-white border-slate-200" : "bg-white/95 border-slate-200",
                )}
                style={{
                  height: mobileExpanded ? "84vh" : undefined,
                  ...(theme === "dark" ? {
                    background: `linear-gradient(150deg, rgba(${getDosageColor(selectedMed.code).gradientRgb},0.20) 0%, rgba(12,12,14,0) 55%), #0c0c0e`,
                  } : {}),
                }}
              >
                {/* ── 收起：膠囊內容 ── */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {!mobileExpanded && (
                    <motion.div
                      key="pill-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.08 }}
                      onClick={() => setMobileExpanded(true)}
                      className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none"
                    >
                      <span className={cn("font-mono font-black text-sm tracking-widest px-2 py-0.5 rounded border shrink-0", getDosageColor(selectedMed.code).bg, getDosageColor(selectedMed.code).text, getDosageColor(selectedMed.code).borderMain)}>
                        {selectedMed.code.trim()}
                      </span>
                      <span className={cn("text-sm font-semibold max-w-[160px] truncate", theme === "dark" ? "text-white" : "text-slate-900")}>
                        {selectedMed.component || selectedMed.genericName}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 shrink-0 rotate-180", theme === "dark" ? "text-zinc-500" : "text-slate-400")} />
                      <button
                        onClick={(e) => { e.stopPropagation(); closeDetail(); }}
                        className={cn("p-0.5 shrink-0 rounded-full transition-colors", theme === "dark" ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-700")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── 展開：完整詳情 ── */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {mobileExpanded && (
                    <motion.div
                      key="sheet-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.15 } }}
                      exit={{ opacity: 0, transition: { duration: 0.06 } }}
                      className="flex flex-col flex-1 min-h-0 overflow-hidden"
                    >
                      <div className="flex justify-center pt-3 pb-1 shrink-0">
                        <button
                          onClick={() => setMobileExpanded(false)}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full transition-colors active:scale-95",
                            theme === "dark"
                              ? "text-zinc-400 hover:text-white hover:bg-white/10"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
                          )}
                          aria-label="收起"
                        >
                          <ChevronDown className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto px-5 pt-1 pb-10 scrollbar-none">
                {/* sticky top bar: close + fav */}
                <div className="flex justify-between items-center sticky top-0 bg-inherit pb-3 z-10">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleCopyCode(selectedMed.code)} className={cn("flex items-center gap-1 px-2 py-0.5 rounded border font-mono font-black text-sm tracking-widest transition-all active:scale-95 group/mc", getDosageColor(selectedMed.code).bg, getDosageColor(selectedMed.code).text, getDosageColor(selectedMed.code).borderMain)} title="複製">
                      <span>{selectedMed.code}</span>
                      <Copy className="w-3 h-3 opacity-30 group-hover/mc:opacity-80 transition-opacity" />
                    </button>
                    <button onClick={() => toggleFavorite(selectedMed.id)} className="p-1.5 cursor-pointer group">
                      <SharpStar className={cn("w-4 h-4 transition-colors", isFavorite(selectedMed.id) ? "fill-amber-400 text-amber-500" : theme === "dark" ? "text-zinc-600 group-hover:text-amber-400" : "text-slate-300 group-hover:text-amber-400")} />
                    </button>
                  </div>
                  <button onClick={closeDetail} className="p-1 opacity-50 hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Hero */}
                <div className="mb-5">
                  <h1 className={cn("text-xl font-bold leading-tight mb-1", theme === "dark" ? "text-white" : "text-slate-900")}>{selectedMed.component}</h1>
                  <p className={cn("text-sm font-medium", getDosageColor(selectedMed.code).accent)}>{selectedMed.genericName}</p>
                  {(selectedMed.brandName || selectedMed.chineseName) && (
                    <p className={cn("text-xs mt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>
                      {[selectedMed.brandName, selectedMed.chineseName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {/* 資訊列 */}
                <div className={cn("divide-y text-sm", theme === "dark" ? "divide-white/[0.07]" : "divide-slate-100")}>
                  {selectedMed.content && (
                    <div className="flex gap-3 py-2.5">
                      <span className={cn("w-12 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>含量</span>
                      <span className={cn("flex-1 leading-relaxed", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>{selectedMed.content}</span>
                    </div>
                  )}
                  <div className="flex gap-3 py-2.5">
                    <span className={cn("w-12 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>系統</span>
                    <button onClick={() => setSearchQuery(selectedMed.anatomicalSystem)} className={cn("flex-1 text-left leading-relaxed hover:text-brand-accent transition-colors", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>{selectedMed.anatomicalSystem}</button>
                  </div>
                  <div className="flex gap-3 py-2.5">
                    <span className={cn("w-12 shrink-0 text-xs pt-0.5", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>藥理</span>
                    <button onClick={() => setSearchQuery(selectedMed.pharmacologicalClass)} className={cn("flex-1 text-left leading-relaxed hover:text-brand-accent transition-colors", theme === "dark" ? "text-zinc-200" : "text-slate-700")}>{selectedMed.pharmacologicalClass}</button>
                  </div>
                </div>

                {/* 適應症 */}
                {selectedMed.indications && (
                  <div className={cn("border-t mt-5 pt-4", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-[11px] uppercase tracking-wider mb-2", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>適應症</p>
                    <p className={cn("text-sm leading-relaxed", theme === "dark" ? "text-zinc-300" : "text-slate-600")}>{selectedMed.indications}</p>
                  </div>
                )}

                {/* 不良反應 */}
                {selectedMed.sideEffects && (
                  <div className={cn("border-t mt-5 pt-4", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-[11px] uppercase tracking-wider mb-2", theme === "dark" ? "text-red-400/70" : "text-red-400")}>不良反應</p>
                    <p className={cn("text-sm leading-relaxed", theme === "dark" ? "text-red-300/80" : "text-red-600/80")}>{selectedMed.sideEffects}</p>
                  </div>
                )}

                {/* 價格 */}
                {(selectedMed.priceNhi || selectedMed.priceRegular) && (
                  <div className={cn("border-t mt-5 pt-4", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                    <p className={cn("text-[11px] uppercase tracking-wider mb-3", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>價格</p>
                    <div className="flex gap-8">
                      {selectedMed.priceNhi ? (
                        <div>
                          <p className={cn("text-xs mb-0.5", theme === "dark" ? "text-blue-400" : "text-blue-500")}>健保</p>
                          <p className={cn("text-xl font-bold", theme === "dark" ? "text-zinc-100" : "text-slate-800")}>${selectedMed.priceNhi.toFixed(1)}</p>
                        </div>
                      ) : null}
                      {selectedMed.priceRegular ? (
                        <div>
                          <p className={cn("text-xs mb-0.5", theme === "dark" ? "text-zinc-400" : "text-slate-500")}>自費</p>
                          <p className={cn("text-xl font-bold", theme === "dark" ? "text-zinc-100" : "text-slate-800")}>${selectedMed.priceRegular.toFixed(1)}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                <div className={cn("border-t mt-5 pt-4", theme === "dark" ? "border-white/[0.07]" : "border-slate-100")}>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMed.searchKeywords.slice(0, 6).map((k, i) => (
                      <button key={i} onClick={() => setSearchQuery(k)} className={cn("px-2.5 py-1 border rounded text-[10px] font-mono transition-all", theme === "dark" ? "border-white/10 text-zinc-500 hover:text-brand-accent hover:border-brand-accent/40" : "border-slate-200 text-slate-400 hover:text-brand-accentShadow")}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Favorites Management Modal */}
      <AnimatePresence>
        {isFavoritesManagerOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              key="favorites-manager-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsFavoritesManagerOpen(false);
                setFavoritesSearchQuery("");
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150]"
            />

            {/* Modal Dialog */}
            <motion.div
              key="favorites-manager-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
              className={cn(
                "fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:h-[550px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden z-[160]",
                theme === "dark"
                  ? "bg-zinc-900/95 border-white/10 text-white shadow-black/80"
                  : "bg-white border-slate-200 text-slate-900 shadow-slate-900/20",
              )}
            >
              {/* Header */}
              <div
                className={cn(
                  "p-5 border-b shrink-0 flex items-center justify-between",
                  theme === "dark"
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-slate-100 bg-slate-50",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <SharpStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <h3 className="text-sm font-bold tracking-tight">
                      我的收藏藥物管理
                    </h3>
                  </div>
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      theme === "dark" ? "text-zinc-500" : "text-slate-400",
                    )}
                  >
                    在此檢視、搜尋，或編輯收藏項目。點擊項目直接查看詳情。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsFavoritesManagerOpen(false);
                    setFavoritesSearchQuery("");
                  }}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    theme === "dark"
                      ? "hover:bg-white/10 text-zinc-400 hover:text-white"
                      : "hover:bg-slate-100 text-slate-500 hover:text-slate-800",
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search input inside favorites */}
              {favorites.length > 0 && (
                <div
                  className={cn(
                    "p-3 px-5 border-b shrink-0 flex items-center gap-2",
                    theme === "dark"
                      ? "bg-zinc-950/40 border-white/5"
                      : "bg-slate-50/50 border-slate-100",
                  )}
                >
                  <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  <input
                    type="text"
                    placeholder="搜尋我的收藏 (成分、名稱、藥碼、適應症)..."
                    value={favoritesSearchQuery}
                    onChange={(e) => setFavoritesSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none text-[11px] focus:outline-none focus:ring-0 placeholder:opacity-50"
                  />
                  {favoritesSearchQuery && (
                    <button
                      onClick={() => setFavoritesSearchQuery("")}
                      className="px-2 py-1 rounded-md text-[9px] font-bold bg-zinc-500/10 hover:bg-zinc-500/20"
                    >
                      清除
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable list of favorites */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {favorites.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div
                      className={cn(
                        "p-4 rounded-full border mb-3",
                        theme === "dark"
                          ? "bg-white/[0.02] border-white/5 text-zinc-700"
                          : "bg-slate-50 border-slate-100 text-slate-300",
                      )}
                    >
                      <SharpStar className="w-6 h-6 text-amber-500/30" />
                    </div>
                    <h4
                      className={cn(
                        "text-xs font-bold",
                        theme === "dark" ? "text-zinc-400" : "text-slate-600",
                      )}
                    >
                      目前無任何收藏藥物
                    </h4>
                    <p className="text-[10px] opacity-40 mt-1 max-w-xs">
                      在主畫面點擊藥物卡片旁的星星，即可將其加入此清單中。
                    </p>
                  </div>
                ) : (
                  (() => {
                    const favoritedMeds = medications.filter((m) =>
                      isFavorite(m.id),
                    );
                    const query = favoritesSearchQuery.toLowerCase().trim();
                    const filtered = favoritedMeds.filter(
                      (m) =>
                        m.component.toLowerCase().includes(query) ||
                        m.code.toLowerCase().includes(query) ||
                        m.brandName.toLowerCase().includes(query) ||
                        (m.chineseName &&
                          m.chineseName.toLowerCase().includes(query)) ||
                        (m.genericName &&
                          m.genericName.toLowerCase().includes(query)) ||
                        (m.indications &&
                          m.indications.toLowerCase().includes(query)),
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                          <p className="text-xs font-medium opacity-50">
                            查無符合關鍵字的收藏項目
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-mono opacity-50 px-1 mb-2">
                          <span>
                            顯示 {filtered.length} / 共 {favoritedMeds.length}{" "}
                            個收藏項目
                          </span>
                          {favoritesSearchQuery && (
                            <span className="text-violet-500 font-bold animate-pulse">
                              搜尋中
                            </span>
                          )}
                        </div>

                        <AnimatePresence mode="popLayout">
                          {filtered.map((med) => {
                            const dosageStyle = getDosageColor(med.code);
                            return (
                              <motion.div
                                key={`manage-fav-${med.id}`}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => {
                                  setSelectedMed(med); setMobileExpanded(false);
                                  setIsFavoritesManagerOpen(false);
                                  setFavoritesSearchQuery("");
                                }}
                                className={cn(
                                  "w-full text-left p-3.5 rounded-2xl border transition-all text-xs flex items-center justify-between group cursor-pointer",
                                  theme === "dark"
                                    ? "bg-white/5 border-white/5 hover:bg-white/10 hover:border-brand-accent/30"
                                    : "bg-slate-50 border-slate-100 hover:bg-slate-100 hover:border-brand-accent/30",
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div
                                    className={cn(
                                      "px-2 py-[2px] rounded-lg text-[9px] font-black tracking-widest uppercase shrink-0 border",
                                      theme === "dark"
                                        ? "border-white/20"
                                        : "border-slate-200",
                                      dosageStyle.text,
                                      dosageStyle.bg,
                                    )}
                                  >
                                    {med.code}
                                  </div>

                                  <div className="min-w-0">
                                    <p
                                      className={cn(
                                        "font-bold truncate text-xs",
                                        theme === "dark"
                                          ? "text-zinc-100"
                                          : "text-slate-800",
                                      )}
                                    >
                                      {med.component}
                                    </p>
                                    <p className="text-[10px] opacity-60 truncate mt-0.5">
                                      {med.brandName}{" "}
                                      {med.chineseName
                                        ? `(${med.chineseName})`
                                        : ""}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(med.id);
                                    }}
                                    className={cn(
                                      "p-2 rounded-xl border transition-all active:scale-75 hover:bg-red-500/15 hover:border-red-500/30 text-zinc-500 hover:text-red-500",
                                      theme === "dark"
                                        ? "border-white/5 bg-white/[0.02]"
                                        : "border-slate-200 bg-white",
                                    )}
                                    title="移出收藏"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-brand-secondary-accent" />
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Footer */}
              {favorites.length > 0 && (
                <div
                  className={cn(
                    "p-4 border-t font-mono text-[9px] opacity-40 text-center shrink-0",
                    theme === "dark" ? "border-white/5" : "border-slate-100",
                  )}
                >
                  Total {favorites.length} medicines pinned in local preferences
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Help & Operation Guide Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              key="help-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150]"
            />

            {/* Modal Dialog */}
            <motion.div
              key="help-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
              className={cn(
                "fixed inset-x-4 top-[12%] bottom-[12%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] md:h-[480px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden z-[160]",
                theme === "dark"
                  ? "bg-zinc-900/95 border-white/10 text-white shadow-black/80"
                  : "bg-white border-slate-200 text-slate-900 shadow-slate-900/20",
              )}
            >
              {/* Header */}
              <div
                className={cn(
                  "p-5 border-b shrink-0 flex items-center justify-between",
                  theme === "dark"
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-slate-100 bg-slate-50",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "p-1.5 rounded-xl flex items-center justify-center shrink-0",
                    theme === "dark" ? "bg-brand-accent/15 text-brand-accent" : "bg-brand-accent/10 text-brand-accent"
                  )}>
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      系統操作指引與介紹
                    </h3>
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      theme === "dark" ? "text-zinc-500" : "text-slate-400",
                    )}>
                      幫助您快速掌握高效率的臨床藥物查詢功能
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    theme === "dark"
                      ? "hover:bg-white/10 text-zinc-400 hover:text-white"
                      : "hover:bg-slate-100 text-slate-500 hover:text-slate-800",
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-brand-accent flex items-center gap-1.5">
                    <span>🔍 字首優先！模糊與精準查詢</span>
                  </h4>
                  <p className="leading-relaxed text-[11px] pl-5 text-amber-500/90 font-medium">
                    💡 關鍵密技：優先輸入成分/英文或中文的「完整字首」（例如以 'acet' / '乙醯' 進行查詢），高強度字首優選演算法即刻啟動，迅速置頂精確西藥成份。
                  </p>
                  <p className="opacity-80 leading-relaxed text-[11px] pl-5">
                    同時也支持直接輸入學名、商品名、中文藥名，或任何「症狀、副作用、生理器官描述」（例如「胃酸過多」、「皮膚過敏」）。系統會透過自動演算，優選出最吻合適應症 (Indications) 的常用西藥成份。
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-brand-accent flex items-center gap-1.5">
                    <span>✨ 自動關聯機轉</span>
                  </h4>
                  <p className="opacity-80 leading-relaxed text-[11px] pl-5">
                    輸入任何症狀時，頁面最上方會立即以簡約精緻的標籤「自動顯示關聯的學術生理機轉（生理系統與藥理分類）」，完全無多餘字樣干擾。
                    同時，臨床最常用的首選西藥成分（如 Acetaminophen 等）會被智慧排序並自動置前。
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-violet-500 flex items-center gap-1.5">
                    <span>🤖 AI 智能情境諮詢模式</span>
                  </h4>
                  <p className="opacity-80 leading-relaxed text-[11px] pl-5">
                    點擊頂部中央的開關可切換為「Smart Analysis」AI 情境諮詢模式。
                    在此模式下，您可以輸入整段臨床情境（如：病患 58 歲女性主訴飯後血糖高），AI 將在數秒內為您分析臨床考量並精確列出可用處方藥。
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-amber-500 flex items-center gap-1.5">
                    <span>⭐ 收藏與高頻藥物管理</span>
                  </h4>
                  <p className="opacity-80 leading-relaxed text-[11px] pl-5">
                    點擊任何藥物卡片右側的星號（⭐）即可將該藥物收藏。
                    點擊右上角「幫助」左側的「收藏」按鈕，可開啟我的收藏面板，用於快速調閱與一鍵管理。
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div
                className={cn(
                  "p-4 border-t flex justify-end shrink-0",
                  theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-slate-100 bg-slate-50",
                )}
              >
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-brand-accent hover:bg-brand-accent/80 text-white font-bold transition-all active:scale-95 shadow-sm text-[11px]"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detail Overlay Removed */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md text-xs font-medium border select-none"
            style={{
              backgroundColor: theme === "dark" ? "rgba(24, 24, 27, 0.9)" : "rgba(255, 255, 255, 0.9)",
              borderColor: theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
              color: theme === "dark" ? "#f4f4f5" : "#18181b",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                <Check className="w-3.5 h-3.5" />
              </span>
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
