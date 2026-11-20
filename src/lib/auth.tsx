import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './supabase';
import type { Profile } from './types';
import { forgetProfile } from './data';

type AuthState = {
  session: Session | null;
  me: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
const Ctx = createContext<AuthState>({ session: null, me: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(configured);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setMe(null);
      return;
    }
    forgetProfile(s.user.id);
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setMe((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => load(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => load(session), [load, session]);
  return <Ctx.Provider value={{ session, me, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
