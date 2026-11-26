// Verum Agora service worker: shows push notifications and opens the right page when tapped.
// It does not cache pages or data, so nothing personal is stored on the device by it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Verum Agora';
  event.waitUntil((async () => {
    // Skip the system notification if the app is already open and visible on that page.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const here = wins.some((w) => w.visibilityState === 'visible' && d.url && new URL(w.url).pathname === d.url);
    if (here) return;
    await self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: d.tag || 'va',
      renotify: true,
      data: { url: d.url || '/notifications' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) { await w.focus(); w.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
