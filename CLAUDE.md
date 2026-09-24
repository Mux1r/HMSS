# HMSS

## 版本號(每次修改都必須遵守)

- 格式 `x.y.z`(大.中.小),來源為 `package.json` 的 `version`,`package-lock.json` 兩處同步修改。
- 每次提交功能或修正都要遞增版本號:
  - 大 `x`:架構或使用方式重大改變(次版號、修訂號歸零)
  - 中 `y`:新增功能(修訂號歸零)
  - 小 `z`:錯誤修正、文字或樣式微調
- 版本號經 `vite.config.ts` 注入為 `__APP_VERSION__`,顯示於控制中心。

## 常用指令

- `npm run lint`:型別檢查
- `npm test`:自我檢查
- `npm run build`:建置(同時輸出 `dist/version.json`,供開啟即更新比對)
