import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setLoading(false);
        return;
      }
      // Auto-sign-in anonymously so per-user persistence works without a login flow.
      try {
        const { data: anon } = await supabase.auth.signInAnonymously();
        setSession(anon.session ?? null);
        setUser(anon.user ?? null);
      } catch {
        /* ignore – app still functions with localStorage only */
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  return { session, user, loading, signOut };
}
