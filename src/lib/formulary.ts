/**
 * AI 用藥建議的純函式：ATC 比對、成分名比對、建議輸出解析。
 * 抽到獨立檔案是為了可被 node 自我檢查腳本直接 import（不牽動 React）。
 */

/**
 * ATC 比對：院內 ATC 是否對應 AI 給的 ATC 碼。
 * 規則：相等，或 AI 碼 >=5 碼且為院內碼之子字串（涵蓋合併製劑的多碼儲存格）。
 * ponytail: 子字串/前綴比對，名稱後備涵蓋粒度誤差（3-4 碼群組層級）。
 */
export function atcMatches(formularyAtc: string | undefined, aiAtc: string): boolean {
  const f = (formularyAtc || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const a = (aiAtc || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!f || !a) return false;
  if (f === a) return true;
  // AI 碼是院內碼的前綴（AI 給群組碼），或院內碼是 AI 碼的前綴（院內存群組碼）
  return (a.length >= 5 && f.includes(a)) || (f.length >= 5 && a.includes(f));
}

/**
 * 病患描述是否為兒科情境（決定是否允許推薦口服液劑/藥水）。
 * ponytail: 關鍵字 + 簡單年齡解析（≤12 歲或以月大描述）；無結構化年齡時以關鍵字為準。
 */
export function isPediatricContext(text: string): boolean {
  const s = text || "";
  if (/兒科|小兒|小孩|孩童|兒童|嬰|幼兒|新生兒|學齡|p[ae]diatric|\bchild\b|\binfant\b|\bneonat/i.test(s)) {
    return true;
  }
  const yr = s.match(/(\d+)\s*歲/);
  if (yr && Number(yr[1]) <= 12) return true;
  if (/(\d+)\s*個?月大/.test(s)) return true;
  return false;
}

const ATC_RE = /^[A-Z]\d{2}[A-Z]{0,2}\d{0,2}$/;
/** 字串是否長得像 ATC 碼（用於樣式判斷欄位）。 */
export function looksLikeAtc(s: string): boolean {
  return ATC_RE.test((s || "").trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// 成分名比對（AI 建議 → 院內藥庫）：只接受明確規則，不做模糊相似度猜測。
// ---------------------------------------------------------------------------

// 同藥異名（美國名 USAN ↔ 國際名 INN 等）。每組第一個為標準名；
// 名稱須為 normalizeIngredient 處理後的形式（小寫、已去鹽類、-ic acid 已轉 -ate）。
export const DRUG_SYNONYMS: string[][] = [
  ["acetaminophen", "paracetamol"],
  ["albuterol", "salbutamol"],
  ["levalbuterol", "levosalbutamol"],
  ["epinephrine", "adrenaline"],
  ["norepinephrine", "noradrenaline"],
  ["isoproterenol", "isoprenaline"],
  ["glyburide", "glibenclamide"],
  ["meperidine", "pethidine"],
  ["lidocaine", "lignocaine"],
  ["cyclosporine", "ciclosporin"],
  ["rifampin", "rifampicin"],
  ["acyclovir", "aciclovir"],
  ["valacyclovir", "valaciclovir"],
  ["cephalexin", "cefalexin"],
  ["mesalamine", "mesalazine"],
  ["furosemide", "frusemide"],
  ["torsemide", "torasemide"],
  ["nitroglycerin", "glyceryl trinitrate"],
  ["phytonadione", "phytomenadione", "vitamin k1"],
  ["chlorpheniramine", "chlorphenamine"],
  ["guaifenesin", "guaiphenesin"],
  ["beclomethasone", "beclometasone"],
  ["sulfasalazine", "sulphasalazine"],
  ["metamizole", "dipyrone"],
  ["tetracaine", "amethocaine"],
  ["cromolyn", "cromoglicate", "cromoglycate"],
  ["aspirin", "acetylsalicylate"],
  ["glucose", "dextrose"],
  ["amoxicillin clavulanate", "co amoxiclav"],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SYNONYM_RULES: [RegExp, string][] = DRUG_SYNONYMS.flatMap(([canonical, ...aliases]) =>
  aliases.map((alias) => [new RegExp(`\\b${escapeRe(alias)}\\b`, "g"), canonical] as [RegExp, string]),
);

const SALT_RE =
  /\s*\b(hydrochloride|hcl|sodium|chloride|sulfate|sulphate|maleate|tartrate|fumarate|acetate|phosphate|bromide|mesylate|besylate|monohydrate|dihydrate|potassium|calcium)\b/g;

/**
 * 成分名正規化：小寫、去括號註記、複方分隔符轉空白、去劑量、-ic acid → -ate、去鹽類、同藥異名轉標準名。
 * 若去鹽後為空（如 Sodium Chloride），保留去鹽前的字串，兩側一致即可比對。
 */
export function normalizeIngredient(raw: string): string {
  const base = (raw || "")
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, " ")
    .replace(/[/＋+,&]|\s-\s|(?<=[a-z])-(?=[a-z])/g, " ")
    .replace(/(?<![a-z])\d[\d.,]*\s*(%|mg|mcg|µg|g|ml|iu|units?|meq|mmol)?(?![a-z])/g, " ")
    .replace(/\b([a-z]+)ic acid\b/g, "$1ate")
    .replace(/\s+/g, " ")
    .trim();
  const stripped = base.replace(SALT_RE, "").replace(/\s+/g, " ").trim() || base;
  let out = stripped;
  for (const [re, canonical] of SYNONYM_RULES) out = out.replace(re, canonical);
  return out;
}

/** 院內品項的任一名稱欄位是否與 AI 建議成分為同一成分（含複方包含關係）。 */
export function ingredientMatches(fields: (string | undefined)[], ingredient: string): boolean {
  const q = normalizeIngredient(ingredient);
  if (!q) return false;
  return fields.some((raw) => {
    const f = normalizeIngredient(raw || "");
    return !!f && (f === q || f.includes(q) || (f.length > 4 && q.includes(f)));
  });
}

// ---------------------------------------------------------------------------
// AI 用藥建議輸出：每行一個 JSON 物件（NDJSON），可邊串流邊解析。
// ---------------------------------------------------------------------------

export type DrugTier = "首選" | "替代";

export interface DrugRec {
  name: string;
  zh: string;
  route: string;
  atc: string;
  tier: DrugTier;
  reason: string;
}

export interface RecGroup {
  problem: string;
  drugs: DrugRec[];
  advice: string[];
}

export interface Recommendation {
  summary: string[];
  groups: RecGroup[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * 解析 AI 回傳的 NDJSON。無法解析的行（未完成的串流行、```、說明文字）一律略過。
 * 藥物/建議若出現在任何「problem」之前，歸入「整體建議」群組。
 */
export function parseRecommendation(text: string): Recommendation {
  const summary: string[] = [];
  const groups: RecGroup[] = [];
  const current = (): RecGroup => {
    if (groups.length === 0) groups.push({ problem: "整體建議", drugs: [], advice: [] });
    return groups[groups.length - 1];
  };

  for (const rawLine of (text || "").split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line.startsWith("{")) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    switch (obj?.type) {
      case "summary": {
        const t = str(obj.text);
        if (t) summary.push(t);
        break;
      }
      case "problem": {
        const name = str(obj.name);
        if (name) groups.push({ problem: name, drugs: [], advice: [] });
        break;
      }
      case "advice": {
        const t = str(obj.text);
        if (t) current().advice.push(t);
        break;
      }
      case "drug": {
        const name = str(obj.name);
        if (!name) break;
        const atc = str(obj.atc).toUpperCase();
        current().drugs.push({
          name,
          zh: str(obj.zh),
          route: str(obj.route),
          atc: looksLikeAtc(atc) && atc.length >= 5 ? atc : "",
          tier: str(obj.tier) === "替代" ? "替代" : "首選",
          reason: str(obj.reason),
        });
        break;
      }
    }
  }
  return { summary, groups };
}
