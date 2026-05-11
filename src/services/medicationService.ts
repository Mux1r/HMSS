import { get, set, del } from 'idb-keyval';

const STORAGE_KEY = 'hosp_medications_v2';
const HASH_KEY = 'hosp_medications_hash';
const SYNC_URL_KEY = 'gsheet_sync_url';

const INITIAL_MEDICATIONS: any[] = [];

export interface Medication {
  id: string;
  code: string;
  genericName: string;
  brandName: string;
  chineseName?: string;
  component?: string;
  dosageForm: string;
  anatomicalSystem: string;
  pharmacologicalClass: string;
  indications?: string;
  searchKeywords: string[];
}

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

      // 數據遷移/校正：確保所有項目都有 dosageForm
      return meds.map(m => {
        if (!m.dosageForm) {
          const code = (m.code || m.id || '').toString().trim();
          const dosageForm = code.charAt(0).toUpperCase();
          return { ...m, dosageForm: dosageForm || '?' };
        }
        return m;
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
   * 從 Google Sheets 同步大型資料集
   */
  async fetchFromGoogleSheet(url: string): Promise<{ meds: Medication[], hash: string }> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('雲端連線失敗，請檢查 URL');
      const data = await response.json();
      const rawHash = this.generateHash(data); // 儲存原始資料的雜湊，用於下次對比
      
      if (!Array.isArray(data)) {
        throw new Error('資料格式錯誤: 預期為陣列');
      }

      // 使用 Web Worker 式的非同步處理 (分批次處理，避免阻塞主線程)
      const CHUNK_SIZE = 500;
      const processed: Medication[] = [];
      
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const chunkProcessed = chunk.map((rawItem: any, index: number) => {
          // 清理 Key 名稱
          const item: any = {};
          Object.keys(rawItem).forEach(key => {
            item[key.trim()] = rawItem[key];
          });

          const baseId = (item['藥品碼'] || item.code || `gsheet-${i + index}`).toString().trim();
          const code = (item['藥品碼'] || item.code || '').toString().trim();
          const pharmacologicalClass = (item['藥理分類'] || '').toString().trim();
          const anatomicalSystem = (item['解剖學系統'] || '').toString().trim();
          const dosageForm = code.charAt(0).toUpperCase();
          
          return {
            id: `${baseId}-${index}-${i}`,
            code: code || baseId,
            genericName: (item['學名'] || '').toString().trim(),
            brandName: (item['實際藥名'] || '').toString().trim(),
            chineseName: (item['中文藥名'] || '').toString().trim(),
            component: (item['常用藥名'] || '').toString().trim(),
            dosageForm: dosageForm || '?',
            anatomicalSystem: anatomicalSystem || '未分類系統',
            pharmacologicalClass: pharmacologicalClass || '未分類藥理',
            indications: item['ATC碼'] ? `ATC碼: ${item['ATC碼']}` : (item['適應症'] || ''),
            searchKeywords: [
              code,
              item['學名'], 
              item['實際藥名'], 
              item['中文藥名'], 
              item['常用藥名'],
              item['ATC碼'],
              dosageForm,
              anatomicalSystem,
              pharmacologicalClass
            ].filter(Boolean).map((s: any) => s.toString().toLowerCase().trim().replace(/\s+/g, ''))
          };
        });
        
        processed.push(...chunkProcessed);
        
        // 給予瀏覽器喘息時間 (讓出 CPU)
        if (i + CHUNK_SIZE < data.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      return { meds: processed, hash: rawHash };
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  },

  /**
   * 重置本地資料庫
   */
  async reset() {
    await del(STORAGE_KEY);
    await del(HASH_KEY);
    localStorage.removeItem(SYNC_URL_KEY);
    return [...INITIAL_MEDICATIONS];
  }
};
