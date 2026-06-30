/**
 * AI 用藥建議的純函式：ATC 比對與藥物行解析。
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

export interface ParsedDrugLine {
  ingredient: string;
  route: string;
  atc: string;
  reason: string;
}

/**
 * 解析 AI 藥物行（樣式判斷、非欄位位置）：
 * 以「|」切分；首欄＝成分；符合 ATC 樣式的欄＝atc；
 * 短且 isRoute 為真的欄＝途徑；其餘＝理由。
 * @param isRoute 判斷字串是否為給藥途徑（由呼叫端傳入 normalizeRoute 包裝）。
 */
export function parseDrugLine(
  line: string,
  isRoute: (s: string) => boolean,
): ParsedDrugLine {
  const cleaned = line
    .replace(/^\s*(\d+[.、)]|\*|-|•)\s*/, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/【([^】]+)】/g, "$1")
    .trim();
  const segs = cleaned
    .split(/\s*[|｜]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ingredient = segs[0] || "";
  let route = "";
  let atc = "";
  const reasonParts: string[] = [];
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    if (!atc && looksLikeAtc(s)) atc = s.toUpperCase();
    else if (!route && s.length <= 5 && isRoute(s)) route = s;
    else reasonParts.push(s);
  }
  return { ingredient, route, atc, reason: reasonParts.join(" ") };
}
