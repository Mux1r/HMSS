/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useDeferredValue,
  FormEvent,
} from "react";
import Fuse from "fuse.js";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import {
  Search,
  Pill,
  Filter,
  Plus,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  ExternalLink,
  Loader2,
  X,
  CheckCircle2,
  Trash2,
  Database,
  Menu,
  Syringe,
  Droplets,
  Eye,
  FlaskConical,
  Wind,
  Sparkles,
  CircleDot,
  ArrowDown,
  ArrowRight,
  History,
  User,
  Zap,
  Beaker,
  Bandage,
  Gem,
  ArrowDownToDot,
  Container,
  Sun,
  Moon,
  Settings,
  Smartphone,
  Download,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";

const getMedicationIcon = (code: string) => {
  const firstChar = code?.charAt(0)?.toUpperCase();
  switch (firstChar) {
    case "E":
      return Sparkles;
    case "T":
      return Pill;
    case "I":
      return Syringe;
    case "L":
      return Droplets;
    case "O":
      return Eye;
    case "S":
      return Wind;
    case "Z":
      return FlaskConical;
    case "V":
      return CircleDot;
    default:
      return Pill;
  }
};

const getDosageColor = (code: string) => {
  const firstChar = code?.charAt(0)?.toUpperCase();
  const base = "border-l";
  switch (firstChar) {
    case "E":
      return {
        border: `${base} border-l-blue-500`,
        glow: "bg-blue-500",
        text: "text-blue-500",
        accent: "text-blue-400",
        bg: "bg-blue-500/10",
        borderMain: "border-blue-500/20",
        icon: Container,
      }; // 外用
    case "T":
      return {
        border: `${base} border-l-orange-500`,
        glow: "bg-orange-500",
        text: "text-orange-500",
        accent: "text-orange-400",
        bg: "bg-orange-500/10",
        borderMain: "border-orange-500/20",
        icon: Pill,
      }; // 錠劑
    case "I":
      return {
        border: `${base} border-l-red-500`,
        glow: "bg-red-500",
        text: "text-red-500",
        accent: "text-red-400",
        bg: "bg-red-500/10",
        borderMain: "border-red-500/20",
        icon: Syringe,
      }; // 針劑
    case "L":
      return {
        border: `${base} border-l-teal-500`,
        glow: "bg-teal-500",
        text: "text-teal-500",
        accent: "text-teal-400",
        bg: "bg-teal-500/10",
        borderMain: "border-teal-500/20",
        icon: FlaskConical,
      }; // 藥水
    case "O":
      return {
        border: `${base} border-l-emerald-500`,
        glow: "bg-emerald-500",
        text: "text-emerald-500",
        accent: "text-emerald-400",
        bg: "bg-emerald-500/10",
        borderMain: "border-emerald-500/20",
        icon: Eye,
      }; // 眼用
    case "S":
      return {
        border: `${base} border-l-amber-500`,
        glow: "bg-amber-500",
        text: "text-amber-500",
        accent: "text-amber-400",
        bg: "bg-amber-500/10",
        borderMain: "border-amber-500/20",
        icon: Wind,
      }; // 噴劑
    case "Z":
      return {
        border: `${base} border-l-zinc-500`,
        glow: "bg-zinc-500",
        text: "text-zinc-500",
        accent: "text-zinc-400",
        bg: "bg-zinc-500/10",
        borderMain: "border-zinc-500/20",
        icon: Beaker,
      }; // 試驗
    case "V":
      return {
        border: `${base} border-l-violet-500`,
        glow: "bg-violet-500",
        text: "text-violet-500",
        accent: "text-violet-400",
        bg: "bg-violet-500/10",
        borderMain: "border-violet-500/20",
        icon: ArrowDownToDot,
      }; // 塞劑
    default:
      return {
        border: `${base} border-l-brand-accent`,
        glow: "bg-brand-accent",
        text: "text-brand-accent",
        accent: "text-brand-accent/80",
        bg: "bg-brand-accent/10",
        borderMain: "border-brand-accent/20",
        icon: Pill,
      };
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
import { MEDICAL_ALIASES } from "./lib/medicalKeywords";

// Helper function to retry Gemini API calls with exponential backoff on 429 Too Many Requests errors.
const retryWithBackoff = async <T = any>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit =
      error?.status === 429 ||
      error?.statusCode === 429 ||
      (error?.message && error.message.includes("429")) ||
      (error?.message && error.message.toLowerCase().includes("too many requests")) ||
      (error?.message && error.message.toLowerCase().includes("quota")) ||
      (error?.message && error.message.toLowerCase().includes("exhausted"));

    if (retries > 0 && isRateLimit) {
      console.warn(`Gemini API rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
};

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
  const [isAdding, setIsAdding] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [gsheetUrl, setGsheetUrl] = useState(
    "https://script.google.com/macros/s/AKfycbxotfbc6-KsIn-_RoltpZl_vQhjUNDN-UrU9pWIARSCnWUCn_9iZ60J46zwr3b6laKBBw/exec",
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isDosageFormOpen, setIsDosageFormOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [aiSymptomMapping, setAiSymptomMapping] = useState<{ classes: string[], systems: string[], keywords: string[], recommendedIngredients: string[] } | null>(null);
  const [isSymptomAnalyzing, setIsSymptomAnalyzing] = useState(false);
  const [isAiSymptomRequested, setIsAiSymptomRequested] = useState(false);
  const aiSymptomCacheRef = useRef<Record<string, { classes: string[], systems: string[], keywords: string[], recommendedIngredients: string[] }>>({});
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
  const dragControls = useDragControls();

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
      const time =
        typeof (globalThis as any).__BUILD_TIME__ !== "undefined"
          ? (globalThis as any).__BUILD_TIME__
          : new Date().toISOString();
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
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<
    { query: string; response: string; timestamp: number; filteredCount?: number; totalCount?: number }[]
  >([]);
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
          if (med) setSelectedMed(med);
        } else if (state.type === "ai") {
          setIsAiMode(true);
          // If the state says it's just AI, but we came from a med selection,
          // we might want to stay in HMSS if that's what's logic dictates,
          // or just follow the state exactly.
          if (state.medId) {
            const med = medications.find((m) => m.id === state.medId);
            if (med) setSelectedMed(med);
          } else {
            setSelectedMed(null);
          }
        } else if (state.type === "med") {
          setIsAiMode(false);
          const med = medications.find((m) => m.id === state.id);
          if (med) setSelectedMed(med);
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

    const state: any = { isAi: isAiMode };
    if (selectedMed) state.medId = selectedMed.id;

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

  // Manual close handlers
  const closeDetail = () => setSelectedMed(null);
  const exitAiMode = () => setIsAiMode(false);
  // -----------------------------------

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", isAiMode ? "ai" : "hmss");
  }, [isAiMode]);

  const ai = useMemo(
    () =>
      new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build-client",
          },
        },
      }),
    [],
  );

  const isQueryValidForAi = useMemo(() => {
    const query = searchQuery.trim();
    if (!query || query.length < 2) return false;
    const looksLikeCode = /^[A-Z0-9.\-\s%]{1,7}$/i.test(query);
    return !looksLikeCode;
  }, [searchQuery]);

  // Reset AI request when search query changes
  useEffect(() => {
    setIsAiSymptomRequested(false);
    setAiSymptomMapping(null);
  }, [searchQuery]);

  useEffect(() => {
    if (!isAiSymptomRequested) {
      setAiSymptomMapping(null);
      setIsSymptomAnalyzing(false);
      return;
    }

    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setAiSymptomMapping(null);
      setIsSymptomAnalyzing(false);
      return;
    }

    // Checking if query matches simple codes or short alpha characters to skip AI request
    const looksLikeCode = /^[A-Z0-9.\-\s%]{1,7}$/i.test(query);
    if (looksLikeCode) {
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
  "keywords": [擴展的1~2個相關中文或英文藥理同義詞/關鍵字，可用於模糊搜尋輔助，例如 "止咳", "抗過敏"],
  "recommendedIngredients": [最合適、最常用且最符合適應症的首選西藥成分名稱列表，建議用常見英文學名如 "dextromethorphan"、或是常用中文成分名稱，依據常用度及臨床首選順序由高到低排列]
}

注意：如果沒有任何相關的，請回傳空陣列形式。`;

        const response = await retryWithBackoff<any>(() =>
          ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              thinkingConfig: {
                thinkingLevel: "MINIMAL",
              },
            }
          })
        );

        const text = response.text || "";
        const parsed = JSON.parse(text.trim());

        const result = {
          classes: Array.isArray(parsed.classes) ? parsed.classes.filter((c: any) => classesList.includes(c)) : [],
          systems: Array.isArray(parsed.systems) ? parsed.systems.filter((s: any) => systemsList.includes(s)) : [],
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: any) => String(k).toLowerCase()) : [],
          recommendedIngredients: Array.isArray(parsed.recommendedIngredients) ? parsed.recommendedIngredients.map((r: any) => String(r).toLowerCase().trim()) : [],
        };

        aiSymptomCacheRef.current[query] = result;
        setAiSymptomMapping(result);
      } catch (error) {
        console.error("AI Symptom Analysis Failed:", error);
      } finally {
        setIsSymptomAnalyzing(false);
      }
    }, 150);

    return () => clearTimeout(delayTimer);
  }, [isAiSymptomRequested, searchQuery, medications, ai]);

  // Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(medications, {
      keys: [
        { name: "code", weight: 1.0 },
        { name: "component", weight: 0.95 },
        { name: "brandName", weight: 0.9 },
        { name: "genericName", weight: 0.8 },
        { name: "chineseName", weight: 0.8 },
        { name: "pharmacologicalClass", weight: 0.4 },
        { name: "anatomicalSystem", weight: 0.4 },
        { name: "indications", weight: 0.3 },
        { name: "searchKeywords", weight: 0.3 },
      ],
      threshold: 0.3, // 更緊確的閾值提升精準度
      location: 0, // 優先考慮字串開頭的匹配 (字首重要性)
      distance: 20, // 縮小權重位距拉大字首匹配與段中匹配的分差
      includeScore: true,
      shouldSort: true,
    });
  }, [medications]);

  // Remove global click listener in favor of local onBlur for better focus management
  useEffect(() => {
    // We can keep a simplified version or rely solely on onBlur
    // But standard "outside click" is usually better for mouse users who click non-focusable areas
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click is not inside a dropdown or filter area, close them
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

  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    setImportStatus("正在連線至雲端資料庫...");

    try {
      const { meds, hash } =
        await localMedicationService.fetchFromGoogleSheet(gsheetUrl);
      setImportStatus(`正在存儲 ${meds.length} 筆資料至本地庫...`);

      // 直接覆蓋現有清單，並儲存原始資料的雜湊以供未來比對
      await localMedicationService.saveAll(meds, hash);
      setMedications(meds);

      setImportStatus(`同步成功！已更新 ${meds.length} 筆資料`);
      setIsUpdateAvailable(false);
    } catch (error) {
      setImportStatus("同步失敗，請檢查網路連線或資料格式");
      console.error(error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  // Data Loading and Update Check
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const stored = await localMedicationService.getAll();
        if (stored.length > 0) {
          setMedications(stored);
        } else {
          const { meds, hash } =
            await localMedicationService.fetchFromGoogleSheet(gsheetUrl);
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
  }, [gsheetUrl]);

  const handleAiSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiResponse(null);

    const currentQuery = aiQuery;
    const currentTimestamp = Date.now();

    // 立即將主要對話佔位符加入對話歷史
    setAiHistory((prev) => [
      { 
        query: currentQuery, 
        response: "", 
        timestamp: currentTimestamp,
      },
      ...prev,
    ]);
    setAiQuery("");

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error(
          "偵測不到 GEMINI_API_KEY。請在專案中設定環境變數。",
        );
      }

      // 1. 將藥物清單壓縮為兼顧準確與極致短少 Token 的緊湊格式，包含藥理分類與適應症資訊供 AI 推理
      const medListSummaryText = medications
        .map(
          (m) =>
            `- [${m.code}] ${m.component || m.genericName}${m.brandName ? ` (${m.brandName})` : ""}: [機轉/分類:${m.pharmacologicalClass || "未知"}]_適應症/ATC關鍵字: ${m.indications || "無"}`
        )
        .join("\n");

      // 2. 優化系統提示詞，引導 AI 進行「臨床精確且文字極度精鍊」的回應，大幅加快回答速度
      const prompt = `# Role
你是一位全能且精通臨床藥理學的主治醫師，具備嚴謹的臨床推理能力與多重用藥（Polypharmacy）審視經驗。

# Context
用戶將會提供一段關於病患的健康狀況描述（包含主訴、病史或症狀），以及一份合適的可用藥物清單。

# Task
請依據用戶提供的病患描述與可用藥物，進行以下三步驟的臨床分析：
1. 臨床問題拆解：分析並識別出描述中健康問題（Problems），並區分為 active 與 underlying problems。
2. 藥理決策與建議：綜合評估識別出的健康問題，針對每個使用者需要解決的問題 (active problems)，從可用藥物清單中篩選出 5-10 個臨床上最適切的藥物建議，並提供藥物功能與選擇理由。underlying disease 僅用來與 active problems 綜合評估病患情況，不需呈現 underlying problems 的藥物建議。
3. 處方總結：撰寫一份整體用藥策略總結 (說明請精準扼要，以 50-100 字為限)。

# Constraints
- 每個藥物建議的「臨床選擇理由與主要功能」必須極度精簡，嚴格限制在 15 個字以內！例如：「一線降血糖藥，心血管保護」。
- 藥物審視（Medication Review）：挑選藥物時，必須嚴格審視藥物交互作用（DDI）、重複用藥及潛在的副作用。
- 實證醫學：所有藥物建議必須符合現行臨床指引。
- 資訊邊界：若病患描述之資訊不足以確立診斷，應明確指出需進一步評估的臨床指標（如肝腎功能、實驗室數據），不可憑空猜測。

# Output Format (強制嚴格執行，以利系統解析)
請務必嚴格遵守以下结构輸出。請「絕對不要」輸出「【第一部分：整體用藥策略與總結建議】」、「第一部分」、「【第二部分：臨床問題與建議藥物清單】」、「第二部分」等標題：

[整體用藥策略與臨床總結段落]
請直接在此第一段輸出 50-100 字的整體臨床分析、用藥策略總結以及任何需要進一步評估的臨床指標（說明請精準扼要，重點式、邏輯清晰、可使用條列式，在此段中絕對不可包含「問題：」或「Problem:」字樣）。

問題：[主動健康問題名稱]
[藥品碼] [藥物名稱] [該藥之臨床選擇理由與主要功能（請限15字內，極致簡短）]
[藥品碼] [藥物名稱] [該藥之臨床選擇理由與主要功能（請限15字內，極致簡短）]
... （針對此問題建議最多 5-10 個藥物，每行一藥）

---
病患狀況描述：
${currentQuery}

以下是可用藥物清單：
${medListSummaryText}
`;

      // 3. 升級至最新的 gemini-3.5-flash，並配合 generateContentStream。
      const responseStream = await retryWithBackoff<any>(() =>
        ai.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            thinkingConfig: {
              thinkingLevel: "LOW",
            },
          },
        })
      );

      let fullResponse = "";
      for await (const chunk of responseStream) {
        const chunkText = chunk.text || "";
        if (chunkText) {
          fullResponse += chunkText;
          setAiHistory((prev) =>
            prev.map((item) =>
              item.timestamp === currentTimestamp
                ? { ...item, response: fullResponse }
                : item,
            ),
          );
        }
      }
    } catch (error: any) {
      console.error("AI Search Error:", error);
      const errorMsg = error?.message || "AI 搜尋發生錯誤，請稍後再試。";
      setAiHistory((prev) =>
        prev.map((item) =>
          item.timestamp === currentTimestamp
            ? { ...item, response: `⚠️ 錯誤：${errorMsg}` }
            : item,
        ),
      );
    } finally {
      setIsAiLoading(false);
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

    let baseMeds = medications;

    if (query) {
      const minPrefixLength = 3;
      const queryLen = query.length;

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

      // 1.1 醫學屬性匹配 (機轉、分類等)
      const medicalIntentMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;

        const pharmacological = m.pharmacologicalClass?.toLowerCase() || "";
        const system = m.anatomicalSystem?.toLowerCase() || "";
        const indications = m.indications?.toLowerCase() || "";

        // 如果查詢命中分類或機轉關鍵字
        if (pharmacological.includes(query) || system.includes(query))
          return true;

        // 別名命中機轉 (例如 ACEI 命中藥理分類中含有相關字眼的藥物)
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
        const targets = [m.code, m.component, m.brandName, m.genericName, m.chineseName];
        return targets.some((t) => t?.toLowerCase().startsWith(query));
      });

      // 第三層： 第一個「字母/中文字」單字開頭匹配 (例如解決 "10% Dextrose" 的 "Dextrose" 開頭，或中文開頭)
      const firstAlphaStartMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        if (stringStartMatches.some((sm) => sm.id === m.id)) return false;
        const targets = [m.component, m.brandName, m.genericName, m.chineseName];
        return targets.some((t) => {
          if (!t) return false;
          const alphaT = getAlphaStart(t);
          return alphaT.startsWith(query);
        });
      });

      // 第四層： 其他單字開頭 (Word Boundary Match - 單字字首開頭) - 滿足「每個單字開頭權重都調高」
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}`, "i");
      const wordBoundaryMatches = medications.filter((m) => {
        if (exactMatches.some((em) => em.id === m.id)) return false;
        if (medicalIntentMatches.some((mm) => mm.id === m.id)) return false;
        if (stringStartMatches.some((sm) => sm.id === m.id)) return false;
        if (firstAlphaStartMatches.some((am) => am.id === m.id)) return false;

        const searchPool = `${m.component} ${m.brandName} ${m.genericName} ${m.chineseName} ${m.searchKeywords || ""}`;
        return wordBoundaryRegex.test(searchPool);
      });

      // 第五層： 全域模糊搜尋 (Global Fuzzy Match) - 僅在符合特定條件時顯示
      const fuzzyResults = fuse.search(query);

      // 過濾與限制模糊搜尋結果
      const constrainedFuzzy = fuzzyResults
        .filter((result) => {
          const item = result.item;
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
        .map((r) => r.item);

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

        return isClassMatch || isSystemMatch || isKeywordMatch;
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
      addUniqueMeds(medicalIntentMatches);
      addUniqueMeds(aiSymptomMatches);
      addUniqueMeds(stringStartMatches);
      addUniqueMeds(firstAlphaStartMatches);
      addUniqueMeds(wordBoundaryMatches);

      // 合併模糊匹配結果 (去重)
      constrainedFuzzy.forEach((fm) => {
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

        // 1. 各層級之基礎匹配權重 (調整排序：字首開頭/首字匹配優先權大幅調高，高於症狀關聯與一般適應症，確保字首重要性)
        if (exactMatches.some((em) => em.id === m.id)) {
          score += 12000;
        } else if (stringStartMatches.some((sm) => sm.id === m.id)) {
          score += 10000;
        } else if (firstAlphaStartMatches.some((am) => am.id === m.id)) {
          score += 9000;
        } else if (wordBoundaryMatches.some((wm) => wm.id === m.id)) {
          score += 8000;
        } else if (medicalIntentMatches.some((mm) => mm.id === m.id)) {
          score += 7000;
        } else if (aiSymptomMatches.some((sm) => sm.id === m.id)) {
          score += 6000;
        } else {
          score += 1000;
        }

        // 2. 適應症(Indications)之精確契合度優選分數 (解決「最符合使用 indication 的藥物作排序」)
        const indicationsLower = (m.indications || "").toLowerCase();
        const chineseNameLower = (m.chineseName || "").toLowerCase();
        const componentLower = (m.component || "").toLowerCase();
        const brandNameLower = (m.brandName || "").toLowerCase();
        const pharmacologicalLower = (m.pharmacologicalClass || "").toLowerCase();
        const genericLower = (m.genericName || "").toLowerCase();

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
          score += 5000; // 給予超高額外字首分數，強調字首的絕對重要性！
        }

        // 3. 整合 AI 臨床首選與推薦藥物成分 (與臨床最常用、治療契合度排序對接)
        if (aiSymptomMapping) {
          // 3.1 AI 主動推薦的特效/常用成分
          const recoIndex = aiSymptomMapping.recommendedIngredients.findIndex((ing) => {
            const cleanIng = ing.toLowerCase();
            return componentLower.includes(cleanIng) || genericLower.includes(cleanIng) || cleanIng.includes(componentLower);
          });

          if (recoIndex !== -1) {
            // 排名越靠前(recoIndex越小)，分數加成越高
            score += Math.max(200, 3000 - recoIndex * 400);
          }

          // 3.2 AI 推薦的相關藥理分類符合
          if (aiSymptomMapping.classes.includes(m.pharmacologicalClass)) {
            score += 1500;
          }
          // 3.3 AI 推薦的相關生理系統符合
          if (aiSymptomMapping.systems.includes(m.anatomicalSystem)) {
            score += 800;
          }
        }

        // 4. 對臨床常見/常用成分常數加分 (保障基線常用度排序)
        const isCommonComponent = GENERAL_COMMON_INGREDIENTS.some((gci) => {
          return componentLower.includes(gci) || genericLower.includes(gci);
        });
        if (isCommonComponent) {
          score += 500;
        }

        return score;
      };

      // 執行最終排序
      baseMeds = [...combinedMeds].sort((a, b) => {
        const scoreA = getSortingScore(a);
        const scoreB = getSortingScore(b);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        // 分數相同時，將品牌藥名長度短的、或者常用藥名排在前面，以防偏僻特殊物料卡在首位
        return (a.brandName || "").length - (b.brandName || "").length;
      });
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
                      onClick={handleSyncGoogleSheet}
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
                        onFocus={() => {
                          setSearchFocused(true);
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

                  {isAiSymptomRequested && (isSymptomAnalyzing || aiSymptomMapping) && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "mb-3.5 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center gap-2 text-xs shadow-sm shadow-brand-accent/5",
                        theme === "dark"
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
                                setSelectedMed(med);
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
                                                          const normalizedLine = line
                                                            .replace(/\[([^\]]+)\]/g, "$1")
                                                            .replace(/【([^】]+)】/g, "$1")
                                                            .trim();
                                                          // 更加彈性的藥品碼解析，自動跳過編號或點點
                                                          const cleanedLine =
                                                            normalizedLine
                                                              .replace(
                                                                /^\s*(\d+[\.\、\)]|\*|\-|\•)\s*/,
                                                                "",
                                                              )
                                                              .trim();
                                                          const parts =
                                                            cleanedLine.split(
                                                              /\s+/,
                                                            );
                                                          const rawCode = parts[0] || "";
                                                          const code = rawCode.replace(/[\[\]]/g, "").toUpperCase();
                                                          const med =
                                                            medications.find(
                                                              (m) =>
                                                                m.code === code,
                                                            );

                                                          let name =
                                                            parts[1] || "";
                                                          let funcPart = parts
                                                            .slice(2)
                                                            .join(" ");

                                                          if (med) {
                                                            name =
                                                              med.component;
                                                            const lineWithoutCode =
                                                              cleanedLine
                                                                .substring(
                                                                  cleanedLine.indexOf(
                                                                    " ",
                                                                  ) + 1,
                                                                )
                                                                .trim();
                                                            if (
                                                              lineWithoutCode.startsWith(
                                                                med.component,
                                                              )
                                                            ) {
                                                              funcPart =
                                                                lineWithoutCode
                                                                  .replace(
                                                                    med.component,
                                                                    "",
                                                                  )
                                                                  .trim();
                                                            }
                                                          }

                                                          // Clean trailing or starting colons or brackets in the parsed parts
                                                          name = name.replace(/^[\[】【]|[\]】]/g, "").trim();
                                                          funcPart = funcPart.replace(/^[\[】【]|[\]】]/g, "").trim();
                                                          if (funcPart.startsWith(":") || funcPart.startsWith("：")) {
                                                            funcPart = funcPart.substring(1).trim();
                                                          }

                                                          const itemKey = `${hIdx}-${gIdx}-${lIdx}`;
                                                          const isExpanded =
                                                            !!aiExpandedMeds[
                                                              itemKey
                                                            ];

                                                          if (!code || !name)
                                                            return (
                                                              <div
                                                                key={lIdx}
                                                                className={cn(
                                                                  "text-xs italic px-2 w-full max-w-full min-w-0 overflow-hidden break-words",
                                                                  theme ===
                                                                    "dark"
                                                                    ? "text-zinc-500"
                                                                    : "text-slate-400",
                                                                )}
                                                              >
                                                                {line}
                                                              </div>
                                                            );

                                                          return (
                                                            <div
                                                              key={lIdx}
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
                "hidden md:flex flex-col border-l relative z-[60] overflow-hidden bg-brand-sidebar shadow-2xl shrink-0 w-[400px] lg:w-[480px]",
                theme === "dark" ? "border-white/10" : "border-slate-200",
              )}
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
                  "flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-thin",
                  theme === "dark"
                    ? "bg-gradient-to-b from-brand-sidebar to-brand-bg scrollbar-thumb-white/10"
                    : "bg-white scrollbar-thumb-slate-200",
                )}
              >
                <div className="space-y-4">
                  <button
                    onClick={() => handleCopyCode(selectedMed.code)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border transition-all active:scale-95 group/code cursor-pointer",
                      getDosageColor(selectedMed.code).bg,
                      getDosageColor(selectedMed.code).borderMain,
                      "hover:bg-brand-accent/5 hover:border-brand-accent/30"
                    )}
                    title="點擊複製藥物代碼"
                  >
                    <span
                      className={cn(
                        "font-mono font-black text-[15px] tracking-widest",
                        getDosageColor(selectedMed.code).text,
                      )}
                    >
                      {selectedMed.code}
                    </span>
                    <Copy className="w-3.5 h-3.5 opacity-40 group-hover/code:opacity-100 transition-opacity text-brand-muted shrink-0" />
                  </button>

                  <div className="space-y-1">
                    <h1
                      className={cn(
                        "text-xl md:text-2xl font-bold leading-tight tracking-tight break-words",
                        theme === "dark" ? "text-zinc-100" : "text-slate-900",
                      )}
                    >
                      {selectedMed.component}
                    </h1>
                    <p
                      className={cn(
                        "text-sm md:text-base font-medium tracking-tight break-words",
                        getDosageColor(selectedMed.code).accent,
                      )}
                    >
                      {selectedMed.genericName}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex flex-col gap-1 pt-2 border-l-2 pl-4",
                      getDosageColor(selectedMed.code).borderMain,
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs md:text-sm font-medium leading-snug",
                        theme === "dark" ? "text-zinc-300" : "text-slate-700",
                      )}
                    >
                      {selectedMed.brandName}
                    </p>
                    {selectedMed.chineseName && (
                      <p
                        className={cn(
                          "text-[10px] md:text-xs font-normal",
                          theme === "dark" ? "text-zinc-500" : "text-slate-400",
                        )}
                      >
                        {selectedMed.chineseName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label
                      className={cn(
                        "text-[9px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2",
                        theme === "dark" ? "text-zinc-500" : "text-slate-400",
                      )}
                    >
                      Anatomical System
                    </label>
                    <button
                      onClick={() => {
                        setSearchQuery(selectedMed.anatomicalSystem);
                      }}
                      className={cn(
                        "font-medium leading-relaxed text-xs md:text-sm pl-2.5 border-l-2 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full",
                        theme === "dark"
                          ? "text-zinc-300 border-zinc-800/60"
                          : "text-slate-600 border-slate-200",
                      )}
                    >
                      {selectedMed.anatomicalSystem}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label
                      className={cn(
                        "text-[10px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2",
                        theme === "dark" ? "text-zinc-500" : "text-slate-400",
                      )}
                    >
                      Pharmacological Class
                    </label>
                    <button
                      onClick={() => {
                        setSearchQuery(selectedMed.pharmacologicalClass);
                      }}
                      className={cn(
                        "font-medium leading-relaxed text-sm md:text-base pl-2.5 border-l-2 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full",
                        theme === "dark"
                          ? "text-zinc-200 border-zinc-700"
                          : "text-slate-700 border-slate-200",
                      )}
                    >
                      {selectedMed.pharmacologicalClass}
                    </button>
                  </div>
                </div>

                {selectedMed.indications && (
                  <section className="space-y-3">
                    <div
                      className={cn(
                        "flex items-center gap-3 font-semibold text-[10px] uppercase tracking-[0.15em]",
                        theme === "dark" ? "text-zinc-500" : "text-slate-400",
                      )}
                    >
                      ATC Info / Indications
                    </div>
                    <p
                      className={cn(
                        "leading-relaxed text-sm md:text-base font-sans backdrop-blur-sm p-4 rounded-lg border shadow-sm break-all",
                        theme === "dark"
                          ? "text-zinc-300 bg-white/[0.01] border-white/[0.03]"
                          : "text-slate-700 bg-slate-50 border-slate-100",
                      )}
                    >
                      {selectedMed.indications}
                    </p>
                  </section>
                )}

                <div className="space-y-6 pt-6 pb-20">
                  <h3
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2",
                      theme === "dark" ? "text-zinc-500" : "text-slate-400",
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        getDosageColor(selectedMed.code).glow,
                      )}
                    ></span>
                    Index Metadata
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedMed.searchKeywords.map((k, i) => (
                      <button
                        key={`${k}-${i}`}
                        onClick={() => setSearchQuery(k)}
                        className={cn(
                          "px-4 py-1.5 border rounded-lg text-[10px] font-mono transition-all cursor-pointer uppercase tracking-tight",
                          theme === "dark"
                            ? "bg-brand-secondary/50 border-brand-border text-zinc-500 hover:border-brand-accent/50 hover:bg-brand-accent/5 hover:text-brand-accent"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:border-brand-accent/50 hover:bg-slate-100 hover:text-brand-accentShadow",
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

        {/* Mobile Detail Panel - Persistent 1/3 bottom sheet */}
        <AnimatePresence>
          {selectedMed && (
            <motion.div
              key="mobile-panel"
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  closeDetail();
                }
              }}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className={cn(
                "md:hidden fixed inset-x-0 bottom-0 h-[38vh] border-t z-[100] overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
                theme === "dark"
                  ? "bg-brand-sidebar border-white/10"
                  : "bg-white border-slate-200",
              )}
            >
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="w-full pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none shrink-0"
              >
                <div
                  className={cn(
                    "w-12 h-1.5 rounded-full mx-auto shadow-sm",
                    theme === "dark" ? "bg-zinc-700" : "bg-slate-300",
                  )}
                />
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5 scrollbar-none">
                <div className="flex justify-between items-start sticky top-0 bg-inherit pt-1 pb-2 z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(selectedMed.code)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[15px] font-mono font-black tracking-widest transition-all active:scale-95 cursor-pointer group/mobile-code",
                        getDosageColor(selectedMed.code).bg,
                        getDosageColor(selectedMed.code).text,
                        getDosageColor(selectedMed.code).borderMain,
                        "hover:bg-brand-accent/5"
                      )}
                      title="點擊複製藥物代碼"
                    >
                      <span>{selectedMed.code}</span>
                      <Copy className="w-3.5 h-3.5 opacity-40 group-hover/mobile-code:opacity-100 transition-opacity text-brand-muted shrink-0" />
                    </button>
                    <button
                      onClick={() => toggleFavorite(selectedMed.id)}
                      className="p-2 rounded-full cursor-pointer transition-colors group"
                    >
                      <SharpStar
                        className={cn(
                          "w-[18px] h-[18px] transition-colors",
                          isFavorite(selectedMed.id)
                            ? "fill-amber-400 text-amber-500"
                            : theme === "dark"
                              ? "text-zinc-700 group-hover:text-amber-400/75"
                              : "text-slate-200 group-hover:text-amber-400/75",
                        )}
                      />
                    </button>
                  </div>
                  <button
                    onClick={closeDetail}
                    className="p-1 -mr-2 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h1
                    className={cn(
                      "text-lg font-bold leading-tight",
                      theme === "dark" ? "text-white" : "text-slate-900",
                    )}
                  >
                    {selectedMed.component}
                  </h1>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      getDosageColor(selectedMed.code).accent,
                    )}
                  >
                    {selectedMed.genericName}
                  </p>
                </div>

                <div className="space-y-4">
                  <div
                    className="flex flex-col gap-0.5 border-l-2 pl-3"
                    style={{
                      borderColor:
                        getDosageColor(selectedMed.code)
                          .borderMain.split("-")
                          .slice(1)
                          .join("-") === "border-white/20"
                          ? "rgba(255,255,255,0.1)"
                          : undefined,
                    }}
                  >
                    <p
                      className={cn(
                        "text-xs",
                        theme === "dark" ? "text-zinc-400" : "text-slate-600",
                      )}
                    >
                      {selectedMed.brandName}
                    </p>
                    {selectedMed.chineseName && (
                      <p
                        className={cn(
                          "text-[10px]",
                          theme === "dark" ? "text-zinc-500" : "text-slate-400",
                        )}
                      >
                        {selectedMed.chineseName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={cn(
                        "p-2.5 rounded-xl border",
                        theme === "dark"
                          ? "bg-white/[0.02] border-white/5"
                          : "bg-slate-50 border-slate-100",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[8px] uppercase tracking-wider mb-1",
                          theme === "dark" ? "text-zinc-500" : "text-slate-400",
                        )}
                      >
                        System
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium block leading-tight",
                          theme === "dark" ? "text-zinc-300" : "text-slate-700",
                        )}
                      >
                        {selectedMed.anatomicalSystem}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "p-2.5 rounded-xl border",
                        theme === "dark"
                          ? "bg-white/[0.02] border-white/5"
                          : "bg-slate-50 border-slate-100",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[8px] uppercase tracking-wider mb-1",
                          theme === "dark" ? "text-zinc-500" : "text-slate-400",
                        )}
                      >
                        Class
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium block leading-tight",
                          theme === "dark" ? "text-zinc-300" : "text-slate-700",
                        )}
                      >
                        {selectedMed.pharmacologicalClass}
                      </span>
                    </div>
                  </div>

                  {selectedMed.indications && (
                    <div
                      className={cn(
                        "p-3 rounded-xl border text-[11px] leading-relaxed",
                        theme === "dark"
                          ? "bg-white/[0.02] border-white/5 text-zinc-400"
                          : "bg-slate-50 border-slate-100 text-slate-600",
                      )}
                    >
                      {selectedMed.indications}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedMed.searchKeywords.slice(0, 5).map((k, i) => (
                      <button
                        key={i}
                        onClick={() => setSearchQuery(k)}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-mono border",
                          theme === "dark"
                            ? "bg-white/5 border-white/10 text-zinc-500"
                            : "bg-slate-50 border-slate-100 text-slate-400",
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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
                                  setSelectedMed(med);
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
