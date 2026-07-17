import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import {defineConfig} from 'vite';

const buildTime = fs.existsSync('.commit-time')
  ? fs.readFileSync('.commit-time', 'utf-8').trim()
  : new Date().toISOString();

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      // GROQ_API_KEY 不再注入前端 —— key 改由 Apps Script 後端持有，瀏覽器看不到。
      '__BUILD_TIME__': JSON.stringify(buildTime),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
