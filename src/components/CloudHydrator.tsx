import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Keys we mirror into cloud for a signed-in user. */
const CHART_KEY = 'chartsView.state.v1';
const BACKING_KEY = 'mf-backing-tracks';

type Snapshot = {
  user_id: string;
  charts_data: unknown;
  backing_tracks_data: unknown;
  updated_at: string;
};

/**
 * CloudHydrator ensures that when the user is signed in, their saved
 * charts + backing tracks are pulled from the cloud and mirrored into
 * localStorage BEFORE children mount, so downstream hooks that read
 * localStorage on mount pick up the cloud copy. It also sets up
 * lightweight cloud sync when local data changes afterwards.
 */
export default function CloudHydrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const currentUserRef = useRef<string | null>(null);
  const debounceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function hydrateFor(userId: string | null) {
      if (!userId) {
        currentUserRef.current = null;
        setReady(true);
        return;
      }
      currentUserRef.current = userId;
      try {
        const { data, error } = await supabase
          .from('user_snapshots')
          .select('charts_data, backing_tracks_data')
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data) {
          if (data.charts_data !== null && data.charts_data !== undefined) {
            try { localStorage.setItem(CHART_KEY, JSON.stringify(data.charts_data)); } catch {}
          }
          if (data.backing_tracks_data !== null && data.backing_tracks_data !== undefined) {
            try { localStorage.setItem(BACKING_KEY, JSON.stringify(data.backing_tracks_data)); } catch {}
          }
        }
      } catch {}
      if (!cancelled) setReady(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      hydrateFor(data.session?.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === 'SIGNED_IN' && uid && uid !== currentUserRef.current) {
        // Re-hydrate and reload so hooks re-read localStorage cleanly.
        (async () => {
          await hydrateFor(uid);
          window.location.reload();
        })();
      } else if (event === 'SIGNED_OUT') {
        currentUserRef.current = null;
      } else {
        currentUserRef.current = uid;
      }
    });

    // Mirror localStorage writes to cloud (debounced).
    const push = (key: string) => {
      const uid = currentUserRef.current;
      if (!uid) return;
      window.clearTimeout(debounceRef.current[key]);
      debounceRef.current[key] = window.setTimeout(async () => {
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          const patch: Record<string, unknown> = { user_id: uid };
          if (key === CHART_KEY) patch.charts_data = parsed;
          if (key === BACKING_KEY) patch.backing_tracks_data = parsed;
          await supabase.from('user_snapshots').upsert(patch, { onConflict: 'user_id' });
        } catch {}
      }, 800);
    };

    // Intercept setItem for the tracked keys.
    const origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      origSet.call(this, k, v);
      if (k === CHART_KEY || k === BACKING_KEY) push(k);
    };

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      Storage.prototype.setItem = origSet;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-sm text-muted-foreground font-mono">Loading…</div>
      </div>
    );
  }
  return <>{children}</>;
}
