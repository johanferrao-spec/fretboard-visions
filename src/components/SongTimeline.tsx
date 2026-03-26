import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Square, Trash2, Music, X } from 'lucide-react';
import type { TimelineChord, SnapValue, Genre } from '@/hooks/useSongTimeline';
import type { NoteName } from '@/lib/music';
import {
  NOTE_NAMES, CHORD_FORMULAS, getDiatonicChords, getChordVariations,
  getChordDegree, SCALE_DEGREE_COLORS, ROMAN_NUMERALS, ROMAN_NUMERALS_MINOR,
  type ChordVariation, type KeyMode,
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
  onTrimOverlaps: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  timelineKey: NoteName;
  setTimelineKey: (k: NoteName) => void;
  keyMode: KeyMode;
  setKeyMode: (m: KeyMode) => void;
  onSeek?: (beat: number) => void;
  onSetChordBass?: (id: string, bassNote: NoteName | undefined) => void;
}

export default function SongTimeline({
  chords, measures, setMeasures, bpm, setBpm,
  genre, setGenre, snap, setSnap,
  isPlaying, currentBeat, panelHeight, setPanelHeight,
  onPlay, onStop, onAddChord, onMoveChord, onResizeChord, onRemoveChord, onClearTimeline, onTrimOverlaps,
  volume, onVolumeChange, timelineKey, setTimelineKey, keyMode, setKeyMode,
  onSeek, onSetChordBass,
}: SongTimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragChord, setDragChord] = useState<string | null>(null);
  const [resizeChord, setResizeChord] = useState<string | null>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ beat: number; root: NoteName; chordType: string } | null>(null);
  const [bpmDragging, setBpmDragging] = useState(false);
  const bpmDragRef = useRef<{ startY: number; startBpm: number }>({ startY: 0, startBpm: 120 });
  const [variationPopup, setVariationPopup] = useState<{
    chordId: string;
    degree: number;
    x: number;
    y: number;
  } | null>(null);

  const totalBeats = measures * 4;
  const snapGrid = snap === '1/4' ? 1 : snap === '1/8' ? 0.5 : 0.25;

  const diatonicChords = useMemo(() => getDiatonicChords(timelineKey, keyMode), [timelineKey, keyMode]);
  const { numerals: currentNumerals } = useMemo(() => {
    const ALL_MODES: KeyMode[] = ['major', 'minor', 'ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
    if (keyMode === 'minor') return { numerals: ROMAN_NUMERALS_MINOR };
    if (keyMode === 'major') return { numerals: ROMAN_NUMERALS };
    // For modes, compute numerals
    const qualities = diatonicChords.map(dc => {
      if (dc.type === 'Minor') return dc.roman;
      if (dc.type === 'Diminished') return dc.roman;
      return dc.roman;
    });
    return { numerals: diatonicChords.map(dc => dc.roman) };
  }, [keyMode, diatonicChords]);

  const getBeatFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const rawBeat = (x / rect.width) * totalBeats;
    return Math.max(0, Math.min(totalBeats - snapGrid, Math.round(rawBeat / snapGrid) * snapGrid));
  }, [totalBeats, snapGrid]);

  const getRawBeatFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const rawBeat = (x / rect.width) * totalBeats;
    return Math.max(0, Math.min(totalBeats, rawBeat));
  }, [totalBeats]);

  // Drag move
  useEffect(() => {
    if (!dragChord) return;
    const onMove = (e: MouseEvent) => onMoveChord(dragChord, getBeatFromX(e.clientX));
    const onUp = () => { setDragChord(null); onTrimOverlaps(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragChord, getBeatFromX, onMoveChord, onTrimOverlaps]);

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
    const onUp = () => { setResizeChord(null); onTrimOverlaps(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizeChord, chords, getBeatFromX, onResizeChord, snapGrid, onTrimOverlaps]);

  // Playhead drag
  useEffect(() => {
    if (!playheadDragging) return;
    const onMove = (e: MouseEvent) => {
      const beat = getRawBeatFromX(e.clientX);
      onSeek?.(beat);
    };
    const onUp = () => setPlayheadDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [playheadDragging, getRawBeatFromX, onSeek]);

  // Spacebar play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        if (isPlaying) onStop(); else onPlay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, onPlay, onStop]);

  // BPM drag
  useEffect(() => {
    if (!bpmDragging) return;
    const onMove = (e: MouseEvent) => {
      const dy = bpmDragRef.current.startY - e.clientY;
      const newBpm = Math.max(40, Math.min(300, bpmDragRef.current.startBpm + Math.round(dy / 2)));
      setBpm(newBpm);
    };
    const onUp = () => setBpmDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [bpmDragging, setBpm]);

  // Handle drop from chord library, diatonic buttons, or identify tab
  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragPreview(null);
    const beat = getBeatFromX(e.clientX);
    const dur = 2; // half a bar default

    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      const { degree } = JSON.parse(degreeData);
      const dc = diatonicChords[degree];
      // Remove any overlapping chords
      const existingOverlaps = chords.filter(c => {
        const cEnd = c.startBeat + c.duration;
        return (beat < cEnd && beat + dur > c.startBeat);
      });
      existingOverlaps.forEach(c => onRemoveChord(c.id));
      onAddChord(dc.root, dc.type, beat, dur);
      return;
    }

    const data = e.dataTransfer.getData('application/chord');
    if (!data) return;
    try {
      const { root, chordType } = JSON.parse(data);
      // Remove any overlapping chords
      const existingOverlaps = chords.filter(c => {
        const cEnd = c.startBeat + c.duration;
        return (beat < cEnd && beat + dur > c.startBeat);
      });
      existingOverlaps.forEach(c => onRemoveChord(c.id));
      onAddChord(root, chordType, beat, dur);
    } catch {}
  }, [getBeatFromX, onAddChord, chords, diatonicChords, onRemoveChord]);

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const beat = getBeatFromX(e.clientX);
    // Try to extract chord info for preview
    const degreeData = e.dataTransfer.types.includes('application/diatonic-degree');
    const chordData = e.dataTransfer.types.includes('application/chord');
    if (degreeData || chordData) {
      setDragPreview({ beat, root: 'C' as NoteName, chordType: 'Major' });
    }
  }, [getBeatFromX]);

  const handleGridDragLeave = useCallback(() => {
    setDragPreview(null);
  }, []);

  const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
    const beat = getBeatFromX(e.clientX);
    // Remove any overlapping chords
    const dur = 2;
    const existingOverlaps = chords.filter(c => {
      const cEnd = c.startBeat + c.duration;
      return (beat < cEnd && beat + dur > c.startBeat);
    });
    existingOverlaps.forEach(c => onRemoveChord(c.id));
    onAddChord('C', 'Major', beat, dur);
  }, [getBeatFromX, onAddChord, chords, onRemoveChord]);

  // Click a chord block to seek playhead there and pause
  const handleChordClick = useCallback((chord: TimelineChord, e: React.MouseEvent) => {
    e.stopPropagation();
    // Seek to this chord's start beat and pause
    if (isPlaying) onStop();
    onSeek?.(chord.startBeat);
  }, [isPlaying, onStop, onSeek]);

  // Right-click for variations
  const handleChordContextMenu = useCallback((chord: TimelineChord, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const degree = getChordDegree(timelineKey, chord.root, chord.chordType, keyMode);
    if (degree < 0) return;
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setVariationPopup({
      chordId: chord.id,
      degree,
      x: blockRect.left + blockRect.width / 2,
      y: blockRect.top,
    });
  }, [timelineKey, keyMode]);

  const handleSelectVariation = useCallback((v: ChordVariation) => {
    if (!variationPopup) return;
    const chord = chords.find(c => c.id === variationPopup.chordId);
    if (chord) {
      onRemoveChord(variationPopup.chordId);
      onAddChord(v.root, v.type, chord.startBeat, chord.duration);
    }
    setVariationPopup(null);
  }, [variationPopup, chords, onRemoveChord, onAddChord]);

  const variations = useMemo(() => {
    if (!variationPopup) return [];
    return getChordVariations(timelineKey, variationPopup.degree, keyMode);
  }, [variationPopup, timelineKey, keyMode]);

  const playheadPct = (currentBeat / totalBeats) * 100;

  // Click on measure bar area to seek
  const handleMeasureBarClick = useCallback((e: React.MouseEvent) => {
    const beat = getRawBeatFromX(e.clientX);
    if (isPlaying) onStop();
    onSeek?.(beat);
  }, [getRawBeatFromX, isPlaying, onStop, onSeek]);

  // Get color for a chord based on its degree in the key
  const getChordColor = (chord: TimelineChord): string => {
    const degree = getChordDegree(timelineKey, chord.root, chord.chordType, keyMode);
    if (degree >= 0) return SCALE_DEGREE_COLORS[degree];
    return '220, 15%, 50%';
  };

  const isBorrowed = (chord: TimelineChord): boolean => {
    const degree = getChordDegree(timelineKey, chord.root, chord.chordType, keyMode);
    return degree < 0;
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

        {/* Volume slider — grows taller with volume, green→red, glowing */}
        <div className="flex items-center gap-1" title={`Volume: ${Math.round(volume * 100)}%`}>
          <span className="text-[9px] font-mono text-muted-foreground">🔊</span>
          <div className="relative flex items-end" style={{ width: 48 }}>
            <input
              type="range"
              min={0}
              max={100}
              value={volume * 100}
              onChange={e => onVolumeChange(Number(e.target.value) / 100)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              style={{ height: 24 }}
            />
            <div
              className="rounded-sm transition-all duration-150"
              style={{
                width: '100%',
                height: Math.max(4, 4 + volume * 18),
                background: `linear-gradient(90deg, hsl(120, 70%, 45%) 0%, hsl(${60 - volume * 60}, ${70 + volume * 20}%, ${45 + volume * 10}%) ${volume * 100}%, hsl(220, 10%, 25%) ${volume * 100}%)`,
                boxShadow: volume > 0.7
                  ? `0 0 ${6 + (volume - 0.7) * 30}px hsl(${Math.max(0, 30 - volume * 40)}, 80%, 50%, ${0.3 + volume * 0.4})`
                  : `0 0 4px hsl(120, 70%, 45%, ${volume * 0.4})`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Music size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase">BPM</span>
          <div
            className="w-12 text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center select-none cursor-ns-resize"
            style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)' }}
            title="Drag up/down to change BPM"
            onMouseDown={(e) => {
              e.preventDefault();
              setBpmDragging(true);
              bpmDragRef.current = { startY: e.clientY, startBpm: bpm };
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const input = document.createElement('input');
              input.type = 'number';
              input.value = String(bpm);
              input.className = 'w-12 text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center';
              input.style.backgroundColor = 'hsl(210, 70%, 80%, 0.2)';
              const target = e.currentTarget;
              target.replaceWith(input);
              input.focus();
              input.select();
              const finish = () => {
                const val = Math.max(40, Math.min(300, Number(input.value) || 120));
                setBpm(val);
                input.replaceWith(target);
              };
              input.addEventListener('blur', finish);
              input.addEventListener('keydown', (ke) => { if (ke.key === 'Enter') { ke.preventDefault(); finish(); }});
            }}
          >
            {bpm}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Key</span>
          <select
            value={timelineKey}
            onChange={e => setTimelineKey(e.target.value as NoteName)}
            className="text-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border appearance-none" style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)', borderColor: 'hsl(210, 60%, 70%, 0.4)' }}
          >
            {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="flex">
            {(['major', 'minor'] as KeyMode[]).map(m => (
              <button
                key={m}
                onClick={() => setKeyMode(m)}
                className={`px-1.5 py-0.5 text-[9px] font-mono uppercase transition-colors ${
                  keyMode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'
                } ${m === 'major' ? 'rounded-l' : 'rounded-r'}`}
              >{m}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Genre</span>
          <select
            value={genre}
            onChange={e => setGenre(e.target.value as Genre)}
            className="text-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border appearance-none" style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)', borderColor: 'hsl(210, 60%, 70%, 0.4)' }}
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
                snap === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'
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
            className="w-10 text-foreground text-[10px] font-mono rounded px-1 py-0.5 border border-border text-center" style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)' }}
          />
        </div>

        {/* Diatonic chord buttons */}
        <div className="flex items-center gap-1 ml-1">
          {diatonicChords.map((dc, i) => (
            <button
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/diatonic-degree', JSON.stringify({ degree: i }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="w-8 h-6 rounded-md text-[8px] font-mono font-bold flex items-center justify-center cursor-grab active:cursor-grabbing transition-all hover:brightness-110"
              style={{
                backgroundColor: `hsl(${SCALE_DEGREE_COLORS[i]})`,
                color: '#000',
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
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Measure labels — clickable to place playhead */}
        <div
          className="flex items-center cursor-pointer select-none"
          onMouseDown={(e) => {
            // Use gridRef position mapping
            if (!gridRef.current) return;
            const beat = getRawBeatFromX(e.clientX);
            if (isPlaying) onStop();
            onSeek?.(beat);
            setPlayheadDragging(true);
          }}
        >
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
          style={{ height: `calc(100% - 24px)` }}
          onDrop={handleGridDrop}
          onDragOver={handleGridDragOver}
          onDragLeave={handleGridDragLeave}
          onDoubleClick={handleGridDoubleClick}
          onClick={() => setVariationPopup(null)}
        >
          {/* Grid lines — beat and measure lines */}
          {Array.from({ length: totalBeats }, (_, i) => {
            const isMeasure = i % 4 === 0;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${(i / totalBeats) * 100}%`,
                  borderLeft: isMeasure ? '1.5px solid hsl(220, 15%, 35%)' : '1px solid hsl(220, 15%, 25%)',
                }}
              />
            );
          })}

          {/* Sub-beat lines */}
          {snap !== '1/4' && Array.from({ length: totalBeats * (snap === '1/16' ? 4 : 2) }, (_, i) => {
            const divisor = snap === '1/16' ? 4 : 2;
            if (i % divisor === 0) return null;
            return (
              <div
                key={`sub-${i}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${(i / (totalBeats * divisor)) * 100}%`,
                  borderLeft: '1px dashed hsl(220, 15%, 20%)',
                }}
              />
            );
          })}

          {/* Playhead — always visible, draggable */}
          <div
            className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
            style={{
              left: `${playheadPct}%`,
              transform: 'translateX(-6px)',
              width: 12,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlayheadDragging(true);
            }}
          >
            {/* Playhead line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                boxShadow: '0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary))',
              }}
            />
            {/* Playhead handle triangle */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-1 w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid hsl(var(--primary))',
                filter: 'drop-shadow(0 0 4px hsl(var(--primary)))',
              }}
            />
          </div>

          {/* Drag preview ghost cell */}
          {dragPreview && (
            <div
              className="absolute top-2 rounded-md pointer-events-none"
              style={{
                left: `${(dragPreview.beat / totalBeats) * 100}%`,
                width: `${(2 / totalBeats) * 100}%`,
                height: 'calc(100% - 16px)',
                backgroundColor: 'hsl(var(--primary) / 0.2)',
                border: '2px dashed hsl(var(--primary) / 0.5)',
                minWidth: 20,
              }}
            />
          )}

          {/* Chord blocks */}
          {chords.map(chord => {
            const leftPct = (chord.startBeat / totalBeats) * 100;
            const widthPct = (chord.duration / totalBeats) * 100;
            const color = getChordColor(chord);
            const degree = getChordDegree(timelineKey, chord.root, chord.chordType, keyMode);
            const isDiatonic = degree >= 0;
            const borrowed = isBorrowed(chord);
            const chordLabel = `${chord.root}${chord.chordType === 'Major' ? '' : chord.chordType === 'Minor' ? 'm' : ` ${chord.chordType}`}`;
            const bassLabel = chord.bassNote ? `/${chord.bassNote}` : '';

            return (
              <div
                key={chord.id}
                className="absolute top-2 rounded-md cursor-grab active:cursor-grabbing select-none flex items-center group"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: 'calc(100% - 16px)',
                  backgroundColor: borrowed
                    ? 'hsl(50, 90%, 55%)'
                    : isDiatonic ? `hsl(${color})` : `hsl(${color} / 0.3)`,
                  border: borrowed
                    ? '1px solid hsl(50, 90%, 65%)'
                    : isDiatonic ? 'none' : '1px dashed hsl(var(--border))',
                  minWidth: 20,
                  ...(borrowed ? {
                    boxShadow: '0 0 8px hsl(50, 90%, 55%, 0.6), 0 0 16px hsl(50, 90%, 55%, 0.3)',
                  } : {}),
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
                onClick={(e) => handleChordClick(chord, e)}
                onContextMenu={(e) => handleChordContextMenu(chord, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onRemoveChord(chord.id);
                }}
                title={`${chordLabel}${bassLabel}${isDiatonic ? ` (${currentNumerals[degree]})` : borrowed ? ' — borrowed' : ''} — click: seek, right-click: variations/bass, dbl-click: remove`}
              >
                <span
                  className="text-[10px] font-mono font-bold px-1.5 truncate"
                  style={{ color: borrowed ? '#000' : isDiatonic ? '#000' : `hsl(${color})` }}
                >
                  {chordLabel}{bassLabel && <span className="opacity-70">{bassLabel}</span>}
                </span>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
                />
              </div>
            );
          })}

          {/* Variation popup — speech bubble style, appears above the chord */}
          {variationPopup && (
            <div
              className="fixed z-[9999]"
              style={{
                left: Math.max(8, variationPopup.x - 112),
                top: Math.max(-200, variationPopup.y - 8),
                transform: 'translateY(-100%)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-lg shadow-xl p-2 w-56 max-h-48 overflow-y-auto relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
                    Variations ({currentNumerals[variationPopup.degree]})
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
                          : 'border-transparent hover:brightness-110 text-foreground'
                      }`}
                      style={!v.isDiatonic ? {
                        backgroundColor: 'hsl(50, 90%, 55%, 0.15)',
                        borderColor: 'hsl(50, 90%, 55%, 0.3)',
                      } : {}}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{v.label}</span>
                        {!v.isDiatonic && (
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                            style={{ backgroundColor: 'hsl(50, 90%, 55%, 0.3)', color: 'hsl(50, 70%, 35%)' }}>
                            BORROWED
                          </span>
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
                {/* Altered bass note selector */}
                <div className="mt-1.5 pt-1.5 border-t border-border/30">
                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Bass Note</div>
                  <div className="flex flex-wrap gap-0.5">
                    <button
                      onClick={() => { onSetChordBass?.(variationPopup.chordId, undefined); setVariationPopup(null); }}
                      className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    >Root</button>
                    {NOTE_NAMES.map(n => (
                      <button
                        key={n}
                        onClick={() => { onSetChordBass?.(variationPopup.chordId, n); setVariationPopup(null); }}
                        className="px-1 py-0.5 rounded text-[8px] font-mono bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >{n}</button>
                    ))}
                  </div>
                </div>
                {/* Speech bubble arrow pointing down */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-card border-r border-b border-border rotate-45"
                />
              </div>
            </div>
          )}

          {/* Drop hint text when empty */}
          {chords.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-mono text-muted-foreground/50">
                Drag chords to the timeline
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
