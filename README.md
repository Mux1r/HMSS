# HMSS 醫院藥物查詢系統

院內藥物查詢 PWA:依藥品碼、學名、商品名、中文名、適應症、機轉縮寫(acei、statin、ppi…)搜尋院內藥庫,並提供 AI 症狀分析與用藥建議(比對院內實際品項)。資料存於 IndexedDB,可離線使用、可安裝到主畫面。

## 技術

- React 19 + Vite + Tailwind CSS v4
- 藥品資料:Supabase(前端以 anon key 讀取,首次載入後快取於本地)
- AI:Groq `openai/gpt-oss-120b`,使用者自備免費金鑰(App 內有逐步設定引導),金鑰只存在使用者瀏覽器,由前端直連 Groq

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

## 版本號

採 `x.y.z`(大.中.小)語意化版本,**每次更新都要修改** `package.json` 的 `version`(並同步 `package-lock.json`):

| 位數 | 何時遞增 | 範例 |
|---|---|---|
| 大 `x` | 架構或使用方式有重大改變 | 改為使用者自備 AI 金鑰 |
| 中 `y` | 新增功能 | 新增一種搜尋方式 |
| 小 `z` | 錯誤修正、文字或樣式微調 | 修正比對錯誤 |

版本號顯示於「控制中心」底部。

## 部署

Push 到 `main` 即由 GitHub Actions 自動建置並部署到 GitHub Pages(Supabase 環境變數設定於 repo secrets)。

每次 build 會產出 `version.json`;App 啟動及每次回到前景時比對,有新部署就自動重新載入(開啟即更新)。
