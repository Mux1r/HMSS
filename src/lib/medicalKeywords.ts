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

// 症狀/病名詞：查詢含其中任一詞 → 視為症狀查詢，AI 輔助查詢按鈕改為醒目樣式（App.tsx 查詢分流），
// 即使剛好也出現在某顆藥的名稱裡（如「感冒」之於感冒糖漿）。
// 只放中文：較長的詞用「包含」比對，「偏頭痛」「我喉嚨痛」都會命中「頭痛」「喉嚨痛」。
export const SYMPTOM_TERMS: string[] = [
  // 全身
  '發燒', '發熱', '退燒', '畏寒', '疲倦', '倦怠', '水腫', '體重減輕',
  // 疼痛
  '疼痛', '止痛', '頭痛', '偏頭痛', '牙痛', '喉嚨痛', '咽喉痛', '胸痛', '腹痛', '胃痛', '肚子痛',
  '背痛', '腰痛', '關節痛', '肌肉痛', '經痛', '神經痛', '痠痛', '酸痛',
  // 呼吸道、耳鼻喉
  '感冒', '流感', '咳嗽', '乾咳', '有痰', '化痰', '鼻塞', '流鼻水', '打噴嚏', '鼻炎', '鼻竇炎',
  '喉嚨', '咽喉炎', '扁桃腺炎', '氣喘', '哮喘', '喘鳴', '呼吸困難', '肺炎', '支氣管炎', '中耳炎', '耳鳴',
  // 腸胃
  '噁心', '嘔吐', '想吐', '暈車', '腹瀉', '拉肚子', '便秘', '脹氣', '消化不良', '胃酸', '火燒心',
  '胃食道逆流', '胃潰瘍', '十二指腸潰瘍', '腸胃炎', '痔瘡', '口破', '口腔潰瘍', '嘴破',
  // 皮膚、過敏、眼
  '過敏', '蕁麻疹', '皮膚癢', '搔癢', '濕疹', '皮膚炎', '青春痘', '痤瘡', '香港腳', '足癬', '灰指甲',
  '燙傷', '傷口', '紅眼', '結膜炎', '乾眼', '眼睛癢',
  // 神經、精神
  '失眠', '睡不著', '躁動', '譫妄', '焦慮', '憂鬱', '頭暈', '暈眩', '眩暈', '癲癇', '抽搐', '失智', '帕金森',
  // 心血管、代謝
  '高血壓', '低血壓', '心悸', '心律不整', '心房顫動', '心衰竭', '心絞痛', '心肌梗塞', '中風',
  '高血脂', '膽固醇', '糖尿病', '高血糖', '低血糖', '低血鉀', '高血鉀', '痛風', '尿酸', '甲狀腺', '貧血', '骨質疏鬆',
  // 泌尿、婦科
  '頻尿', '尿失禁', '尿道炎', '膀胱炎', '泌尿道感染', '攝護腺肥大', '前列腺肥大', '陰道炎', '月經不順', '更年期',
  // 感染
  '感染', '發炎', '細菌感染', '黴菌感染', '病毒感染', '帶狀皰疹', '皰疹', '蜂窩性組織炎',
];

// 值班症狀 → 圖譜裡適應症實際的寫法（2026-10-13 逐一查過圖上有這些概念、且有接藥）。
// 適應症多寫病名，症狀直接查會對不上（抽搐查不到抗癲癇藥）；查圖譜時把這些詞附在查詢後面一起送。
export const SYMPTOM_INDICATIONS: Record<string, string[]> = {
  '抽搐': ['癲癇'],
  '心悸': ['心律不整', '心搏過速'],
  '胸痛': ['狹心症', '心絞痛'],
  '胃痛': ['胃潰瘍', '消化性潰瘍', '胃炎', '胃酸過多'],
  '發燒': ['解熱', '退燒'],
  '發熱': ['解熱', '退燒'],
  '咳嗽': ['鎮咳'],
  '乾咳': ['鎮咳'],
  '鼻塞': ['過敏性鼻炎'],
  '流鼻水': ['過敏性鼻炎'],
  '打噴嚏': ['過敏性鼻炎'],
  '頭暈': ['眩暈'],
  '暈眩': ['眩暈'],
  '低血鉀': ['鉀缺乏症'],
  '低血糖': ['升糖'],
};

/** 圖譜查詢字串：原查詢後面附上對照到的適應症用詞（去重）。 */
export function kgQueryText(query: string): string {
  const extra = Object.entries(SYMPTOM_INDICATIONS)
    .filter(([k]) => query.includes(k))
    .flatMap(([, v]) => v)
    .filter((t) => !query.includes(t));
  return [query, ...new Set(extra)].join(' ');
}

/** 實際送給 kg-search 的字串（App 與 scripts/kg-eval.ts 共用）：
 *  適應症用詞之外，再附上整理過的機轉縮寫（「Cox 2」→「cox2」），讓圖上機轉類別的縮寫別名能字面命中。 */
export function kgRequestText(query: string): string {
  const key = mechanismKey(query);
  const text = kgQueryText(query);
  return key && key !== query.toLowerCase() ? `${text} ${key}` : text;
}

// 高低方向相反的概念：向量比對分不太出「低血鉀」和「高血鉀症」，查低的要把高的濾掉，反之亦然。
// 「降低血壓」「升高血糖」是動詞不是狀態，排除（降低血壓要的正是高血壓藥）。
const LEVEL_TARGETS = ['鉀', '鈉', '鈣', '鎂', '磷', '糖', '壓'];
const levelIn = (text: string, dir: '低' | '高', t: string) =>
  new RegExp(`(?<!${dir === '低' ? '降' : '升'})${dir}血?${t}`).test(text);

/** 概念與查詢的高低方向相反（查低血鉀、概念是高血鉀症）→ true。 */
export function isOppositeLevel(query: string, concept: string): boolean {
  return LEVEL_TARGETS.some(
    (t) =>
      (levelIn(query, '低', t) && !levelIn(query, '高', t) && levelIn(concept, '高', t)) ||
      (levelIn(query, '高', t) && !levelIn(query, '低', t) && levelIn(concept, '低', t)),
  );
}

/** 查詢含任一症狀/病名詞即為症狀查詢。 */
export function isSymptomQuery(query: string): boolean {
  const q = query.trim();
  return q.length >= 2 && SYMPTOM_TERMS.some((t) => q.includes(t));
}
