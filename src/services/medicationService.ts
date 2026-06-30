import { get, set, del } from 'idb-keyval';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'hosp_medications_v2';
const HASH_KEY = 'hosp_medications_hash';

const INITIAL_MEDICATIONS: any[] = [];

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export interface Medication {
  id: string;
  code: string;
  genericName: string;
  brandName: string;
  chineseName?: string;
  component?: string;
  bagLabelName?: string;
  dosageForm: string;
  anatomicalSystem: string;
  pharmacologicalClass: string;
  indications?: string;
  atcCode?: string;
  atcDi?: string;
  searchKeywords: string[];
  // 臨床安全欄位
  contraindications?: string;
  sideEffects?: string;
  warning?: string;
  dosage?: string;
  dailyMax?: string;
  pregnancySafety?: string;
  content?: string;
  storage?: string;
  nhiCode?: string;
  // 特殊旗標
  controlled?: string;
  highAlert?: string;
  cannotCrush?: string;
  ngCompatible?: string;
  pediatricLiquid?: string;
  beersCriteria?: string;
  avoidG6pd?: string;
  avoidAsthma?: string;
  avoidMyasthenia?: string;
  // 價格
  priceNhi?: number;
  priceRegular?: number;
}

const ATC_SYSTEM: Record<string, string> = {
  A: '消化道及代謝', B: '血液及造血器官', C: '心臟血管系統',
  D: '皮膚科製劑',   G: '泌尿生殖系統及性荷爾蒙', H: '全身性荷爾蒙',
  J: '全身性感染用藥', L: '抗腫瘤及免疫調節劑', M: '肌肉骨骼系統',
  N: '神經系統',    P: '抗寄生蟲藥', R: '呼吸系統', S: '感覺器官', V: '雜項',
};

// ATC 4碼前綴 → 藥理分類（涵蓋院內藥庫實際出現的所有分類）
const ATC_CLASS: Record<string, string> = {
  A01A:'口腔科製劑', A02A:'制酸劑', A02B:'消化性潰瘍用藥', A02X:'其他消化道藥',
  A03A:'消化道解痙劑', A03B:'生物鹼類解痙劑', A03F:'腸蠕動促進劑', A04A:'止吐劑',
  A05A:'膽道治療藥', A05B:'肝臟治療藥', A06A:'瀉藥',
  A07A:'腸道抗感染藥', A07B:'腸道吸附劑', A07D:'腸蠕動抑制劑',
  A07E:'腸道抗炎藥', A07F:'腸道微生物製劑', A07X:'其他腸道藥',
  A08A:'抗肥胖藥', A09A:'消化酵素', A10A:'胰島素及類似物', A10B:'口服降血糖藥',
  A11B:'維生素B群複方', A11C:'維生素A及D', A11D:'維生素B1',
  A11E:'維生素B複方', A11G:'維生素C', A11H:'其他維生素',
  A12A:'鈣製劑', A12B:'鉀製劑', A12C:'其他礦物質補充劑', A16A:'其他代謝藥',
  B01A:'抗血栓藥', B02A:'抗纖溶藥', B02B:'維生素K及止血藥',
  B03A:'鐵製劑', B03B:'維生素B12及葉酸', B03X:'其他抗貧血藥',
  B05A:'血液及相關製品', B05B:'靜脈輸液', B05C:'沖洗溶液',
  B05D:'腹膜透析液', B05X:'靜脈添加劑', B05Z:'血液透析液', B06A:'其他血液製品',
  C01A:'強心苷', C01B:'抗心律不整藥', C01C:'心臟刺激劑',
  C01D:'血管擴張劑（心臟）', C01E:'其他心臟製劑',
  C02A:'中樞性降壓藥', C02C:'周邊腎上腺素拮抗劑',
  C02D:'直接平滑肌鬆弛劑', C02K:'其他降壓藥',
  C03A:'噻嗪類利尿劑', C03B:'低效利尿劑', C03C:'高效利尿劑（袢利尿劑）',
  C03D:'保鉀利尿劑', C03E:'利尿劑複方', C03X:'其他利尿劑',
  C04A:'周邊血管擴張劑', C05A:'痔瘡用藥（外用）',
  C05B:'抗靜脈曲張藥', C05C:'微血管穩定劑',
  C07A:'β阻斷劑', C08C:'二氫吡啶類鈣離子拮抗劑',
  C08D:'苯烷基胺類鈣離子拮抗劑', C09A:'ACE抑制劑',
  C09B:'ACE抑制劑複方', C09C:'血管收縮素II拮抗劑（ARB）',
  C09D:'ARB複方', C10A:'降血脂藥', C10B:'降血脂複方',
  D01A:'外用抗黴菌藥', D01B:'全身性抗黴菌藥', D02A:'皮膚保護劑',
  D03A:'傷口癒合製劑', D04A:'外用麻醉藥', D05A:'牛皮癬外用製劑',
  D05B:'全身性牛皮癬用藥', D06A:'外用抗生素', D06B:'外用化療藥',
  D07A:'外用皮質類固醇', D07C:'皮質類固醇複方（抗感染）',
  D07X:'其他皮質類固醇複方', D08A:'消毒防腐藥',
  D10A:'痤瘡外用製劑', D10B:'全身性痤瘡用藥', D11A:'其他皮膚科製劑',
  G01A:'泌尿生殖道抗感染藥', G02A:'催產素', G02C:'其他婦科用藥',
  G03A:'荷爾蒙避孕藥', G03B:'雄性素', G03C:'雌激素', G03D:'黃體素',
  G03F:'黃體素與雌激素複方', G03G:'促性腺激素',
  G03H:'抗雄性素', G03X:'其他性荷爾蒙',
  G04B:'泌尿科製劑', G04C:'攝護腺肥大用藥（α阻斷劑/5α還原酶抑制劑）',
  H01A:'腦下垂體前葉荷爾蒙', H01B:'腦下垂體後葉荷爾蒙',
  H01C:'下視丘荷爾蒙', H02A:'全身性皮質類固醇',
  H03A:'甲狀腺製劑', H03B:'抗甲狀腺藥', H03C:'碘製劑',
  H04A:'升糖素', H05A:'副甲狀腺荷爾蒙', H05B:'抗副甲狀腺藥',
  J01A:'四環黴素類', J01C:'青黴素類', J01D:'頭孢子菌素類',
  J01E:'磺胺類及甲氧苄啶', J01F:'大環內酯及林可黴素類',
  J01G:'胺基醣苷類', J01M:'氟喹諾酮類', J01X:'其他抗菌藥',
  J02A:'全身性抗黴菌藥', J04A:'抗結核藥', J04B:'抗痲瘋藥',
  J05A:'抗病毒藥', J06A:'免疫血清', J06B:'免疫球蛋白',
  J07A:'細菌疫苗', J07B:'病毒疫苗', J07C:'細菌及病毒混合疫苗',
  L01A:'烷化劑', L01B:'抗代謝藥（抗腫瘤）',
  L01C:'植物鹼類抗腫瘤藥', L01D:'抗腫瘤抗生素', L01E:'蛋白激酶抑制劑',
  M01A:'非類固醇抗炎藥（NSAIDs）', M01C:'特定抗風濕藥',
  M02A:'外用抗炎藥', M03A:'肌肉鬆弛劑（周邊作用）',
  M03B:'肌肉鬆弛劑（中樞作用）', M04A:'抗痛風藥', M05B:'骨質疏鬆藥',
  N01A:'全身麻醉藥', N01B:'局部麻醉藥', N02A:'鴉片類鎮痛藥',
  N02B:'非鴉片類鎮痛藥', N02C:'偏頭痛用藥', N03A:'抗癲癇藥',
  N04A:'抗膽鹼藥（巴金森）', N04B:'多巴胺類藥（巴金森）',
  N05A:'抗精神病藥', N05B:'抗焦慮藥', N05C:'催眠鎮靜藥',
  N06A:'抗憂鬱藥', N06B:'精神刺激劑（ADHD）', N06C:'精神科複方',
  N06D:'失智症用藥', N07A:'副交感神經藥', N07B:'成癮治療藥',
  N07X:'其他神經系統藥',
  P01A:'腸道原蟲感染用藥', P01B:'抗瘧疾藥', P02A:'驅絛蟲藥',
  P02B:'驅線蟲藥', P02C:'驅其他蠕蟲藥', P03A:'疥癬用藥',
  R01A:'鼻腔減充血劑', R01B:'口服鼻腔減充血劑', R02A:'咽喉製劑',
  R03A:'β2交感神經興奮劑（吸入）', R03B:'其他呼吸道吸入藥',
  R03C:'β2交感神經興奮劑（全身）', R03D:'其他全身性呼吸道用藥',
  R05C:'袪痰藥', R05D:'止咳藥', R06A:'全身性抗組織胺',
  S01A:'眼科抗感染藥', S01B:'眼科抗炎藥', S01C:'眼科抗炎抗感染複方',
  S01E:'青光眼用藥', S01G:'眼科減充血及抗過敏藥',
  S01H:'眼科局部麻醉藥', S01J:'眼科診斷用藥', S01K:'眼科手術輔助藥',
  S01L:'眼科血管新生抑制藥', S01X:'其他眼科製劑',
  S02A:'耳科抗感染藥', S02B:'耳科皮質類固醇', S02C:'耳科複方',
  S03A:'眼耳科抗感染藥', V03A:'解毒劑', V04C:'其他診斷用藥',
  V06D:'其他營養製劑', V07A:'其他非治療製劑', V08A:'X光顯影劑',
  V09C:'腎臟閃爍顯影劑', V10X:'其他治療性放射性藥物',
};

const mapSupabaseRow = (row: any): Medication => {
  const code = (row.code || '').toString().trim();
  const dosageForm = row.dosage_form || code.charAt(0).toUpperCase() || '?';
  const atcCode = (row.atc_code || '').toString().trim().toUpperCase();
  const atc4 = atcCode.slice(0, 4);
  const anatomicalSystem = row.anatomical_system || ATC_SYSTEM[atcCode[0]] || '未分類系統';
  const pharmacologicalClass = ATC_CLASS[atc4] || '未分類藥理';
  return {
    id: row.id || code,
    code,
    genericName: row.generic_name || '',
    brandName: row.brand_name || '',
    chineseName: row.chinese_name || '',
    component: row.component || '',
    bagLabelName: row.bag_label_name || '',
    dosageForm,
    anatomicalSystem,
    pharmacologicalClass,
    indications: row.indications || (atcCode ? `ATC碼: ${atcCode}` : ''),
    atcCode,
    atcDi: row.atc_di || '',
    contraindications: row.contraindications || '',
    sideEffects: row.side_effects || '',
    warning: row.warning || '',
    dosage: row.dosage || '',
    dailyMax: row.daily_max || '',
    pregnancySafety: row.pregnancy_safety || '',
    content: row.content || '',
    storage: row.storage || '',
    nhiCode: row.nhi_code || '',
    controlled: row.controlled || '',
    highAlert: row.high_alert || '',
    cannotCrush: row.cannot_crush || '',
    ngCompatible: row.ng_compatible || '',
    pediatricLiquid: row.pediatric_liquid || '',
    beersCriteria: row.beers_criteria || '',
    avoidG6pd: row.avoid_g6pd || '',
    avoidAsthma: row.avoid_asthma || '',
    avoidMyasthenia: row.avoid_myasthenia || '',
    priceNhi: row.price_nhi ?? undefined,
    priceRegular: row.price_regular ?? undefined,
    searchKeywords: [
      code, row.generic_name, row.brand_name, row.chinese_name,
      row.component, row.bag_label_name, atcCode, dosageForm,
      anatomicalSystem, pharmacologicalClass,
    ].filter(Boolean).map((s: any) => s.toString().toLowerCase().trim().replace(/\s+/g, '')),
  };
};

export const localMedicationService = {
  /**
   * 獲取所有藥物資料 (從 IndexedDB)
   */
  async getAll(): Promise<Medication[]> {
    try {
      const stored = await get(STORAGE_KEY);
      let meds: Medication[] = [];
      
      if (stored && Array.isArray(stored)) {
        meds = stored;
      } else {
        meds = INITIAL_MEDICATIONS;
      }

      // 數據遷移/校正：確保所有項目都有 dosageForm 與 atcCode
      return meds.map(m => {
        let next = m;
        if (!next.dosageForm) {
          const code = (next.code || next.id || '').toString().trim();
          const dosageForm = code.charAt(0).toUpperCase();
          next = { ...next, dosageForm: dosageForm || '?' };
        }
        // 舊快取沒有結構化 atcCode → 從 indications 已存的「ATC碼: XXX」補回，
        // 使既有使用者不必重新同步即可使用 ATC 比對。
        if (!next.atcCode && next.indications) {
          const match = next.indications.match(/ATC碼:\s*([A-Z0-9]+)/i);
          if (match) next = { ...next, atcCode: match[1].toUpperCase() };
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to get stored medications:', e);
      return INITIAL_MEDICATIONS;
    }
  },

  /**
   * 儲存所有藥物資料到 IndexedDB
   */
  async saveAll(meds: Medication[], customHash?: string) {
    try {
      await set(STORAGE_KEY, meds);
      const hash = customHash || this.generateHash(meds);
      await set(HASH_KEY, hash);
    } catch (e) {
      console.error('Failed to save medications:', e);
      throw e;
    }
  },

  generateHash(data: any): string {
    // 簡單的雜湊生成，用於檢查版本
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36) + str.length;
  },

  /**
   * 檢查是否有更新
   */
  async checkForUpdates(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      const data = await response.json();
      const newHash = this.generateHash(data);
      const currentHash = await get(HASH_KEY);
      return currentHash !== newHash;
    } catch (e) {
      return false;
    }
  },

  /**
   * 取得 Supabase 目前筆數（HEAD request，不傳資料，極快）
   */
  async getSupabaseCount(): Promise<number> {
    const { count } = await supabase.from('medications').select('id', { count: 'exact', head: true });
    return count ?? 0;
  },

  /**
   * 從 Supabase 同步（含豐富欄位），自動分頁處理大型資料集
   */
  async fetchFromSupabase(): Promise<{ meds: Medication[], hash: string }> {
    const PAGE = 1000;
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .range(from, from + PAGE - 1)
        .order('code');
      if (error) throw new Error(`Supabase 連線失敗: ${error.message}`);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    const meds = all.map(mapSupabaseRow);
    return { meds, hash: this.generateHash(all) };
  },

  /**
   * 重置本地資料庫
   */
  async reset() {
    await del(STORAGE_KEY);
    await del(HASH_KEY);
    return [...INITIAL_MEDICATIONS];
  }
};
