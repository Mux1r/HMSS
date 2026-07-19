# HMSS 醫院藥物查詢系統

院內藥物查詢 PWA:依藥品碼、學名、商品名、中文名、適應症、機轉縮寫(acei、statin、ppi…)搜尋院內藥庫,並提供 AI 症狀分析與用藥建議(比對院內實際品項)。資料存於 IndexedDB,可離線使用、可安裝到主畫面。

## 技術

- React 19 + Vite + Tailwind CSS v4
- 藥品資料:Supabase(前端以 anon key 讀取,首次載入後快取於本地)
- AI:Groq(經 Apps Script 代理呼叫,API key 存於後端,前端不含任何金鑰)

## 本地開發

```bash
npm install
cp .env.example .env.local   # 填入 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

```bash
npm run lint   # tsc --noEmit
npm test       # node 自我檢查(formulary / medicalKeywords)
npm run build  # 產出 dist/
```

## 資料匯入

一次性將 `dglist.xlsx` 匯入 Supabase(需 service_role key):

```bash
SUPABASE_URL=... SERVICE_ROLE_KEY=... node scripts/import-excel.mjs dglist.xlsx
```

## 部署

Push 到 `main` 即由 GitHub Actions 自動建置並部署到 GitHub Pages(Supabase 環境變數設定於 repo secrets)。
