import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Square, Trash2, Music, X } from 'lucide-react';
import type { TimelineChord, SnapValue, Genre } from '@/hooks/useSongTimeline';
import type { NoteName } from '@/lib/music';
import {
  NOTE_NAMES, CHORD_FORMULAS, getDiatonicChords, getChordVariations,
  getChordDegree, SCALE_DEGREE_COLORS, ROMAN_NUMERALS,
  type ChordVariation,
} from '@/lib/music';

interface SongTimelineProps {
  chords: TimelineChord[];
  measures: number;
  setMeasures: (v: number) => void;
  bpm: number;
  setBpm: (v: number) => void;
  genre: Genre;
  setGenre: (v: Genre) => void;
  snap: SnapValue;
  setSnap: (v: SnapValue) => void;
  isPlaying: boolean;
  currentBeat: number;
  panelHeight: number;
  setPanelHeight: (v: number) => void;
  onPlay: () => void;
  onStop: () => void;
  onAddChord: (root: NoteName, chordType: string, startBeat: number, duration?: number) => string;
  onMoveChord: (id: string, newStartBeat: number) => void;
  onResizeChord: (id: string, newDuration: number) => void;
  onRemoveChord: (id: string) => void;
  onClearTimeline: () => void;
}

export default function SongTimeline({
  chords, measures, setMeasures, bpm, setBpm,
  genre, setGenre, snap, setSnap,
  isPlaying, currentBeat, panelHeight, setPanelHeight,
  onPlay, onStop, onAddChord, onMoveChord, onResizeChord, onRemoveChord, onClearTimeline,
}: SongTimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragChord, setDragChord] = useState<string | null>(null);
  const [resizeChord, setResizeChord] = useState<string | null>(null);
  const [timelineKey, setTimelineKey] = useState<NoteName>('C');
  // Variation popup state
  const [variationPopup, setVariationPopup] = useState<{
    chordId: string;
    degree: number;
    x: number;
    y: number;
  } | null>(null);

  const totalBeats = measures * 4;
  const snapGrid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;

  const diatonicChords = useMemo(() => getDiatonicChords(timelineKey), [timelineKey]);

  const getBeatFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const rawBeat = (x / rect.width) * totalBeats;
    return Math.max(0, Math.min(totalBeats - snapGrid, Math.round(rawBeat / snapGrid) * snapGrid));
  }, [totalBeats, snapGrid]);

  // Drag move
  useEffect(() => {
    if (!dragChord) return;
    const onMove = (e: MouseEvent) => onMoveChord(dragChord, getBeatFromX(e.clientX));
    const onUp = () => setDragChord(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragChord, getBeatFromX, onMoveChord]);

  // Resize chord
  useEffect(() => {
    if (!resizeChord) return;
    const chord = chords.find(c => c.id === resizeChord);
    if (!chord) return;
    const onMove = (e: MouseEvent) => {
      const beat = getBeatFromX(e.clientX);
      const newDur = beat - chord.startBeat;
      if (newDur >= snapGrid) onResizeChord(resizeChord, newDur);
    };
    const onUp = () => setResizeChord(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizeChord, chords, getBeatFromX, onResizeChord, snapGrid]);

  // Handle drop from chord library or diatonic buttons
  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const beat = getBeatFromX(e.clientX);
    const dur = snap === '1/4' ? 2 : snap === '1/8' ? 1 : 0.5;

    // Check for diatonic degree drop
    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      const { degree } = JSON.parse(degreeData);
      const dc = diatonicChords[degree];
      const id = onAddChord(dc.root, dc.type, beat, dur);
      // Show variation popup
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (gridRect) {
        setVariationPopup({
          chordId: id,
          degree,
          x: e.clientX - gridRect.left,
          y: e.clientY - gridRect.top - 120,
        });
      }
      return;
    }

    const data = e.dataTransfer.getData('application/chord');
    if (!data) return;
    try {
      const { root, chordType } = JSON.parse(data);
      onAddChord(root, chordType, beat, dur);
    } catch {}
  }, [getBeatFromX, onAddChord, snap, diatonicChords]);

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
    const beat = getBeatFromX(e.clientX);
    onAddChord('C', 'Major', beat, snap === '1/4' ? 2 : snap === '1/8' ? 1 : 0.5);
  }, [getBeatFromX, onAddChord, snap]);

  const handleSelectVariation = useCallback((v: ChordVariation) => {
    if (!variationPopup) return;
    // Update the chord — remove old and add new with same position
    const chord = chords.find(c => c.id === variationPopup.chordId);
    if (chord) {
      onRemoveChord(variationPopup.chordId);
      onAddChord(v.root, v.type, chord.startBeat, chord.duration);
    }
    setVariationPopup(null);
  }, [variationPopup, chords, onRemoveChord, onAddChord]);

  const variations = useMemo(() => {
    if (!variationPopup) return [];
    return getChordVariations(timelineKey, variationPopup.degree);
  }, [variationPopup, timelineKey]);

  const playheadPct = (currentBeat / totalBeats) * 100;

  // Get color for a chord based on its degree in the key
  const getChordColor = (chord: TimelineChord): string => {
    const degree = getChordDegree(timelineKey, chord.root, chord.chordType);
    if (degree >= 0) return SCALE_DEGREE_COLORS[degree];
    return '220, 15%, 50%'; // non-diatonic grey
  };

  return (
    <div
      className="border-t border-border bg-card flex flex-col shrink-0"
      style={{ height: 160 }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 flex-wrap">
        <button
          onClick={isPlaying ? onStop : onPlay}
          className={`p-1.5 rounded-md transition-colors ${
            isPlaying
              ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
              : 'bg-primary/20 text-primary hover:bg-primary/30'
          }`}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </button>

        <div className="flex items-center gap-1">
          <Music size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase">BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(300, Number(e.target.value))))}
            className="w-12 bg-secondary text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Key</span>
          <select
            value={timelineKey}
            onChange={e => setTimelineKey(e.target.value as NoteName)}
            className="bg-secondary text-secondary-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border border-border"
          >
            {NOTE_NAMES.map(n => <option key={n} value={n}>{n} Major</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Genre</span>
          <select
            value={genre}
            onChange={e => setGenre(e.target.value as Genre)}
            className="bg-secondary text-secondary-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border border-border"
          >
            <option value="Rock">Rock</option>
            <option value="Pop">Pop</option>
            <option value="Jazz">Jazz</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Snap</span>
          {(['1/4', '1/8', '1/16'] as SnapValue[]).map(s => (
            <button
              key={s}
              onClick={() => setSnap(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                snap === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Bars</span>
          <input
            type="number"
            value={measures}
            onChange={e => setMeasures(Math.max(1, Math.min(32, Number(e.target.value))))}
            className="w-10 bg-secondary text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center"
          />
        </div>

        {/* Diatonic chord buttons */}
        <div className="flex items-center gap-0.5 ml-1">
          {diatonicChords.map((dc, i) => (
            <button
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/diatonic-degree', JSON.stringify({ degree: i }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="w-7 h-6 rounded text-[8px] font-mono font-bold flex items-center justify-center cursor-grab active:cursor-grabbing border border-transparent hover:border-foreground/20 transition-all"
              style={{
                backgroundColor: `hsl(${SCALE_DEGREE_COLORS[i]} / 0.35)`,
                color: `hsl(${SCALE_DEGREE_COLORS[i]})`,
              }}
              title={`${dc.symbol} — ${dc.roman} — drag to timeline`}
            >
              {dc.roman}
            </button>
          ))}
        </div>

        <button
          onClick={onClearTimeline}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Clear timeline"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {/* Measure labels */}
        <div className="flex items-center" style={{ minWidth: `${measures * 200}px` }}>
          <div className="w-0" />
          {Array.from({ length: measures }, (_, m) => (
            <div key={m} className="flex-1 text-center border-l border-border/50 first:border-l-0">
              <span className="text-[9px] font-mono text-muted-foreground">{m + 1}</span>
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div
          ref={gridRef}
          className="relative flex-1 bg-secondary/20 border-t border-border/30"
          style={{ minWidth: `${measures * 200}px`, height: `calc(100% - 24px)` }}
          onDrop={handleGridDrop}
          onDragOver={handleGridDragOver}
          onDoubleClick={handleGridDoubleClick}
        >
          {/* Grid lines */}
          {Array.from({ length: totalBeats }, (_, i) => {
            const isMeasure = i % 4 === 0;
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${isMeasure ? 'border-l border-border/60' : 'border-l border-border/20'}`}
                style={{ left: `${(i / totalBeats) * 100}%` }}
              />
            );
          })}

          {/* Sub-beat lines */}
          {snap !== '1/4' && Array.from({ length: totalBeats * 2 }, (_, i) => {
            if (i % 2 === 0) return null;
            return (
              <div
                key={`8-${i}`}
                className="absolute top-0 bottom-0 border-l border-border/10"
                style={{ left: `${(i / (totalBeats * 2)) * 100}%` }}
              />
            );
          })}

          {/* Playhead */}
          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
              style={{ left: `${playheadPct}%`, boxShadow: '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary))' }}
            />
          )}

          {/* Chord blocks */}
          {chords.map(chord => {
            const leftPct = (chord.startBeat / totalBeats) * 100;
            const widthPct = (chord.duration / totalBeats) * 100;
            const color = getChordColor(chord);
            const degree = getChordDegree(timelineKey, chord.root, chord.chordType);
            const isDiatonic = degree >= 0;

            return (
              <div
                key={chord.id}
                className="absolute top-2 rounded-md border cursor-grab active:cursor-grabbing select-none flex items-center group"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: 'calc(100% - 16px)',
                  backgroundColor: isDiatonic ? `hsl(${color} / 0.4)` : `hsl(${color} / 0.15)`,
                  borderColor: isDiatonic ? `hsl(${color} / 0.7)` : `hsl(${color} / 0.3)`,
                  borderStyle: isDiatonic ? 'solid' : 'dashed',
                  minWidth: 20,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX > rect.right - 8) {
                    setResizeChord(chord.id);
                  } else {
                    setDragChord(chord.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onRemoveChord(chord.id);
                }}
                title={`${chord.root} ${chord.chordType}${isDiatonic ? ` (${ROMAN_NUMERALS[degree]})` : ' — outside key'} — double-click to remove`}
              >
                <span
                  className="text-[10px] font-mono font-bold px-1.5 truncate"
                  style={{ color: `hsl(${color})` }}
                >
                  {chord.root}{chord.chordType === 'Major' ? '' : chord.chordType === 'Minor' ? 'm' : ` ${chord.chordType}`}
                </span>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: `hsl(${color} / 0.4)` }}
                />
              </div>
            );
          })}

          {/* Variation popup */}
          {variationPopup && (
            <div
              className="absolute z-50 bg-card border border-border rounded-lg shadow-xl p-2 w-56 max-h-48 overflow-y-auto"
              style={{ left: variationPopup.x, top: Math.max(0, variationPopup.y) }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
                  Choose variation ({ROMAN_NUMERALS[variationPopup.degree]})
                </span>
                <button onClick={() => setVariationPopup(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              </div>
              <div className="space-y-0.5">
                {variations.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectVariation(v)}
                    className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                      v.isDiatonic
                        ? 'bg-muted/50 border-transparent hover:bg-muted text-foreground'
                        : 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{v.label}</span>
                      {!v.isDiatonic && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-bold">BORROWED</span>
                      )}
                    </div>
                    {v.borrowedFrom && (
                      <div className="text-[8px] text-muted-foreground mt-0.5 leading-tight">
                        ⚠ {v.borrowedFrom}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Drop hint text when empty */}
          {chords.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-mono text-muted-foreground/50">
                Drag chords or roman numerals to the timeline
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
