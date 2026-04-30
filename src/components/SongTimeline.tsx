import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Square, Trash2, Music, X, ChevronDown, ChevronUp, Save, FolderOpen, LayoutGrid, List, ChevronsLeftRight, RefreshCw } from 'lucide-react';
import type { TimelineChord, SnapValue, Genre, GrooveId } from '@/hooks/useSongTimeline';
import type { NoteName } from '@/lib/music';
import {
  NOTE_NAMES, CHORD_FORMULAS, getDiatonicChords, getChordVariations,
  getChordDegree, SCALE_DEGREE_COLORS, ROMAN_NUMERALS, ROMAN_NUMERALS_MINOR,
  type ChordVariation, type KeyMode,
} from '@/lib/music';
import CellGridView from './ChordCellGrid';

interface SongTimelineProps {
  chords: TimelineChord[];
  measures: number;
  setMeasures: (v: number) => void;
  bpm: number;
  setBpm: (v: number) => void;
  genre: Genre;
  setGenre: (v: Genre) => void;
  groove: GrooveId;
  setGroove: (v: GrooveId) => void;
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
  onCommitMove: (id: string) => void;
  onResizeChord: (id: string, newDuration: number) => void;
  onResizeChordRange: (id: string, newStartBeat: number, newDuration: number) => void;
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
  /** When backing-track tab is open, show extra controls in the toolbar */
  backingTrackActive?: boolean;
  onOpenBackingTrack?: () => void;
  onCloseBackingTrack?: () => void;
  onRegenerateBackingMidi?: () => void;
  onSaveBackingTrack?: (name: string) => void;
  onLoadBackingTrack?: (id: string) => void;
  onDeleteBackingTrack?: (id: string) => void;
  savedBackingTracks?: { id: string; name: string }[];
}

export default function SongTimeline({
  chords, measures, setMeasures, bpm, setBpm,
  genre, setGenre, groove, setGroove, snap, setSnap,
  isPlaying, currentBeat, panelHeight, setPanelHeight,
  onPlay, onStop, onAddChord, onMoveChord, onCommitMove, onResizeChord, onResizeChordRange, onRemoveChord, onClearTimeline, onTrimOverlaps,
  volume, onVolumeChange, timelineKey, setTimelineKey, keyMode, setKeyMode,
  onSeek, onSetChordBass,
  backingTrackActive, onOpenBackingTrack, onCloseBackingTrack,
  onRegenerateBackingMidi,
  onSaveBackingTrack, onLoadBackingTrack, onDeleteBackingTrack, savedBackingTracks = [],
}: SongTimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragChord, setDragChord] = useState<{ id: string; offsetBeats: number } | null>(null);
  const [zHeld, setZHeld] = useState(false);
  const [xHeld, setXHeld] = useState(false);
  const [cmdHeld, setCmdHeld] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [resizeChord, setResizeChord] = useState<{
    id: string;
    edge: 'left' | 'right';
    origStart: number;
    origDuration: number;
  } | null>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ beat: number; root: NoteName; chordType: string } | null>(null);
  const [bpmDragging, setBpmDragging] = useState(false);
  const [showSavePop, setShowSavePop] = useState(false);
  const [showLoadPop, setShowLoadPop] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [cellView, setCellView] = useState(false);
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

  // Helpers to convert chord types between triad/seventh/dominant variants.
  const toSeventh = useCallback((type: string): string => {
    if (type === 'Major') return 'Major 7';
    if (type === 'Minor') return 'Minor 7';
    if (type === 'Diminished') return 'Half-Dim 7';
    if (type === 'Augmented') return 'Aug 7';
    return type; // already extended
  }, []);
  const toDominant7 = useCallback((_type: string): string => 'Dominant 7', []);
  const toTriad = useCallback((type: string): string => {
    if (type === 'Major 7' || type === 'Dominant 7' || type === 'Major 9' || type === 'Dominant 9' || type === 'Major 6' || type === 'Add9' || type === '13' || type === '11' || type === 'Maj11' || type === 'Maj13') return 'Major';
    if (type === 'Minor 7' || type === 'Minor 9' || type === 'Minor 6' || type === 'Madd9' || type === 'Minor 11' || type === 'Minor 13' || type === 'Min/Maj 7') return 'Minor';
    if (type === 'Half-Dim 7' || type === 'Dim 7') return 'Diminished';
    if (type === 'Aug 7') return 'Augmented';
    return type;
  }, []);

  // Mutate one chord by id via remove+add (preserves position/duration)
  const mutateChordType = useCallback((id: string, mapper: (t: string) => string) => {
    const c = chords.find(ch => ch.id === id);
    if (!c) return;
    const newType = mapper(c.chordType);
    if (newType === c.chordType) return;
    onRemoveChord(id);
    const newId = onAddChord(c.root, newType, c.startBeat, c.duration);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.delete(id)) next.add(newId);
      return next;
    });
  }, [chords, onAddChord, onRemoveChord]);

  // Drag move — preserves the cursor's grab-offset within the region so the
  // region doesn't snap its start to the cursor. Hold Z to force the moved
  // region to a full bar (4 beats) duration. Hold X to convert it to dom7.
  useEffect(() => {
    if (!dragChord) return;
    const onMove = (e: MouseEvent) => {
      const rawBeat = getRawBeatFromX(e.clientX);
      const desiredStart = rawBeat - dragChord.offsetBeats;
      const snapped = Math.max(0, Math.min(totalBeats - snapGrid, Math.round(desiredStart / snapGrid) * snapGrid));
      onMoveChord(dragChord.id, snapped);
      if (zHeld) onResizeChord(dragChord.id, 4);
    };
    const onUp = () => {
      const id = dragChord.id;
      if (xHeld) mutateChordType(id, toDominant7);
      setDragChord(null);
      onCommitMove(id);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragChord, getRawBeatFromX, onMoveChord, onCommitMove, onResizeChord, zHeld, xHeld, snapGrid, totalBeats, mutateChordType, toDominant7]);

  // Track Z (whole-bar drag), X (dom7), and Cmd/Ctrl (delete cursor) modifiers
  // plus shortcut keys: Z extends selected chord(s) to a full bar; X converts
  // selected chord(s) to dominant 7; A converts selected chord(s) to triads.
  useEffect(() => {
    const isTextTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
    const onDown = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        setZHeld(true);
        // Apply Z to selected when not actively dragging a chord
        if (!dragChord && selectedIds.size > 0) {
          selectedIds.forEach(id => onResizeChord(id, 4));
        }
      }
      if (k === 'x') {
        setXHeld(true);
        if (!dragChord && selectedIds.size > 0) {
          Array.from(selectedIds).forEach(id => mutateChordType(id, toDominant7));
        }
      }
      if (k === 'a') {
        if (selectedIds.size > 0) {
          Array.from(selectedIds).forEach(id => mutateChordType(id, toTriad));
        }
      }
      if (e.metaKey || e.ctrlKey) setCmdHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'z') setZHeld(false);
      if (k === 'x') setXHeld(false);
      if (!e.metaKey && !e.ctrlKey) setCmdHeld(false);
    };
    const onBlur = () => { setZHeld(false); setXHeld(false); setCmdHeld(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [dragChord, selectedIds, onResizeChord, mutateChordType, toDominant7, toTriad]);

  // Resize chord from either edge; resize uses the range handler so dragged
  // edges consume/shrink neighbouring chord regions while the mouse moves.
  useEffect(() => {
    if (!resizeChord) return;
    const origEnd = resizeChord.origStart + resizeChord.origDuration;
    const onMove = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawBeat = ((e.clientX - rect.left) / rect.width) * totalBeats;
      const snappedBeat = Math.max(0, Math.min(totalBeats, Math.round(rawBeat / snapGrid) * snapGrid));

      if (resizeChord.edge === 'right') {
        const nextEnd = Math.max(resizeChord.origStart + snapGrid, snappedBeat);
        onResizeChordRange(resizeChord.id, resizeChord.origStart, nextEnd - resizeChord.origStart);
      } else {
        const nextStart = Math.min(origEnd - snapGrid, snappedBeat);
        onResizeChordRange(resizeChord.id, nextStart, origEnd - nextStart);
      }
    };
    const onUp = () => { setResizeChord(null); onTrimOverlaps(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizeChord, onResizeChordRange, snapGrid, totalBeats, onTrimOverlaps]);

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
    // Use raw beat for hit-testing existing chords (more accurate than snapped grid beat)
    const rawBeat = getRawBeatFromX(e.clientX);
    const beat = getBeatFromX(e.clientX);
    const dur = 2; // half a bar default

    const degreeData = e.dataTransfer.getData('application/diatonic-degree');
    if (degreeData) {
      const { degree } = JSON.parse(degreeData);
      const dc = diatonicChords[degree];
      // Always add a new chord region; replace overlaps. Bass-note assignment
      // is no longer triggered by dropping a degree on top of an existing chord
      // — use right-click on a chord cell to change its bass note instead.
      const existingOverlaps = chords.filter(c => {
        const cEnd = c.startBeat + c.duration;
        return (beat < cEnd && beat + dur > c.startBeat);
      });
      existingOverlaps.forEach(c => onRemoveChord(c.id));
      // Default to 7th-quality chord; X drag overrides to dominant 7
      const baseType = xHeld ? 'Dominant 7' : toSeventh(dc.type);
      onAddChord(dc.root, baseType, beat, dur);
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
      const finalType = xHeld ? 'Dominant 7' : toSeventh(chordType);
      onAddChord(root, finalType, beat, dur);
    } catch {}
  }, [getBeatFromX, getRawBeatFromX, onAddChord, chords, diatonicChords, onRemoveChord, onSetChordBass, xHeld, toSeventh]);

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
    onAddChord('C', 'Major 7', beat, dur);
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

  // In cell view, grow vertically as more rows of cells are added (each row ≈ 90px tall + gap).
  const cellRows = cellView ? Math.max(1, Math.ceil(Math.ceil(measures / 4) / 4)) : 0;
  const containerHeight = cellView ? 50 + cellRows * 100 : 160;

  return (
    <div
      className="border-t border-border bg-card flex flex-col shrink-0"
      style={{ height: containerHeight }}
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
          <select
            value={keyMode}
            onChange={e => setKeyMode(e.target.value as KeyMode)}
            className="text-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border appearance-none" style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)', borderColor: 'hsl(210, 60%, 70%, 0.4)' }}
          >
            {(['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] as KeyMode[]).map(m => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
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
            <option value="Funk">Funk</option>
            <option value="Latin">Latin</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Groove</span>
          <select
            value={groove}
            onChange={e => setGroove(Number(e.target.value) as GrooveId)}
            disabled={genre !== 'Funk'}
            className="text-foreground text-[10px] font-mono uppercase rounded px-1.5 py-0.5 border appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'hsl(210, 70%, 80%, 0.2)', borderColor: 'hsl(210, 60%, 70%, 0.4)' }}
            title={genre === 'Funk' ? 'Pick a groove preset' : 'Grooves are available for the Funk genre'}
          >
            <option value={1}>1</option>
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

        <div className="ml-auto flex items-center gap-1 relative">
          {backingTrackActive && (
            <>
              <button
                onClick={() => { setShowSavePop(s => !s); setShowLoadPop(false); }}
                className="px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                title="Save backing track"
              >
                <Save size={10} /> Save
              </button>
              <button
                onClick={() => { setShowLoadPop(s => !s); setShowSavePop(false); }}
                className="px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-1"
                title="Load backing track"
              >
                <FolderOpen size={10} /> Load
                {savedBackingTracks.length > 0 && (
                  <span className="text-[8px] bg-muted rounded px-1 ml-0.5">{savedBackingTracks.length}</span>
                )}
              </button>
              {showSavePop && (
                <div className="absolute right-12 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl p-2 w-56 animate-fade-in">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">Save Backing Track</div>
                  <input
                    type="text" placeholder="Track name…" value={saveName}
                    onChange={e => setSaveName(e.target.value)} autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && saveName.trim()) {
                        onSaveBackingTrack?.(saveName.trim()); setSaveName(''); setShowSavePop(false);
                      } else if (e.key === 'Escape') setShowSavePop(false);
                    }}
                    className="w-full bg-muted text-foreground text-[11px] font-mono rounded px-2 py-1 border border-border mb-1.5"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => { if (saveName.trim()) { onSaveBackingTrack?.(saveName.trim()); setSaveName(''); setShowSavePop(false); } }}
                      className="flex-1 px-2 py-1 rounded text-[9px] font-mono uppercase bg-primary text-primary-foreground hover:bg-primary/90"
                    >Save</button>
                    <button
                      onClick={() => setShowSavePop(false)}
                      className="px-2 py-1 rounded text-[9px] font-mono uppercase bg-secondary text-secondary-foreground hover:bg-muted"
                    >Cancel</button>
                  </div>
                </div>
              )}
              {showLoadPop && (
                <div className="absolute right-12 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl p-2 w-64 max-h-64 overflow-y-auto animate-fade-in">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">Saved Backing Tracks</div>
                  {savedBackingTracks.length === 0 ? (
                    <div className="text-[10px] font-mono text-muted-foreground py-2 text-center">No saved tracks yet</div>
                  ) : savedBackingTracks.map(t => (
                    <div key={t.id} className="flex items-center gap-1 mb-1">
                      <button
                        onClick={() => { onLoadBackingTrack?.(t.id); setShowLoadPop(false); }}
                        className="flex-1 text-left px-2 py-1 rounded text-[10px] font-mono bg-muted/40 text-foreground hover:bg-muted transition-colors truncate"
                      >{t.name}</button>
                      <button
                        onClick={() => { if (confirm(`Delete "${t.name}"?`)) onDeleteBackingTrack?.(t.id); }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            onClick={onClearTimeline}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Clear timeline"
          >
            <Trash2 size={13} />
          </button>
          {!backingTrackActive && onOpenBackingTrack && (
            <button
              onClick={onOpenBackingTrack}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Open Backing Track DAW"
            >
              <ChevronUp size={14} />
            </button>
          )}
          {backingTrackActive && onCloseBackingTrack && (
            <button
              onClick={onCloseBackingTrack}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Hide backing track DAW"
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Measure labels — clickable to place playhead.
            When backing-track DAW is open, leave a 200px left spacer to align
            with the per-track lane headers below so all grids share the same X axis. */}
        <div
          className="flex items-center cursor-pointer select-none"
          onMouseDown={(e) => {
            if (cellView) return;
            if (!gridRef.current) return;
            const beat = getRawBeatFromX(e.clientX);
            if (isPlaying) onStop();
            onSeek?.(beat);
            setPlayheadDragging(true);
          }}
        >
          {backingTrackActive && (
            <div
              style={{ width: 200, minWidth: 200 }}
              className="flex items-center gap-1 px-2 h-5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Chords</span>
              <button
                onClick={() => setCellView(v => !v)}
                className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider flex items-center gap-1 transition-colors ${
                  cellView
                    ? 'bg-primary/30 text-primary hover:bg-primary/40'
                    : 'bg-secondary text-muted-foreground hover:bg-muted'
                }`}
                title={cellView ? 'Switch to linear view' : 'Switch to cell view'}
              >
                {cellView ? <List size={9} /> : <LayoutGrid size={9} />}
                Switch View
              </button>
            </div>
          )}
          {!cellView && (
            <div className="flex-1 flex items-center">
              {Array.from({ length: measures }, (_, m) => (
                <div key={m} className="flex-1 text-center border-l border-border/50 first:border-l-0">
                  <span className="text-[9px] font-mono text-muted-foreground">{m + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grid wrapper — adds left header-spacer so chord grid aligns with DAW lanes */}
        <div className="flex-1 flex min-h-0">
          {backingTrackActive && !cellView && (
            <div
              style={{ width: 200, minWidth: 200 }}
              className="border-r border-border/30 bg-card/40 flex items-start justify-center pt-2"
            >
              <button
                onClick={() => onRegenerateBackingMidi?.()}
                className="px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 bg-primary/20 text-primary hover:bg-primary/30 transition-colors border border-primary/30"
                title="Regenerate backing track MIDI from current chords"
              >
                <RefreshCw size={10} />
                Regenerate MIDI
              </button>
            </div>
          )}
          {cellView ? (
            <CellGridView
              measures={measures}
              chords={chords}
              currentBeat={currentBeat}
              totalBeats={totalBeats}
              getChordColor={getChordColor}
              onAddBars={() => setMeasures(Math.min(32, measures + 4))}
              onSeek={(beat) => { if (isPlaying) onStop(); onSeek?.(beat); }}
              onAddChord={onAddChord}
              onRemoveChord={onRemoveChord}
              onResizeChordRange={onResizeChordRange}
              onSetChordBass={onSetChordBass}
              diatonicChords={diatonicChords}
            />
          ) : (
          <div
            ref={gridRef}
            className="relative flex-1 bg-secondary/20 border-t border-border/30"
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
                className={`absolute top-2 rounded-md select-none flex items-center group ${cmdHeld ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
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
                  e.stopPropagation();
                  // Cmd/Ctrl-click acts as a delete tool for the region
                  if (e.metaKey || e.ctrlKey) {
                    onRemoveChord(chord.id);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX < rect.left + 12) {
                    setResizeChord({ id: chord.id, edge: 'left', origStart: chord.startBeat, origDuration: chord.duration });
                  } else if (e.clientX > rect.right - 12) {
                    setResizeChord({ id: chord.id, edge: 'right', origStart: chord.startBeat, origDuration: chord.duration });
                  } else {
                    // Preserve the cursor's grab-offset within the region so
                    // the region doesn't snap its start to the cursor.
                    const offsetPx = e.clientX - rect.left;
                    const gridRect = gridRef.current?.getBoundingClientRect();
                    const beatsPerPx = gridRect ? totalBeats / gridRect.width : 0;
                    const offsetBeats = offsetPx * beatsPerPx;
                    setDragChord({ id: chord.id, offsetBeats });
                  }
                }}
                onClick={(e) => handleChordClick(chord, e)}
                onContextMenu={(e) => handleChordContextMenu(chord, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  // Open the variations/bass popup (was: delete)
                  handleChordContextMenu(chord, e);
                }}
                title={`${chordLabel}${bassLabel}${isDiatonic ? ` (${currentNumerals[degree]})` : borrowed ? ' — borrowed' : ''} — click: seek, dbl-click: voicings, ⌘-click: delete`}
              >
                <span
                  className="text-[10px] font-mono font-bold px-1.5 truncate"
                  style={{ color: borrowed ? '#000' : isDiatonic ? '#000' : `hsl(${color})` }}
                >
                  {chordLabel}{bassLabel && <span className="opacity-70">{bassLabel}</span>}
                </span>
                {/* Resize handles */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center rounded-l-md"
                  style={{ backgroundColor: 'hsl(var(--foreground) / 0.22)' }}
                >
                  <ChevronsLeftRight size={9} className="text-background pointer-events-none" />
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center rounded-r-md"
                  style={{ backgroundColor: 'hsl(var(--foreground) / 0.22)' }}
                >
                  <ChevronsLeftRight size={9} className="text-background pointer-events-none" />
                </div>
              </div>
            );
          })}

          {/* Variations panel — docked to the right edge of the viewport so
              long lists are always fully visible. Click outside to dismiss. */}
          {variationPopup && (
            <VariationsPanel
              degreeLabel={currentNumerals[variationPopup.degree]}
              variations={variations}
              anchorX={variationPopup.x}
              anchorY={variationPopup.y}
              onSelect={handleSelectVariation}
              onSetBass={(n) => { onSetChordBass?.(variationPopup.chordId, n); setVariationPopup(null); }}
              onClearBass={() => { onSetChordBass?.(variationPopup.chordId, undefined); setVariationPopup(null); }}
              onClose={() => setVariationPopup(null)}
            />
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
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chord-variations panel — fixed to the right edge of the viewport so the
 * full list of voicings + bass-note picker is always visible regardless of
 * how close to the right side the source chord block is. Click outside the
 * panel (or press Escape) to dismiss.
 */
function VariationsPanel({
  degreeLabel, variations, anchorX, anchorY, onSelect, onSetBass, onClearBass, onClose,
}: {
  degreeLabel: string;
  variations: ChordVariation[];
  anchorX: number;
  anchorY: number;
  onSelect: (v: ChordVariation) => void;
  onSetBass: (n: NoteName) => void;
  onClearBass: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const PANEL_W = 256;
  const PANEL_H_MAX = Math.round(window.innerHeight * 0.6);
  // Clamp into viewport so it stays visible. Prefer anchor to the RIGHT of the
  // chord cell; if it would overflow, flip to the left side.
  let left = anchorX + 8;
  if (left + PANEL_W > window.innerWidth - 8) left = Math.max(8, anchorX - PANEL_W - 8);
  let top = anchorY;
  if (top + PANEL_H_MAX > window.innerHeight - 8) top = Math.max(8, window.innerHeight - PANEL_H_MAX - 8);
  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(ev.target as Node)) onClose();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    // Defer registration so the very click that opened the panel doesn't
    // immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocMouseDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-64 max-h-[60vh] flex flex-col bg-card border border-border rounded-lg shadow-2xl animate-fade-in"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">
          Voicings ({degreeLabel})
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {variations.map((v, i) => (
          <button
            key={i}
            onClick={() => onSelect(v)}
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
                <span
                  className="text-[8px] px-1 py-0.5 rounded font-bold"
                  style={{ backgroundColor: 'hsl(50, 90%, 55%, 0.3)', color: 'hsl(50, 70%, 35%)' }}
                >
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
      <div className="border-t border-border px-2 py-2">
        <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
          Bass Note
        </div>
        <div className="flex flex-wrap gap-0.5">
          <button
            onClick={onClearBass}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Root
          </button>
          {NOTE_NAMES.map(n => (
            <button
              key={n}
              onClick={() => onSetBass(n)}
              className="px-1 py-0.5 rounded text-[8px] font-mono bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

