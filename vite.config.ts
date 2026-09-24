import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

// 版本號遵循 x.y.z（大.中.小），每次更新都要同步修改 package.json 的 version。
const appVersion: string = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
// 每次 build 都不同，讓「開啟即更新」即使版本號未變也能偵測到新部署。
const buildId = new Date().toISOString();

// 輸出 version.json 供執行中的前端比對是否有新版。
const versionFile = (): Plugin => ({
  name: 'hmss-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({version: appVersion, buildId}),
    });
  },
});

const buildTime = fs.existsSync('.commit-time')
  ? fs.readFileSync('.commit-time', 'utf-8').trim()
  : new Date().toISOString();

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), versionFile()],
    define: {
      // Groq 金鑰由使用者在前端自行設定，不在 build 時注入。
      '__BUILD_TIME__': JSON.stringify(buildTime),
      '__APP_VERSION__': JSON.stringify(appVersion),
      '__BUILD_ID__': JSON.stringify(buildId),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
