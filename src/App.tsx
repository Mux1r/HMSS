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
  Container
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
import { INITIAL_MEDICATIONS } from './data/medications';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [displayLimit, setDisplayLimit] = useState(40);
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isClassOpen, setIsClassOpen] = useState(false);
  const [isDosageFormOpen, setIsDosageFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

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

  // Suggestions based on search query
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return fuse.search(searchQuery).slice(0, 6).map(result => result.item);
  }, [fuse, searchQuery]);

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

  const handleReset = async () => {
    setLoading(true);
    const resetData = await localMedicationService.reset();
    setMedications([...resetData]); 
    setGsheetUrl('https://script.google.com/macros/s/AKfycbxotfbc6-KsIn-_RoltpZl_vQhjUNDN-UrU9pWIARSCnWUCn_9iZ60J46zwr3b6laKBBw/exec');
    setShowResetConfirm(false);
    setLoading(false);
    setImportStatus('資料庫已重置為預設值');
    setTimeout(() => setImportStatus(null), 3000);
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
    setDisplayLimit(40);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [deferredSearchQuery, selectedSystem, selectedClass, selectedDosageForm]);

  const filteredMedications = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();
    
    let baseMeds = medications;
    
    if (query) {
      const minPrefixLength = 3;
      const queryLen = query.length;

      // 1. 完全匹配 (最優先)
      const exactMatches = medications.filter(m => 
        m.code?.toLowerCase() === query ||
        m.component?.toLowerCase() === query ||
        m.brandName?.toLowerCase() === query
      );

      // 輔助函式：取得從第一個英文字母開始的字串部分
      const getAlphaStart = (str: string) => {
        if (!str) return "";
        const m = str.match(/[a-zA-Z].*/);
        return m ? m[0].toLowerCase() : str.toLowerCase();
      };

      // 第二層： 字串絕對開頭匹配 (String Start)
      const stringStartMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
        const targets = [m.code, m.component, m.brandName, m.genericName];
        return targets.some(t => t?.toLowerCase().startsWith(query));
      });

      // 第三層： 第一個「字母」單字開頭匹配 (例如解決 "10% Dextrose" 的 "Dextrose" 開頭)
      const firstAlphaStartMatches = medications.filter(m => {
        if (exactMatches.some(em => em.id === m.id)) return false;
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

      // 整合與去重，保持嚴格優先順序：完全 > 字串開 > 字母開 > 單字開
      const combinedMeds: typeof medications = [
        ...exactMatches, 
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#060608] font-sans text-zinc-400 flex flex-col overflow-hidden selection:bg-brand-accent/30 selection:text-brand-accent relative">
      {/* Enhanced Background Glows for Glass Visibility */}
      <div className="absolute top-[-5%] right-[-5%] w-[50%] h-[50%] bg-brand-accent/10 blur-[140px] rounded-full pointer-events-none z-0 animate-pulse"></div>
      <div className="absolute bottom-[10%] left-[-10%] w-[45%] h-[45%] bg-[#66D99B]/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

      {/* Decorative Background Lines */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          <line x1="10%" y1="0" x2="40%" y2="100%" stroke="rgba(49,135,189,0.08)" strokeWidth="1" />
          <line x1="60%" y1="0" x2="30%" y2="100%" stroke="rgba(102,217,155,0.05)" strokeWidth="1" />
          <line x1="0" y1="20%" x2="100%" y2="40%" stroke="rgba(49,135,189,0.04)" strokeWidth="1" />
          <line x1="0" y1="80%" x2="100%" y2="60%" stroke="rgba(102,217,155,0.06)" strokeWidth="1" />
          
          <circle cx="20%" cy="15%" r="1" fill="rgba(49,135,189,0.2)" />
          <circle cx="85%" cy="45%" r="1.5" fill="rgba(102,217,155,0.15)" />
          <circle cx="45%" cy="75%" r="0.8" fill="rgba(49,135,189,0.25)" />
        </svg>
      </div>

      {/* Header */}
      <header className={cn(
        "h-16 border-b flex items-center justify-between px-4 md:px-8 shrink-0 z-50 shadow-2xl transition-all duration-500",
        isAiMode 
          ? "border-purple-500/20 bg-brand-header/40 backdrop-blur-3xl shadow-purple-500/5" 
          : "border-white/5 bg-brand-header/30 backdrop-blur-3xl shadow-black/50"
      )}>
        <div className="flex items-center gap-6">
          {/* Segmented Tab Switcher */}
          <div className="bg-white/5 p-1 rounded-xl flex items-center gap-1 border border-white/10 relative w-48 sm:w-64">
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
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />

            <button
              onClick={() => {
                setIsAiMode(false);
                setAiResponse(null);
                setAiQuery('');
              }}
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

        <div className="flex items-center gap-3 md:gap-6">
          {importStatus && (
            <div className="hidden lg:flex items-center gap-2 text-[9px] text-[#3187BD] font-bold bg-brand-accent/5 px-3 py-1.5 rounded-full border border-[#3187BD]/20 animate-pulse">
              <CheckCircle2 className="w-3 h-3" /> {importStatus}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-1">
              <p className="text-[8px] md:text-[9px] text-brand-accent font-bold uppercase tracking-widest">
                資料庫: {isSyncing ? '同步中' : isUpdateAvailable ? '有更新可用' : '正常'}
              </p>
              <p className="text-[7px] md:text-[8px] text-zinc-500 font-medium">
                {isSyncing ? 'Cloud connecting' : isUpdateAvailable ? 'Update pending' : 'Auto-sync active'}
              </p>
            </div>
            
            <button 
              onClick={handleSyncGoogleSheet}
              disabled={isSyncing}
              className={cn(
                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg relative overflow-hidden",
                isSyncing 
                  ? "bg-brand-secondary text-brand-muted cursor-not-allowed" 
                  : isUpdateAvailable
                    ? "bg-amber-500 text-black hover:bg-amber-400 hover:scale-[1.02] active:scale-95"
                    : "bg-brand-accent text-white hover:bg-[#66D99B] hover:scale-[1.02] active:scale-95 shadow-lg shadow-brand-accent/20"
              )}
            >
              {isUpdateAvailable && !isSyncing && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-bounce" />
              )}
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isSyncing ? '同步中...' : isUpdateAvailable ? '更新可用' : '雲端同步'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Area */}
        <main className="flex-1 flex flex-col bg-brand-bg overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {!isAiMode ? (
              <motion.div 
                key="standard-mode"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Top Search & Filter Toolbar */}
                <div className="bg-transparent border-b border-brand-border/60 p-3 md:p-4 shrink-0 z-30 relative">
            <div className="flex items-center gap-3">
              {/* Global Search */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowSuggestions(false);
                  const input = e.currentTarget.querySelector('input');
                  if (input) input.blur();
                }}
                className="relative flex-1 group dropdown-container p-[1px] rounded-xl bg-gradient-to-r from-[#3187BD]/30 to-[#66D99B]/30 focus-within:from-[#3187BD]/80 focus-within:to-[#66D99B]/80 transition-all shadow-xl"
              >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-accent z-10 transition-colors" />
                <input 
                  type="text" 
                  enterKeyHint="search"
                  placeholder="搜尋成分、代碼、適應症..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    setSearchFocused(true);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    // Small delay to allow clicking suggestions
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full bg-black/60 backdrop-blur-xl border-none rounded-[11px] pl-11 pr-24 md:pr-24 py-3 text-sm focus:outline-none focus:ring-0 transition-all placeholder:text-zinc-600 text-white shadow-[inset_0_1px_1px_rgba(0,0,0,0.4)] font-medium"
                />
                
                {/* Search Suggestions Dropdown */}
                <AnimatePresence>
                  {showSuggestions && searchQuery.trim() && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-brand-sidebar border border-white/10 rounded-xl shadow-2xl z-[120] overflow-hidden backdrop-blur-3xl"
                    >
                      <div className="p-2 flex flex-col gap-1">
                        <div className="px-3 py-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">建議匹配</span>
                          <span className="text-[9px] text-zinc-500">{suggestions.length} 筆建議</span>
                        </div>
                        {suggestions.map((med) => (
                          <button
                            key={`suggest-${med.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedMed(med);
                              setSearchQuery(med.component);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all group flex items-start gap-3"
                          >
                            <div className={cn("mt-0.5 p-1 rounded bg-white/5 group-hover:bg-brand-accent/10 transition-colors", getDosageColor(med.code).text)}>
                              <Pill className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 truncate">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">{med.component}</span>
                                <span className={cn("text-[8px] font-black uppercase px-1 rounded border border-white/10", getDosageColor(med.code).text)}>{med.code}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                                {med.brandName} {med.chineseName && `• ${med.chineseName}`}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                      : "bg-white/5 border-white/10 text-brand-muted hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">篩選</span>
                  {(selectedSystem !== '全部系統' || selectedClass !== '全部藥理' || selectedDosageForm !== '全部劑型') && (
                    <span className="w-2 h-2 rounded-full bg-brand-accent absolute -top-1 -right-1 shadow-[0_0_10px_rgba(49,135,189,0.5)] border border-brand-bg animate-pulse" />
                  )}
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      key="filter-popover"
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      className="absolute top-full right-0 mt-3 w-80 bg-brand-sidebar/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-4 flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em]">分類篩選</span>
                        <button onClick={() => setShowFilters(false)} className="text-zinc-500 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Anatomical System Filter */}
                        <div className="space-y-1.5 overflow-visible dropdown-container">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">系統分組</label>
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
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-zinc-200 flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group"
                            >
                              <span className="truncate font-medium">{selectedSystem}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isSystemOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isSystemOpen && (
                                <motion.div 
                                  key="system-dropdown"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute top-full left-0 right-0 mt-1 bg-brand-header border border-white/10 rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1"
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
                                          ? "bg-brand-accent/20 text-white font-bold" 
                                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
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
                          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">用藥劑型</label>
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
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-zinc-200 flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group"
                            >
                              <span className="truncate font-medium">{selectedDosageForm === '全部劑型' ? '全部劑型' : getDosageName(selectedDosageForm)}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isDosageFormOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isDosageFormOpen && (
                                <motion.div 
                                  key="dosage-dropdown"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute top-full left-0 right-0 mt-1 bg-brand-header border border-white/10 rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1"
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
                                          ? "bg-brand-accent/20 text-white font-bold" 
                                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
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
                          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">藥理分類</label>
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
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-zinc-200 flex items-center justify-between cursor-pointer focus:border-brand-accent/40 transition-all truncate shadow-sm group"
                            >
                              <span className="truncate font-medium">{selectedClass}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-brand-muted transition-transform duration-300", isClassOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isClassOpen && (
                                <motion.div 
                                  key="class-dropdown"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute top-full left-0 right-0 mt-1 bg-brand-header border border-white/10 rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-1"
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
                                          ? "bg-brand-accent/20 text-white font-bold" 
                                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
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
            className="flex-1 p-3 md:p-5 overflow-y-auto custom-scrollbar"
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
                if (displayLimit < filteredMedications.length) {
                  setDisplayLimit(prev => prev + 40);
                }
              }
            }}
          >
          <div className="flex flex-col md:flex-row md:items-end justify-end gap-3 mb-3 md:mb-4">
              
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {displayedMedications.map((med) => {
                  const dosageStyle = getDosageColor(med.code);
                  return (
                    <motion.div
                      key={med.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => setSelectedMed(med)}
                      className={cn(
                        "group bg-transparent border border-white/[0.05] p-2.5 md:p-3 rounded-lg hover:bg-white/[0.04] hover:shadow-2xl cursor-pointer transition-all flex flex-col gap-1.5 items-start relative overflow-hidden",
                        dosageStyle.border,
                        (() => {
                          const dosageClass = med.code?.charAt(0)?.toUpperCase();
                          switch(dosageClass) {
                            case 'E': return "hover:border-blue-500/50 hover:shadow-blue-500/5";
                            case 'T': return "hover:border-orange-500/50 hover:shadow-orange-500/5";
                            case 'I': return "hover:border-red-500/50 hover:shadow-red-500/5";
                            case 'L': return "hover:border-teal-500/50 hover:shadow-teal-500/5";
                            case 'O': return "hover:border-emerald-500/50 hover:shadow-emerald-500/5";
                            case 'S': return "hover:border-amber-500/50 hover:shadow-amber-500/5";
                            case 'Z': return "hover:border-zinc-500/50 hover:shadow-zinc-500/5";
                            case 'V': return "hover:border-violet-500/50 hover:shadow-violet-500/5";
                            default: return "hover:border-brand-accent/50 hover:shadow-brand-accent/5";
                          }
                        })()
                      )}
                    >
                      {/* Glow Decoration */}
                      <div className={cn("absolute top-0 left-0 bottom-0 w-1 opacity-40 blur-[10px] group-hover:opacity-70 transition-opacity", dosageStyle.glow)} />
                      
                      <div className="flex gap-3 items-start w-full">
                        <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                          <div className={cn(
                            "p-1.5 rounded-lg bg-white/5 group-hover:bg-brand-accent/10 transition-colors shrink-0",
                            dosageStyle.text
                          )}>
                            <dosageStyle.icon className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-2">
                            <h3 className="text-sm md:text-base font-bold text-white group-hover:text-brand-accent transition-all truncate leading-tight flex items-center gap-2">
                              <span className="truncate">{med.component}</span>
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase shrink-0 border border-white/20",
                                dosageStyle.text
                              )}>
                                <span>{med.code}</span>
                              </span>
                              {isAiSemanticEnabled && aiRecommendedCodes.includes(med.code) && (
                                <span className="flex items-center gap-1 text-[7px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded border border-purple-500/30 font-black animate-pulse">
                                  <Sparkles className="w-1.5 h-1.5" />
                                  AI
                                </span>
                              )}
                            </h3>
                            <ChevronRight className="w-3.5 h-3.5 text-brand-muted/30 group-hover:text-brand-accent group-hover:translate-x-1 transition-all shrink-0" />
                          </div>
                          
                          <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                            <p className="text-[10px] md:text-[11px] text-zinc-400 font-medium truncate shrink-0">{med.brandName}</p>
                            {med.chineseName && (
                              <p className="text-[9px] md:text-[10px] text-zinc-500 truncate opacity-60">
                                • {med.chineseName}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-500 font-medium">{med.genericName}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                            <span className="text-[9px] text-brand-accent/70 font-bold uppercase tracking-wider">
                              {med.pharmacologicalClass}
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
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
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
                        <div className="absolute top-0 left-0 right-0 z-40 p-3 md:p-4 bg-transparent">
                          <form onSubmit={handleAiSearch} className="relative group p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-orange-500/40 focus-within:from-blue-500/80 focus-within:via-purple-500/80 focus-within:to-orange-500/80 transition-all shadow-2xl">
                            <input 
                              type="text"
                              placeholder="例如：我有頭痛且發燒的症狀，有哪些適合的藥物？"
                              value={aiQuery}
                              onChange={(e) => setAiQuery(e.target.value)}
                              className="w-full bg-black/60 backdrop-blur-xl border-none rounded-2xl pl-5 pr-14 py-3.5 text-sm md:text-base focus:outline-none focus:ring-0 transition-all placeholder:text-zinc-500 text-white font-medium shadow-2xl"
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
                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-20 md:pt-24 pb-8 px-4 md:px-8">
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
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 border border-white/10 shadow-lg">
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-2xl rounded-tl-none border border-white/5 text-xs md:text-sm text-zinc-300 font-medium shadow-xl max-w-[85%]">
                              {aiQuery}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400 bg-clip-text text-transparent uppercase tracking-widest">AI 建議分析中</span>
                              <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10" />
                            </div>
                            <div className="flex items-center gap-3 text-brand-accent font-bold animate-pulse tracking-widest text-[10px] uppercase px-4 py-3 bg-white/[0.03] rounded-xl border border-white/5">
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-4"
                              >
                                {/* User Question */}
                                <div className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 border border-white/10 shadow-lg">
                                    <User className="w-3.5 h-3.5 text-zinc-400" />
                                  </div>
                                  <div className="bg-white/5 px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5 text-xs md:text-sm text-zinc-300 font-medium shadow-xl max-w-[85%]">
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

                                                if (!code || !name) return <div key={lIdx} className="text-xs text-zinc-500 italic px-2">{line}</div>;

                                                return (
                                                  <button 
                                                    key={lIdx} 
                                                    onClick={() => {
                                                      const medLookup = medications.find(m => m.code === code);
                                                      if (medLookup) setSelectedMed(medLookup);
                                                    }}
                                                    className="w-full flex items-center gap-3 text-xs bg-white/[0.02] p-3 rounded-xl hover:bg-white/[0.05] transition-all group border border-transparent hover:border-white/10 hover:translate-x-1 text-left"
                                                  >
                                                    <div className={cn(
                                                      "font-mono font-bold shrink-0 px-2 py-0.5 rounded bg-white/5",
                                                      getDosageColor(code).text
                                                    )}>
                                                      {code}
                                                    </div>
                                                    <span className="text-zinc-200 font-bold truncate">{name}</span>
                                                    <span className="text-zinc-500 flex-1 truncate text-right group-hover:text-zinc-400 transition-colors uppercase text-[10px] tracking-tight">{funcPart}</span>
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
      </div>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedMed && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
          >
            <div 
              onClick={() => setSelectedMed(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              key="detail-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                "absolute inset-y-0 right-0 w-full max-w-2xl bg-brand-sidebar/40 backdrop-blur-3xl border-l border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] z-[70] overflow-hidden flex flex-col",
                getDosageColor(selectedMed.code).border
              )}
            >
              <div className="py-2 px-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                  <h2 className="text-[10px] font-bold text-zinc-400 tracking-[0.15em] truncate uppercase">Data Sheet <span className="text-zinc-700 mx-1 font-normal">/</span> <span className={cn("transition-colors", getDosageColor(selectedMed.code).text)}>藥物詳情</span></h2>
                </div>
                <button 
                  onClick={() => setSelectedMed(null)}
                  className="p-1 px-2 hover:bg-white/5 rounded-md text-brand-muted hover:text-white transition-all border border-transparent hover:border-white/10 flex items-center gap-2"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Close</span>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 space-y-8 md:space-y-10 bg-gradient-to-b from-brand-sidebar to-brand-bg scrollbar-thin scrollbar-thumb-white/10">
                <div className="space-y-4">
                  {/* Code Badge */}
                  <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md border", getDosageColor(selectedMed.code).bg, getDosageColor(selectedMed.code).borderMain)}>
                    <span className={cn("font-mono font-medium text-sm md:text-base tracking-widest", getDosageColor(selectedMed.code).text)}>{selectedMed.code}</span>
                  </div>

                  <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 leading-tight tracking-tight break-words">{selectedMed.component}</h1>
                    <p className={cn("text-base md:text-lg font-medium tracking-tight break-words", getDosageColor(selectedMed.code).accent)}>{selectedMed.genericName}</p>
                  </div>

                  <div className={cn("flex flex-col gap-1 pt-2 border-l-2 pl-4", getDosageColor(selectedMed.code).borderMain)}>
                    <p className="text-sm md:text-base text-zinc-300 font-medium leading-snug">{selectedMed.brandName}</p>
                    {selectedMed.chineseName && <p className="text-[11px] md:text-xs text-zinc-500 font-normal">{selectedMed.chineseName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-semibold tracking-[0.15em] flex items-center gap-2">
                      Anatomical System
                    </label>
                    <button 
                      onClick={() => {
                        setSearchQuery(selectedMed.anatomicalSystem);
                        setSelectedMed(null);
                      }}
                      className="text-zinc-300 font-medium leading-relaxed text-xs md:text-sm pl-2.5 border-l-2 border-zinc-800/60 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full"
                    >
                      {selectedMed.anatomicalSystem}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-semibold tracking-[0.15em] flex items-center gap-2">
                      Pharmacological Class
                    </label>
                    <button 
                      onClick={() => {
                        setSearchQuery(selectedMed.pharmacologicalClass);
                        setSelectedMed(null);
                      }}
                      className="text-zinc-300 font-medium leading-relaxed text-xs md:text-sm pl-2.5 border-l-2 border-zinc-800/60 hover:text-brand-accent hover:border-brand-accent transition-all text-left w-full"
                    >
                      {selectedMed.pharmacologicalClass}
                    </button>
                  </div>
                </div>

                {selectedMed.indications && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-3 text-zinc-500 font-semibold text-[9px] uppercase tracking-[0.15em]">
                      ATC Info / Indications
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-sm md:text-base font-sans bg-white/[0.01] backdrop-blur-sm p-4 rounded-lg border border-white/[0.03] shadow-sm break-all lg:p-6">
                      {selectedMed.indications}
                    </p>
                  </section>
                )}

                <div className="space-y-6 pt-6">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getDosageColor(selectedMed.code).glow)}></span>
                    Index Metadata
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedMed.searchKeywords.map((k, i) => (
                      <button 
                        key={`${k}-${i}`} 
                        onClick={() => {
                          setSearchQuery(k);
                          setSelectedMed(null);
                        }}
                        className="px-4 py-1.5 bg-brand-secondary/50 border border-brand-border text-zinc-500 rounded-lg text-[10px] font-mono hover:border-brand-accent/50 hover:bg-brand-accent/5 hover:text-brand-accent transition-all cursor-pointer uppercase tracking-tight"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>


            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
