// Service worker self-unregistration to prevent routing proxy failures and cached 405 error issues
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then((clients) => {
        clients.forEach((client) => {
          if (client.url && 'navigate' in client) {
            try {
              client.navigate(client.url);
            } catch (err) {
              console.error('Failed to navigate client:', err);
            }
          }
        });
      })
  );
});
