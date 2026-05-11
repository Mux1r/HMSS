/**
 * 醫學常用關鍵字與縮寫對照表
 * 用於強化搜尋引擎的語意理解能力
 */

export const MEDICAL_ALIASES: Record<string, string[]> = {
  // 機轉類 (Mechanism of Action)
  'acei': ['angiotensin converting enzyme inhibitor', 'captopril', 'enalapril', 'lisinopril', 'ramipril', 'fosinopril', 'trandolapril'],
  'arb': ['angiotensin ii receptor blocker', 'losartan', 'valsartan', 'irbesartan', 'candesartan', 'olmesartan', 'telmisartan'],
  'ccb': ['calcium channel blocker', 'amlodipine', 'nifedipine', 'felodipine', 'diltiazem', 'verapamil', 'lacidipine'],
  'ppi': ['proton pump inhibitor', 'omeprazole', 'lansoprazole', 'esomeprazole', 'pantoprazole', 'rabeprazole', 'dexlansoprazole'],
  'statin': ['hmg-coa reductase inhibitor', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
  'nsaid': ['non-steroidal anti-inflammatory drug', 'ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'celecoxib', 'etoricoxib', 'aspirin', 'asa'],
  'bb': ['beta blocker', 'bisoprolol', 'metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'nebivolol'],
  'h2ra': ['h2 receptor antagonist', 'famotidine', 'ranitidine', 'cimetidine'],
  'sglti': ['sglto inhibitor', 'dapagliflozin', 'empagliflozin', 'canagliflozin'],
  'dpp4i': ['dpp-4 inhibitor', 'sitagliptin', 'vildagliptin', 'saxagliptin', 'linagliptin', 'alogliptin'],
  
  // 縮寫類 (Abbreviations)
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
  'flu': ['influenza', '流感'],
  'uti': ['urinary tract infection', '尿道感染'],
  'uri': ['upper respiratory infection', '感冒', '呼吸道感染'],
  'hf': ['heart failure', '心衰竭'],
  'af': ['atrial fibrillation', '心房顫動'],
  'ami': ['acute myocardial infarction', '心肌梗塞'],
  'cad': ['coronary artery disease', '冠狀動脈疾病'],
  'dm': ['diabetes mellitus', '糖尿病', 'metformin', 'insulin'],
  'htn': ['hypertension', '高血壓'],
  'copd': ['chronic obstructive pulmonary disease', '肺阻塞'],
  
  // 別名類 (Common Synonyms)
  '抗生素': ['antibiotic', 'penicillin', 'cephalosporin', 'fluoroquinolone', 'macrolide'],
  '止痛': ['pain', 'analgesic', 'nsaid', 'acetaminophen', 'morphine', 'fentanyl', 'tramadol'],
  '降壓': ['antihypertensive', 'acei', 'arb', 'ccb', 'beta blocker', 'diuretic'],
  '降血糖': ['antidiabetic', 'metformin', 'sulfonylurea', 'dpp4i', 'sglti', 'insulin'],
  '胃藥': ['antacid', 'ppi', 'h2ra', 'mucosal protector'],
  '軟便': ['laxative', 'magnesium oxide', 'sennoside', 'lactulose', 'bisacodyl'],
  '抗凝血': ['anticoagulant', 'warfarin', 'noac', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'edoxaban'],
  '類固醇': ['steroid', 'prednisolone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone', 'betamethasone']
};
