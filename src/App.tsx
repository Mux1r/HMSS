/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
  FormEvent,
  type ReactNode,
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
  KeyRound,
  MessageSquareWarning,
  Monitor,
  Lock,
} from "lucide-react";
import ApiKeySetup from "./components/ApiKeySetup";
import Feedback from "./components/Feedback";
import FavoritesPage from "./components/FavoritesPage";
import Tour, { type TourStep } from "./components/Tour";
import { EMPTY_FOLDERS, mergeFolders, normalizeFolders, type FavoriteFolders } from "./lib/folders";
import {
  GROQ_MODEL,
  GROQ_MODEL_FAST,
  GroqKeyError,
  GroqRateLimitError,
  GUEST_KEY,
  clearGroqKey,
  groqChat,
  groqChatStream,
  loadGroqKey,
  saveGroqKey,
} from "./lib/groq";

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
  X: "核醫藥品",
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


// 引導教學的步驟（target 對應畫面元素的 data-tour）
const TOUR_STEPS: TourStep[] = [
  { target: "search", title: "查藥", body: "打藥名、成分、代碼或症狀就能查。現在先幫你填了「頭痛」當例子。" },
  { target: "fav-star", title: "收藏", body: "點星星把常用的藥加入收藏（要先登入）。收藏可以在左上角 ☰ 的控制中心裡分資料夾整理。" },
  { target: "kg", title: "AI 輔助查詢", body: "打的是症狀或病名時按這裡，AI 會依院內藥品的適應症找藥，連同義詞和更細的病名也會找到。不需要金鑰，也不佔 AI 助理的次數。" },
  { target: "filter", title: "篩選", body: "先選生理系統，再選藥理分類，也可以加上劑型，一起縮小範圍。" },
  { target: "mode", title: "AI 助理", body: "切到 AI 助理，輸入病人狀況，會先整理問題、請你勾選症狀，再建議院內用藥。沒登入每小時可以用 3 次。" },
  { target: "menu", title: "控制中心", body: "登入、收藏、AI 金鑰、外觀、意見回報都在這裡。" },
  { target: "help", title: "幫助", body: "想再看一次這個教學，或查每個功能的說明，都在這裡。" },
];

// 需要登入時的提示文字
const LOGIN_FOR_FAVORITES = {
  title: "登入後才能收藏",
  body: "收藏會存在你的帳號，換電腦登入也看得到；在公用電腦上也不會留給下一個人。",
  dismiss: "先不要",
};
const LOGIN_FOR_KEY = {
  title: "登入後才能設定 AI 金鑰",
  body: "金鑰會存在你的帳號，不會留在這台電腦。沒登入也能用 AI 助理，每小時可以產生 3 次用藥建議。",
  dismiss: "先不要",
};

// AI 輔助查詢按鈕：做成「用另一種方式查剛剛打的字」的搜尋建議樣式，標題直接帶出查詢字
function AiSearchButton({ query, dark, onClick, className }: {
  query: string;
  dark: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      data-tour="kg"
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-colors",
        dark
          ? "border-brand-accent/50 bg-brand-accent/10 hover:bg-brand-accent/20"
          : "border-brand-accent/40 bg-white hover:bg-brand-accent/5",
        className,
      )}
    >
      <span className="relative w-10 h-10 rounded-full bg-brand-accent text-white flex items-center justify-center shrink-0">
        <Search className="w-5 h-5" />
        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 fill-amber-300" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold truncate">
          AI 輔助查詢「<span className="text-brand-accent">{query}</span>」
        </span>
        <span className={cn("block text-[11px] truncate", dark ? "text-zinc-400" : "text-slate-500")}>
          依院內藥品的適應症，找出相關用藥
        </span>
      </span>
      <span className="flex items-center gap-0.5 px-3 h-8 rounded-full bg-brand-accent text-white text-xs font-bold shrink-0 group-hover:brightness-110">
        查詢
        <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// 登入二選一：刻意沒有預設、兩個按鈕一樣大，一定要選「公用電腦」或「個人裝置」才能登入，不會被略過。
function LoginChoice({ dark, onPick }: { dark: boolean; onPick: (remember: boolean) => void }) {
  const option = (remember: boolean, icon: ReactNode, title: string, desc: string) => (
    <button
      onClick={() => onPick(remember)}
      className={cn(
        "flex-1 min-w-0 flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-left transition-colors",
        dark ? "border-white/15 bg-white/5 hover:border-brand-accent" : "border-slate-200 bg-white/70 hover:border-brand-accent",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold">
        {icon}
        {title}
      </span>
      <span className={cn("text-[11px] leading-snug", dark ? "text-zinc-400" : "text-slate-500")}>{desc}</span>
    </button>
  );
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-bold">
        <GoogleIcon className="w-5 h-5 shrink-0" />
        用 Google 登入，先選這是哪種電腦
      </p>
      <div className="flex gap-2">
        {option(false, <Monitor className="w-4 h-4 text-amber-500 shrink-0" />, "公用電腦", "關掉分頁或閒置 30 分鐘就自動登出，不留資料")}
        {option(true, <Smartphone className="w-4 h-4 text-brand-accent shrink-0" />, "我的個人裝置", "保持登入，下次打開不用再登入")}
      </div>
    </div>
  );
}

// 幫助視窗內容。寫法原則：講「在哪裡、按什麼、會發生什麼」，不寫宣傳詞。
const HELP_SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: "查藥",
    lines: [
      "可以打成分、商品名、中文名或藥品代碼。打開頭幾個字最快，例如 acet 或「乙醯」，開頭相符的藥會排在最前面。",
    ],
  },
  {
    title: "用症狀找藥",
    lines: [
      "打症狀或病名（例如「偏頭痛」、「胃酸過多」），列表上方會出現「AI 輔助查詢」。按下去會找出院內藥品資料中適應症有寫到的藥，同義詞和更細的病名也算，例如查頭痛也會找到偏頭痛用藥，找到的藥會排到前面。也可以打藥理分類，例如「PPI」「COX-2」。",
      "這個功能不需要 AI 金鑰。",
    ],
  },
  {
    title: "AI 助理",
    lines: [
      "在最上方切到「AI 助理」，輸入病人的狀況，例如「58 歲女性，飯後血糖高」。",
      "AI 會先整理出主要問題，並列出幾個可能的伴隨症狀，請勾選病人有的。這些是用來判斷病因的，不會因此多開藥。也可以填病人的族群、腎肝功能、過敏和目前用藥，AI 會避開禁忌。",
      "建議分成「首選」和「替代」，並對應到院內品項。標示「同類替代」或「依 ATC 比對」的不是 AI 原本建議的成分，使用前請自己確認。長按藥卡（電腦按右鍵）可以複製藥品碼。",
      "沒登入也能用：訪客每小時可以產生 3 次用藥建議（用網站提供的額度）。登入後可以設定自己的免費 Groq 金鑰，就不受次數限制，設定大約一分鐘，之後可以在控制中心修改。AI 建議僅供參考，處方前請依臨床判斷和仿單確認。",
    ],
  },
  {
    title: "收藏",
    lines: [
      "收藏要先登入。登入後點藥品旁邊的星星就能收藏；左上角 ☰ 打開控制中心，按「收藏」可以查看和整理；篩選裡打開「僅顯示收藏」，列表就只顯示收藏的藥。",
    ],
  },
  {
    title: "Google 登入",
    lines: [
      "在控制中心先選「公用電腦」或「我的個人裝置」再登入。選公用電腦的話，關掉分頁或閒置 30 分鐘就會自動登出；選個人裝置會一直保持登入。登入後，收藏和 AI 金鑰會存到你的帳號，換手機或電腦登入同一個帳號就會自動帶過來。",
      "Google 的登入畫面會寫「繼續前往 ○○○.supabase.co」，那是本站使用的登入服務，可以放心繼續。",
      "登出時，這台裝置上的收藏、金鑰和 AI 諮詢紀錄會一起清掉，帳號裡的不受影響。",
      "網站管理者在後台看得到帳號裡的資料，包括存進去的 AI 金鑰；介意的話可以不登入，資料就只留在這台裝置上。",
      "完整說明請見控制中心最下方的「隱私權政策」。",
    ],
  },
  {
    title: "意見回報",
    lines: [
      "左上角 ☰ 打開控制中心，按「意見回報」。寫下發生了什麼事，可以附一張截圖（電腦上也能直接貼上）。請不要寫病人的姓名或病歷號。",
    ],
  },
];

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
  searchKg,
  KgResult,
} from "./services/medicationService";
import { consumeJustUpdated } from "./lib/appUpdate";
import { consumeStaleEphemeral, isDeviceRemembered } from "./lib/device";

// 開啟時判斷一次：上一位在公用電腦沒登出（關分頁／關瀏覽器）→ 不載入他留下的收藏與 AI 紀錄。
const STALE_EPHEMERAL = consumeStaleEphemeral();
import { cn } from "./lib/utils";
import { MEDICAL_ALIASES, MECHANISM_ATC, mechanismKey } from "./lib/medicalKeywords";
import {
  atcMatches,
  diffMedications,
  ingredientMatches,
  isPediatricContext,
  parseRecommendation,
  type DrugRec,
} from "./lib/formulary";

import { aiRecommendCache, loadAiHistory, saveAiHistory } from "./lib/aiStore";
import {
  type User as AuthUser,
  fetchRemoteUserData,
  hasSyncedOnDevice,
  markSyncedOnDevice,
  mergeFavorites,
  onAuthChange,
  pushRemoteUserData,
  pushRemoteFolders,
  signInWithGoogle,
  signOut,
} from "./lib/account";

// AI 諮詢流程階段：拆解問題 → 勾選確認 → 產生建議 → 完成
type AiPhase = "decomposing" | "selecting" | "recommending" | "done";

// 病患安全資訊：產生建議前由使用者勾選/填寫，供 AI 避開禁忌與交互作用。
interface SafetyInfo {
  flags: string[];
  allergy: string;
  meds: string;
}
const SAFETY_FLAGS = ["65 歲以上", "兒童", "懷孕/哺乳", "腎功能不全", "肝功能不全"];
const EMPTY_SAFETY: SafetyInfo = { flags: [], allergy: "", meds: "" };
const formatSafety = (s: SafetyInfo): string => {
  const lines = [
    s.flags.length > 0 && `- 族群/器官功能：${s.flags.join("、")}`,
    s.allergy.trim() && `- 過敏史：${s.allergy.trim()}`,
    s.meds.trim() && `- 目前用藥：${s.meds.trim()}`,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "未提供（請在總結中提醒確認過敏史與目前用藥）";
};

interface AiHistoryItem {
  query: string;
  response: string;
  timestamp: number;
  phase?: AiPhase;
  mainProblems?: string[];
  secondaryProblems?: string[];
  selectedSecondary?: string[];
  safety?: SafetyInfo;
}

// AI 建議藥物對到的院內品項，與比對依據（見 findFormularyMatches）。
type MatchKind = "name" | "atc" | "class";
interface FormularyMatch {
  med: Medication;
  kind: MatchKind;
}

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
  // 本機藥品資料已確認與雲端一致（背景比對或同步成功後），按鈕改顯示「已更新」
  const [isDataFresh, setIsDataFresh] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isDosageFormOpen, setIsDosageFormOpen] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isAiSymptomRequested, setIsAiSymptomRequested] = useState(false);
  // 知識圖向量搜尋：症狀查詢只走圖譜（院內適應症），不需要 Groq 金鑰。
  // 刻意拿掉舊的 Groq 分類/系統比對：按生理系統撈藥太廣（頭痛 → 整個神經系統）。
  const [kgResult, setKgResult] = useState<KgResult | null>(null);
  const [isKgSearching, setIsKgSearching] = useState(false);
  const [kgError, setKgError] = useState<string | null>(null);
  const kgCacheRef = useRef<Record<string, KgResult>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavoritesManagerOpen, setIsFavoritesManagerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const tourPrevQueryRef = useRef("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  // 需要登入時跳出的提示（訪客切到 AI、點收藏、點 AI 金鑰）；null＝關閉
  const [loginPrompt, setLoginPrompt] = useState<{ title: string; body: string; dismiss: string } | null>(null);
  // Esc 關掉最上層：先訪客提醒／回報視窗，再控制中心。
  useEffect(() => {
    if (!isSettingsOpen && !isFeedbackOpen && !loginPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (loginPrompt) setLoginPrompt(null);
      else if (isFeedbackOpen) setIsFeedbackOpen(false);
      else setIsSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSettingsOpen, isFeedbackOpen, loginPrompt]);
  const [groqApiKey, setGroqApiKey] = useState(loadGroqKey);
  const [isApiKeySetupOpen, setIsApiKeySetupOpen] = useState(false);
  // 免費額度暫滿時的自動重試倒數秒數（0＝未在等待）
  const [aiWaitSeconds, setAiWaitSeconds] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== "undefined" && !STALE_EPHEMERAL) {
      const saved = localStorage.getItem("favorites");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  // 收藏資料夾（見 lib/folders.ts）；和收藏一樣存本機、登入時同步到帳號
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolders>(() => {
    if (STALE_EPHEMERAL) return EMPTY_FOLDERS;
    try {
      return normalizeFolders(JSON.parse(localStorage.getItem("favorite_folders") || "null"));
    } catch {
      return EMPTY_FOLDERS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("favorite_folders", JSON.stringify(favoriteFolders));
    } catch {}
  }, [favoriteFolders]);

  const toggleFavorite = (id: string) => {
    if (!authUser) return setLoginPrompt(LOGIN_FOR_FAVORITES);
    const removing = favorites.includes(id);
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
    // 移出收藏時一併移出資料夾，免得之後重新收藏跑回舊資料夾
    if (removing && favoriteFolders.assign[id]) {
      const { [id]: _, ...assign } = favoriteFolders.assign;
      setFavoriteFolders({ ...favoriteFolders, assign });
    }
  };

  const isFavorite = (id: string) => !!authUser && favorites.includes(id);

  // --- Google 登入：收藏與 AI 金鑰綁定帳號 ---
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [accountSync, setAccountSync] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [accountPullTick, setAccountPullTick] = useState(0);
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const groqApiKeyRef = useRef(groqApiKey);
  groqApiKeyRef.current = groqApiKey;
  // 最近一次與雲端一致的收藏（JSON）；null＝尚未完成首次拉取，此時不推送。
  const lastSyncedFavRef = useRef<string | null>(null);
  const foldersRef = useRef(favoriteFolders);
  foldersRef.current = favoriteFolders;
  const lastSyncedFoldersRef = useRef<string | null>(null);

  useEffect(() => onAuthChange(setAuthUser), []);

  // 回到前景時重新拉取，取得其他裝置的變更。
  useEffect(() => {
    const onVisible = () =>
      document.visibilityState === "visible" && setAccountPullTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const applyGroqKey = (key: string) => {
    if (key) saveGroqKey(key);
    else clearGroqKey();
    setGroqApiKey(key);
  };

  // 拉取帳號資料：
  // - 收藏：這台裝置首次同步時合併本機與雲端，之後以雲端為準。
  // - AI 金鑰：帳號有金鑰就以帳號為準；帳號沒有而本機有，則把本機金鑰存進帳號。
  const authUserId = authUser?.id;
  useEffect(() => {
    if (!authUserId) {
      lastSyncedFavRef.current = null;
      lastSyncedFoldersRef.current = null;
      setAccountSync("idle");
      return;
    }
    let cancelled = false;
    (async () => {
      setAccountSync("syncing");
      try {
        const remote = await fetchRemoteUserData(authUserId);
        const firstSync = !hasSyncedOnDevice(authUserId);
        const localFav = favoritesRef.current;
        const nextFav =
          remote === null
            ? localFav
            : !firstSync
              ? remote.favorites
              : mergeFavorites(remote.favorites, localFav);
        // 資料夾同規則；帳號還沒存過資料夾（含資料表還沒加欄位）就沿用本機的
        const remoteFolders = remote?.favoriteFolders ?? null;
        const nextFolders = !remoteFolders
          ? foldersRef.current
          : firstSync
            ? mergeFolders(remoteFolders, foldersRef.current)
            : remoteFolders;
        const nextKey = remote?.groqApiKey || groqApiKeyRef.current;

        const patch: { favorites?: string[]; groqApiKey?: string } = {};
        if (JSON.stringify(nextFav) !== JSON.stringify(remote?.favorites ?? null)) patch.favorites = nextFav;
        if (nextKey && nextKey !== remote?.groqApiKey) patch.groqApiKey = nextKey;
        if (Object.keys(patch).length > 0) await pushRemoteUserData(authUserId, patch);
        const foldersJson = JSON.stringify(nextFolders);
        if (foldersJson !== JSON.stringify(remoteFolders) && (remoteFolders || nextFolders.folders.length > 0)) {
          // 資料夾寫入失敗（例如還沒加欄位）不影響收藏同步，只留紀錄
          await pushRemoteFolders(authUserId, nextFolders).catch((e) => console.warn("Folders push failed:", e));
        }
        if (cancelled) return;

        markSyncedOnDevice(authUserId);
        lastSyncedFavRef.current = JSON.stringify(nextFav);
        lastSyncedFoldersRef.current = foldersJson;
        setFavorites(nextFav);
        setFavoriteFolders(nextFolders);
        if (nextKey !== groqApiKeyRef.current) applyGroqKey(nextKey);
        setAccountSync("synced");
      } catch (error) {
        console.error("Account sync failed:", error);
        if (!cancelled) setAccountSync("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUserId, accountPullTick]);

  // 推送收藏：登入中且收藏有變動時，0.8 秒後寫回帳號。
  useEffect(() => {
    if (!authUserId || lastSyncedFavRef.current === null) return;
    const json = JSON.stringify(favorites);
    if (json === lastSyncedFavRef.current) return;
    const timer = setTimeout(async () => {
      setAccountSync("syncing");
      try {
        await pushRemoteUserData(authUserId, { favorites });
        lastSyncedFavRef.current = json;
        setAccountSync("synced");
      } catch (error) {
        console.error("Favorites push failed:", error);
        setAccountSync("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [favorites, authUserId]);

  // 推送資料夾：與收藏分開寫，失敗只留紀錄（資料表還沒加欄位時不影響其他同步）
  useEffect(() => {
    if (!authUserId || lastSyncedFoldersRef.current === null) return;
    const json = JSON.stringify(favoriteFolders);
    if (json === lastSyncedFoldersRef.current) return;
    const timer = setTimeout(() => {
      pushRemoteFolders(authUserId, favoriteFolders)
        .then(() => (lastSyncedFoldersRef.current = json))
        .catch((error) => console.warn("Folders push failed:", error));
    }, 800);
    return () => clearTimeout(timer);
  }, [favoriteFolders, authUserId]);

  // 設定/移除 AI 金鑰：登入中則同步寫回帳號。
  const updateGroqKey = async (key: string) => {
    applyGroqKey(key);
    if (!authUserId) return;
    setAccountSync("syncing");
    try {
      await pushRemoteUserData(authUserId, { groqApiKey: key });
      setAccountSync("synced");
    } catch (error) {
      console.error("API key push failed:", error);
      setAccountSync("error");
    }
  };

  const handleGoogleSignIn = async (remember: boolean) => {
    try {
      await signInWithGoogle(remember);
    } catch (error: any) {
      setToast({ message: error?.message || "Google 登入失敗，請稍後再試", type: "error" });
    }
  };

  // 登出：收藏與 AI 金鑰綁定帳號，一併從這台裝置移除（公用電腦不留資料）。
  const handleSignOut = async (reason?: string) => {
    lastSyncedFavRef.current = null; // 先停止推送，避免清空的收藏被寫回帳號
    lastSyncedFoldersRef.current = null;
    await signOut();
    setFavorites([]);
    setFavoriteFolders(EMPTY_FOLDERS);
    setIsFavoritesManagerOpen(false);
    applyGroqKey("");
    setAiHistory([]); // 諮詢內容可能含病人資訊，登出時一併清掉
    setOnlyFavorites(false);
    setToast({ message: reason || "已登出，收藏、AI 金鑰與諮詢紀錄已從這台裝置移除", type: "info", duration: 6000 });
  };

  // 公用電腦模式：閒置 30 分鐘自動登出（補「還原分頁」可能把登入狀態帶回來的漏洞）
  useEffect(() => {
    if (!authUser || isDeviceRemembered()) return;
    const IDLE_MS = 30 * 60 * 1000;
    let timer = window.setTimeout(() => handleSignOut("閒置 30 分鐘，已自動登出"), IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => handleSignOut("閒置 30 分鐘，已自動登出"), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [authUser]);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info"; duration?: number } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, toast.duration ?? 2500);
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
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([]);
  // 諮詢紀錄存於 IndexedDB：啟動時載入（中斷的請求退回可重送的狀態），之後每次變動即儲存。
  const aiHistoryLoadedRef = useRef(false);
  useEffect(() => {
    if (STALE_EPHEMERAL) {
      // 上一位在公用電腦沒登出：不載入他的諮詢紀錄，直接清空
      aiHistoryLoadedRef.current = true;
      saveAiHistory([]);
      return;
    }
    loadAiHistory<AiHistoryItem>().then((stored) => {
      const restored = stored
        .filter((it) => it.phase !== "decomposing")
        .map((it) =>
          it.phase === "recommending" ? { ...it, phase: "selecting" as const, response: "" } : it,
        );
      // 載入完成前若已有新諮詢，新諮詢在前。
      setAiHistory((prev) => [...prev, ...restored].slice(0, 20));
      aiHistoryLoadedRef.current = true;
    });
  }, []);
  useEffect(() => {
    if (aiHistoryLoadedRef.current) saveAiHistory(aiHistory);
  }, [aiHistory]);
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

      // 收藏頁：狀態是 favorites，或從收藏頁打開的藥（fav）→ 收藏頁留著；其他狀態都關掉
      setIsFavoritesManagerOpen(!!state && (state.type === "favorites" || (state.type === "med" && !!state.fav)));

      if (!state) {
        // Initial state
        setSelectedMed(null);
        setIsAiMode(false);
      } else {
        // Navigation case
        if (state.type === "favorites") {
          setIsAiMode(false);
          setSelectedMed(null);
        } else if (state.type === "ai_with_med") {
          setIsAiMode(true);
          const med = medications.find((m) => m.id === state.medId);
          if (med) setSelectedMed(med); setMobileExpanded(true);
        } else if (state.type === "ai") {
          setIsAiMode(true);
          // If the state says it's just AI, but we came from a med selection,
          // we might want to stay in HMSS if that's what's logic dictates,
          // or just follow the state exactly.
          if (state.medId) {
            const med = medications.find((m) => m.id === state.medId);
            if (med) setSelectedMed(med); setMobileExpanded(true);
          } else {
            setSelectedMed(null);
          }
        } else if (state.type === "med") {
          setIsAiMode(false);
          const med = medications.find((m) => m.id === state.id);
          if (med) setSelectedMed(med); setMobileExpanded(true);
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
      // fav：從收藏頁打開的，按上一頁要回到收藏頁
      window.history.pushState({ type: "med", id: selectedMed.id, fav: isFavoritesManagerOpen }, "");
    } else if (isFavoritesManagerOpen) {
      if (window.history.state?.type !== "favorites") window.history.pushState({ type: "favorites" }, "");
    } else {
      // Basic HMSS mode
      window.history.replaceState({ type: "hmss" }, "");
    }
  }, [selectedMed, isAiMode, isFavoritesManagerOpen]);

  // 切到 AI 助理就離開收藏頁（收藏頁蓋在主畫面上）
  useEffect(() => {
    if (isAiMode) setIsFavoritesManagerOpen(false);
  }, [isAiMode]);

  // 收藏頁的「返回」：是剛推進的收藏頁紀錄就退一步（跟按上一頁一樣），否則直接關
  const closeFavoritesPage = () => {
    if (window.history.state?.type === "favorites") window.history.back();
    else setIsFavoritesManagerOpen(false);
  };

  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Manual close handlers
  const closeDetail = () => {
    // 從收藏頁打開的詳情：關閉＝退一步回收藏頁，免得之後按上一頁又把剛關掉的藥打開
    if (window.history.state?.type === "med" && window.history.state.fav) return window.history.back();
    setSelectedMed(null);
    setMobileExpanded(false);
  };
  const exitAiMode = () => setIsAiMode(false);

  // 引導教學：先填入範例「頭痛」讓畫面上有藥品卡片和圖譜按鈕可以介紹，結束後還原原本的搜尋
  const startTour = () => {
    setIsHelpOpen(false);
    setIsAiMode(false);
    setIsFavoritesManagerOpen(false);
    setShowFilters(false);
    setSelectedMed(null);
    tourPrevQueryRef.current = searchQuery;
    setSearchQuery("頭痛");
    setTimeout(() => setIsTourOpen(true), 600); // 等搜尋結果畫出來
  };
  const endTour = () => {
    setIsTourOpen(false);
    setSearchQuery(tourPrevQueryRef.current);
  };
  // -----------------------------------

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", isAiMode ? "ai" : "hmss");
  }, [isAiMode]);

  // 使用者自備 Groq 金鑰直連；缺金鑰或金鑰失效時開啟設定引導。
  // 免費額度暫滿（429）→ 依 Groq 建議秒數倒數後自動重試，最多 2 次；需等太久則直接告知。
  // 傳入 onText 時改用串流，每收到內容就回呼目前全文。
  const RATE_LIMIT_MAX_WAIT = 90;
  // 沒登入又沒自己的金鑰 → 用訪客額度（ai-proxy，每台裝置每小時限次）；登入了就要用自己的金鑰
  const aiKey = groqApiKey || (authUser ? "" : GUEST_KEY);
  const callGroq = useCallback(
    async (body: Record<string, any>, onText?: (full: string) => void): Promise<any> => {
      for (let attempt = 0; ; attempt++) {
        try {
          return onText
            ? await groqChatStream(aiKey, body, onText)
            : await groqChat(aiKey, body);
        } catch (error) {
          if (error instanceof GroqKeyError) setIsApiKeySetupOpen(true);
          if (!(error instanceof GroqRateLimitError)) throw error;
          const wait = error.retryAfter;
          if (wait > RATE_LIMIT_MAX_WAIT) {
            const mins = Math.ceil(wait / 60);
            throw new Error(
              mins >= 60
                ? `今日 AI 免費額度已用完，請約 ${Math.ceil(mins / 60)} 小時後再試`
                : `AI 免費額度暫時用盡，請約 ${mins} 分鐘後再試`,
            );
          }
          if (attempt >= 2) throw new Error("AI 免費額度暫時用盡，請稍後再試");
          for (let left = wait; left > 0; left--) {
            setAiWaitSeconds(left);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setAiWaitSeconds(0);
        }
      }
    },
    [aiKey],
  );

  // 進入 AI 模式但尚未設定金鑰 → 直接帶出設定引導。
  useEffect(() => {
    if (!isAiMode || groqApiKey) return;
    if (authUser) setIsApiKeySetupOpen(true);
    // 訪客：每個分頁提醒一次可以登入，不擋著用
    else if (sessionStorage.getItem("hmss_guest_ai_notice") !== "1") {
      sessionStorage.setItem("hmss_guest_ai_notice", "1");
      setLoginPrompt({
        title: "你現在是訪客",
        body: "AI 助理可以先用網站提供的額度，每小時可以產生 3 次用藥建議。登入並設定自己的免費 Groq 金鑰，就不受次數限制。",
        dismiss: "先用訪客額度",
      });
    }
  }, [isAiMode, groqApiKey, authUser]);

  // 依成分名與 ATC 碼比對院內藥庫（不使用模糊相似度，避免配到名稱相近的別種藥）。
  // 每筆結果標示比對依據：
  //   name  — 成分名確認相同（含同藥異名、鹽類/寫法差異）
  //   atc   — 僅 ATC 7 碼相同、成分名對不上（多為命名差異，須確認）
  //   class — 院內無此成分，改列同類（ATC 前 5 碼）品項，屬替代而非原建議
  // 再依給藥途徑篩劑型、排序、去重，上限 FORMULARY_MATCH_CAP 筆。
  const FORMULARY_MATCH_CAP = 8;
  const findFormularyMatches = (
    atcCode: string,
    ingredient: string,
    route: string | undefined,
    allowLiquid: boolean,
  ): FormularyMatch[] => {
    const letterOf = (m: Medication) => (m.code?.charAt(0) || "").toUpperCase();
    const nameHit = (m: Medication) =>
      ingredientMatches([m.component, m.genericName, m.chineseName, m.brandName], ingredient);

    // 1. 建立候選池：成分名與 ATC 一致者最優先，其次成分名，再其次 ATC，最後同類。
    const atc = (atcCode || "").trim().toUpperCase();
    const atcPool = atc.length >= 7 ? medications.filter((m) => atcMatches(m.atcCode, atc)) : [];
    const namePool = medications.filter(nameHit);
    const both = atcPool.filter(nameHit);
    let candidates: Medication[];
    let kind: MatchKind;
    if (both.length > 0) {
      candidates = both;
      kind = "name";
    } else if (namePool.length > 0) {
      candidates = namePool;
      kind = "name";
    } else if (atcPool.length > 0) {
      candidates = atcPool;
      kind = "atc";
    } else if (atc.length >= 5) {
      candidates = medications.filter((m) => atcMatches(m.atcCode, atc.slice(0, 5)));
      kind = "class";
    } else {
      return [];
    }
    if (candidates.length === 0) return [];

    // 非兒科 → 有非液劑替代時，剔除藥水/糖漿（液劑為唯一選擇時仍保留）。
    const demoteLiquid = (list: Medication[]): Medication[] => {
      if (allowLiquid) return list;
      const nonLiquid = list.filter((m) => !LIQUID_FORM_LETTERS.has(letterOf(m)));
      return nonLiquid.length > 0 ? nonLiquid : list;
    };

    // 去重（依藥品碼）並截斷
    const finalize = (list: Medication[]): FormularyMatch[] => {
      const seen = new Set<string>();
      const out: FormularyMatch[] = [];
      for (const m of list) {
        const key = m.code || m.id;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ med: m, kind });
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
  }, [searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    setKgResult(null);
    setKgError(null);
    if (!isAiSymptomRequested || query.length < 2 || medicationCodeSet.has(query.toUpperCase())) {
      setIsKgSearching(false);
      return;
    }
    if (kgCacheRef.current[query]) {
      setKgResult(kgCacheRef.current[query]);
      return;
    }
    let cancelled = false;
    setIsKgSearching(true);
    searchKg(query)
      .then((r) => {
        kgCacheRef.current[query] = r;
        if (!cancelled) setKgResult(r);
      })
      .catch((e) => !cancelled && setKgError(e?.message || "AI 輔助查詢失敗"))
      .finally(() => !cancelled && setIsKgSearching(false));
    return () => {
      cancelled = true;
    };
  }, [isAiSymptomRequested, searchQuery, medicationCodeSet]);

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
      setIsDataFresh(true);
    } catch (error) {
      setImportStatus("同步失敗，請檢查網路連線");
      console.error(error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const refreshIfChanged = async (stored: Medication[]) => {
    const [{ meds, hash }, oldHash] = await Promise.all([
      localMedicationService.fetchFromSupabase(),
      localMedicationService.getStoredHash(),
    ]);
    if (meds.length === 0) return;
    setIsDataFresh(true);
    if (hash === oldHash) return;
    await localMedicationService.saveAll(meds, hash);
    setMedications(meds);
    const { added, changed, removed } = diffMedications(stored, meds);
    if (added + changed + removed === 0) return; // 只是快取格式不同，內容沒變就不打擾
    const parts = [added && `新增 ${added}`, changed && `修改 ${changed}`, removed && `刪除 ${removed}`].filter(Boolean);
    setToast({ message: `藥品資料已更新：${parts.join("、")} 筆`, type: "info", duration: 6000 });
  };

  useEffect(() => {
    if (consumeJustUpdated()) {
      setToast({ message: `網站已更新到 v${__APP_VERSION__}`, type: "info", duration: 6000 });
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const stored = await localMedicationService.getAll();
        if (stored.length > 0) {
          setMedications(stored);
          // 背景抓完整清單比對內容（約 360 KB gzip）。刻意不只比筆數：改學名這類修改筆數不變也要更新。
          refreshIfChanged(stored).catch(() => {});
        } else {
          const { meds, hash } = await localMedicationService.fetchFromSupabase();
          await localMedicationService.saveAll(meds, hash);
          setMedications(meds);
          setIsDataFresh(true);
        }
      } catch (error) {
        console.error("Failed to load local database:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // 第一階段：拆解病患描述為「主要問題」與「次要問題/症狀」（輕量模型，JSON）
  const decomposeProblems = async (
    query: string,
  ): Promise<{ mainProblems: string[]; secondaryProblems: string[] }> => {
    const prompt = `你是一位專業臨床藥師。請分析以下病患描述，拆解臨床問題，並回傳純 JSON（絕不要 Markdown 標籤，也不要任何前後說明）。
規則：
- "mainProblems"：病患「主動描述」的主要問題/主訴（疾病本身或明確不適），通常 1-3 個，每項簡短（2-12 字）。
- "secondaryProblems"：描述中尚未提及、但「有或沒有」會改變最可能診斷的伴隨症狀，供勾選確認，用來協助鑑別診斷（不是用來多開藥）。優先列能區分常見病因的症狀與需要轉診的警訊（例如頭痛 → 發燒、頸部僵硬、單側搏動性、畏光）。列 3-8 項，一個症狀一項，每項簡短（2-12 字），不要與 mainProblems 重複。
- 疾病本身與各症狀必須分開。
回傳格式：{"mainProblems":["..."],"secondaryProblems":["..."]}
病患描述：「${query}」`;
    const response = await retryWithBackoff<any>(() =>
      callGroq({
        model: GROQ_MODEL_FAST,
        reasoning_effort: "low",
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

  // 第二階段：針對「已確認的問題清單」與病患安全資訊產生用藥建議（串流，NDJSON）
  const runRecommendation = async (
    timestamp: number,
    query: string,
    mainProblems: string[],
    selectedSecondary: string[],
    safety: SafetyInfo = EMPTY_SAFETY,
  ) => {
    setIsAiLoading(true);
    const setResponse = (response: string, phase: AiPhase) =>
      setAiHistory((prev) =>
        prev.map((it) => (it.timestamp === timestamp ? { ...it, response, phase } : it)),
      );
    setResponse("", "recommending");
    try {
      const safetyText = formatSafety(safety);
      const cacheKey = [
        query,
        [...mainProblems].sort().join("\x01"),
        [...selectedSecondary].sort().join("\x01"),
        safetyText,
      ].join("\x00");
      const cached = aiRecommendCache.get(cacheKey);
      if (cached) {
        setResponse(cached, "done");
        return;
      }
      const problemListText =
        mainProblems.length > 0 ? mainProblems.map((p) => `- ${p}`).join("\n") : `- ${query}`;
      // 伴隨症狀只用來判斷診斷，不自成一組開藥（使用者勾選的目的是讓診斷更準）
      const symptomListText =
        selectedSecondary.length > 0 ? selectedSecondary.map((p) => `- ${p}`).join("\n") : "（無）";

      const prompt = `你是精通臨床藥理的主治醫師。請先結合「主要問題」與「已確認的伴隨症狀」判斷最可能的診斷，再針對主要問題給出用藥建議；系統會用你給的成分學名與 ATC 碼比對院內藥庫。

# 規則
0. 伴隨症狀是鑑別診斷的線索，不是要各自開藥的問題：用它們判斷最可能的病因、調整藥物選擇、找出需轉診的警訊。不要為伴隨症狀另開一組，也不要為了涵蓋每個症狀而多列藥。
1. 只為「主要問題」各開一組，不自行新增；problem 名稱可寫成「主要問題（推測：診斷）」。每組只放該問題的藥。同一成分只列一次（reason 可註明兼治哪些問題）；若某問題已被上方用藥涵蓋，該組只給一條 advice 說明。
2. 可用藥的問題：列「首選」1–3 種、「替代」0–3 種，依臨床指引與實證排序。寧缺勿濫，不要為湊數列次要或冷門成分；優先各級醫院普遍備有的標準成分。
3. 無特定藥物可治療的問題：不列藥，改給一條臨床建議（生活調整、檢查、轉診）。
4. name 用通用英文學名，zh 附中文學名。絕不編造藥品碼。
5. atc 填 WHO ATC 7 碼；只確定前 5 碼就填 5 碼；不確定填空字串，絕不杜撰。
6. route 擇一：口服、針劑、外用、眼用、吸入、栓劑、貼片。全身性疾病只能口服或針劑，能口服優先口服；重症、無法進食或需快速起效才用針劑；局部病灶才用局部劑型。非兒科不建議口服液劑。
7. reason 為一段 30–60 字的連貫敘述，融合機轉與選擇理由（指引地位、療效、安全性），必要時點出關鍵注意事項；不要編號或小標題。
8. 依病患安全資訊避開禁忌（過敏、懷孕、腎肝功能、年齡），並檢查與目前用藥的交互作用及重複用藥，須注意處寫進 reason 或總結。資訊不足時，在總結中列出須確認的項目。

# 輸出格式（嚴格遵守）
只輸出 NDJSON：每行一個 JSON 物件，不要 Markdown、不要任何其他文字。依序：
{"type":"summary","text":"最可能的診斷與依據（引用哪些伴隨症狀）、需排除的鑑別診斷或轉診警訊、整體用藥策略，80–150 字"}
{"type":"problem","name":"問題名稱"}
{"type":"drug","name":"Amlodipine","zh":"氨氯地平","route":"口服","atc":"C08CA01","tier":"首選","reason":"……"}
{"type":"advice","text":"臨床建議（僅用於無特定藥物可治療的問題）"}
每個問題重複一次 problem 行，其後接該問題的 drug 或 advice 行。

# 主要問題
${problemListText}

# 已確認的伴隨症狀（僅供判斷診斷）
${symptomListText}

# 病患安全資訊
${safetyText}

# 病患描述
${query}`;

      // 串流：每 100ms 最多更新一次畫面，避免逐字觸發重繪。
      let latest = "";
      let lastFlush = 0;
      const fullResponse = await retryWithBackoff<string>(() =>
        callGroq(
          {
            model: GROQ_MODEL,
            reasoning_effort: "medium",
            include_reasoning: false,
            max_completion_tokens: 5000,
            messages: [{ role: "user", content: prompt }],
          },
          (full) => {
            latest = full;
            const now = Date.now();
            if (now - lastFlush > 100) {
              lastFlush = now;
              setResponse(latest, "recommending");
            }
          },
        ),
      );
      const rec = parseRecommendation(fullResponse);
      if (rec.summary.length === 0 && rec.groups.length === 0) {
        throw new Error("AI 回傳格式無法解析，請重試");
      }
      aiRecommendCache.set(cacheKey, fullResponse);
      setResponse(fullResponse, "done");
    } catch (error: any) {
      console.error("AI recommendation error:", error);
      setResponse(`⚠️ 錯誤：${error?.message || "AI 搜尋發生錯誤，請稍後再試。"}`, "done");
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
      item.safety,
    );
  };

  // 更新某筆諮詢的病患安全資訊
  const updateSafety = (timestamp: number, patch: Partial<SafetyInfo>) =>
    setAiHistory((prev) =>
      prev.map((it) =>
        it.timestamp === timestamp
          ? { ...it, safety: { ...EMPTY_SAFETY, ...it.safety, ...patch } }
          : it,
      ),
    );
  const toggleSafetyFlag = (timestamp: number, flag: string) => {
    const item = aiHistory.find((it) => it.timestamp === timestamp);
    const flags = item?.safety?.flags || [];
    updateSafety(timestamp, {
      flags: flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag],
    });
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

    // 一律進入勾選階段：確認伴隨症狀並填寫安全資訊後，才產生建議。
    const toSelecting = (mainProblems: string[], secondaryProblems: string[]) =>
      setAiHistory((prev) =>
        prev.map((it) =>
          it.timestamp === currentTimestamp
            ? { ...it, phase: "selecting", mainProblems, secondaryProblems, selectedSecondary: [] }
            : it,
        ),
      );
    try {
      const { mainProblems, secondaryProblems } = await decomposeProblems(currentQuery);
      toSelecting(mainProblems, secondaryProblems);
    } catch (error: any) {
      console.error("AI decompose error:", error);
      if (error instanceof SyntaxError) {
        // 拆解結果格式錯誤 → 略過拆解，直接以原始描述進入勾選階段。
        toSelecting([], []);
      } else {
        setAiHistory((prev) =>
          prev.map((it) =>
            it.timestamp === currentTimestamp
              ? { ...it, phase: "done", response: `⚠️ 錯誤：${error?.message || "AI 分析發生錯誤，請稍後再試。"}` }
              : it,
          ),
        );
      }
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
        .filter((f) => /^[A-Z]$/.test(f)), // 數字開頭是空白佔位代碼，不是劑型
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
    const atcPrefixes = MECHANISM_ATC[query] || MECHANISM_ATC[mechanismKey(query)] || [];

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

      // 知識圖命中：適應症（臨床用途）經 LLM 拆解＋同義詞合併＋上下位擴散後對到的藥
      const kgScoreOf = (m: Medication) => kgResult?.hits[(m.code || "").trim().toUpperCase()] || 0;
      const kgMatches = kgResult ? medications.filter((m) => kgScoreOf(m) > 0) : [];

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
      addUniqueMeds(kgMatches);
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
        } else if (kgScoreOf(m) > 0) {
          // 圖譜命中 = 院內適應症有寫到（語意比對），排在字面適應症(7000)之後、contains(5000)之前
          score += 6500;
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

        // 4. 對臨床常見/常用成分常數加分 (保障基線常用度排序)
        const isCommonComponent = GENERAL_COMMON_INGREDIENTS.some((gci) => {
          return componentLower.includes(gci) || genericLower.includes(gci);
        });
        if (isCommonComponent) {
          score += 500;
        }

        // 4.5 圖譜分數（約 0.3–1.1）：同層內語意越貼近越前面，量級與適應症字面命中(+2000)相當
        score += Math.round(kgScoreOf(m) * 2000);

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
    kgResult,
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

  // 圖譜查詢按鈕：實心、白字，比一般結果更顯眼
  const kgButtonClass =
    "w-full mb-3.5 px-4 py-3 rounded-2xl flex items-center gap-3 text-white shadow-lg shadow-brand-accent/20 bg-gradient-to-r from-brand-accent to-teal-500 hover:brightness-110 active:scale-[0.99] transition-all";

  // 控制中心的玻璃材質（半透明 + 背後模糊由外層提供）
  const glass = theme === "dark" ? "bg-white/5 border-white/10" : "bg-white/60 border-slate-200";
  const glassHover = theme === "dark" ? "hover:bg-white/10" : "hover:bg-white/80";
  const muted = theme === "dark" ? "text-zinc-400" : "text-slate-500";
  return (
    <div className="h-screen font-sans flex flex-col overflow-hidden relative">
      {/* 控制中心：全頁，一眼看到所有功能 */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            key="control-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="control-center-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className={cn(
              "fixed inset-0 z-[110] flex flex-col backdrop-blur-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
              theme === "dark" ? "bg-zinc-950/30 text-white" : "bg-white/30 text-slate-900",
            )}
          >
            <div className={cn("shrink-0 border-b", theme === "dark" ? "border-white/10" : "border-slate-200")}>
              <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                <h2 id="control-center-title" className="text-base font-bold">控制中心</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="關閉控制中心"
                  className={cn("p-2 rounded-full", theme === "dark" ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-200 text-slate-500")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-md mx-auto px-4 py-6 space-y-5">
                {/* 帳號：一條橫的 */}
                <div className="space-y-1.5">
                  {authUser ? (
                    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl border", glass)}>
                      {authUser.user_metadata?.avatar_url ? (
                        <img src={authUser.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full shrink-0" />
                      ) : (
                        <User className="w-5 h-5 shrink-0 opacity-60" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{authUser.user_metadata?.full_name || authUser.email}</p>
                        <p className={cn("flex items-center gap-1.5 text-[11px]", muted)}>
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              accountSync === "synced" && "bg-emerald-500",
                              accountSync === "syncing" && "bg-amber-500 animate-pulse",
                              accountSync === "error" && "bg-rose-500",
                              accountSync === "idle" && "bg-slate-400",
                            )}
                          />
                          {accountSync === "error" ? "同步失敗，請檢查網路" : accountSync === "syncing" ? "同步中…" : "收藏與 AI 金鑰已存到帳號"}
                        </p>
                      </div>
                      <button onClick={() => handleSignOut()} className="text-xs font-bold text-rose-500 hover:underline shrink-0">
                        登出
                      </button>
                    </div>
                  ) : (
                    <div className={cn("px-4 py-3 rounded-2xl border", glass)}>
                      <LoginChoice dark={theme === "dark"} onPick={handleGoogleSignIn} />
                    </div>
                  )}
                  <p className={cn("text-[10px] leading-relaxed px-1", muted)}>
                    {authUser
                      ? isDeviceRemembered()
                        ? "個人裝置：會一直保持登入。登出會清掉這台裝置上的收藏、AI 金鑰和諮詢紀錄，帳號裡的不受影響。"
                        : "公用電腦：關掉分頁或閒置 30 分鐘會自動登出，收藏、AI 金鑰和諮詢紀錄都不會留在這台電腦。"
                      : `Google 登入畫面會寫「繼續前往 ${new URL(import.meta.env.VITE_SUPABASE_URL).host}」，這是本站使用的登入服務，可以放心繼續。`}
                  </p>
                </div>

                {/* 收藏、AI 金鑰：兩張並排，用數字和狀態說話 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 沒登入：反灰加鎖頭，點了跳登入提示（不是點不動，免得以為壞了） */}
                  <button
                    onClick={() =>
                      authUser
                        ? (setIsFavoritesManagerOpen(true), setIsSettingsOpen(false))
                        : setLoginPrompt(LOGIN_FOR_FAVORITES)
                    }
                    className={cn("relative p-4 rounded-2xl border text-left transition-colors", glass, glassHover, !authUser && "opacity-55")}
                  >
                    {!authUser && <Lock className="absolute top-3 right-3 w-3.5 h-3.5 opacity-60" aria-hidden="true" />}
                    <SharpStar className={cn("w-4 h-4 text-amber-500", authUser && favorites.length > 0 && "fill-amber-500")} />
                    <span className="block text-2xl font-bold mt-3 leading-none">{authUser ? favorites.length : "—"}</span>
                    <span className={cn("block text-[11px] mt-1", muted)}>{authUser ? "收藏的藥品" : "收藏：登入後可以使用"}</span>
                  </button>
                  <button
                    onClick={() =>
                      authUser
                        ? (setIsApiKeySetupOpen(true), setIsSettingsOpen(false))
                        : setLoginPrompt(LOGIN_FOR_KEY)
                    }
                    className={cn("relative p-4 rounded-2xl border text-left transition-colors", glass, glassHover, !authUser && "opacity-55")}
                  >
                    {!authUser && <Lock className="absolute top-3 right-3 w-3.5 h-3.5 opacity-60" aria-hidden="true" />}
                    <KeyRound className="w-4 h-4 text-violet-500" />
                    <span className="flex items-center gap-1.5 text-sm font-bold mt-3">
                      {authUser ? (
                        <>
                          <span className={cn("w-2 h-2 rounded-full", groqApiKey ? "bg-emerald-500" : "bg-rose-500")} />
                          {groqApiKey ? "已設定" : "未設定"}
                        </>
                      ) : (
                        "訪客額度"
                      )}
                    </span>
                    <span className={cn("block text-[11px] mt-1", muted)}>{authUser ? "AI 金鑰" : "AI 金鑰：登入後可以設定"}</span>
                  </button>
                </div>

                {/* 外觀、藥品資料、安裝：一組分隔列表 */}
                <div className={cn("rounded-2xl border divide-y", glass, theme === "dark" ? "divide-white/10" : "divide-slate-200")}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm font-bold">外觀</span>
                    {/* 沿用原本的滑動式主題切換 */}
                    <div
                      className={cn(
                        "w-32 p-1 rounded-xl flex items-center gap-1 border relative transition-colors h-10",
                        theme === "dark" ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200",
                      )}
                    >
                      <motion.div
                        className={cn(
                          "absolute h-[calc(100%-8px)] rounded-lg shadow-md z-0",
                          theme === "dark" ? "bg-zinc-800 border border-white/10" : "bg-white border border-slate-200",
                        )}
                        initial={false}
                        animate={{
                          left: theme === "dark" ? "calc(50% + 1px)" : "4px",
                          width: "calc(50% - 5px)",
                        }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                      />
                      <button
                        onClick={() => setTheme("light")}
                        aria-label="淺色"
                        aria-pressed={theme === "light"}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === "light" ? "text-amber-500" : "text-zinc-500 hover:text-zinc-400",
                        )}
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        aria-label="深色"
                        aria-pressed={theme === "dark"}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === "dark" ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-400",
                        )}
                      >
                        <Moon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">藥品資料</p>
                      <p className={cn("text-[11px] truncate", muted)}>
                        {importStatus || `${medications.length} 筆，${isDataFresh ? "已是最新" : "開網站時自動更新"}`}
                      </p>
                    </div>
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className={cn(
                        "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold shrink-0 disabled:opacity-60",
                        theme === "dark" ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isDataFresh ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Database className="w-3.5 h-3.5" />
                      )}
                      {isSyncing ? "同步中" : isDataFresh ? "已更新" : "同步"}
                    </button>
                  </div>

                  {!isStandalone && (
                    <button onClick={handleInstallApp} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">安裝 App</span>
                        <span className={cn("block text-[11px]", muted)}>加到主畫面，之後直接點開</span>
                      </span>
                      <Smartphone className="w-4 h-4 text-brand-accent shrink-0" />
                    </button>
                  )}
                </div>

                {/* 說明、回報：兩顆膠囊按鈕 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsHelpOpen(true); setIsSettingsOpen(false); }}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full border text-xs font-bold transition-colors", glass, glassHover)}
                  >
                    <HelpCircle className="w-4 h-4 text-brand-accent" />
                    使用說明
                  </button>
                  <button
                    onClick={() => setIsFeedbackOpen(true)}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full border text-xs font-bold transition-colors", glass, glassHover)}
                  >
                    <MessageSquareWarning className="w-4 h-4 text-rose-500" />
                    意見回報
                  </button>
                </div>

                <p className={cn("text-center text-[10px] pt-1", muted)}>
                  HMSS v{__APP_VERSION__} · 僅供醫療專業人員參考 ·{" "}
                  <a href="./privacy.html" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-brand-accent">
                    隱私權政策
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 需要登入的提示：訪客切到 AI、點收藏、點 AI 金鑰時跳出；不擋著用，可以按「先不要」 */}
      <AnimatePresence>
        {loginPrompt && (
          <>
            <motion.div
              key="login-prompt-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLoginPrompt(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[170]"
            />
            <motion.div
              key="login-prompt-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-prompt-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
              className={cn(
                "fixed inset-x-4 top-[12%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[440px] rounded-3xl border shadow-2xl p-5 space-y-4 z-[180]",
                theme === "dark" ? "bg-zinc-900/95 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900",
              )}
            >
              <div>
                <h3 id="login-prompt-title" className="text-base font-bold">{loginPrompt.title}</h3>
                <p className={cn("text-xs leading-relaxed mt-1.5", muted)}>{loginPrompt.body}</p>
              </div>
              <LoginChoice
                dark={theme === "dark"}
                onPick={(remember) => {
                  setLoginPrompt(null);
                  handleGoogleSignIn(remember);
                }}
              />
              <button
                onClick={() => setLoginPrompt(null)}
                className={cn("w-full h-10 rounded-full border text-xs font-bold", glass, glassHover)}
              >
                {loginPrompt.dismiss}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {isTourOpen && <Tour steps={TOUR_STEPS} theme={theme} onClose={endTour} />}

      <Feedback
        open={isFeedbackOpen}
        theme={theme}
        email={authUser?.email}
        onClose={() => setIsFeedbackOpen(false)}
        onSent={() => {
          setIsFeedbackOpen(false);
          setToast({ message: "已送出，謝謝你的回報", type: "success" });
        }}
      />

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
          "h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-2xl transition-all duration-500",
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
            data-tour="menu"
            onClick={() => setIsSettingsOpen(true)}
            aria-label={authUser ? "控制中心" : "控制中心（尚未登入）"}
            className={cn(
              "relative p-2 rounded-xl border transition-all duration-300",
              theme === "dark"
                ? "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
            )}
          >
            <Menu className="w-5 h-5" />
            {/* 沒登入：右上角閃爍的點，提醒可以登入 */}
            {!authUser && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
            )}
          </button>

          <div className="flex items-center gap-6">
            {/* Segmented Tab Switcher */}
            <div
              data-tour="mode"
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

          </div>
        </div>

        <div className="flex items-center gap-3">
          {importStatus && (
            <div className="hidden lg:flex items-center gap-2 text-[9px] text-brand-accent font-bold bg-brand-accent/5 px-3 py-1.5 rounded-full border border-brand-accent/20 animate-pulse">
              <CheckCircle2 className="w-3 h-3" /> {importStatus}
            </div>
          )}

          <button
            data-tour="help"
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
          {/* 收藏頁：蓋在主畫面區上，右側詳情欄照常顯示；點藥或返回都不會離開 */}
          {isFavoritesManagerOpen && authUser && (
            <FavoritesPage
              theme={theme}
              meds={favorites.map((id) => medications.find((m) => m.id === id)).filter((m): m is Medication => !!m)}
              folders={favoriteFolders}
              selectedId={selectedMed?.id}
              onOpen={(med) => { setSelectedMed(med); setMobileExpanded(true); }}
              onRemove={toggleFavorite}
              onBack={closeFavoritesPage}
              onChangeFolders={setFavoriteFolders}
              codeStyle={getDosageColor}
            />
          )}
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
                    <form data-tour="search"
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
                        placeholder="搜尋藥名、成分、代碼或症狀"
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
                        data-tour="filter"
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
                              "absolute top-full right-0 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] backdrop-blur-3xl border rounded-2xl shadow-2xl z-[100] p-4 flex flex-col gap-4",
                              theme === "dark"
                                ? "bg-brand-sidebar/95 border-white/10 shadow-black/50"
                                : "bg-white border-slate-200 shadow-slate-200/60",
                            )}
                          >
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-bold text-brand-accent tracking-[0.2em]">
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
                                  className={cn("flex items-center justify-between p-2 pl-3 rounded-lg border transition-colors group cursor-pointer", !authUser && "opacity-55")}
                                  onClick={() =>
                                    authUser
                                      ? setOnlyFavorites(!onlyFavorites)
                                      : setLoginPrompt(LOGIN_FOR_FAVORITES)
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
                                        "text-xs font-bold",
                                        theme === "dark"
                                          ? "text-zinc-300"
                                          : "text-slate-700",
                                      )}
                                    >
                                      {authUser ? "僅顯示收藏" : "僅顯示收藏（登入後可用）"}
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
                                        "text-[11px] font-bold pl-1",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      ① 系統
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
                                          "w-full border rounded-lg pl-3 pr-2 py-2.5 text-xs flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all shadow-sm group disabled:cursor-not-allowed disabled:opacity-50",
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
                                              "absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl z-[110] max-h-60 overflow-y-auto p-1",
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
                                                  // 引導下一步：選好系統就直接展開藥理
                                                  setIsClassOpen(s !== "全部系統");
                                                }}
                                                className={cn(
                                                  "w-full text-left px-2.5 py-2 rounded-md text-xs transition-all flex items-center justify-between",
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
                                        "text-[11px] font-bold pl-1",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      ② 藥理
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
                                        // 刻意要求先選系統：藥理清單上百項，沒縮小範圍很難找
                                        disabled={selectedSystem === "全部系統"}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsClassOpen(!isClassOpen);
                                          setIsSystemOpen(false);
                                          setIsDosageFormOpen(false);
                                        }}
                                        className={cn(
                                          "w-full border rounded-lg pl-3 pr-2 py-2.5 text-xs flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all shadow-sm group disabled:cursor-not-allowed disabled:opacity-50",
                                          theme === "dark"
                                            ? "bg-white/5 border-white/10 text-zinc-200"
                                            : "bg-slate-50 border-slate-200 text-slate-700",
                                        )}
                                      >
                                        <span className="truncate font-medium">
                                          {selectedSystem === "全部系統"
                                            ? "先選系統"
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
                                              "absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl z-[110] max-h-60 overflow-y-auto p-1",
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
                                                  "w-full text-left px-2.5 py-2 rounded-md text-xs transition-all flex items-center justify-between",
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
                                        "text-[11px] font-bold",
                                        theme === "dark"
                                          ? "text-zinc-500"
                                          : "text-slate-400",
                                      )}
                                    >
                                      劑型（可多選）
                                    </label>
                                    {selectedDosageForms.length > 0 && (
                                      <button
                                        onClick={() =>
                                          setSelectedDosageForms([])
                                        }
                                        className="text-[11px] text-brand-accent font-bold hover:underline"
                                      >
                                        重設
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 p-0.5 max-h-48 overflow-y-auto custom-scrollbar">
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
                                              "px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all border flex items-center gap-1.5",
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
                  {/* 症狀查詢按鈕（由使用者點選開啟，只走知識圖譜） */}
                  {isQueryValidForAi && !isAiSymptomRequested && filteredMedications.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-3.5">
                      <AiSearchButton
                        query={searchQuery.trim()}
                        dark={theme === "dark"}
                        onClick={() => setIsAiSymptomRequested(true)}
                      />
                    </motion.div>
                  )}

                  {isAiSymptomRequested && (isKgSearching || kgResult || kgError) && (
                    <div
                      className={cn(
                        "mb-3.5 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center gap-2 text-xs",
                        theme === "dark"
                          ? "bg-brand-accent/[0.03] border-brand-accent/20 text-zinc-300"
                          : "bg-brand-accent/[0.015] border-brand-accent/15 text-slate-700",
                      )}
                    >
                      <span className="shrink-0 font-bold text-brand-accent">AI 找到的相關概念：</span>
                      {isKgSearching ? (
                        <span className="text-[11px] text-brand-accent/70 animate-pulse font-medium">搜尋中...</span>
                      ) : kgError ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-red-400 font-medium">{kgError}</span>
                          <button
                            onClick={() => { setIsAiSymptomRequested(false); setTimeout(() => setIsAiSymptomRequested(true), 0); }}
                            className="text-[10px] font-bold text-brand-accent underline underline-offset-2"
                          >重試</button>
                        </div>
                      ) : kgResult && kgResult.concepts.length > 0 ? (
                        kgResult.concepts.slice(0, 10).map((c) => (
                          <span
                            key={c.label}
                            title={c.via ? `經上下位關聯自「${c.via}」` : undefined}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/25"
                          >
                            {c.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">院內藥品適應症中未找到相關概念</span>
                      )}
                    </div>
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
                        {displayedMedications.map((med, medIndex) => {
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
                                setSelectedMed(med); setMobileExpanded(true);
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

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        data-tour={medIndex === 0 ? "fav-star" : undefined}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFavorite(med.id);
                                        }}
                                        aria-label={isFavorite(med.id) ? `把 ${med.code} 移出收藏` : `把 ${med.code} 加入收藏`}
                                        title={isFavorite(med.id) ? "移出收藏" : "加入收藏"}
                                        className="p-1.5 -m-1 rounded-lg group/fav cursor-pointer hover:bg-amber-400/15 transition-colors"
                                      >
                                        <SharpStar
                                          className={cn(
                                            "w-5 h-5 transition-colors",
                                            isFavorite(med.id)
                                              ? "fill-amber-400 text-amber-400"
                                              : theme === "dark"
                                                ? "text-amber-400/60 group-hover/fav:text-amber-400"
                                                : "text-amber-400/80 group-hover/fav:text-amber-500",
                                          )}
                                        />
                                      </button>
                                    </div>
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
                            顯示更多（還有 {filteredMedications.length - displayLimit} 筆）
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
                        找不到相符的藥
                      </h3>
                      {isQueryValidForAi && !isAiSymptomRequested ? (
                        <>
                          <p className="text-brand-muted text-sm mb-5 max-w-sm">
                            一般搜尋沒有找到。如果你打的是症狀或病名，可以試試 AI 輔助查詢。
                          </p>
                          <AiSearchButton
                            query={searchQuery.trim()}
                            dark={theme === "dark"}
                            onClick={() => setIsAiSymptomRequested(true)}
                            className="max-w-sm"
                          />
                        </>
                      ) : (
                        <p className="text-brand-muted text-sm mb-8">
                          {isKgSearching ? "AI 輔助查詢中…" : "換個說法試試，例如成分學名或商品名"}
                        </p>
                      )}
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
                        輸入藥名、成分、代碼或症狀開始查，也可以用「篩選」依系統、藥理或劑型找藥。
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
                              打字就能查
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
                            成分、商品名、中文名、縮寫（如 NS）或代碼都可以；打症狀可用「AI 輔助查詢」。
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
                              用篩選縮小範圍
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
                            按搜尋框右邊的「篩選」，依系統、藥理和劑型組合篩選。
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
                              placeholder="例如：58 歲女性，飯後血糖高"
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
                                輸入病人狀況，AI 會先整理問題、請你勾選症狀，再建議用藥
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
                                    <span className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">
                                      諮詢對話
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setAiHistory([])}
                                    className="text-xs text-red-400/50 hover:text-red-400 transition-colors uppercase tracking-widest font-bold"
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
                                            "px-4 py-2.5 rounded-2xl rounded-tl-none border text-sm md:text-base font-medium shadow-xl max-w-[85%]",
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
                                          <span className="text-xs font-black bg-gradient-to-r from-blue-400/60 via-purple-400/60 to-orange-400/60 bg-clip-text text-transparent uppercase tracking-widest">
                                            AI 建議
                                          </span>
                                          <div className="h-[1px] flex-1 min-w-[20px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10" />
                                        </div>

                                        {item.phase === "decomposing" && (
                                          <div className="flex items-center gap-2 text-sm text-brand-accent/80 px-1 py-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span className="animate-pulse font-medium">
                                              {aiWaitSeconds > 0
                                                ? `免費額度暫滿，${aiWaitSeconds} 秒後自動重試…`
                                                : "正在拆解臨床問題…"}
                                            </span>
                                          </div>
                                        )}

                                        {item.phase === "selecting" && (
                                          <div className="w-full space-y-3.5">
                                            {(item.mainProblems?.length ?? 0) > 0 && (
                                              <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-bold uppercase tracking-wider text-brand-accent">
                                                  主要問題（將自動提供建議）
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {item.mainProblems?.map((p) => (
                                                    <span
                                                      key={p}
                                                      className="px-2 py-0.5 rounded-md text-[13px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/25"
                                                    >
                                                      {p}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            <div className="flex flex-col gap-1.5">
                                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                伴隨症狀（勾選有的，協助判斷病因）
                                              </span>
                                              <div className="flex flex-col gap-1.5">
                                                {item.secondaryProblems?.map((p) => {
                                                  const checked = item.selectedSecondary?.includes(p);
                                                  return (
                                                    <button
                                                      key={p}
                                                      onClick={() => toggleSecondaryProblem(item.timestamp, p)}
                                                      className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all",
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
                                                    "flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:border-brand-accent/50",
                                                    theme === "dark"
                                                      ? "bg-white/[0.02] border-white/10 text-zinc-200 placeholder:text-zinc-500"
                                                      : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400",
                                                  )}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => addCustomSymptom(item.timestamp)}
                                                  disabled={!(customSymptomInputs[item.timestamp] || "").trim()}
                                                  className="shrink-0 px-3 py-2 rounded-lg text-sm font-bold border border-brand-accent/30 text-brand-accent hover:bg-brand-accent/10 transition-all disabled:opacity-40"
                                                >
                                                  新增
                                                </button>
                                              </div>
                                            </div>
                                            {/* 病患安全資訊（選填）：供 AI 避開禁忌與交互作用 */}
                                            <div className="flex flex-col gap-1.5">
                                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                病患安全資訊（選填，建議填寫）
                                              </span>
                                              <div className="flex flex-wrap gap-1.5">
                                                {SAFETY_FLAGS.map((flag) => {
                                                  const on = item.safety?.flags.includes(flag);
                                                  return (
                                                    <button
                                                      key={flag}
                                                      type="button"
                                                      onClick={() => toggleSafetyFlag(item.timestamp, flag)}
                                                      className={cn(
                                                        "px-2.5 py-1 rounded-lg border text-[13px] font-bold transition-all",
                                                        on
                                                          ? "bg-rose-500/10 border-rose-500/40 text-rose-500"
                                                          : theme === "dark"
                                                            ? "bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/[0.05]"
                                                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-white",
                                                      )}
                                                    >
                                                      {flag}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                              {(
                                                [
                                                  ["allergy", "過敏史（例如：Penicillin、NSAIDs）"],
                                                  ["meds", "目前用藥（例如：Warfarin、Metformin）"],
                                                ] as const
                                              ).map(([field, placeholder]) => (
                                                <input
                                                  key={field}
                                                  type="text"
                                                  value={item.safety?.[field] || ""}
                                                  onChange={(e) => updateSafety(item.timestamp, { [field]: e.target.value })}
                                                  placeholder={placeholder}
                                                  className={cn(
                                                    "w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all focus:border-brand-accent/50",
                                                    theme === "dark"
                                                      ? "bg-white/[0.02] border-white/10 text-zinc-200 placeholder:text-zinc-500"
                                                      : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400",
                                                  )}
                                                />
                                              ))}
                                            </div>
                                            <button
                                              onClick={() => handleGenerateRecommendation(item.timestamp)}
                                              disabled={isAiLoading}
                                              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 text-white shadow-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
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
                                            if (item.response.startsWith("⚠️ 錯誤：")) {
                                              return (
                                                <div className="p-3 rounded-xl border border-red-400/30 bg-red-400/5 text-sm text-red-400 leading-relaxed break-words">
                                                  {item.response}
                                                </div>
                                              );
                                            }
                                            const rec = parseRecommendation(item.response);
                                            const allowLiquid =
                                              isPediatricContext(item.query) ||
                                              !!item.safety?.flags.includes("兒童");

                                            const tierBadge = (tier: DrugRec["tier"]) => (
                                              <span
                                                className={cn(
                                                  "text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0",
                                                  tier === "首選"
                                                    ? "bg-emerald-500/15 text-emerald-600"
                                                    : "bg-slate-500/15 text-slate-500",
                                                )}
                                              >
                                                {tier}
                                              </span>
                                            );

                                            // 院內品項卡片：左半開啟藥物詳情，右半展開/收合理由，長按或右鍵複製藥品碼。
                                            const renderMedCard = (
                                              med: Medication,
                                              reason: string,
                                              tier: DrugRec["tier"],
                                              itemKey: string,
                                            ) => {
                                              const code = med.code;
                                              const name = med.component || med.brandName || med.genericName;
                                              const isExpanded = !!aiExpandedMeds[itemKey];
                                              return (
                                                <div
                                                  key={itemKey}
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
                                                    "w-full max-w-full min-w-0 flex flex-col gap-2.5 text-sm p-3.5 rounded-xl transition-all group border text-left overflow-hidden box-border select-none",
                                                    theme === "dark"
                                                      ? "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10"
                                                      : "bg-slate-50 hover:bg-white border-slate-100/50 hover:border-slate-200 shadow-sm shadow-slate-100",
                                                  )}
                                                  title="點擊左半部開啟藥物詳情，點擊右半部展開或收合理由，長按或滑鼠右鍵可複製藥品碼"
                                                >
                                                  <div className="flex items-center justify-between w-full gap-2">
                                                    <div
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedMed(med); setMobileExpanded(true);
                                                      }}
                                                      className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-transform"
                                                    >
                                                      <div
                                                        className={cn(
                                                          "font-mono font-bold shrink-0 px-2 py-0.5 rounded text-xs",
                                                          theme === "dark"
                                                            ? "bg-white/10 text-zinc-300"
                                                            : "bg-white border shadow-sm text-slate-800",
                                                          getDosageColor(code).text,
                                                        )}
                                                      >
                                                        {code}
                                                      </div>
                                                      <span
                                                        className={cn(
                                                          "font-bold truncate text-sm md:text-base",
                                                          theme === "dark" ? "text-zinc-200" : "text-slate-800",
                                                        )}
                                                      >
                                                        {name}
                                                      </span>
                                                      {tierBadge(tier)}
                                                    </div>
                                                    <div
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAiExpandedMeds((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
                                                      }}
                                                      className="flex items-center gap-1.5 shrink min-w-0 max-w-[35%] md:max-w-[60%] cursor-pointer hover:bg-zinc-500/10 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
                                                    >
                                                      {!isExpanded && reason && (
                                                        <span
                                                          className={cn(
                                                            "truncate text-right transition-colors uppercase text-xs tracking-tight",
                                                            theme === "dark"
                                                              ? "text-zinc-500 group-hover:text-zinc-400"
                                                              : "text-slate-400 group-hover:text-slate-600",
                                                          )}
                                                        >
                                                          {reason}
                                                        </span>
                                                      )}
                                                      <ChevronDown
                                                        className={cn(
                                                          "w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600 transition-transform duration-200",
                                                          isExpanded && "rotate-180",
                                                        )}
                                                      />
                                                    </div>
                                                  </div>
                                                  {reason && isExpanded && (
                                                    <div
                                                      className={cn(
                                                        "w-full text-[13px] leading-relaxed border-t pt-2.5 mt-0.5 animate-fadeIn whitespace-normal break-words",
                                                        theme === "dark"
                                                          ? "border-white/5 text-zinc-400"
                                                          : "border-slate-100 text-slate-600",
                                                      )}
                                                    >
                                                      {reason}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            };

                                            // 一個 AI 建議成分 → 院內相符品項（或「院內無此品項」）。
                                            const renderDrug = (drug: DrugRec, drugKey: string) => {
                                              const route = normalizeRoute(drug.route);
                                              const displayName = drug.zh ? `${drug.name}（${drug.zh}）` : drug.name;
                                              const matches = findFormularyMatches(drug.atc, drug.name, drug.route, allowLiquid);

                                              if (matches.length === 0) {
                                                return (
                                                  <div
                                                    key={drugKey}
                                                    className={cn(
                                                      "w-full max-w-full min-w-0 flex flex-col gap-1 text-sm p-3 rounded-xl border border-dashed overflow-hidden box-border",
                                                      theme === "dark"
                                                        ? "bg-white/[0.01] border-white/10 text-zinc-400"
                                                        : "bg-slate-50/50 border-slate-200 text-slate-500",
                                                    )}
                                                  >
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-bold text-sm md:text-base break-words">{displayName}</span>
                                                      {tierBadge(drug.tier)}
                                                      {route && (
                                                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-500/15 shrink-0">
                                                          {route}
                                                        </span>
                                                      )}
                                                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                                                        院內無此品項
                                                      </span>
                                                    </div>
                                                    {drug.reason && (
                                                      <span className="text-[13px] leading-relaxed break-words opacity-80">
                                                        {drug.reason}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              }

                                              // 非成分名確認的比對：標示依據並顯示 AI 原建議，避免誤認為 AI 直接推薦。
                                              const kind = matches[0].kind;
                                              const classAtc = drug.atc.slice(0, 5);
                                              const reason =
                                                kind === "class"
                                                  ? `院內無 ${drug.name}，此為同類（ATC ${classAtc}）品項，請確認是否適用。原建議（${drug.name}）的理由：${drug.reason}`
                                                  : drug.reason;
                                              return (
                                                <div key={drugKey} className="flex flex-col gap-1.5 w-full min-w-0">
                                                  {kind !== "name" && (
                                                    <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs">
                                                      <span className="font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                                                        {kind === "class" ? "同類替代" : "依 ATC 比對・成分名待確認"}
                                                      </span>
                                                      <span className="opacity-70 break-words">AI 建議：{displayName}</span>
                                                    </div>
                                                  )}
                                                  {matches.map(({ med }) =>
                                                    renderMedCard(med, reason, drug.tier, `${drugKey}-${med.code}`),
                                                  )}
                                                </div>
                                              );
                                            };

                                            const groupsSection = rec.groups.map((group, gIdx) => {
                                              const limitKey = `${item.timestamp}-${gIdx}`;
                                              const limit = aiVisibleLimits[limitKey] || 3;
                                              const visibleDrugs = group.drugs.slice(0, limit);
                                              const hiddenCount = group.drugs.length - visibleDrugs.length;
                                              return (
                                                <div
                                                  key={`group-${limitKey}`}
                                                  className="space-y-3 w-full max-w-full min-w-0 overflow-hidden"
                                                >
                                                  <div className="flex items-center gap-2.5 px-1 w-full max-w-full min-w-0 overflow-hidden">
                                                    <div className="w-[3px] h-3 bg-gradient-to-b from-blue-500 via-purple-500 to-orange-500 rounded-full rotate-[15deg] shadow-lg shadow-purple-500/20 shrink-0" />
                                                    <span className="text-[13px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-[0.2em] truncate flex-1 min-w-0">
                                                      {group.problem}
                                                    </span>
                                                  </div>
                                                  <div className="grid gap-2 w-full max-w-full min-w-0 overflow-hidden box-border">
                                                    {group.advice.map((text, aIdx) => (
                                                      <div
                                                        key={`advice-${aIdx}`}
                                                        className={cn(
                                                          "w-full max-w-full min-w-0 flex items-start gap-2 text-sm p-3 rounded-xl border overflow-hidden box-border break-words",
                                                          theme === "dark"
                                                            ? "bg-blue-500/[0.04] border-blue-400/20 text-zinc-300"
                                                            : "bg-blue-50 border-blue-200 text-slate-600",
                                                        )}
                                                      >
                                                        <span className="text-blue-500 shrink-0 font-bold">※</span>
                                                        <span className="leading-relaxed">{text}</span>
                                                      </div>
                                                    ))}
                                                    {visibleDrugs.map((drug, dIdx) => renderDrug(drug, `${limitKey}-${dIdx}`))}
                                                  </div>
                                                  {hiddenCount > 0 && (
                                                    <button
                                                      onClick={() =>
                                                        setAiVisibleLimits((prev) => ({ ...prev, [limitKey]: limit + 5 }))
                                                      }
                                                      className="w-full mt-2 py-3 text-xs font-black text-brand-accent hover:text-white bg-brand-accent/10 hover:bg-brand-accent/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl border border-brand-accent/20 shadow-lg shadow-brand-accent/5 backdrop-blur-sm"
                                                    >
                                                      查看更多建議 ({hiddenCount} 筆)
                                                      <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              );
                                            });

                                            return (
                                              <div className="space-y-6">
                                                {rec.summary.length > 0 && (
                                                  <div
                                                    className={cn(
                                                      "p-4 rounded-xl border shadow-sm leading-relaxed font-normal text-justify space-y-2",
                                                      theme === "dark"
                                                        ? "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-orange-500/5 border-white/5 text-zinc-300"
                                                        : "bg-gradient-to-br from-blue-500/[0.04] via-purple-500/[0.04] to-orange-500/[0.02] border-slate-100 text-slate-700",
                                                    )}
                                                  >
                                                    {rec.summary.map((text, sIdx) => (
                                                      <p key={sIdx} className="text-sm md:text-base leading-relaxed whitespace-pre-line">
                                                        {text}
                                                      </p>
                                                    ))}
                                                    <p className="text-xs leading-relaxed text-amber-600/90 pt-1">
                                                      ⚠️ AI 建議僅供醫療專業人員參考，處方前請依臨床判斷、仿單及院內規範確認。
                                                    </p>
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
                                          {hIdx === 0 && isAiLoading && aiWaitSeconds > 0 && (
                                            <p className="text-[11px] font-bold text-amber-500 px-1">
                                              免費額度暫滿，{aiWaitSeconds} 秒後自動重試…
                                            </p>
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
                    : "rounded-full mb-[calc(1.25rem+env(safe-area-inset-bottom))]",
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


      <ApiKeySetup
        open={isApiKeySetupOpen}
        theme={theme}
        currentKey={groqApiKey}
        onClose={() => setIsApiKeySetupOpen(false)}
        signedIn={!!authUser}
        onSave={updateGroqKey}
        onClear={() => updateGroqKey("")}
      />

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
                      使用說明
                    </h3>
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      theme === "dark" ? "text-zinc-500" : "text-slate-400",
                    )}>
                      查藥、用症狀找藥、AI 助理、收藏與登入
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
                <button onClick={startTour} className={cn(kgButtonClass, "mb-1")}>
                  <Sparkles className="w-5 h-5 shrink-0" />
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-bold">開始引導教學</span>
                    <span className="block text-[11px] opacity-90">一步一步帶你看畫面上每個功能在哪裡，約 1 分鐘</span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0" />
                </button>
                {HELP_SECTIONS.map(({ title, lines }) => (
                  <div key={title} className="space-y-1">
                    <h4 className="font-bold text-brand-accent">{title}</h4>
                    {lines.map((line) => (
                      <p key={line} className="opacity-80 leading-relaxed text-[11px]">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
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
            className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md text-xs font-medium border select-none"
            style={{
              backgroundColor: theme === "dark" ? "rgba(24, 24, 27, 0.9)" : "rgba(255, 255, 255, 0.9)",
              borderColor: theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
              color: theme === "dark" ? "#f4f4f5" : "#18181b",
            }}
          >
            <div className="flex items-center gap-2">
              {toast.type === "error" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
