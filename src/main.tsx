import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {setupAutoUpdate} from './lib/appUpdate';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' → sw.js 本身不走 HTTP 快取，新版 SW 立即被偵測到。
    navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).catch(error => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}

setupAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
