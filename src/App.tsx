/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
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
  ArrowDown
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
  const base = "border-l-2";
  switch (firstChar) {
    case 'E': return { border: `${base} border-l-blue-500`, glow: "bg-blue-500", text: "text-blue-500", accent: "text-blue-400", bg: "bg-blue-500/10", borderMain: "border-blue-500/20" }; // 外用
    case 'T': return { border: `${base} border-l-orange-500`, glow: "bg-orange-500", text: "text-orange-500", accent: "text-orange-400", bg: "bg-orange-500/10", borderMain: "border-orange-500/20" }; // 錠劑
    case 'I': return { border: `${base} border-l-red-500`, glow: "bg-red-500", text: "text-red-500", accent: "text-red-400", bg: "bg-red-500/10", borderMain: "border-red-500/20" }; // 針劑
    case 'L': return { border: `${base} border-l-teal-500`, glow: "bg-teal-500", text: "text-teal-500", accent: "text-teal-400", bg: "bg-teal-500/10", borderMain: "border-teal-500/20" }; // 藥水
    case 'O': return { border: `${base} border-l-emerald-500`, glow: "bg-emerald-500", text: "text-emerald-500", accent: "text-emerald-400", bg: "bg-emerald-500/10", borderMain: "border-emerald-500/20" }; // 眼用
    case 'S': return { border: `${base} border-l-amber-500`, glow: "bg-amber-500", text: "text-amber-500", accent: "text-amber-400", bg: "bg-amber-500/10", borderMain: "border-amber-500/20" }; // 噴劑
    case 'Z': return { border: `${base} border-l-zinc-500`, glow: "bg-zinc-500", text: "text-zinc-500", accent: "text-zinc-400", bg: "bg-zinc-500/10", borderMain: "border-zinc-500/20" }; // 試驗
    case 'V': return { border: `${base} border-l-violet-500`, glow: "bg-violet-500", text: "text-violet-500", accent: "text-violet-400", bg: "bg-violet-500/10", borderMain: "border-violet-500/20" }; // 塞劑
    default: return { border: `${base} border-l-brand-accent`, glow: "bg-brand-accent", text: "text-brand-accent", accent: "text-brand-accent/80", bg: "bg-brand-accent/10", borderMain: "border-brand-accent/20" };
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
    
    return medications.filter(med => {
      const matchesSearch = !query || 
        med.code.toLowerCase().includes(query) ||
        med.genericName.toLowerCase().includes(query) ||
        med.brandName.toLowerCase().includes(query) ||
        med.searchKeywords.some(k => k.toLowerCase().includes(query));
      
      const matchesSystem = 
        selectedSystem === '全部系統' || med.anatomicalSystem === selectedSystem;

      const matchesClass = 
        selectedClass === '全部藥理' || med.pharmacologicalClass === selectedClass;

      const matchesDosageForm = 
        selectedDosageForm === '全部劑型' || 
        (med.dosageForm || med.code?.charAt(0)?.toUpperCase() || '?') === selectedDosageForm;

      return matchesSearch && matchesSystem && matchesClass && matchesDosageForm;
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
      <div className="absolute bottom-[10%] left-[-10%] w-[45%] h-[45%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
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
          
          <line x1="10%" y1="0" x2="40%" y2="100%" stroke="rgba(16,185,129,0.05)" strokeWidth="1" />
          <line x1="60%" y1="0" x2="30%" y2="100%" stroke="rgba(16,185,129,0.03)" strokeWidth="1" />
          <line x1="0" y1="20%" x2="100%" y2="40%" stroke="rgba(16,185,129,0.02)" strokeWidth="1" />
          <line x1="0" y1="80%" x2="100%" y2="60%" stroke="rgba(16,185,129,0.04)" strokeWidth="1" />
          
          <circle cx="20%" cy="15%" r="1" fill="rgba(16,185,129,0.2)" />
          <circle cx="85%" cy="45%" r="1.5" fill="rgba(16,185,129,0.15)" />
          <circle cx="45%" cy="75%" r="0.8" fill="rgba(16,185,129,0.25)" />
        </svg>
      </div>

      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-brand-header/30 backdrop-blur-3xl flex items-center justify-between px-4 md:px-8 shrink-0 z-50 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-brand-accent to-emerald-600 rounded-xl shadow-lg shadow-brand-accent/20">
            <Pill className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2 truncate">
            HMSS 
            <span className="h-4 w-px bg-brand-border hidden sm:block mx-1"></span>
            <span className="text-brand-muted text-sm font-medium hidden sm:inline tracking-wide">院內藥物查詢系統</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {importStatus && (
            <div className="hidden lg:flex items-center gap-2 text-[9px] text-emerald-500 font-bold bg-brand-accent/5 px-3 py-1.5 rounded-full border border-emerald-500/20 animate-pulse">
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
                    : "bg-brand-accent text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-95"
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
          {/* Top Search & Filter Toolbar */}
          <div className="bg-brand-sidebar/20 backdrop-blur-2xl border-b border-brand-border/60 p-3 md:p-4 shrink-0 z-30 shadow-2xl relative">
            <div className="flex items-center gap-3">
              {/* Global Search */}
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-accent transition-colors" />
                <input 
                  type="text" 
                  placeholder="搜尋成分、代碼、適應症..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-brand-accent/40 focus:ring-1 focus:ring-brand-accent/20 transition-all placeholder:text-zinc-600 text-white shadow-[inset_0_1px_1px_rgba(0,0,0,0.4)] font-medium"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-accent p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

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
                    <span className="w-2 h-2 rounded-full bg-brand-accent absolute -top-1 -right-1 shadow-[0_0_10px_rgba(16,185,129,0.5)] border border-brand-bg animate-pulse" />
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
                        "group bg-white/[0.03] border border-white/[0.05] p-3.5 md:p-4 rounded-xl hover:bg-white/[0.06] hover:shadow-2xl cursor-pointer transition-all flex flex-col gap-3 items-start relative overflow-hidden backdrop-blur-sm",
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
                      
                      <div className="flex gap-1 items-start w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="text-base md:text-lg font-bold text-white group-hover:text-brand-accent transition-all truncate leading-snug flex items-center gap-3">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest border border-white/10 shadow-sm uppercase shrink-0 relative overflow-hidden",
                                "bg-white/5",
                                dosageStyle.text
                              )}>
                                <div className={cn("absolute inset-0 opacity-20 blur-[4px]", dosageStyle.glow)} />
                                <span className="relative z-10">{med.code}</span>
                              </span>
                              <span className="truncate">{med.component}</span>
                            </h3>
                            <ChevronRight className="w-4 h-4 text-brand-muted/30 group-hover:text-brand-accent group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                          </div>
                          <p className="text-xs md:text-sm text-zinc-400 mb-1 font-medium truncate tracking-tight">{med.genericName}</p>
                          {med.chineseName && <p className="text-[10px] md:text-[11px] text-brand-muted mb-2.5 font-medium truncate opacity-60 leading-tight">{med.brandName} • {med.chineseName}</p>}
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                            <span className="text-[8px] md:text-[9px] bg-white/5 px-2 py-0.5 rounded text-zinc-500 uppercase tracking-wider border border-white/5 font-bold">
                              {med.anatomicalSystem}
                            </span>
                            <span className="text-[8px] md:text-[9px] bg-brand-accent/10 px-2 py-0.5 rounded text-brand-accent uppercase tracking-wider border border-brand-accent/20 font-bold">
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
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <Search className="w-16 h-16 text-brand-muted mb-4 stroke-1" />
                <h3 className="text-xl font-medium text-white">查無相關結果</h3>
                <p className="text-brand-muted text-sm mt-1">請嘗試不同的診斷名、成分或藥品碼</p>
              </div>
            )}
          </div>
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
