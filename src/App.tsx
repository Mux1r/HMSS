/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useDeferredValue, FormEvent } from 'react';
import Fuse from 'fuse.js';
import { GoogleGenAI } from "@google/genai";
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
  Download
} from 'lucide-react';

const getMedicationIcon = (code: string) => {
  const firstChar = code?.charAt(0)?.toUpperCase();
  switch (firstChar) {
    case 'E': return Sparkles;
    case 'T': return Pill;
    case 'I': return Syringe;
    case 'L': return Droplets;
    case 'O': return Eye;
    case 'S': return Wind;
    case 'Z': return FlaskConical;
    case 'V': return CircleDot;
    default: return Pill;
  }
};

const getDosageColor = (code: string) => {
  const firstChar = code?.charAt(0)?.toUpperCase();
  const base = "border-l";
  switch (firstChar) {
    case 'E': return { border: `${base} border-l-blue-500`, glow: "bg-blue-500", text: "text-blue-500", accent: "text-blue-400", bg: "bg-blue-500/10", borderMain: "border-blue-500/20", icon: Container }; // 外用
    case 'T': return { border: `${base} border-l-orange-500`, glow: "bg-orange-500", text: "text-orange-500", accent: "text-orange-400", bg: "bg-orange-500/10", borderMain: "border-orange-500/20", icon: Pill }; // 錠劑
    case 'I': return { border: `${base} border-l-red-500`, glow: "bg-red-500", text: "text-red-500", accent: "text-red-400", bg: "bg-red-500/10", borderMain: "border-red-500/20", icon: Syringe }; // 針劑
    case 'L': return { border: `${base} border-l-teal-500`, glow: "bg-teal-500", text: "text-teal-500", accent: "text-teal-400", bg: "bg-teal-500/10", borderMain: "border-teal-500/20", icon: FlaskConical }; // 藥水
    case 'O': return { border: `${base} border-l-emerald-500`, glow: "bg-emerald-500", text: "text-emerald-500", accent: "text-emerald-400", bg: "bg-emerald-500/10", borderMain: "border-emerald-500/20", icon: Eye }; // 眼用
    case 'S': return { border: `${base} border-l-amber-500`, glow: "bg-amber-500", text: "text-amber-500", accent: "text-amber-400", bg: "bg-amber-500/10", borderMain: "border-amber-500/20", icon: Wind }; // 噴劑
    case 'Z': return { border: `${base} border-l-zinc-500`, glow: "bg-zinc-500", text: "text-zinc-500", accent: "text-zinc-400", bg: "bg-zinc-500/10", borderMain: "border-zinc-500/20", icon: Beaker }; // 試驗
    case 'V': return { border: `${base} border-l-violet-500`, glow: "bg-violet-500", text: "text-violet-500", accent: "text-violet-400", bg: "bg-violet-500/10", borderMain: "border-violet-500/20", icon: ArrowDownToDot }; // 塞劑
    default: return { border: `${base} border-l-brand-accent`, glow: "bg-brand-accent", text: "text-brand-accent", accent: "text-brand-accent/80", bg: "bg-brand-accent/10", borderMain: "border-brand-accent/20", icon: Pill };
  }
};

const DOSAGE_FORM_MAP: Record<string, string> = {
  'T': '錠劑',
  'B': '膠囊',
  'C': '顆粒',
  'D': '粉末',
  'E': '外用藥',
  'F': '膜衣錠',
  'G': '腸溶錠',
  'H': '軟膠囊',
  'I': '針劑',
  'K': '膏劑/乳膏',
  'L': '內服液/藥水',
  'O': '眼用藥',
  'P': '貼片',
  'R': '栓劑',
  'S': '噴劑/吸入',
  'V': '塞劑',
  'W': '洗劑',
  'Y': '糖漿',
  'Z': '其他/試驗',
  'A': '錠劑'
};

const getDosageName = (code: string) => {
  const char = code?.charAt(0)?.toUpperCase();
  return char && DOSAGE_FORM_MAP[char] ? `${char} - ${DOSAGE_FORM_MAP[char]}` : char || '?';
};

import { motion, AnimatePresence } from 'motion/react';
import { localMedicationService, Medication } from './services/medicationService';
import { cn } from './lib/utils';
import { MEDICAL_ALIASES } from './lib/medicalKeywords';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [displayLimit, setDisplayLimit] = useState(100);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedSystem, setSelectedSystem] = useState('全部系統');
  const [selectedClass, setSelectedClass] = useState('全部藥理');
  const [selectedDosageForm, setSelectedDosageForm] = useState('全部劑型');
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [gsheetUrl, setGsheetUrl] = useState('https://script.google.com/macros/s/AKfycbxotfbc6-KsIn-_RoltpZl_vQhjUNDN-UrU9pWIARSCnWUCn_9iZ60J46zwr3b6laKBBw/exec');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isDosageFormOpen, setIsDosageFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  }, []);

  const buildVersion = useMemo(() => {
    try {
      // @ts-ignore
      const time = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
      const date = new Date(time);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}${mm}${dd}.${hh}${min}`;
    } catch (e) {
      return "20240101.0000";
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // If prompt is not available but user clicked, show a guide or toast
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("iOS 裝置請點擊瀏覽器下方的『分享』圖示，並選擇『加入主畫面』。");
      } else {
        alert("Chrome 瀏覽器請點擊右上角『⋮』選單，選擇『安裝應用程式』或『加入主畫面』。");
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // AI Mode States
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{query: string, response: string, timestamp: number}[]>([]);
  const [aiVisibleLimits, setAiVisibleLimits] = useState<Record<string, number>>({});
  const [isAiSemanticEnabled, setIsAiSemanticEnabled] = useState(false);
  const [aiRecommendedCodes, setAiRecommendedCodes] = useState<string[]>([]);
  const [isAiSemanticLoading, setIsAiSemanticLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
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
        if (state.type === 'ai_with_med') {
          setIsAiMode(true);
          const med = medications.find(m => m.id === state.medId);
          if (med) setSelectedMed(med);
        } else if (state.type === 'ai') {
          setIsAiMode(true);
          // If the state says it's just AI, but we came from a med selection, 
          // we might want to stay in HMSS if that's what's logic dictates, 
          // or just follow the state exactly.
          if (state.medId) {
             const med = medications.find(m => m.id === state.medId);
             if (med) setSelectedMed(med);
          } else {
            setSelectedMed(null);
          }
        } else if (state.type === 'med') {
          setIsAiMode(false);
          const med = medications.find(m => m.id === state.id);
          if (med) setSelectedMed(med);
        } else if (state.type === 'hmss') {
          setIsAiMode(false);
          setSelectedMed(null);
        }
      }
      
      setTimeout(() => { isNavigatingRef.current = false; }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [medications, selectedMed, isAiMode]);

  // Sync state changes to browser history with detailed state
  useEffect(() => {
    if (isNavigatingRef.current) return;

    const state: any = { isAi: isAiMode };
    if (selectedMed) state.medId = selectedMed.id;

    if (isAiMode && selectedMed) {
      window.history.pushState({ type: 'ai_with_med', medId: selectedMed.id }, '');
    } else if (isAiMode) {
      window.history.pushState({ type: 'ai' }, '');
    } else if (selectedMed) {
      window.history.pushState({ type: 'med', id: selectedMed.id }, '');
    } else {
      // Basic HMSS mode
      window.history.replaceState({ type: 'hmss' }, '');
    }
  }, [selectedMed, isAiMode]);

  // Manual close handlers
  const closeDetail = () => setSelectedMed(null);
  const exitAiMode = () => setIsAiMode(false);
  // -----------------------------------

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }), []);

  // Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(medications, {
      keys: [
        { name: 'code', weight: 1.0 },
        { name: 'component', weight: 0.9 },
        { name: 'brandName', weight: 0.8 },
        { name: 'genericName', weight: 0.7 },
        { name: 'chineseName', weight: 0.6 },
        { name: 'indications', weight: 0.4 },
        { name: 'searchKeywords', weight: 0.4 }
      ],
      threshold: 0.4, // 調整基礎靈敏度，由邏輯層決定動態門檻
      location: 0,    // 優先考慮字串開頭的匹配
      distance: 50,   // 縮小範圍，讓遠離位點 0 的匹配扣分更高
      includeScore: true,
      shouldSort: true
    });
  }, [medications]);

  // Remove global click listener in favor of local onBlur for better focus management
  useEffect(() => {
    // We can keep a simplified version or rely solely on onBlur
    // But standard "outside click" is usually better for mouse users who click non-focusable areas
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click is not inside a dropdown or filter area, close them
      if (!target.closest('.dropdown-container') && !target.closest('.filter-popover-container')) {
        setIsSystemOpen(false);
        setIsClassOpen(false);
        setIsDosageFormOpen(false);
        setShowFilters(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    setImportStatus('正在連線至雲端資料庫...');
    
    try {
      const { meds, hash } = await localMedicationService.fetchFromGoogleSheet(gsheetUrl);
      setImportStatus(`正在存儲 ${meds.length} 筆資料至本地庫...`);
      
      // 直接覆蓋現有清單，並儲存原始資料的雜湊以供未來比對
      await localMedicationService.saveAll(meds, hash);
      setMedications(meds);
      
      setImportStatus(`同步成功！已更新 ${meds.length} 筆資料`);
      setIsUpdateAvailable(false);
    } catch (error) {
      setImportStatus('同步失敗，請檢查網路連線或資料格式');
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
      const data = await localMedicationService.getAll();
      setMedications(data);
      setLoading(false);

      // 如果資料庫是空的，自動進行首次同步
      if (data.length === 0) {
        handleSyncGoogleSheet();
      } else {
        // 否則只檢查更新
        const checkUpdates = async () => {
          try {
            const hasUpdate = await localMedicationService.checkForUpdates(gsheetUrl);
            if (hasUpdate) {
              setIsUpdateAvailable(true);
            }
          } catch (e) {
            console.warn('Update check failed:', e);
          }
        };
        setTimeout(checkUpdates, 2000);
      }
    };

    initData();
  }, []);

  const handleAiSemanticSearch = async (query: string) => {
    if (!query.trim() || isAiSemanticLoading) return;
    setIsAiSemanticLoading(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API Key missing");
      }
      // Use a lean version of the data for faster AI processing
      const medListSummary = medications.map(m => ({
        c: m.code,
        n: `${m.component} ${m.brandName}`,
        i: m.indications
      }));

      const prompt = `你是一個專業臨床藥學助理。
任務：將使用者的關鍵詞轉換為相關的藥品。
當前關鍵詞：「${query}」。
注意：
1. 包含常見臨床對應（例如："normal" 對應 "Normal Saline", "NaCl"；"water" 對應 "Distilled Water"；"sugar" 對應 "Dextrose"）。
2. 分析適應症相關性。

目標：從下方清單中找出相關藥品代碼。
僅輸出 JSON 陣列（代碼），不要多言。
格式：["CODE1", "CODE2"]

清單：
${JSON.stringify(medListSummary)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const rawText = response.text || "[]";
      const jsonMatch = rawText.match(/\[.*\]/s);
      if (jsonMatch) {
        try {
          const codes = JSON.parse(jsonMatch[0].trim());
          if (Array.isArray(codes)) {
            // Mapping back from 'c' to actual code if necessary, 
            // but since we used 'c' as the property name in prompt, JSON should match
            setAiRecommendedCodes(codes);
          }
        } catch (e) {
          console.error("Failed to parse AI response as JSON:", e);
          setAiRecommendedCodes([]);
        }
      } else {
        setAiRecommendedCodes([]);
      }
    } catch (error) {
      console.error("AI Semantic Search Error:", error);
      setAiRecommendedCodes([]);
    } finally {
      setIsAiSemanticLoading(false);
    }
  };

  useEffect(() => {
    if (isAiSemanticEnabled && deferredSearchQuery.trim().length >= 2) {
      handleAiSemanticSearch(deferredSearchQuery);
    } else {
      setAiRecommendedCodes([]);
    }
  }, [deferredSearchQuery, isAiSemanticEnabled]);

  const handleAiSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiResponse(null);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("偵測不到 GEMINI_API_KEY。若您在使用 GitHub Pages，請在專案中設定環境變數。");
      }
      
      // Send the full list of medications to AI for comprehensive analysis
      const medListSummary = medications.map(m => ({
        code: m.code,
        component: m.component,
        genericName: m.genericName,
        brandName: m.brandName,
        indications: m.indications
      }));

      const currentQuery = aiQuery;
      const prompt = `你是一個專業的醫藥助理。請根據以下提供的藥物清單，分析並拆解使用者的描述中包含的所有健康問題 (Problems)。
針對每個識別出的問題，請從清單中提供 5-10 個適合的藥物建議。

使用者問題：${currentQuery}

藥物清單（部分）：
${JSON.stringify(medListSummary)}

輸出格式請嚴格遵守：
問題：[問題名稱]
藥品碼 藥物名稱 藥物功能
藥品碼 藥物名稱 藥物功能
...

(每個問題下儘量提供 5-10 個藥物，每行一個藥物，不需要其他解釋)
例如：
問題：頭痛
T123 阿斯匹靈 解熱鎮痛
T456 普拿疼 緩解疼痛
...

問題：發燒
...
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const resultText = response.text || "未能找到合適的藥物建議。";
      setAiResponse(resultText);
      setAiHistory(prev => [{ query: currentQuery, response: resultText, timestamp: Date.now() }, ...prev]);
      setAiQuery('');
    } catch (error) {
      console.error("AI Search Error:", error);
      setAiResponse("AI 搜尋發生錯誤，請稍後再試。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const anatomicalSystems = useMemo(() => {
    const systems = new Set(medications.map(m => m.anatomicalSystem));
    return ['全部系統', ...Array.from(systems).sort()];
  }, [medications]);

  const pharmacologicalClasses = useMemo(() => {
    // 根據選取的系統過濾藥理分類
    const filteredMeds = selectedSystem === '全部系統' 
      ? medications 
      : medications.filter(m => m.anatomicalSystem === selectedSystem);
    
    const classes = new Set(filteredMeds.map(m => m.pharmacologicalClass));
    return ['全部藥理', ...Array.from(classes).sort()];
  }, [medications, selectedSystem]);

  const dosageForms = useMemo(() => {
    const forms = new Set(medications.map(m => m.dosageForm || (m.code?.charAt(0)?.toUpperCase() || '?')).filter(f => f && f !== '?'));
    return ['全部劑型', ...Array.from(forms).sort()];
  }, [medications]);

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(100);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [deferredSearchQuery, selectedSystem, selectedClass, selectedDosageForm]);

  const filteredMedications = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();
    const synonyms = MEDICAL_ALIASES[query] || [];
    
    let baseMeds = medications;
    
    if (query) {
      const minPrefixLength = 3;
      const queryLen = query.length;

      // 1. 完全或縮寫匹配 (最優先)
      const exactMatches = medications.filter(m => {
        const mCode = m.code?.toLowerCase();
        const mComp = m.component?.toLowerCase();
        const mBrand = m.brandName?.toLowerCase();
        
        // 直接完全匹配
        const isExact = mCode === query || mComp === query || mBrand === query;
        if (isExact) return true;

        // 縮寫/別名匹配 (例如打 NS 找到 Normal Saline)
        if (synonyms.length > 0) {
          const searchable = `${mCode} ${mComp} ${mBrand} ${m.genericName?.toLowerCase()} ${m.chineseName?.toLowerCase()} ${m.pharmacologicalClass?.toLowerCase()}`;
          return synonyms.some(s => searchable.includes(s.toLowerCase()));
        }
        return false;
      });

      // 1.1 醫學屬性匹配 (機轉、分類等)
      const medicalIntentMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
        
        const pharmacological = m.pharmacologicalClass?.toLowerCase() || "";
        const system = m.anatomicalSystem?.toLowerCase() || "";
        const indications = m.indications?.toLowerCase() || "";
        
        // 如果查詢命中分類或機轉關鍵字
        if (pharmacological.includes(query) || system.includes(query)) return true;
        
        // 別名命中機轉 (例如 ACEI 命中藥理分類中含有相關字眼的藥物)
        if (synonyms.length > 0) {
          return synonyms.some(s => 
            pharmacological.includes(s.toLowerCase()) || 
            system.includes(s.toLowerCase()) ||
            indications.includes(s.toLowerCase())
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

      // 第二層： 字串絕對開頭匹配 (String Start)
      const stringStartMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
        if (medicalIntentMatches.some(mm => mm.id === m.id)) return false;
        const targets = [m.code, m.component, m.brandName, m.genericName];
        return targets.some(t => t?.toLowerCase().startsWith(query));
      });

      // 第三層： 第一個「字母」單字開頭匹配 (例如解決 "10% Dextrose" 的 "Dextrose" 開頭)
      const firstAlphaStartMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
        if (medicalIntentMatches.some(mm => mm.id === m.id)) return false;
        if (stringStartMatches.some(sm => sm.id === m.id)) return false;
        const targets = [m.component, m.brandName, m.genericName];
        return targets.some(t => {
          if (!t) return false;
          const alphaT = getAlphaStart(t);
          return alphaT.startsWith(query);
        });
      });

      // 第四層： 其他單字開頭 (Word Boundary Match) - 滿足「每個單字開頭權重都調高」
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}`, 'i');
      const wordBoundaryMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
        if (medicalIntentMatches.some(mm => mm.id === m.id)) return false;
        if (stringStartMatches.some(sm => sm.id === m.id)) return false;
        if (firstAlphaStartMatches.some(am => am.id === m.id)) return false;
        
        const searchPool = `${m.component} ${m.brandName} ${m.genericName} ${m.chineseName} ${m.searchKeywords || ''}`;
        return wordBoundaryRegex.test(searchPool);
      });

      // 第五層： 全域模糊搜尋 (Global Fuzzy Match) - 僅在符合特定條件時顯示
      const fuzzyResults = fuse.search(query);
      
      // 過濾與限制模糊搜尋結果
      const constrainedFuzzy = fuzzyResults
        .filter(result => {
          const item = result.item;
          if (exactMatches.some(em => em.id === item.id)) return false;
          if (medicalIntentMatches.some(mm => mm.id === item.id)) return false;
          if (stringStartMatches.some(sm => sm.id === item.id)) return false;
          if (firstAlphaStartMatches.some(am => am.id === item.id)) return false;
          if (wordBoundaryMatches.some(wm => wm.id === item.id)) return false;

          // 核心限制：避免短關鍵字（如 3 碼以下）匹配到單字中間
          if (queryLen < minPrefixLength) return false;

          // 動態閾值調整：短關鍵字需更精準，長關鍵字容許較多模糊
          let dynamicThreshold = 0.4;
          if (queryLen === 3) dynamicThreshold = 0.18;
          else if (queryLen === 4) dynamicThreshold = 0.25;
          else if (queryLen <= 6) dynamicThreshold = 0.32;

          if (result.score === undefined || result.score > dynamicThreshold) return false;

          // 避免長度差異過大造成的誤判
          const primaryName = item.component || item.brandName || "";
          if (result.score > 0.2 && primaryName.length > queryLen + 10) {
            return false;
          }

          return true;
        })
        .map(r => r.item);

      // AI 語意推薦 (獨立權重，通常排在精準匹配之後)
      let aiMeds: typeof medications = [];
      if (isAiSemanticEnabled && aiRecommendedCodes.length > 0) {
        aiMeds = medications.filter(m => aiRecommendedCodes.includes(m.code));
      }

      // 整合與去重，保持嚴格優先順序
      const combinedMeds: typeof medications = [
        ...exactMatches, 
        ...medicalIntentMatches,
        ...stringStartMatches, 
        ...firstAlphaStartMatches,
        ...wordBoundaryMatches
      ];
      
      // 合併 AI 推薦 (去重)
      aiMeds.forEach(am => {
        if (!combinedMeds.some(m => m.id === am.id)) {
          combinedMeds.push(am);
        }
      });

      // 合併模糊匹配結果 (去重)
      constrainedFuzzy.forEach(fm => {
        if (!combinedMeds.some(m => m.id === fm.id)) {
          combinedMeds.push(fm);
        }
      });

      baseMeds = combinedMeds;
    }
    
    return baseMeds.filter(med => {
      const matchesSystem = 
        selectedSystem === '全部系統' || med.anatomicalSystem === selectedSystem;

      const matchesClass = 
        selectedClass === '全部藥理' || med.pharmacologicalClass === selectedClass;

      const matchesDosageForm = 
        selectedDosageForm === '全部劑型' || 
        (med.dosageForm || med.code?.charAt(0)?.toUpperCase() || '?') === selectedDosageForm;

      return matchesSystem && matchesClass && matchesDosageForm;
    });
  }, [medications, deferredSearchQuery, selectedSystem, selectedClass, selectedDosageForm]);

  const displayedMedications = useMemo(() => {
    return filteredMedications.slice(0, displayLimit);
  }, [filteredMedications, displayLimit]);

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-500",
        theme === 'dark' 
          ? "bg-gradient-to-br from-[#1F2232] via-[#0D0E16] to-[#030305]" 
          : "bg-gradient-to-br from-slate-50 via-slate-100 to-white"
      )}>
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
              initial={{ x: '-105%' }}
              animate={{ x: 0 }}
              exit={{ x: '-105%' }}
              transition={{ 
                type: 'spring', 
                damping: 32, 
                stiffness: 280,
                mass: 0.8,
                restDelta: 0.001
              }}
              className={cn(
                "fixed inset-y-0 left-0 w-40 z-[110] shadow-2xl flex flex-col",
                theme === 'dark' 
                  ? "bg-zinc-950/30 border-r border-white/10 text-white backdrop-blur-md" 
                  : "bg-white/30 border-r border-slate-200 text-slate-900 backdrop-blur-md"
              )}
            >
              {/* Header: Identity */}
              <div className="p-4 pt-10 pb-6 border-b border-inherit">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">控制中心</h2>
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.2em] opacity-60 mt-1", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>Preferences</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
                {/* Section: Mode/Theme - Segmented Switcher */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className={cn(
                      "p-1 rounded-xl flex items-center gap-1 border relative transition-colors h-10",
                      theme === 'dark' ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
                    )}>
                      <motion.div
                        className={cn(
                          "absolute h-[calc(100%-8px)] rounded-lg shadow-md z-0",
                          theme === 'dark' ? "bg-zinc-800 border border-white/10" : "bg-white border border-slate-200"
                        )}
                        initial={false}
                        animate={{
                          left: theme === 'dark' ? "calc(50% + 1px)" : "4px",
                          width: "calc(50% - 5px)"
                        }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                      />
                      
                      <button
                        onClick={() => setTheme('light')}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === 'light' ? "text-amber-500" : "text-zinc-500 hover:text-zinc-400"
                        )}
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "relative z-10 flex-1 h-full rounded-lg transition-all duration-300 flex items-center justify-center",
                          theme === 'dark' ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-400"
                        )}
                      >
                        <Moon className="w-4 h-4" />
                      </button>
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-center opacity-60", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>
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
                        theme === 'dark' 
                          ? "bg-white/5 hover:bg-brand-accent/20 border border-white/5 text-zinc-400 hover:text-brand-accent" 
                          : "bg-slate-50 hover:bg-brand-accent/10 border border-slate-100 text-slate-400 hover:text-brand-accent shadow-sm"
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
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.1em] block", 
                      isSyncing ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {isSyncing ? "Syncing..." : "Connected"}
                    </span>
                    <span className={cn("text-[8px] font-medium opacity-60 block", theme === 'dark' ? "text-zinc-500" : "text-slate-600")}>
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
                        theme === 'dark' ? "bg-brand-accent/20 border border-brand-accent/30" : "bg-brand-accent/10 border border-brand-accent/20 shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center bg-brand-accent text-white shadow-lg shadow-brand-accent/20 group-hover:rotate-12 transition-transform",
                      )}>
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-brand-accent block">
                          安裝應用程式
                        </span>
                        <span className={cn("text-[8px] font-medium opacity-60 block", theme === 'dark' ? "text-zinc-500" : "text-slate-600")}>
                          {deferredPrompt ? "Install Web App" : "Add to Home Screen (Guide)"}
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Build Info */}
                <div className="pt-6 border-t border-inherit space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      theme === 'dark' ? "bg-white/5" : "bg-slate-50 border border-slate-100"
                    )}>
                      <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <div className="text-center space-y-1">
                      <span className={cn("text-[10px] font-bold block", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>
                        Build Ver.
                      </span>
                      <span className={cn("text-[9px] font-mono px-2 py-0.5 rounded border border-inherit leading-none block", 
                        theme === 'dark' ? "bg-zinc-800 text-zinc-300 border-white/10" : "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {buildVersion}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={cn("p-6 border-t border-inherit", theme === 'dark' ? "bg-black/20" : "bg-slate-50/50")}>
                 <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 opacity-20">
                       <span className="text-[9px] font-black tracking-[0.4em] uppercase">HMSS</span>
                    </div>
                    <p className={cn("text-[8px] text-center leading-tight opacity-50 font-medium", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>
                      Professional Ref Only.
                    </p>
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Enhanced Background Glows for Glass Visibility */}
      <div className={cn(
        "absolute top-[-5%] right-[-5%] w-[50%] h-[50%] blur-[140px] rounded-full pointer-events-none z-0 animate-pulse",
        theme === 'dark' ? "bg-brand-accent/10" : "bg-brand-accent/5"
      )}></div>
      <div className={cn(
        "absolute bottom-[10%] left-[-10%] w-[45%] h-[45%] blur-[120px] rounded-full pointer-events-none z-0",
        theme === 'dark' ? "bg-[#66D99B]/5" : "bg-[#66D99B]/3"
      )}></div>
      <div className={cn(
        "absolute top-[30%] left-[20%] w-[30%] h-[30%] blur-[100px] rounded-full pointer-events-none z-0",
        theme === 'dark' ? "bg-blue-500/5" : "bg-blue-500/3"
      )}></div>

      {/* Decorative Background Lines */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke={theme === 'dark' ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          <line x1="10%" y1="0" x2="40%" y2="100%" stroke={theme === 'dark' ? "rgba(49,135,189,0.08)" : "rgba(49,135,189,0.12)"} strokeWidth="1" />
          <line x1="60%" y1="0" x2="30%" y2="100%" stroke={theme === 'dark' ? "rgba(102,217,155,0.05)" : "rgba(102,217,155,0.08)"} strokeWidth="1" />
          <line x1="0" y1="20%" x2="100%" y2="40%" stroke={theme === 'dark' ? "rgba(49,135,189,0.04)" : "rgba(49,135,189,0.06)"} strokeWidth="1" />
          <line x1="0" y1="80%" x2="100%" y2="60%" stroke={theme === 'dark' ? "rgba(102,217,155,0.06)" : "rgba(102,217,155,0.1)"} strokeWidth="1" />
        </svg>
      </div>

      {/* Header */}
      <header className={cn(
        "h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-2xl transition-all duration-500",
        isAiMode 
          ? "border-purple-500/20 bg-brand-header/40 backdrop-blur-3xl shadow-purple-500/5" 
          : cn(
              "backdrop-blur-3xl",
              theme === 'dark' 
                ? "border-white/5 bg-brand-header/30 shadow-black/50" 
                : "border-slate-200 bg-white/70 shadow-slate-200/50"
            )
      )}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
              "p-2 rounded-xl border transition-all duration-300",
              theme === 'dark' 
                ? "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            )}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-6">
            {/* Segmented Tab Switcher */}
          <div className={cn(
            "p-1 rounded-xl flex items-center gap-1 border relative w-48 sm:w-64 transition-colors",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
          )}>
            {/* Sliding background */}
              <motion.div
                layoutId="activeTab"
                className={cn(
                  "absolute h-[calc(100%-8px)] rounded-lg shadow-lg z-0",
                  isAiMode 
                    ? "bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500" 
                    : "bg-gradient-to-r from-[#3187BD] to-[#66D99B]"
                )}
                initial={false}
                animate={{
                  left: isAiMode ? "calc(50% + 2px)" : "4px",
                  width: "calc(50% - 6px)"
                }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.6 }}
              />

            <button
              onClick={exitAiMode}
              className={cn(
                "relative z-10 flex-1 py-2 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2",
                !isAiMode ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Pill className={cn("w-4 h-4 transition-colors", !isAiMode ? "text-white" : "text-zinc-500")} />
              <span className="hidden sm:inline whitespace-nowrap">HMSS 查詢</span>
              <span className="sm:hidden">HMSS</span>
            </button>

            <button
              onClick={() => setIsAiMode(true)}
              className={cn(
                "relative z-10 flex-1 py-2 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2",
                isAiMode ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Sparkles className={cn("w-4 h-4 transition-colors", isAiMode ? "text-white" : "text-zinc-500")} />
              <span className="hidden sm:inline whitespace-nowrap">AI 助理</span>
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
            <div className="hidden lg:flex items-center gap-2 text-[9px] text-[#3187BD] font-bold bg-brand-accent/5 px-3 py-1.5 rounded-full border border-[#3187BD]/20 animate-pulse">
              <CheckCircle2 className="w-3 h-3" /> {importStatus}
            </div>
          )}

          <div className="hidden md:flex flex-col items-end mr-1">
            <p className="text-[8px] text-brand-accent font-bold uppercase tracking-widest leading-none">
              {isSyncing ? 'Cloud Syncing' : 'Connected'}
            </p>
          </div>
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
                  const input = e.currentTarget.querySelector('input');
                  if (input) input.blur();
                }}
                className={cn(
                  "relative flex-1 group dropdown-container p-[1.5px] rounded-2xl transition-all shadow-2xl",
                  theme === 'dark' 
                    ? "bg-gradient-to-r from-[#3187BD]/60 to-[#66D99B]/60 focus-within:from-[#3187BD] focus-within:to-[#66D99B] shadow-brand-accent/20"
                    : "bg-gradient-to-r from-[#3187BD]/40 to-[#66D99B]/40 focus-within:from-[#3187BD]/70 focus-within:to-[#66D99B]/70 shadow-slate-200"
                )}
              >
                <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors", theme === 'dark' ? "text-zinc-500 group-focus-within:text-brand-accent" : "text-slate-400 group-focus-within:text-brand-accent")} />
                <input 
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
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className={cn(
                    "w-full backdrop-blur-3xl border-none rounded-[15px] pl-11 pr-24 md:pr-24 py-3 text-sm focus:outline-none focus:ring-0 transition-all font-medium",
                    theme === 'dark' 
                      ? "bg-black/90 text-white placeholder:text-zinc-600" 
                      : "bg-white/90 text-slate-800 placeholder:text-slate-400"
                  )}
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newState = !isAiSemanticEnabled;
                      setIsAiSemanticEnabled(newState);
                      if (!newState) setAiRecommendedCodes([]);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                      isAiSemanticEnabled 
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-lg shadow-purple-500/20" 
                        : "bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300"
                    )}
                    title="AI 語意智慧搜尋"
                  >
                    {isAiSemanticLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className={cn("w-3 h-3", isAiSemanticEnabled && "animate-pulse")} />
                    )}
                    <span className="hidden xs:inline">智尋</span>
                  </button>
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {searchQuery && (
                    <button 
                      type="submit"
                      className="md:hidden p-1.5 text-brand-accent hover:text-[#66D99B] transition-colors"
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
                    showFilters || selectedSystem !== '全部系統' || selectedClass !== '全部藥理' || selectedDosageForm !== '全部劑型'
                      ? "bg-brand-accent/20 border-brand-accent/40 text-brand-accent"
                      : cn(
                          "transition-colors",
                          theme === 'dark' 
                            ? "bg-white/[0.03] border-white/10 text-brand-muted hover:text-white hover:bg-white/[0.05]"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm shadow-slate-200"
                        )
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">篩選</span>
                  {(selectedSystem !== '全部系統' || selectedClass !== '全部藥理' || selectedDosageForm !== '全部劑型') && (
                    <span className={cn(
                      "w-2 h-2 rounded-full bg-brand-accent absolute -top-1 -right-1 shadow-lg border animate-pulse",
                      theme === 'dark' ? "shadow-brand-accent/50 border-brand-bg" : "shadow-brand-accent/30 border-white"
                    )} />
                  )}
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      key="filter-popover"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
                      className={cn(
                        "absolute top-full right-0 mt-3 w-80 backdrop-blur-3xl border rounded-2xl shadow-2xl z-[100] p-4 flex flex-col gap-4",
                        theme === 'dark' 
                          ? "bg-brand-sidebar/95 border-white/10 shadow-black/50" 
                          : "bg-white border-slate-200 shadow-slate-200/60"
                      )}
                    >
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em]">分類篩選</span>
                        <button onClick={() => setShowFilters(false)} className={cn(
                          "transition-colors",
                          theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-600"
                        )}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Anatomical System Filter */}
                        <div className="space-y-1.5 overflow-visible dropdown-container">
                          <label className={cn(
                            "text-[10px] font-bold uppercase tracking-widest pl-1",
                            theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                          )}>系統分組</label>
                          <div 
                            className="relative"
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
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
                                "w-full border rounded-xl pl-4 pr-10 py-2.5 text-xs flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group",
                                theme === 'dark' 
                                  ? "bg-white/5 border-white/10 text-zinc-200" 
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              )}
                            >
                              <span className="truncate font-medium">{selectedSystem}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isSystemOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isSystemOpen && (
                                <motion.div 
                                  key="system-dropdown"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                                  className={cn(
                                    "absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1",
                                    theme === 'dark' ? "bg-brand-header border-white/10" : "bg-white border-slate-200"
                                  )}
                                >
                                  {anatomicalSystems.map(s => (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        setSelectedSystem(s);
                                        setSelectedClass('全部藥理');
                                        setIsSystemOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between",
                                        selectedSystem === s 
                                          ? "bg-brand-accent/20 text-brand-accent font-bold" 
                                          : theme === 'dark' 
                                            ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-accent"
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

                        {/* Dosage Form Filter */}
                        <div className="space-y-1.5 overflow-visible dropdown-container">
                          <label className={cn(
                            "text-[10px] font-bold uppercase tracking-widest pl-1",
                            theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                          )}>用藥劑型</label>
                          <div 
                            className="relative"
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setIsDosageFormOpen(false);
                              }
                            }}
                          >
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsDosageFormOpen(!isDosageFormOpen);
                                setIsSystemOpen(false);
                                setIsClassOpen(false);
                              }}
                              className={cn(
                                "w-full border rounded-xl pl-4 pr-10 py-2.5 text-xs flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group",
                                theme === 'dark' 
                                  ? "bg-white/5 border-white/10 text-zinc-200" 
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              )}
                            >
                              <span className="truncate font-medium">{selectedDosageForm === '全部劑型' ? '全部劑型' : getDosageName(selectedDosageForm)}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isDosageFormOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isDosageFormOpen && (
                                <motion.div 
                                  key="dosage-dropdown"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                                  className={cn(
                                    "absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1",
                                    theme === 'dark' ? "bg-brand-header border-white/10" : "bg-white border-slate-200"
                                  )}
                                >
                                  {dosageForms.map(f => (
                                    <button
                                      key={f}
                                      onClick={() => {
                                        setSelectedDosageForm(f);
                                        setIsDosageFormOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between",
                                        selectedDosageForm === f 
                                          ? "bg-brand-accent/20 text-brand-accent font-bold" 
                                          : theme === 'dark' 
                                            ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-accent"
                                      )}
                                    >
                                      {f === '全部劑型' ? f : getDosageName(f)}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Pharmacological Class Filter */}
                        <div className="space-y-1.5 overflow-visible dropdown-container">
                          <label className={cn(
                            "text-[10px] font-bold uppercase tracking-widest pl-1",
                            theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                          )}>藥理分類</label>
                          <div 
                            className="relative"
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
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
                                "w-full border rounded-xl pl-4 pr-10 py-2.5 text-xs flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group",
                                theme === 'dark' 
                                  ? "bg-white/5 border-white/10 text-zinc-200" 
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              )}
                            >
                              <span className="truncate font-medium">{selectedClass}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isClassOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isClassOpen && (
                                <motion.div 
                                  key="class-dropdown"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                                  className={cn(
                                    "absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1",
                                    theme === 'dark' ? "bg-brand-header border-white/10" : "bg-white border-slate-200"
                                  )}
                                >
                                  {pharmacologicalClasses.map(c => (
                                    <button
                                      key={c}
                                      onClick={() => {
                                        setSelectedClass(c);
                                        setIsClassOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between",
                                        selectedClass === c 
                                          ? "bg-brand-accent/20 text-brand-accent font-bold" 
                                          : theme === 'dark' 
                                            ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-accent"
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

                      <div className="pt-2 border-t border-white/5">
                        <button 
                          onClick={() => {
                            setSelectedSystem('全部系統');
                            setSelectedClass('全部藥理');
                            setSelectedDosageForm('全部劑型');
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
              selectedMed ? "pb-[40vh] md:pb-5" : "pb-5"
            )}
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
                if (displayLimit < filteredMedications.length) {
                  setDisplayLimit(prev => prev + 100);
                }
              }
            }}
          >
          <div className="flex flex-col md:flex-row md:items-end justify-end gap-3 mb-2 md:mb-2.5">
              
              {(searchQuery || selectedSystem !== '全部系統' || selectedClass !== '全部藥理' || selectedDosageForm !== '全部劑型') && (
                <button 
                  onClick={() => { 
                    setSearchQuery(''); 
                    setSelectedSystem('全部系統'); 
                    setSelectedClass('全部藥理');
                    setSelectedDosageForm('全部劑型');
                  }}
                  className="flex items-center gap-2 text-[10px] font-black text-brand-muted hover:text-brand-accent transition-all uppercase tracking-[0.2em] self-start px-3 py-1.5 rounded-lg hover:bg-brand-accent/5"
                >
                  重設所有篩選 <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {isAiSemanticLoading && (
              <div className="flex items-center gap-3 text-purple-400 font-bold animate-pulse tracking-widest text-[10px] uppercase px-4 py-3 bg-purple-500/5 rounded-xl border border-purple-500/10 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在進行語意分析與相關性比對中...
              </div>
            )}
            
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
                        layout: { type: "spring", bounce: 0.1, duration: 0.6 }
                      }}
                      onClick={() => setSelectedMed(med)}
                      className={cn(
                        "medication-card group bg-transparent border border-transparent p-2 md:p-2.5 rounded-xl transition-all flex flex-col gap-1 items-start relative overflow-hidden",
                        theme === 'dark' 
                          ? "hover:bg-white/[0.05] hover:shadow-2xl cursor-pointer" 
                          : "hover:bg-white hover:shadow-xl hover:shadow-slate-200/60 cursor-pointer"
                      )}
                    >
                      {/* Left Vertical Bar Decoration */}
                      <div className={cn("absolute top-0 left-0 bottom-0 w-[1px] transition-[width] group-hover:w-[2px]", dosageStyle.glow)} />
                      
                      <div className="flex gap-2 items-start w-full pl-1.5">
                        <div className="flex-1 min-w-0">
                          {/* Top Row: Code & Class */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-[0.5px] rounded text-[9px] font-black tracking-widest uppercase shrink-0 border",
                              theme === 'dark' ? "border-white/20" : "border-slate-200",
                              dosageStyle.text
                            )}>
                              <span>{med.code}</span>
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider truncate",
                              theme === 'dark' ? "text-brand-accent/90" : "text-brand-accent"
                            )}>
                              {med.pharmacologicalClass}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mb-0.5 gap-1.5">
                            <h3 className={cn(
                              "text-[13px] md:text-[15px] font-bold transition-colors truncate leading-tight flex items-center gap-1.5",
                              theme === 'dark' ? "text-white group-hover:text-brand-accent" : "text-slate-800 group-hover:text-brand-accent"
                            )}>
                              <span className="truncate">{med.component}</span>
                              {isAiSemanticEnabled && aiRecommendedCodes.includes(med.code) && (
                                <span className={cn(
                                  "flex items-center gap-0.5 text-[7px] px-1 py-0.5 rounded border font-black animate-pulse",
                                  theme === 'dark' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-purple-100 text-purple-600 border-purple-200"
                                )}>
                                  AI
                                </span>
                              )}
                            </h3>
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "text-[10px] font-medium truncate opacity-70",
                              theme === 'dark' ? "text-zinc-500" : "text-slate-500"
                            )}>
                              {med.genericName} {med.chineseName && `• ${med.chineseName}`}
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
                    onClick={() => setDisplayLimit(prev => prev + 100)}
                    className="flex items-center gap-2 text-[10px] font-black text-brand-muted hover:text-brand-accent transition-all uppercase tracking-[0.2em] px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08]"
                  >
                    載入更多藥物 ({filteredMedications.length - displayLimit} 筆)
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <Search className="w-16 h-16 text-brand-muted mb-4 stroke-[0.5]" />
                <h3 className="text-xl font-medium text-white mb-2">查無相關結果</h3>
                <p className="text-brand-muted text-sm mb-8">請嘗試不同的診斷名、成分或藥品碼</p>
                
                {!isAiSemanticEnabled && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsAiSemanticEnabled(true)}
                    className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-500/20 group transition-all"
                  >
                    <Sparkles className="w-4 h-4 group-hover:animate-spin" />
                    立即試用 AI 語意智尋
                  </motion.button>
                )}
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
                  <div className="flex items-center gap-2 px-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span className="text-[10px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-[0.3em]">AI 智能諮詢模式</span>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col relative">
                    <div className="flex-1 p-[1px] rounded-[32px] bg-gradient-to-br from-blue-500/15 via-purple-500/15 to-orange-500/15 overflow-hidden shadow-2xl">
                      <div className="h-full w-full bg-brand-bg/40 backdrop-blur-3xl rounded-[31px] overflow-hidden flex flex-col relative">
                        
                        {/* Floating Search Bar Overlay */}
                        <div className="absolute top-0 left-0 right-0 z-40 p-3 md:p-4 bg-transparent pointer-events-none">
                          <form onSubmit={handleAiSearch} className="relative group p-[1.5px] rounded-2xl bg-gradient-to-r from-blue-500/60 via-purple-500/60 to-orange-500/60 focus-within:from-blue-500 focus-within:via-purple-500 focus-within:to-orange-500 transition-all shadow-2xl pointer-events-auto">
                            <input 
                              type="text"
                              placeholder="例如：我有頭痛且發燒的症狀，有哪些適合的藥物？"
                              value={aiQuery}
                              onChange={(e) => setAiQuery(e.target.value)}
                              className="w-full bg-black/80 backdrop-blur-xl border-none rounded-[15px] pl-5 pr-14 py-3.5 text-sm md:text-base focus:outline-none focus:ring-0 transition-all placeholder:text-zinc-500 text-white font-medium shadow-2xl"
                            />
                            <button 
                              type="submit"
                              disabled={isAiLoading || !aiQuery.trim()}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 text-white flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-95"
                            >
                              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                          </form>
                        </div>

                        {/* Content Area */}
                        <div className={cn(
                          "flex-1 overflow-y-auto custom-scrollbar pt-[72px] md:pt-[80px] px-4 md:px-8 transition-all duration-500",
                          selectedMed ? "pb-[40vh] md:pb-8" : "pb-8"
                        )}>
                          {aiHistory.length === 0 && !isAiLoading && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20">
                              <Database className="w-12 h-12 mb-4 stroke-1" />
                              <p className="text-zinc-400 font-medium tracking-wide">等待輸入諮詢內容...</p>
                            </div>
                          )}

                    <div className="space-y-12">
                      {/* Loading State with Question Bubble */}
                      {isAiLoading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
                          className="space-y-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border shadow-lg",
                              theme === 'dark' ? "bg-white/10 border-white/10" : "bg-slate-100 border-slate-200 shadow-slate-200"
                            )}>
                              <User className={cn("w-3.5 h-3.5", theme === 'dark' ? "text-zinc-400" : "text-slate-500")} />
                            </div>
                            <div className={cn(
                              "px-4 py-2 rounded-2xl rounded-tl-none border text-xs md:text-sm font-medium shadow-xl max-w-[85%]",
                              theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-300" : "bg-white border-slate-100 text-slate-700 shadow-slate-200"
                            )}>
                              {aiQuery}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-widest">AI 建議分析中</span>
                              <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10" />
                            </div>
                            <div className={cn(
                              "flex items-center gap-3 text-brand-accent font-bold animate-pulse tracking-widest text-[10px] uppercase px-4 py-3 rounded-xl border",
                              theme === 'dark' ? "bg-white/[0.03] border-white/5" : "bg-slate-50 border-slate-100 shadow-sm"
                            )}>
                              <div className={cn("w-full h-1 rounded-full overflow-hidden", theme === 'dark' ? "bg-white/5" : "bg-slate-200")}>
                                <motion.div 
                                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500"
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Conversation History (Include current results) */}
                      {aiHistory.length > 0 && (
                        <div className="space-y-10">
                          <div className="flex items-center justify-between pb-4 border-b border-white/5">
                            <div className="flex items-center gap-2">
                              <History className="w-4 h-4 text-zinc-500" />
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">諮詢對話</span>
                            </div>
                            <button 
                              onClick={() => setAiHistory([])}
                              className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors uppercase tracking-widest font-bold"
                            >
                              清除紀錄
                            </button>
                          </div>

                          <div className="space-y-12">
                            {aiHistory.map((item, hIdx) => (
                              <motion.div 
                                key={`history-${item.timestamp}`} 
                                initial={{ opacity: 0, scale: 0.99 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
                                className="space-y-4"
                              >
                                {/* User Question */}
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border shadow-lg",
                                    theme === 'dark' ? "bg-white/10 border-white/10" : "bg-slate-100 border-slate-200 shadow-slate-200"
                                  )}>
                                    <User className={cn("w-3.5 h-3.5", theme === 'dark' ? "text-zinc-400" : "text-slate-500")} />
                                  </div>
                                  <div className={cn(
                                    "px-4 py-2.5 rounded-2xl rounded-tl-none border text-xs md:text-sm font-medium shadow-xl max-w-[85%]",
                                    theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-300" : "bg-white border-slate-100 text-slate-700 shadow-slate-200"
                                  )}>
                                    {item.query}
                                  </div>
                                </div>

                                {/* AI Response */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black bg-gradient-to-r from-blue-400/60 via-purple-400/60 to-orange-400/60 bg-clip-text text-transparent uppercase tracking-widest">AI 建議</span>
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10" />
                                </div>
                                <div className="w-full space-y-8">
                                  {(() => {
                                    const lines = item.response.split('\n').filter(line => line.trim());
                                    const groups: { problem: string, items: string[] }[] = [];
                                    let currentGroup: { problem: string, items: string[] } | null = null;
                                    
                                    lines.forEach(line => {
                                      const problemMatch = line.match(/^(問題|Problem)[:：]\s*(.*)$/i);
                                      if (problemMatch) {
                                        currentGroup = { problem: problemMatch[2].trim(), items: [] };
                                        groups.push(currentGroup);
                                      } else if (currentGroup) {
                                        currentGroup.items.push(line);
                                      }
                                    });

                                    return groups.map((group, gIdx) => {
                                      const limitKey = `${hIdx}-${gIdx}`;
                                      const limit = aiVisibleLimits[limitKey] || 3;
                                      const visibleItems = group.items.slice(0, limit);
                                      const hasMore = group.items.length > limit;

                                      return (
                                        <div key={`group-${hIdx}-${gIdx}`} className="space-y-3">
                                          <div className="flex items-center gap-2.5 px-1">
                                            <div className="w-[3px] h-3 bg-gradient-to-b from-blue-500 via-purple-500 to-orange-500 rounded-full rotate-[15deg] shadow-lg shadow-purple-500/20" />
                                            <span className="text-[11px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-[0.2em]">{group.problem}</span>
                                          </div>
                                          
                                          <div className="grid gap-2">
                                            {visibleItems.map((line, lIdx) => {
                                              // 更加彈性的藥品碼解析，自動跳過編號或點點
                                              const cleanedLine = line.replace(/^\s*(\d+[\.\、\)]|\*|\-|\•)\s*/, '').trim();
                                              const parts = cleanedLine.split(/\s+/);
                                              const code = parts[0]?.toUpperCase();
                                              const med = medications.find(m => m.code === code);
                                              
                                              let name = parts[1] || '';
                                              let funcPart = parts.slice(2).join(' ');

                                              if (med) {
                                                name = med.component;
                                                const lineWithoutCode = line.substring(line.indexOf(' ') + 1).trim();
                                                if (lineWithoutCode.startsWith(med.component)) {
                                                  funcPart = lineWithoutCode.replace(med.component, '').trim();
                                                }
                                              }

                                              if (!code || !name) return <div key={lIdx} className={cn("text-xs italic px-2", theme === 'dark' ? "text-zinc-500" : "text-slate-400")}>{line}</div>;

                                              return (
                                                <button 
                                                  key={lIdx} 
                                                  onClick={() => {
                                                    const medLookup = medications.find(m => m.code === code);
                                                    if (medLookup) setSelectedMed(medLookup);
                                                  }}
                                                  className={cn(
                                                    "w-full flex items-center gap-3 text-xs p-3 rounded-xl transition-all group border border-transparent hover:translate-x-1 text-left",
                                                    theme === 'dark' 
                                                      ? "bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10" 
                                                      : "bg-slate-50 hover:bg-white hover:border-slate-200 shadow-sm shadow-slate-100"
                                                  )}
                                                >
                                                  <div className={cn(
                                                    "font-mono font-bold shrink-0 px-2 py-0.5 rounded",
                                                    theme === 'dark' ? "bg-white/5" : "bg-slate-100",
                                                    getDosageColor(code).text
                                                  )}>
                                                    {code}
                                                  </div>
                                                  <span className={cn(
                                                    "font-bold truncate",
                                                    theme === 'dark' ? "text-zinc-200" : "text-slate-800"
                                                  )}>{name}</span>
                                                  <span className={cn(
                                                    "flex-1 truncate text-right transition-colors uppercase text-[10px] tracking-tight",
                                                    theme === 'dark' ? "text-zinc-500 group-hover:text-zinc-400" : "text-slate-400 group-hover:text-slate-600"
                                                  )}>{funcPart}</span>
                                                </button>
                                              );
                                            })}
                                          </div>

                                            {hasMore && (
                                              <button 
                                                onClick={() => setAiVisibleLimits(prev => ({
                                                  ...prev,
                                                  [limitKey]: limit + 5
                                                }))}
                                                className="w-full mt-2 py-3 text-[10px] font-black text-brand-accent hover:text-white bg-brand-accent/10 hover:bg-brand-accent/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl border border-brand-accent/20 shadow-lg shadow-brand-accent/5 backdrop-blur-sm"
                                              >
                                                查看更多建議 ({group.items.length - limit} 筆)
                                                <ChevronDown className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
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
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 1 }}
              className={cn(
                "hidden md:flex flex-col border-l relative z-[60] overflow-hidden bg-brand-sidebar shadow-2xl shrink-0 w-[400px] lg:w-[480px]",
                theme === 'dark' ? "border-white/10" : "border-slate-200"
              )}
            >
              <div className={cn(
                "py-2 px-6 border-b flex items-center justify-between shrink-0",
                theme === 'dark' ? "border-white/5 bg-white/[0.02]" : "border-slate-100 bg-slate-50"
              )}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <h2 className={cn(
                    "text-[10px] font-bold tracking-[0.15em] truncate uppercase",
                    theme === 'dark' ? "text-zinc-400" : "text-slate-500"
                  )}>
                    Data Sheet <span className={theme === 'dark' ? "text-zinc-700" : "text-slate-300 mx-1 font-normal"}>/</span> <span className={cn("transition-colors", getDosageColor(selectedMed.code).text)}>藥物詳情</span></h2>
                </div>
                <button 
                  onClick={closeDetail}
                  className={cn(
                    "p-1 px-2 rounded-md transition-all border flex items-center gap-2",
                    theme === 'dark' 
                      ? "hover:bg-white/5 text-brand-muted hover:text-white border-transparent hover:border-white/10" 
                      : "hover:bg-slate-100 text-slate-400 hover:text-slate-700 border-transparent hover:border-slate-200"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Close</span>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={cn(
                "flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-thin",
                theme === 'dark' 
                  ? "bg-gradient-to-b from-brand-sidebar to-brand-bg scrollbar-thumb-white/10" 
                  : "bg-white scrollbar-thumb-slate-200"
              )}>
                <div className="space-y-4">
                  <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md border", getDosageColor(selectedMed.code).bg, getDosageColor(selectedMed.code).borderMain)}>
                    <span className={cn("font-mono font-medium text-sm md:text-base tracking-widest", getDosageColor(selectedMed.code).text)}>{selectedMed.code}</span>
                  </div>

                  <div className="space-y-1">
                    <h1 className={cn(
                      "text-xl md:text-2xl font-bold leading-tight tracking-tight break-words",
                      theme === 'dark' ? "text-zinc-100" : "text-slate-900"
                    )}>{selectedMed.component}</h1>
                    <p className={cn("text-sm md:text-base font-medium tracking-tight break-words", getDosageColor(selectedMed.code).accent)}>{selectedMed.genericName}</p>
                  </div>

                  <div className={cn("flex flex-col gap-1 pt-2 border-l-2 pl-4", getDosageColor(selectedMed.code).borderMain)}>
                    <p className={cn(
                      "text-xs md:text-sm font-medium leading-snug",
                      theme === 'dark' ? "text-zinc-300" : "text-slate-700"
                    )}>{selectedMed.brandName}</p>
                    {selectedMed.chineseName && <p className={cn(
                      "text-[10px] md:text-xs font-normal",
                      theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                    )}>{selectedMed.chineseName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className={cn(
                      "text-[9px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2",
                      theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                    )}>
                      Anatomical System
                    </label>
                    <button 
                      onClick={() => {
                        setSearchQuery(selectedMed.anatomicalSystem);
                      }}
                      className={cn(
                        "font-medium leading-relaxed text-xs md:text-sm pl-2.5 border-l-2 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full",
                        theme === 'dark' ? "text-zinc-300 border-zinc-800/60" : "text-slate-600 border-slate-200"
                      )}
                    >
                      {selectedMed.anatomicalSystem}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className={cn(
                      "text-[10px] uppercase font-semibold tracking-[0.15em] flex items-center gap-2",
                      theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                    )}>
                      Pharmacological Class
                    </label>
                    <button 
                      onClick={() => {
                        setSearchQuery(selectedMed.pharmacologicalClass);
                      }}
                      className={cn(
                        "font-medium leading-relaxed text-sm md:text-base pl-2.5 border-l-2 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full",
                        theme === 'dark' ? "text-zinc-200 border-zinc-700" : "text-slate-700 border-slate-200"
                      )}
                    >
                      {selectedMed.pharmacologicalClass}
                    </button>
                  </div>
                </div>

                {selectedMed.indications && (
                  <section className="space-y-3">
                    <div className={cn(
                      "flex items-center gap-3 font-semibold text-[10px] uppercase tracking-[0.15em]",
                      theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                    )}>
                      ATC Info / Indications
                    </div>
                    <p className={cn(
                      "leading-relaxed text-sm md:text-base font-sans backdrop-blur-sm p-4 rounded-lg border shadow-sm break-all",
                      theme === 'dark' ? "text-zinc-300 bg-white/[0.01] border-white/[0.03]" : "text-slate-700 bg-slate-50 border-slate-100"
                    )}>
                      {selectedMed.indications}
                    </p>
                  </section>
                )}

                <div className="space-y-6 pt-6 pb-20">
                  <h3 className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2",
                    theme === 'dark' ? "text-zinc-500" : "text-slate-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getDosageColor(selectedMed.code).glow)}></span>
                    Index Metadata
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedMed.searchKeywords.map((k, i) => (
                      <button 
                        key={`${k}-${i}`} 
                        onClick={() => setSearchQuery(k)}
                        className={cn(
                          "px-4 py-1.5 border rounded-lg text-[10px] font-mono transition-all cursor-pointer uppercase tracking-tight",
                          theme === 'dark' 
                            ? "bg-brand-secondary/50 border-brand-border text-zinc-500 hover:border-brand-accent/50 hover:bg-brand-accent/5 hover:text-brand-accent" 
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:border-brand-accent/50 hover:bg-slate-100 hover:text-brand-accentShadow"
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
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className={cn(
                "md:hidden fixed inset-x-0 bottom-0 h-[38vh] border-t z-[100] overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
                theme === 'dark' ? "bg-brand-sidebar border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "w-12 h-1 rounded-full mx-auto my-3 shrink-0",
                theme === 'dark' ? "bg-zinc-700/50" : "bg-slate-200"
              )} />
              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5 scrollbar-none">
                <div className="flex justify-between items-start sticky top-0 bg-inherit pt-1 pb-2 z-10">
                   <div className={cn("px-2 py-0.5 rounded border text-[10px] font-mono", getDosageColor(selectedMed.code).bg, getDosageColor(selectedMed.code).text, getDosageColor(selectedMed.code).borderMain)}>
                      {selectedMed.code}
                   </div>
                   <button onClick={closeDetail} className="p-1 -mr-2 opacity-60 hover:opacity-100 transition-opacity"><X className="w-5 h-5 text-zinc-500" /></button>
                </div>
                
                <div className="space-y-1">
                  <h1 className={cn("text-lg font-bold leading-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>{selectedMed.component}</h1>
                  <p className={cn("text-xs font-medium", getDosageColor(selectedMed.code).accent)}>{selectedMed.genericName}</p>
                </div>

                <div className="space-y-4">
                   <div className="flex flex-col gap-0.5 border-l-2 pl-3" style={{ borderColor: getDosageColor(selectedMed.code).borderMain.split('-').slice(1).join('-') === 'border-white/20' ? 'rgba(255,255,255,0.1)' : undefined }}>
                      <p className={cn("text-xs", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>{selectedMed.brandName}</p>
                      {selectedMed.chineseName && <p className={cn("text-[10px]", theme === 'dark' ? "text-zinc-500" : "text-slate-400")}>{selectedMed.chineseName}</p>}
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className={cn("p-2.5 rounded-xl border", theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100")}>
                         <span className={cn("block text-[8px] uppercase tracking-wider mb-1", theme === 'dark' ? "text-zinc-500" : "text-slate-400")}>System</span>
                         <span className={cn("text-[10px] font-medium block leading-tight", theme === 'dark' ? "text-zinc-300" : "text-slate-700")}>{selectedMed.anatomicalSystem}</span>
                      </div>
                      <div className={cn("p-2.5 rounded-xl border", theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100")}>
                         <span className={cn("block text-[8px] uppercase tracking-wider mb-1", theme === 'dark' ? "text-zinc-500" : "text-slate-400")}>Class</span>
                         <span className={cn("text-[10px] font-medium block leading-tight", theme === 'dark' ? "text-zinc-300" : "text-slate-700")}>{selectedMed.pharmacologicalClass}</span>
                      </div>
                   </div>

                   {selectedMed.indications && (
                     <div className={cn("p-3 rounded-xl border text-[11px] leading-relaxed", theme === 'dark' ? "bg-white/[0.02] border-white/5 text-zinc-400" : "bg-slate-50 border-slate-100 text-slate-600")}>
                        {selectedMed.indications}
                     </div>
                   )}

                   <div className="flex flex-wrap gap-2 pt-2">
                     {selectedMed.searchKeywords.slice(0, 5).map((k, i) => (
                       <button key={i} onClick={() => setSearchQuery(k)} className={cn("px-2 py-1 rounded text-[9px] font-mono border", theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-500" : "bg-slate-50 border-slate-100 text-slate-400")}>{k}</button>
                     ))}
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Overlay Removed */}
    </div>
  );
}
