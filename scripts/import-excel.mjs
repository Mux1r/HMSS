/**
 * 一次性 Excel → Supabase 匯入工具（對應 dglist.xlsx 欄位）
 * 用法：node scripts/import-excel.mjs <dglist.xlsx>
 * 需要環境變數：SUPABASE_URL、SERVICE_ROLE_KEY
 */

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const XLSX = await import('xlsx').catch(() => {
  console.error('請先安裝：npm install --save-dev xlsx');
  process.exit(1);
});

// ATC 碼第一碼 → 解剖學系統（WHO ATC 分類）
const ATC_SYSTEM = {
  A: '消化道及代謝', B: '血液及造血器官', C: '心臟血管系統',
  D: '皮膚科製劑',   G: '泌尿生殖系統及性荷爾蒙', H: '全身性荷爾蒙',
  J: '全身性感染用藥', L: '抗腫瘤及免疫調節劑', M: '肌肉骨骼系統',
  N: '神經系統',    P: '抗寄生蟲藥', R: '呼吸系統', S: '感覺器官', V: '雜項',
};

// trim + 將空白/星號轉為 null
const clean = v => {
  const s = v == null ? '' : v.toString().trim();
  return (s === '' || s === '*') ? null : s;
};

const { SUPABASE_URL, SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('需要環境變數 SUPABASE_URL 和 SERVICE_ROLE_KEY');
  process.exit(1);
}
const filePath = process.argv[2];
if (!filePath) {
  console.error('用法：node scripts/import-excel.mjs <dglist.xlsx>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const workbook = XLSX.read(await readFile(filePath));
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

console.log(`讀取到 ${rows.length} 筆資料，開始匯入...`);

const mapped = rows.map((r, i) => {
  const code  = (r['藥品編碼'] ?? '').toString().trim();
  const atc   = clean(r['ATC碼'])?.toUpperCase() ?? null;
  const first = atc?.[0] ?? '';
  return {
    // PK：藥品編碼去空白；若重複加索引確保唯一
    id:                    code || `row-${i}`,
    code,
    dosage_form:           code.charAt(0).toUpperCase() || '?',
    generic_name:          clean(r['藥理學名']),
    component:             clean(r['常用商品']),
    brand_name:            clean(r['實際商品']),
    bag_label_name:        clean(r['藥袋學名']),
    chinese_name:          clean(r['中文商品名']),
    atc_code:              atc,
    atc_di:                clean(r['ATC-DI']),
    pharmacological_class: clean(r['藥理分類']),
    anatomical_system:     ATC_SYSTEM[first] ?? '未分類系統',
    content:               clean(r['含量劑型']),
    nhi_code:              clean(r['健保代碼']),
    pregnancy_safety:      clean(r['孕婦安全']),
    controlled:            clean(r['管制藥品']),
    high_alert:            clean(r['高警訊藥']),
    dosage:                clean(r['服法指示']),
    daily_max:             clean(r['日最大量']),
    indications:           clean(r['臨床用途']),
    side_effects:          clean(r['不良反應']),
    contraindications:     clean(r['注意事項']),
    warning:               clean(r['警示標語']),
    storage:               clean(r['保存條件']),
    cannot_crush:          clean(r['不可磨粉']),
    ng_compatible:         clean(r['管灌可用']),
    pediatric_liquid:      clean(r['兒科液劑']),
    beers_criteria:        clean(r['符Beers']),
    avoid_g6pd:            clean(r['避蠶豆症']),
    avoid_asthma:          clean(r['避氣喘']),
    avoid_myasthenia:      clean(r['避重肌無力症']),
    price_nhi:             r['健保費'] != null ? Number(r['健保費']) || null : null,
    price_regular:         r['一般價'] != null ? Number(r['一般價']) || null : null,
  };
}).filter(r => r.code); // 跳過藥品編碼為空的列

console.log(`有效資料：${mapped.length} 筆`);

const BATCH = 500;
let done = 0;
for (let i = 0; i < mapped.length; i += BATCH) {
  const { error } = await supabase.from('medications').upsert(mapped.slice(i, i + BATCH));
  if (error) { console.error('匯入失敗：', error.message); process.exit(1); }
  done += Math.min(BATCH, mapped.length - i);
  console.log(`進度：${done}/${mapped.length}`);
}

console.log(`✅ 完成！共匯入 ${done} 筆藥品資料`);
