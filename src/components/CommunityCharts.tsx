import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, RefreshCw, Search, Share2, Trash2, Music4, FileMusic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const LIBRARY_KEY = 'mf-charts-library';
const BACKING_KEY = 'mf-backing-tracks';

type Kind = 'chart' | 'track';

interface SharedItem {
  id: string;
  user_id: string;
  author_name: string;
  kind: Kind;
  title: string;
  composer: string | null;
  tempo: number | null;
  time_sig: string | null;
  feel: string | null;
  genre: string | null;
  description: string | null;
  data: unknown;
  downloads: number;
  created_at: string;
}

interface LocalChart {
  id: string;
  title: string;
  composer?: string;
  tempo?: number;
  timeSig?: string;
  feel?: string;
  data: unknown;
}

interface LocalTrack {
  id: string;
  name: string;
  bpm?: number;
  genre?: string;
  [k: string]: unknown;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(value) }));
  } catch {
    /* quota — ignore */
  }
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function CommunityCharts() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Kind | 'mine'>('all');

  const localCharts = readJSON<LocalChart[]>(LIBRARY_KEY, []);
  const localTracks = readJSON<LocalTrack[]>(BACKING_KEY, []);

  const [pickKind, setPickKind] = useState<Kind>('chart');
  const [pickId, setPickId] = useState<string>('');
  const [author, setAuthor] = useState<string>(() => localStorage.getItem('mf-share-author') || '');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shared_charts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Could not load shared charts');
    setItems((data as SharedItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(it => {
      if (filter === 'mine' && it.user_id !== userId) return false;
      if ((filter === 'chart' || filter === 'track') && it.kind !== filter) return false;
      if (!q) return true;
      return [it.title, it.composer, it.author_name, it.genre]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter, userId]);

  const publish = async () => {
    if (!pickId) {
      toast.error('Pick something from your library to share');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error('Sign in to share your work');
      return;
    }
    setPublishing(true);
    const name = author.trim() || 'Anonymous';
    localStorage.setItem('mf-share-author', name);

    let payload: Record<string, unknown>;
    if (pickKind === 'chart') {
      const c = localCharts.find(x => x.id === pickId);
      if (!c) { setPublishing(false); toast.error('Chart not found'); return; }
      payload = {
        user_id: uid, author_name: name, kind: 'chart', title: c.title || 'Untitled',
        composer: c.composer ?? null, tempo: c.tempo ?? null, time_sig: c.timeSig ?? null,
        feel: c.feel ?? null, genre: null, description: description.trim() || null, data: c.data,
      };
    } else {
      const t = localTracks.find(x => x.id === pickId);
      if (!t) { setPublishing(false); toast.error('Backing track not found'); return; }
      payload = {
        user_id: uid, author_name: name, kind: 'track', title: t.name || 'Untitled',
        composer: null, tempo: (t.bpm as number) ?? null, time_sig: null, feel: null,
        genre: (t.genre as string) ?? null, description: description.trim() || null, data: t,
      };
    }

    const { error } = await supabase.from('shared_charts').insert(payload);
    setPublishing(false);
    if (error) {
      toast.error('Publish failed', { description: error.message });
      return;
    }
    toast.success('Shared with the community');
    setDescription('');
    load();
  };

  const importItem = async (it: SharedItem) => {
    if (it.kind === 'chart') {
      const lib = readJSON<LocalChart[]>(LIBRARY_KEY, []);
      writeJSON(LIBRARY_KEY, [
        ...lib,
        {
          id: `chart-${Date.now()}`,
          title: it.title,
          composer: it.composer ?? undefined,
          tempo: it.tempo ?? undefined,
          timeSig: it.time_sig ?? undefined,
          feel: it.feel ?? undefined,
          updatedAt: Date.now(),
          data: it.data,
        },
      ]);
      toast.success(`"${it.title}" added to My Charts`);
    } else {
      const lib = readJSON<LocalTrack[]>(BACKING_KEY, []);
      const track = { ...(it.data as LocalTrack), id: `bt-${Date.now()}`, name: it.title };
      writeJSON(BACKING_KEY, [...lib, track]);
      toast.success(`"${it.title}" added to your backing tracks`);
    }
    await supabase.rpc('increment_shared_chart_downloads', { _id: it.id });
    setItems(prev => prev.map(p => (p.id === it.id ? { ...p, downloads: p.downloads + 1 } : p)));
  };

  const unpublish = async (it: SharedItem) => {
    const { error } = await supabase.from('shared_charts').delete().eq('id', it.id);
    if (error) { toast.error('Could not remove'); return; }
    setItems(prev => prev.filter(p => p.id !== it.id));
    toast('Removed from the community library');
  };

  const options = pickKind === 'chart'
    ? localCharts.map(c => ({ id: c.id, label: c.title || 'Untitled' }))
    : localTracks.map(t => ({ id: t.id, label: t.name || 'Untitled' }));

  return (
    <div className="flex gap-3 h-[380px] min-h-0">
      {/* Publish panel */}
      <div className="w-[230px] shrink-0 flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-2.5 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
          <Share2 size={12} /> Share your work
        </div>

        <div className="flex gap-1">
          {(['chart', 'track'] as Kind[]).map(k => (
            <button
              key={k}
              onClick={() => { setPickKind(k); setPickId(''); }}
              className={`flex-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                pickKind === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {k === 'chart' ? 'Chart' : 'Backing'}
            </button>
          ))}
        </div>

        <select
          value={pickId}
          onChange={e => setPickId(e.target.value)}
          className="w-full bg-input border border-border rounded px-1.5 py-1 text-[10px] font-mono"
        >
          <option value="">
            {options.length ? 'Select…' : pickKind === 'chart' ? 'No saved charts' : 'No saved tracks'}
          </option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>

        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Your name"
          className="w-full bg-input border border-border rounded px-1.5 py-1 text-[10px] font-mono"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Notes (optional)"
          rows={3}
          className="w-full bg-input border border-border rounded px-1.5 py-1 text-[10px] font-mono resize-none"
        />

        <button
          onClick={publish}
          disabled={publishing || !pickId}
          className="w-full px-2 py-1.5 rounded bg-primary text-primary-foreground text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-1"
        >
          {publishing ? <Loader2 size={11} className="animate-spin" /> : <Share2 size={11} />} Publish
        </button>

        <p className="text-[8px] font-mono leading-relaxed text-muted-foreground mt-auto">
          Shared items are visible to everyone. Save a chart or backing track first, then publish it here.
        </p>
      </div>

      {/* Browse */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search shared charts & tracks"
              className="w-full bg-input border border-border rounded pl-6 pr-2 py-1 text-[10px] font-mono"
            />
          </div>
          {(['all', 'chart', 'track', 'mine'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {f === 'chart' ? 'Charts' : f === 'track' ? 'Tracks' : f}
            </button>
          ))}
          <button
            onClick={load}
            className="p-1.5 rounded bg-secondary text-secondary-foreground"
            title="Refresh"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 gap-2 content-start">
          {loading && (
            <div className="col-span-2 flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="col-span-2 text-center py-8 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Nothing shared yet — be the first to publish
            </div>
          )}
          {visible.map(it => (
            <div
              key={it.id}
              className="rounded-lg border border-border bg-card/60 p-2 flex flex-col gap-1"
            >
              <div className="flex items-start gap-1.5">
                <span className="text-primary mt-0.5">
                  {it.kind === 'chart' ? <FileMusic size={12} /> : <Music4 size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-fredoka truncate">{it.title}</div>
                  <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                    {it.composer ? `${it.composer} · ` : ''}{it.author_name} · {timeAgo(it.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                {it.tempo ? <span className="px-1 rounded bg-muted/50">{it.tempo} bpm</span> : null}
                {it.time_sig ? <span className="px-1 rounded bg-muted/50">{it.time_sig}</span> : null}
                {it.feel ? <span className="px-1 rounded bg-muted/50">{it.feel}</span> : null}
                {it.genre ? <span className="px-1 rounded bg-muted/50">{it.genre}</span> : null}
                <span className="px-1 rounded bg-muted/50">{it.downloads} ↓</span>
              </div>

              {it.description && (
                <p className="text-[9px] font-mono text-muted-foreground line-clamp-2">{it.description}</p>
              )}

              <div className="flex items-center gap-1 mt-auto pt-1">
                <button
                  onClick={() => importItem(it)}
                  className="flex-1 px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-[9px] font-mono uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <Download size={10} /> Import
                </button>
                {it.user_id === userId && (
                  <button
                    onClick={() => unpublish(it)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove from community"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
