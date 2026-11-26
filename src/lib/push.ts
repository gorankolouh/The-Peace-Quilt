// Push notifications on this device (Web Push). Opt-in only; nothing is sent until the person turns it on.
import { DEMO, supabase } from './supabase';

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (reg) return reg;
  if (DEMO || !('serviceWorker' in navigator)) return (reg = Promise.resolve(null));
  reg = navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
  return reg;
}

const b64ToBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const r = await registerServiceWorker();
  return r ? r.pushManager.getSubscription() : null;
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc('save_push_subscription', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
  if (error) throw new Error(error.message);
}

export async function enablePush(): Promise<'on' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const r = await registerServiceWorker();
  if (!r) return 'unsupported';
  await navigator.serviceWorker.ready;
  let sub = await r.pushManager.getSubscription();
  if (!sub) {
    const { data, error } = await supabase.functions.invoke('push', { body: { action: 'public_key' } });
    if (error || !data?.key) throw new Error('Push notifications are not set up on the server yet.');
    sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.key) });
  }
  await save(sub);
  return 'on';
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** After signing in on a device that already had push on, attach it to the current account. */
export async function refreshPushOwner() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) await save(sub);
  } catch { /* not critical */ }
}

// "Install app" prompt (Android Chrome, desktop Chrome and Edge).
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}
export const canInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export async function installApp() {
  if (!deferred) return false;
  await deferred.prompt();
  const r = await deferred.userChoice;
  deferred = null; listeners.forEach((f) => f());
  return r.outcome === 'accepted';
}
export const isInstalled = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
