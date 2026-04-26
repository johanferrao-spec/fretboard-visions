import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { TrackId, TrackState, MidiClip, DrumFill } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, TRACK_LABELS, DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import TrackHeader from './TrackHeader';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Trash2 } from 'lucide-react';

interface TrackLaneProps {
  track: TrackState;
  measures: number;
  currentBeat: number;
  isPlaying: boolean;
  bpm: number;
  genre: Genre;
  chords: TimelineChord[];
  onParamChange: <K extends keyof TrackState>(key: K, value: TrackState[K]) => void;
  onRegenerate: () => void;
  onAINotes: (notes: TrackState['clips'][number]['notes']) => void;
  onUpdateClip: (clipId: string, patch: Partial<MidiClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onOpenClipEditor: (clipId: string) => void;
  /** Drum-only: fill regions (red) overlaid on the pink drum block */
  drumFills?: DrumFill[];
  onAddDrumFill?: (startBar: number, lengthBars?: number) => void;
  onUpdateDrumFill?: (id: string, patch: Partial<DrumFill>) => void;
  onRemoveDrumFill?: (id: string) => void;
}

interface DragState {
  clipId: string;
  mode: 'move' | 'resize-r' | 'resize-l';
  origStart: number;
  origDuration: number;
  startX: number;
  pxPerBeat: number;
}

const SNAP = 0.25;
const snap = (b: number) => Math.max(0, Math.round(b / SNAP) * SNAP);

export default function TrackLane({
  track, measures, currentBeat, isPlaying, bpm, genre, chords,
  onParamChange, onRegenerate, onAINotes,
  onUpdateClip, onDeleteClip, onDuplicateClip, onOpenClipEditor,
  drumFills = [], onAddDrumFill, onUpdateDrumFill, onRemoveDrumFill,
}: TrackLaneProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const laneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const fillDragRef = useRef<{ id: string; mode: 'move' | 'resize-l' | 'resize-r'; origStart: number; origLen: number; startX: number; pxPerBar: number; } | null>(null);
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFillId, setSelectedFillId] = useState<string | null>(null);
  const totalBeats = measures * 4;
  const isDrums = track.id === 'drums';

  // Mouse drag handling for clips
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dBeats = dx / d.pxPerBeat;
      if (d.mode === 'move') {
        const ns = snap(d.origStart + dBeats);
        onUpdateClip(d.clipId, { startBeat: Math.max(0, Math.min(totalBeats - SNAP, ns)) });
      } else if (d.mode === 'resize-r') {
        const nd = snap(d.origDuration + dBeats);
        onUpdateClip(d.clipId, { duration: Math.max(SNAP, nd) });
      } else if (d.mode === 'resize-l') {
        const ns = snap(d.origStart + dBeats);
        const nd = snap(d.origDuration - dBeats);
        if (nd >= SNAP && ns >= 0) onUpdateClip(d.clipId, { startBeat: ns, duration: nd });
      }
    };
    const onUp = () => { dragRef.current = null; force(x => x + 1); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onUpdateClip, totalBeats]);

  // Keyboard delete / copy on selected clip
  useEffect(() => {
    if (!selectedId) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteClip(selectedId);
        setSelectedId(null);
      } else if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onDuplicateClip(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, onDeleteClip, onDuplicateClip]);

  // Mouse drag for drum fills
  useEffect(() => {
    if (!isDrums) return;
    const onMove = (e: MouseEvent) => {
      const f = fillDragRef.current;
      if (!f || !onUpdateDrumFill) return;
      const dx = e.clientX - f.startX;
      const dBars = dx / f.pxPerBar;
      if (f.mode === 'move') {
        const ns = Math.round(f.origStart + dBars);
        onUpdateDrumFill(f.id, {
          startBar: Math.max(0, Math.min(measures - f.origLen, ns)),
        });
      } else if (f.mode === 'resize-r') {
        const nLen = Math.round(f.origLen + dBars);
        onUpdateDrumFill(f.id, {
          lengthBars: Math.max(1, Math.min(4, Math.min(measures - f.origStart, nLen))),
        });
      } else if (f.mode === 'resize-l') {
        const ns = Math.round(f.origStart + dBars);
        const nLen = Math.round(f.origLen - dBars);
        if (nLen >= 1 && nLen <= 4 && ns >= 0) {
          onUpdateDrumFill(f.id, { startBar: ns, lengthBars: nLen });
        }
      }
    };
    const onUp = () => { fillDragRef.current = null; force(x => x + 1); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDrums, onUpdateDrumFill, measures]);

  // Keyboard delete on selected drum fill
  useEffect(() => {
    if (!selectedFillId || !onRemoveDrumFill) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onRemoveDrumFill(selectedFillId);
        setSelectedFillId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFillId, onRemoveDrumFill]);

  const startFillDrag = (e: React.MouseEvent, fill: DrumFill, mode: 'move' | 'resize-l' | 'resize-r') => {
    e.preventDefault();
    e.stopPropagation();
    if (!laneRef.current) return;
    const pxPerBar = laneRef.current.getBoundingClientRect().width / measures;
    fillDragRef.current = {
      id: fill.id, mode, origStart: fill.startBar, origLen: fill.lengthBars,
      startX: e.clientX, pxPerBar,
    };
    setSelectedFillId(fill.id);
  };

  const startDrag = (e: React.MouseEvent, clip: MidiClip, mode: DragState['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    if (!laneRef.current) return;
    const pxPerBeat = laneRef.current.getBoundingClientRect().width / totalBeats;
    dragRef.current = {
      clipId: clip.id,
      mode,
      origStart: clip.startBeat,
      origDuration: clip.duration,
      startX: e.clientX,
      pxPerBeat,
    };
    setSelectedId(clip.id);
  };

  const handleAIRegen = async () => {
    if (chords.length === 0) {
      toast.error('Add chords to the progression first');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-backing-midi', {
        body: {
          trackType: track.id,
          chords, measures, bpm, genre,
          intensity: track.intensity,
          complexity: track.complexity,
        },
      });
      if (error) {
        if ((error as any).status === 429) toast.error('Rate limit exceeded');
        else if ((error as any).status === 402) toast.error('AI credits exhausted');
        else toast.error((error as any).message || 'AI generation failed');
        return;
      }
      if (data?.error) { toast.error(data.error); return; }
      const notes = (data?.notes || []).map((n: any, i: number) => ({
        id: `ai-${track.id}-${Date.now()}-${i}`,
        startBeat: n.startBeat, duration: n.duration, pitch: n.pitch, velocity: n.velocity,
      }));
      onAINotes(notes);
      toast.success(`AI generated ${notes.length} ${track.id} notes`);
    } catch (e) {
      console.error(e);
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const color = TRACK_COLORS[track.id];
  const playPct = (currentBeat / totalBeats) * 100;

  return (
    <div className="flex border-b border-border" style={{ height: 96 }}>
      <TrackHeader
        track={track}
        onChange={onParamChange}
        onRegenerate={onRegenerate}
        onAIRegenerate={handleAIRegen}
        isAILoading={aiLoading}
      />
      <div
        className="flex-1 p-1.5 min-w-0 relative"
        onClick={() => { setSelectedId(null); setSelectedFillId(null); }}
      >
        <div
          ref={laneRef}
          className="relative w-full h-full rounded-md overflow-hidden"
          style={{
            backgroundColor: `hsl(${color} / 0.06)`,
            border: `1px solid hsl(${color} / 0.25)`,
          }}
          onClick={(e) => {
            if (!isDrums || !onAddDrumFill) return;
            // Click empty pink area → add a 1-bar fill at that bar
            const target = e.target as HTMLElement;
            if (target.dataset.role !== 'drum-block') return;
            const rect = laneRef.current!.getBoundingClientRect();
            const xPct = (e.clientX - rect.left) / rect.width;
            const bar = Math.max(0, Math.min(measures - 1, Math.floor(xPct * measures)));
            // Avoid creating overlapping fills
            const overlaps = drumFills.some(f => bar >= f.startBar && bar < f.startBar + f.lengthBars);
            if (overlaps) return;
            onAddDrumFill(bar, 1);
          }}
        >
          {/* Measure grid */}
          {Array.from({ length: measures }, (_, m) => (
            <div
              key={`m-${m}`}
              className="absolute top-0 bottom-0"
              style={{
                left: `${(m / measures) * 100}%`,
                borderLeft: m === 0 ? 'none' : '1.5px solid hsl(220, 15%, 28%)',
              }}
            />
          ))}
          {/* Beat sub-grid */}
          {Array.from({ length: totalBeats }, (_, b) => (
            b % 4 === 0 ? null : (
              <div
                key={`b-${b}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${(b / totalBeats) * 100}%`,
                  borderLeft: '1px solid hsl(220, 15%, 18%)',
                }}
              />
            )
          ))}

          {/* Drum lane: solid pink block + draggable red fill regions */}
          {isDrums && (
            <>
              <div
                data-role="drum-block"
                className="absolute top-1 bottom-1 left-0 right-0 rounded-md select-none"
                style={{
                  backgroundColor: 'hsl(330, 75%, 60%)',
                  cursor: onAddDrumFill ? 'copy' : 'default',
                }}
                title="Click an empty area to add a drum fill"
              >
                <div
                  data-role="drum-block"
                  className="absolute top-0.5 left-1.5 text-[8px] font-mono font-bold uppercase pointer-events-none"
                  style={{ color: 'hsl(330, 90%, 90%)', textShadow: '0 0 3px hsl(0 0% 0% / 0.8)' }}
                >
                  Drums — click to add fill
                </div>
              </div>

              {/* Red fill regions */}
              {drumFills.map(fill => {
                const left = (fill.startBar / measures) * 100;
                const width = (fill.lengthBars / measures) * 100;
                const isSel = selectedFillId === fill.id;
                return (
                  <div
                    key={fill.id}
                    className={`absolute top-1 bottom-1 rounded-md select-none cursor-grab active:cursor-grabbing group`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: 'hsl(0, 85%, 55% / 0.55)',
                      border: `1.5px solid hsl(0, 90%, ${isSel ? 70 : 55}%)`,
                      boxShadow: isSel ? '0 0 0 2px hsl(0, 90%, 60% / 0.5)' : undefined,
                      zIndex: 5,
                    }}
                    onMouseDown={(e) => {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const offset = e.clientX - rect.left;
                      if (offset > rect.width - 8) startFillDrag(e, fill, 'resize-r');
                      else if (offset < 8) startFillDrag(e, fill, 'resize-l');
                      else startFillDrag(e, fill, 'move');
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedFillId(fill.id); }}
                    title={`Fill — ${fill.lengthBars} bar${fill.lengthBars > 1 ? 's' : ''} at bar ${fill.startBar + 1}. Drag to move, edges to resize, Del to remove`}
                  >
                    <div
                      className="absolute top-0.5 left-1.5 text-[8px] font-mono font-bold uppercase pointer-events-none"
                      style={{ color: 'hsl(0, 100%, 95%)', textShadow: '0 0 3px hsl(0 0% 0% / 0.9)' }}
                    >
                      Fill ({fill.lengthBars})
                    </div>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                      style={{ backgroundColor: 'hsl(0, 90%, 70%)' }} />
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                      style={{ backgroundColor: 'hsl(0, 90%, 70%)' }} />
                    {isSel && onRemoveDrumFill && (
                      <button
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-card/80 text-muted-foreground hover:text-destructive hover:bg-card z-20"
                        title="Delete fill"
                        onClick={(e) => { e.stopPropagation(); onRemoveDrumFill(fill.id); setSelectedFillId(null); }}
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Clips (non-drum tracks) */}
          {!isDrums && track.clips.map(clip => {
            const left = (clip.startBeat / totalBeats) * 100;
            const width = (clip.duration / totalBeats) * 100;
            const isSelected = selectedId === clip.id;

            // Pitch range for clip preview
            let minP = 127, maxP = 0;
            if (track.id === 'drums') { minP = 30; maxP = 55; }
            else {
              for (const n of clip.notes) {
                if (n.pitch < minP) minP = n.pitch;
                if (n.pitch > maxP) maxP = n.pitch;
              }
              if (clip.notes.length === 0) { minP = 48; maxP = 72; }
              const span = maxP - minP;
              if (span < 12) {
                const pad = (12 - span) / 2;
                minP -= Math.ceil(pad); maxP += Math.floor(pad);
              }
            }
            const pRange = maxP - minP || 1;

            return (
              <div
                key={clip.id}
                className={`absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-grab active:cursor-grabbing select-none ${isSelected ? 'ring-2' : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: `hsl(${color} / 0.18)`,
                  border: `1.5px solid hsl(${color} / ${isSelected ? 0.95 : 0.55})`,
                  boxShadow: isSelected ? `0 0 0 2px hsl(${color} / 0.4)` : undefined,
                  minWidth: 18,
                }}
                onMouseDown={(e) => {
                  // Edge → resize handles, else move
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const offset = e.clientX - rect.left;
                  if (offset > rect.width - 6) startDrag(e, clip, 'resize-r');
                  else if (offset < 6) startDrag(e, clip, 'resize-l');
                  else startDrag(e, clip, 'move');
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(clip.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); onOpenClipEditor(clip.id); }}
                title={`${clip.label || 'Region'} — drag to move, edges to resize, double-click to edit, Del to remove, ⌘D to duplicate`}
              >
                {/* Clip label */}
                {clip.label && (
                  <div
                    className="absolute top-0.5 left-1.5 text-[8px] font-mono font-bold uppercase pointer-events-none z-10 truncate"
                    style={{ color: `hsl(${color} / 1)`, textShadow: '0 0 3px hsl(0 0% 0% / 0.8)' }}
                  >
                    {clip.label}
                  </div>
                )}
                {/* Mini notes inside clip */}
                <div className="absolute inset-0 mt-3">
                  {clip.notes.map(n => {
                    if (n.startBeat >= clip.duration) return null;
                    const nLeft = (n.startBeat / clip.duration) * 100;
                    const nWidth = Math.max(0.6, (Math.min(n.duration, clip.duration - n.startBeat) / clip.duration) * 100);
                    const nTop = (1 - (n.pitch - minP) / pRange) * 100;
                    const nH = track.id === 'drums' ? 12 : Math.max(4, 100 / pRange);
                    return (
                      <div
                        key={n.id}
                        className="absolute rounded-[1px] pointer-events-none"
                        style={{
                          left: `${nLeft}%`,
                          top: `${Math.max(0, Math.min(95, nTop))}%`,
                          width: `${nWidth}%`,
                          height: `${nH}%`,
                          backgroundColor: `hsl(${color} / ${0.5 + (n.velocity / 127) * 0.5})`,
                        }}
                      />
                    );
                  })}
                </div>
                {/* Empty hint */}
                {clip.notes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-muted-foreground/70 pointer-events-none">
                    empty
                  </div>
                )}
                {/* Resize handles */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                  style={{ backgroundColor: `hsl(${color} / 0.6)` }} />
                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                  style={{ backgroundColor: `hsl(${color} / 0.6)` }} />

                {/* Action buttons (visible on hover) */}
                {isSelected && (
                  <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20">
                    <button
                      className="p-0.5 rounded bg-card/80 text-muted-foreground hover:text-primary hover:bg-card"
                      title="Duplicate"
                      onClick={(e) => { e.stopPropagation(); onDuplicateClip(clip.id); }}
                    >
                      <Copy size={9} />
                    </button>
                    <button
                      className="p-0.5 rounded bg-card/80 text-muted-foreground hover:text-destructive hover:bg-card"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id); }}
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Playhead */}
          {(isPlaying || currentBeat > 0) && (
            <div
              className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none"
              style={{
                left: `${playPct}%`,
                backgroundColor: 'hsl(var(--primary))',
                boxShadow: '0 0 4px hsl(var(--primary))',
              }}
            />
          )}

          {/* Empty hint */}
          {!isDrums && track.clips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground/60 pointer-events-none">
              No regions — add chords to generate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
