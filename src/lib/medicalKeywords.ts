/**
 * 醫學常用關鍵字與縮寫對照表
 * 用於強化搜尋引擎的語意理解能力
 *
 * ponytail: 兩張表分工——
 *  - MECHANISM_ATC：藥理機轉縮寫 → ATC 碼前綴。用 atcCode.startsWith 比對，撈到該類「在庫每一顆藥」，
 *    免手動維護學名清單，且可指定 5~7 碼細粒度隔出被 4 碼大類混在一起的（如 statin C10AA）。這是主力。
 *  - MEDICAL_ALIASES：ATC 隔不乾淨或非藥理類的確定性縮寫 → 名稱/病名清單（給藥/電解質、疾病縮寫、SNRI）。
 * 模糊臨床意圖（止痛、胃藥…）兩張都不放，走適應症圖譜查詢（App.tsx，Edge Function kg-search）處理。
 */

// 機轉縮寫 → ATC 碼前綴（可多個；比對 drug.atcCode.startsWith）
export const MECHANISM_ATC: Record<string, string[]> = {
  'acei': ['C09A', 'C09B'],          // ACE 抑制劑（含複方）
  'arb': ['C09C', 'C09D'],           // 血管收縮素II拮抗劑（含複方）
  'ccb': ['C08'],                    // 鈣離子拮抗劑
  'bb': ['C07'],                     // β 阻斷劑
  'statin': ['C10AA'],               // HMG-CoA 還原酶抑制劑（自降血脂大類 C10A 中精準隔出）
  'nsaid': ['M01A'],                 // 非類固醇抗炎藥
  'cox2': ['M01AH'],                 // COX-2 選擇性抑制劑（coxib）
  'cox2i': ['M01AH'],
  'coxib': ['M01AH'],
  'ppi': ['A02BC'],                  // 質子幫浦抑制劑
  'h2ra': ['A02BA'],                 // H2 受體拮抗劑
  'sglt2': ['A10BK'],                // SGLT2 抑制劑
  'sglt2i': ['A10BK'],
  'dpp4i': ['A10BH'],                // DPP-4 抑制劑
  'glp1': ['A10BJ'],                 // GLP-1 受體促效劑
  'ssri': ['N06AB'],                 // 選擇性血清素回收抑制劑
  'tca': ['N06AA'],                  // 三環抗憂鬱劑
  'bzd': ['N05BA', 'N05CD', 'N03AE'],// 苯二氮平（抗焦慮/安眠/抗癲癇散布於三處）
  'benzo': ['N05BA', 'N05CD', 'N03AE'],
  'noac': ['B01AE', 'B01AF'],        // 直接凝血酶/Xa 因子抑制劑
  'doac': ['B01AE', 'B01AF'],
  'arni': ['C09DX04'],               // sacubitril/valsartan
  'mra': ['C03DA'],                  // 醛固酮拮抗劑
  // --- 以下於 2026-09-30 補上 30 組（另含 aap、5ht3、p2y12 三個同義寫法），每組都對過院內至少有一筆 ---
  // 呼吸道
  'laba': ['R03AC12', 'R03AC13', 'R03AC18', 'R03AC19', 'R03AK', 'R03AL03', 'R03AL04', 'R03AL05', 'R03AL06', 'R03AL07', 'R03AL08', 'R03AL09', 'R03AL11', 'R03AL12'], // 長效 β2 促效劑（含 ICS/LAMA 複方）
  'saba': ['R03AC02', 'R03AC03', 'R03AC04', 'R03AL01', 'R03AL02'], // 短效 β2 促效劑（含與 SAMA 複方）
  'lama': ['R03BB04', 'R03BB05', 'R03BB06', 'R03BB07', 'R03AL03', 'R03AL04', 'R03AL05', 'R03AL06', 'R03AL07', 'R03AL08', 'R03AL09', 'R03AL11', 'R03AL12'], // 長效抗膽鹼（含複方）
  'sama': ['R03BB01', 'R03AL01', 'R03AL02'], // 短效抗膽鹼 ipratropium（含複方）
  'ics': ['R03BA', 'R03AK', 'R03AL08', 'R03AL09', 'R03AL11', 'R03AL12'], // 吸入型類固醇（含複方）
  'incs': ['R01AD'],                 // 鼻用類固醇
  'ltra': ['R03DC'],                 // 白三烯受體拮抗劑（montelukast）
  'h1ra': ['R06A'],                  // H1 抗組織胺
  // 泌尿、代謝
  '5ari': ['G04CB'],                 // 5α 還原酶抑制劑
  'pde5i': ['G04BE03', 'G04BE08', 'G04BE09', 'G04BE10'], // PDE5 抑制劑
  'tzd': ['A10BG'],                  // thiazolidinedione（pioglitazone）
  // 精神、神經
  'sga': ['N05AH02', 'N05AH03', 'N05AH04', 'N05AH05', 'N05AX08', 'N05AX12', 'N05AX13', 'N05AE04', 'N05AE05'], // 第二代抗精神病藥
  'aap': ['N05AH02', 'N05AH03', 'N05AH04', 'N05AH05', 'N05AX08', 'N05AX12', 'N05AX13', 'N05AE04', 'N05AE05'], // 同 sga（atypical antipsychotic）
  'fga': ['N05AA', 'N05AB', 'N05AD', 'N05AF'], // 第一代抗精神病藥
  'maoi': ['N06AF', 'N06AG'],        // 單胺氧化酶抑制劑
  'achei': ['N06DA'],                // 乙醯膽鹼酯酶抑制劑（失智）
  'triptan': ['N02CC'],              // 5-HT1 促效劑（偏頭痛）
  // 止吐
  '5ht3ra': ['A04AA'],               // 5-HT3 拮抗劑（setron）
  '5ht3': ['A04AA'],
  // 抗凝、抗血小板
  'lmwh': ['B01AB04', 'B01AB05', 'B01AB06', 'B01AB12'], // 低分子量肝素
  'ufh': ['B01AB01'],                // 未分段肝素
  'vka': ['B01AA'],                  // 維生素 K 拮抗劑（warfarin）
  'p2y12i': ['B01AC04', 'B01AC05', 'B01AC22', 'B01AC24'], // P2Y12 抑制劑
  'p2y12': ['B01AC04', 'B01AC05', 'B01AC22', 'B01AC24'],
  // 抗感染
  'fq': ['J01MA'],                   // fluoroquinolone
  'tmpsmx': ['J01EE01'],             // trimethoprim/sulfamethoxazole
  'bli': ['J01CR'],                  // β-lactam + β-lactamase inhibitor
  '3gc': ['J01DD'],                  // 第三代頭孢菌素
  'nrti': ['J05AF'],                 // 核苷類反轉錄酶抑制劑（含 B 肝用藥）
  // 免疫、血液
  'tnfi': ['L04AB'],                 // TNF-α 抑制劑
  'jaki': ['L04AF', 'L04AA29', 'L04AA37', 'L04AA44'], // JAK 抑制劑（新舊 ATC 版本都收）
  'esa': ['B03XA01', 'B03XA02', 'B03XA03'], // 紅血球生成刺激劑（不含 HIF-PHI）
  'gcsf': ['L03AA'],                 // 白血球生長激素
};

/** 查縮寫表前先整理：去空白與連字號，inhibitor(s) 收成 i。「COX-2 inhibitors」「Cox 2」→ cox2i／cox2。 */
export function mechanismKey(query: string): string {
  return query.toLowerCase().replace(/[\s\-]+/g, "").replace(/inhibitors?$/, "i");
}

// 確定性縮寫 → 名稱/病名清單（ATC 隔不乾淨或非藥理分類者）
export const MEDICAL_ALIASES: Record<string, string[]> = {
  // 機轉類：SNRI 散布於 N06AX（與 mirtazapine/trazodone 等混雜），ATC 無法乾淨隔出，故用學名清單
  'snri': ['serotonin norepinephrine reuptake inhibitor', 'venlafaxine', 'duloxetine', 'desvenlafaxine'],

  // 給藥/電解質縮寫 (Abbreviations)
  'ns': ['normal saline', 'sodium chloride', '生理食鹽水', '氯化鈉'],
  'ds': ['dextrose', '葡萄糖'],
  'd5w': ['5% dextrose', '5% 葡萄糖'],
  'd10w': ['10% dextrose', '10% 葡萄糖'],
  'd50w': ['50% dextrose', '50% 葡萄糖'],
  'lr': ['lactated ringer', 'ringer\'s lactate', '乳酸林格氏液'],
  'apap': ['acetaminophen', 'paracetamol', '乙醯胺酚', 'panadol', '普拿疼'],
  'asa': ['aspirin', 'acetylsalicylic acid', '阿斯匹靈'],
  'kcl': ['potassium chloride', '氯化鉀'],
  'mgo': ['magnesium oxide', '氧化鎂'],
  'nacl': ['sodium chloride', '生理食鹽水', '氯化鈉'],
  'hco3': ['sodium bicarbonate', '碳酸氫鈉'],

  // 疾病縮寫 → 病名（用於比對 indications）
  'flu': ['influenza', '流感'],
  'uti': ['urinary tract infection', '尿道感染'],
  'uri': ['upper respiratory infection', '感冒', '呼吸道感染'],
  'hf': ['heart failure', '心衰竭'],
  'af': ['atrial fibrillation', '心房顫動'],
  'ami': ['acute myocardial infarction', '心肌梗塞'],
  'cad': ['coronary artery disease', '冠狀動脈疾病'],
  'dm': ['diabetes mellitus', '糖尿病'],
  'htn': ['hypertension', '高血壓'],
  'copd': ['chronic obstructive pulmonary disease', '肺阻塞'],
};
