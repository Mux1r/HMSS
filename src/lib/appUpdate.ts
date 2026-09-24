// 開啟即更新：啟動時與每次回到前景都比對伺服器上的 version.json，
// 有新部署就更新 Service Worker 並重新載入，確保使用者總是用到最新版。

const RELOAD_GUARD = "hmss_reloaded_for";

async function checkForUpdate() {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { buildId } = await res.json();
    if (!buildId || buildId === __BUILD_ID__) return;

    // 同一個新版本只重載一次，避免快取異常時無限重整。
    if (sessionStorage.getItem(RELOAD_GUARD) === buildId) return;
    sessionStorage.setItem(RELOAD_GUARD, buildId);

    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    window.location.reload();
  } catch {
    // 離線或版本檔不存在時略過，不影響使用。
  }
}

export function setupAutoUpdate() {
  if (import.meta.env.DEV) return;
  checkForUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}
