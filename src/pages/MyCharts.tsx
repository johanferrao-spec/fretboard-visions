import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileMusic, Music4, ListMusic, Trash2, Plus, X, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { BackingTrack } from '@/lib/backingTrackTypes';

const LIBRARY_KEY = 'mf-charts-library';
const BACKING_KEY = 'mf-backing-tracks';
const SETLISTS_KEY = 'mf-setlists';
const CHART_KEY = 'chartsView.state.v1';

interface StoredChart {
  id: string;
  title: string;
  composer?: string;
  tempo?: number;
  timeSig?: string;
  feel?: string;
  updatedAt: number;
  data: any;
}

interface SetlistItem {
  refType: 'chart' | 'track';
  refId: string;
}
interface Setlist {
  id: string;
  name: string;
  items: SetlistItem[];
}

function readJSON<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJSON(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export default function MyCharts() {
  const navigate = useNavigate();
  const [charts, setCharts] = useState<StoredChart[]>(() => readJSON<StoredChart[]>(LIBRARY_KEY, []));
  const [tracks, setTracks] = useState<BackingTrack[]>(() => readJSON<BackingTrack[]>(BACKING_KEY, []));
  const [setlists, setSetlists] = useState<Setlist[]>(() => readJSON<Setlist[]>(SETLISTS_KEY, []));
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [tab, setTab] = useState<'charts' | 'tracks' | 'setlists'>('charts');
  // Guard: never let the initial render flush empty arrays over saved data.
  const hydrated = useRef(false);

  // Pull the cloud copy on mount and merge it in (localStorage may have been
  // cleared by the browser even though the account still holds the data).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from('user_snapshots')
          .select('charts_library, backing_tracks_data, setlists')
          .eq('user_id', uid)
          .maybeSingle();
        if (cancelled || !data) return;
        const d = data as any;
        const mergeById = <T extends { id: string }>(local: T[], cloud: unknown): T[] => {
          if (!Array.isArray(cloud)) return local;
          const map = new Map<string, T>();
          [...(cloud as T[]), ...local].forEach(item => item?.id && map.set(item.id, item));
          return [...map.values()];
        };
        setCharts(prev => mergeById(prev, d.charts_library));
        setTracks(prev => mergeById(prev, d.backing_tracks_data));
        setSetlists(prev => mergeById(prev, d.setlists));
      } catch {
        /* offline — local copy still works */
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (hydrated.current) writeJSON(LIBRARY_KEY, charts); }, [charts]);
  useEffect(() => { if (hydrated.current) writeJSON(SETLISTS_KEY, setlists); }, [setlists]);
  useEffect(() => { if (hydrated.current) writeJSON(BACKING_KEY, tracks); }, [tracks]);


  const activeSetlist = useMemo(
    () => setlists.find(s => s.id === activeSetlistId) ?? null,
    [setlists, activeSetlistId],
  );

  const openChart = (c: StoredChart) => {
    writeJSON(CHART_KEY, c.data);
    toast.success(`Loaded "${c.title}"`);
    navigate('/');
  };

  const deleteChart = (id: string) => setCharts(prev => prev.filter(c => c.id !== id));
  const deleteTrack = (id: string) => setTracks(prev => prev.filter(t => t.id !== id));

  const createSetlist = () => {
    const name = prompt('Setlist name?');
    if (!name) return;
    const s: Setlist = { id: `sl-${Date.now()}`, name, items: [] };
    setSetlists(prev => [...prev, s]);
    setActiveSetlistId(s.id);
    setTab('setlists');
  };
  const deleteSetlist = (id: string) => {
    setSetlists(prev => prev.filter(s => s.id !== id));
    if (activeSetlistId === id) setActiveSetlistId(null);
  };
  const renameSetlist = (id: string) => {
    const cur = setlists.find(s => s.id === id);
    const name = prompt('Rename setlist', cur?.name);
    if (!name) return;
    setSetlists(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };
  const addToSetlist = (item: SetlistItem) => {
    if (!activeSetlist) { toast.error('Select a setlist first'); return; }
    setSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, items: [...s.items, item] } : s));
    toast.success('Added to ' + activeSetlist.name);
  };
  const removeFromSetlist = (idx: number) => {
    if (!activeSetlist) return;
    setSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s));
  };

  const chartById = (id: string) => charts.find(c => c.id === id);
  const trackById = (id: string) => tracks.find(t => t.id === id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex items-center gap-4">
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="text-lg font-fredoka">My Charts</h1>
        <div className="ml-auto flex gap-1">
          {(['charts','tracks','setlists'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {t === 'charts' ? 'Chord Charts' : t === 'tracks' ? 'Backing Tracks' : 'Setlists'}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <section>
          {tab === 'charts' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Chord Charts ({charts.length})</h2>
                <span className="text-[10px] text-muted-foreground">Save charts from the Chart editor →</span>
              </div>
              {charts.length === 0 ? (
                <EmptyState icon={<FileMusic />} label="No charts saved yet. Open the Chart editor and press Save." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {charts.map(c => (
                    <Card key={c.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-fredoka text-base">{c.title}</div>
                          {c.composer && <div className="text-[10px] text-muted-foreground">{c.composer}</div>}
                          <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                            {c.tempo ?? '—'} BPM · {c.timeSig ?? '4/4'} · {c.feel ?? 'Straight'}
                          </div>
                        </div>
                        <IconBtn title="Delete" onClick={() => deleteChart(c.id)}><Trash2 size={12} /></IconBtn>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <ActionBtn onClick={() => openChart(c)}><Play size={11} /> Open</ActionBtn>
                        <ActionBtn onClick={() => addToSetlist({ refType: 'chart', refId: c.id })}><Plus size={11} /> Setlist</ActionBtn>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'tracks' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Backing Tracks ({tracks.length})</h2>
              </div>
              {tracks.length === 0 ? (
                <EmptyState icon={<Music4 />} label="No saved backing tracks yet. Build one in the DAW view and press Save." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {tracks.map(t => (
                    <Card key={t.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-fredoka text-base">{t.name}</div>
                          <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                            {t.bpm} BPM · {t.measures} bars · {t.genre}
                          </div>
                        </div>
                        <IconBtn title="Delete" onClick={() => deleteTrack(t.id)}><Trash2 size={12} /></IconBtn>
                      </div>
                      <div className="mt-3">
                        <ActionBtn onClick={() => addToSetlist({ refType: 'track', refId: t.id })}><Plus size={11} /> Setlist</ActionBtn>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'setlists' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Setlists ({setlists.length})</h2>
                <ActionBtn onClick={createSetlist}><Plus size={11} /> New setlist</ActionBtn>
              </div>
              {!activeSetlist ? (
                setlists.length === 0 ? (
                  <EmptyState icon={<ListMusic />} label="No setlists yet. Create one to group songs and backing tracks." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {setlists.map(s => (
                      <Card key={s.id}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-fredoka text-base">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">{s.items.length} songs</div>
                          </div>
                          <div className="flex gap-1">
                            <IconBtn title="Rename" onClick={() => renameSetlist(s.id)}>✎</IconBtn>
                            <IconBtn title="Delete" onClick={() => deleteSetlist(s.id)}><Trash2 size={12} /></IconBtn>
                          </div>
                        </div>
                        <div className="mt-3">
                          <ActionBtn onClick={() => setActiveSetlistId(s.id)}>Open</ActionBtn>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setActiveSetlistId(null)} className="text-[11px] font-mono text-muted-foreground hover:text-foreground">← All setlists</button>
                    <h3 className="text-lg font-fredoka">{activeSetlist.name}</h3>
                  </div>
                  {activeSetlist.items.length === 0 ? (
                    <EmptyState icon={<ListMusic />} label="Empty setlist. Add charts or tracks from the other tabs." />
                  ) : (
                    <ol className="space-y-2">
                      {activeSetlist.items.map((it, idx) => {
                        const name = it.refType === 'chart' ? (chartById(it.refId)?.title ?? '(missing chart)') : (trackById(it.refId)?.name ?? '(missing track)');
                        return (
                          <li key={idx} className="flex items-center gap-3 bg-card border border-border rounded px-3 py-2">
                            <span className="text-[11px] font-mono text-muted-foreground w-6">{idx + 1}.</span>
                            <span className="text-[10px] font-mono uppercase text-muted-foreground w-16">{it.refType}</span>
                            <span className="font-fredoka text-sm flex-1">{name}</span>
                            {it.refType === 'chart' && (
                              <IconBtn title="Open" onClick={() => { const c = chartById(it.refId); if (c) openChart(c); }}><Play size={12} /></IconBtn>
                            )}
                            <IconBtn title="Remove" onClick={() => removeFromSetlist(idx)}><X size={12} /></IconBtn>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="border border-border rounded-lg p-3 bg-card h-fit">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Active setlist</h3>
          {activeSetlist ? (
            <div>
              <div className="font-fredoka text-base mb-1">{activeSetlist.name}</div>
              <div className="text-[10px] text-muted-foreground">{activeSetlist.items.length} items · use "+ Setlist" buttons to add.</div>
              <button onClick={() => setActiveSetlistId(null)} className="mt-2 text-[10px] font-mono text-muted-foreground hover:text-foreground">Clear selection</button>
            </div>
          ) : setlists.length === 0 ? (
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">Create a setlist to group songs.</p>
              <ActionBtn onClick={createSetlist}><Plus size={11} /> New setlist</ActionBtn>
            </div>
          ) : (
            <select
              value=""
              onChange={(e) => setActiveSetlistId(e.target.value || null)}
              className="w-full text-[11px] font-mono bg-background border border-border rounded px-2 py-1"
            >
              <option value="">Select…</option>
              {setlists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </aside>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-lg bg-card p-3">{children}</div>;
}
function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button title={title} onClick={onClick} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
      {children}
    </button>
  );
}
function ActionBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors">
      {children}
    </button>
  );
}
function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
      <div className="flex justify-center mb-2 opacity-60">{icon}</div>
      <div className="text-xs font-mono">{label}</div>
    </div>
  );
}
