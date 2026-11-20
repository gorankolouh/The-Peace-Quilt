import { createClient } from '@supabase/supabase-js';
import { DEMO_URL, demoFetch, demoSession } from './demo';

export const DEMO = import.meta.env.VITE_DEMO === '1';

const url = DEMO ? DEMO_URL : (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = DEMO ? 'demo' : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (DEMO) {
  try { localStorage.setItem('sb-demo-auth-token', JSON.stringify(demoSession())); } catch { /* storage unavailable */ }
}

export const configured = Boolean(url && key);
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: !DEMO, detectSessionInUrl: !DEMO },
  global: DEMO ? { fetch: demoFetch } : undefined,
});

if (DEMO) {
  // No live updates in the preview: replace realtime channels with no-ops.
  const fake: any = { on: () => fake, subscribe: () => fake, unsubscribe: async () => 'ok' }; // eslint-disable-line @typescript-eslint/no-explicit-any
  (supabase as any).channel = () => fake; // eslint-disable-line @typescript-eslint/no-explicit-any
  (supabase as any).removeChannel = async () => 'ok'; // eslint-disable-line @typescript-eslint/no-explicit-any
}
