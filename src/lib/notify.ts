// Message notifications: in-app toast, optional browser notification, optional soft sound.
const KEY = 'va-notify-sound';

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}
export function browserNotifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}
export function browserNotifyState(): NotificationPermission | 'unsupported' {
  return browserNotifySupported() ? Notification.permission : 'unsupported';
}
export async function askBrowserNotify(): Promise<NotificationPermission | 'unsupported'> {
  if (!browserNotifySupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

let ctx: AudioContext | null = null;
export function chime() {
  if (!soundOn()) return;
  try {
    ctx = ctx || new AudioContext();
    const now = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);
      o.connect(g).connect(ctx!.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.3);
    });
  } catch { /* audio blocked until the user interacts */ }
}

export function showBrowserNotification(title: string, body: string, onClick: () => void) {
  if (!browserNotifySupported() || Notification.permission !== 'granted' || !document.hidden) return;
  // Android only allows notifications through the service worker.
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: '/icon-192.png', badge: '/badge-96.png', tag: 'va-message', data: { url: location.pathname } })).catch(() => {});
    return;
  }
  try {
    const n = new Notification(title, { body, icon: '/icon-192.png', tag: 'va-message' });
    n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* some browsers only allow this from a service worker */ }
}
