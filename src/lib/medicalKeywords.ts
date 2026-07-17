/**
 * 醫學常用關鍵字與縮寫對照表
 * 用於強化搜尋引擎的語意理解能力
 *
 * ponytail: 兩張表分工——
 *  - MECHANISM_ATC：藥理機轉縮寫 → ATC 碼前綴。用 atcCode.startsWith 比對，撈到該類「在庫每一顆藥」，
 *    免手動維護學名清單，且可指定 5~7 碼細粒度隔出被 4 碼大類混在一起的（如 statin C10AA）。這是主力。
 *  - MEDICAL_ALIASES：ATC 隔不乾淨或非藥理類的確定性縮寫 → 名稱/病名清單（給藥/電解質、疾病縮寫、SNRI）。
 * 模糊臨床意圖（止痛、胃藥…）兩張都不放，走 AI 輔助機轉查詢路徑（App.tsx 症狀分析）動態處理。
 */

// 機轉縮寫 → ATC 碼前綴（可多個；比對 drug.atcCode.startsWith）
export const MECHANISM_ATC: Record<string, string[]> = {
  'acei': ['C09A', 'C09B'],          // ACE 抑制劑（含複方）
  'arb': ['C09C', 'C09D'],           // 血管收縮素II拮抗劑（含複方）
  'ccb': ['C08'],                    // 鈣離子拮抗劑
  'bb': ['C07'],                     // β 阻斷劑
  'statin': ['C10AA'],               // HMG-CoA 還原酶抑制劑（自降血脂大類 C10A 中精準隔出）
  'nsaid': ['M01A'],                 // 非類固醇抗炎藥
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
};

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
