import { useMemo, useState } from 'react';
import { NOTE_NAMES, type NoteName } from '@/lib/music';
import { GRID_PER_BEAT, type ChordTrackEntry, type KeyChangeEntry, type TempoChangeEntry, type KeyQuality } from '@/lib/courseTypes';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  chordTrack: ChordTrackEntry[]; setChordTrack: (v: ChordTrackEntry[]) => void;
  keyTrack: KeyChangeEntry[]; setKeyTrack: (v: KeyChangeEntry[]) => void;
  tempoTrack: TempoChangeEntry[]; setTempoTrack: (v: TempoChangeEntry[]) => void;
  startGrid: number;
  visibleGrids: number;
  beatsPerBar: number;
  isOwner: boolean;
}

const CELL_W = 28;
const ROW_H = 26;
const CHORD_QUALITIES = ['Major', 'Minor', 'Dominant 7', 'Major 7', 'Minor 7', 'Diminished'];

export function GlobalTracksEditor({
  chordTrack, setChordTrack, keyTrack, setKeyTrack, tempoTrack, setTempoTrack,
  startGrid, visibleGrids, beatsPerBar, isOwner,
}: Props) {
  const [editing, setEditing] = useState<{ kind: 'chord' | 'key' | 'tempo'; id: string } | null>(null);
  const totalCells = visibleGrids;
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  const inWindow = <T extends { beatIndex: number }>(arr: T[]) =>
    arr.filter(e => e.beatIndex >= startGrid && e.beatIndex < startGrid + totalCells);

  const addChord = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / GRID_PER_BEAT) * GRID_PER_BEAT;
    const id = `c-${Date.now()}`;
    setChordTrack([...chordTrack, { id, beatIndex, durationGrid: gridPerBar, root: 'C', quality: 'Major' }]);
    setEditing({ kind: 'chord', id });
  };
  const addKey = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    const id = `k-${Date.now()}`;
    setKeyTrack([...keyTrack, { id, beatIndex, root: 'C', quality: 'Major' }]);
    setEditing({ kind: 'key', id });
  };
  const addTempo = (cellIdx: number) => {
    if (!isOwner) return;
    const beatIndex = startGrid + Math.floor(cellIdx / gridPerBar) * gridPerBar;
    const id = `t-${Date.now()}`;
    setTempoTrack([...tempoTrack, { id, beatIndex, bpm: 100 }]);
    setEditing({ kind: 'tempo', id });
  };

  const isBarLine = (cellIdx: number) => {
    const absolute = startGrid + cellIdx;
    return absolute > 0 && absolute % gridPerBar === 0;
  };

  const visChords = useMemo(() => inWindow(chordTrack), [chordTrack, startGrid, totalCells]);
  const visKeys = useMemo(() => inWindow(keyTrack), [keyTrack, startGrid, totalCells]);
  const visTempos = useMemo(() => inWindow(tempoTrack), [tempoTrack, startGrid, totalCells]);

  const gridStyle: React.CSSProperties = { width: totalCells * CELL_W, minWidth: '100%' };

  const Lane = ({
    label, color, children, onCellClick,
  }: { label: string; color: string; children: React.ReactNode; onCellClick: (cellIdx: number) => void }) => (
    <div className="relative border-b border-border" style={{ height: ROW_H }}>
      <div className="absolute left-0 top-0 h-full w-16 flex items-center justify-center text-[9px] font-mono text-muted-foreground bg-muted/30 border-r border-border z-10 uppercase tracking-wider"
        style={{ color }}>{label}</div>
      <div className="absolute inset-0 left-16 flex">
        {Array.from({ length: totalCells }).map((_, cellIdx) => (
          <button
            key={cellIdx}
            onClick={() => onCellClick(cellIdx)}
            className="border-r border-border/30 hover:bg-primary/5"
            style={{
              width: CELL_W, height: ROW_H,
              borderRightWidth: isBarLine(cellIdx + 1) ? 2 : 1,
              borderRightColor: isBarLine(cellIdx + 1) ? 'hsl(var(--foreground))' : undefined,
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );

  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto">
      <div className="relative" style={{ width: totalCells * CELL_W + 64, minWidth: '100%' }}>
        {/* Chord lane */}
        <Lane label="Chords" color="hsl(210, 80%, 55%)" onCellClick={addChord}>
          {visChords.map(c => {
            const local = c.beatIndex - startGrid;
            const isEditing = editing?.kind === 'chord' && editing.id === c.id;
            return (
              <div key={c.id}
                className="absolute top-1 rounded text-[10px] font-mono px-1 z-20"
                style={{
                  left: 64 + local * CELL_W,
                  width: c.durationGrid * CELL_W - 2,
                  height: ROW_H - 4,
                  background: 'hsl(210, 80%, 55%, 0.25)',
                  border: '1px solid hsl(210, 80%, 55%, 0.6)',
                  color: 'hsl(210, 80%, 75%)',
                }}>
                {isEditing && isOwner ? (
                  <div className="flex items-center gap-1">
                    <select value={c.root} onChange={e => setChordTrack(chordTrack.map(x => x.id === c.id ? { ...x, root: e.target.value as NoteName } : x))} className="bg-background text-foreground text-[10px] rounded">
                      {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select value={c.quality} onChange={e => setChordTrack(chordTrack.map(x => x.id === c.id ? { ...x, quality: e.target.value } : x))} className="bg-background text-foreground text-[10px] rounded">
                      {CHORD_QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <button onClick={() => { setChordTrack(chordTrack.filter(x => x.id !== c.id)); setEditing(null); }} className="text-destructive ml-auto"><Trash2 className="size-3" /></button>
                    <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">✓</button>
                  </div>
                ) : (
                  <button onClick={() => isOwner && setEditing({ kind: 'chord', id: c.id })} className="w-full h-full text-left">
                    {c.root} {c.quality === 'Major' ? '' : c.quality}
                  </button>
                )}
              </div>
            );
          })}
        </Lane>

        {/* Key lane */}
        <Lane label="Key" color="hsl(280, 70%, 60%)" onCellClick={addKey}>
          {visKeys.map(k => {
            const local = k.beatIndex - startGrid;
            const isEditing = editing?.kind === 'key' && editing.id === k.id;
            return (
              <div key={k.id} className="absolute top-1 rounded text-[10px] font-mono px-1 z-20 flex items-center"
                style={{
                  left: 64 + local * CELL_W,
                  height: ROW_H - 4,
                  background: 'hsl(280, 70%, 60%, 0.25)',
                  border: '1px solid hsl(280, 70%, 60%, 0.6)',
                  color: 'hsl(280, 70%, 80%)',
                }}>
                {isEditing && isOwner ? (
                  <div className="flex items-center gap-1">
                    <select value={k.root} onChange={e => setKeyTrack(keyTrack.map(x => x.id === k.id ? { ...x, root: e.target.value as NoteName } : x))} className="bg-background text-foreground text-[10px] rounded">
                      {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select value={k.quality} onChange={e => setKeyTrack(keyTrack.map(x => x.id === k.id ? { ...x, quality: e.target.value as KeyQuality } : x))} className="bg-background text-foreground text-[10px] rounded">
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                    </select>
                    <button onClick={() => { setKeyTrack(keyTrack.filter(x => x.id !== k.id)); setEditing(null); }} className="text-destructive"><Trash2 className="size-3" /></button>
                    <button onClick={() => setEditing(null)}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => isOwner && setEditing({ kind: 'key', id: k.id })} className="px-1">
                    🎼 {k.root} {k.quality}
                  </button>
                )}
              </div>
            );
          })}
        </Lane>

        {/* Tempo lane */}
        <Lane label="Tempo" color="hsl(40, 80%, 55%)" onCellClick={addTempo}>
          {visTempos.map(t => {
            const local = t.beatIndex - startGrid;
            const isEditing = editing?.kind === 'tempo' && editing.id === t.id;
            return (
              <div key={t.id} className="absolute top-1 rounded text-[10px] font-mono px-1 z-20 flex items-center"
                style={{
                  left: 64 + local * CELL_W,
                  height: ROW_H - 4,
                  background: 'hsl(40, 80%, 55%, 0.25)',
                  border: '1px solid hsl(40, 80%, 55%, 0.6)',
                  color: 'hsl(40, 80%, 75%)',
                }}>
                {isEditing && isOwner ? (
                  <div className="flex items-center gap-1">
                    <input type="number" min={40} max={240} value={t.bpm}
                      onChange={e => setTempoTrack(tempoTrack.map(x => x.id === t.id ? { ...x, bpm: parseInt(e.target.value, 10) || 100 } : x))}
                      className="bg-background text-foreground text-[10px] rounded w-12 px-1" />
                    <button onClick={() => { setTempoTrack(tempoTrack.filter(x => x.id !== t.id)); setEditing(null); }} className="text-destructive"><Trash2 className="size-3" /></button>
                    <button onClick={() => setEditing(null)}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => isOwner && setEditing({ kind: 'tempo', id: t.id })} className="px-1">
                    ♩= {t.bpm}
                  </button>
                )}
              </div>
            );
          })}
        </Lane>
      </div>
      {isOwner && (
        <p className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground border-t border-border bg-muted/10">
          Click an empty cell in any lane to add a chord, key change, or tempo change. Click an entry to edit.
        </p>
      )}
    </div>
  );
}
