import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourseTabs } from '@/hooks/useCourses';
import { useFretboard } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import { CompactScaleSelector } from '@/components/Courses/CompactScaleSelector';
import { DiatonicChordPalette } from '@/components/Courses/DiatonicChordPalette';
import { TechniqueToolbar } from '@/components/Courses/TechniqueToolbar';
import { TabEditor } from '@/components/Courses/TabEditor';
import { GlobalTracksEditor } from '@/components/Courses/GlobalTracksEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Square, Plus, Keyboard, Bell, BellOff, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { ShortcutsDialog } from '@/components/Courses/ShortcutsDialog';
import { TechniqueQuickMenu } from '@/components/Courses/TechniqueQuickMenu';
import { useCourseGuitarPlayer } from '@/hooks/useCourseGuitarPlayer';
import type { CoursePhrase, CourseTabRow, KeyQuality, ChordTrackEntry, KeyChangeEntry, TempoChangeEntry, CourseNote, Technique } from '@/lib/courseTypes';
import { GRID_PER_BEAT, KEY_QUALITY_SCALE } from '@/lib/courseTypes';
import { STANDARD_TUNING, type NoteName } from '@/lib/music';
import type { Subdivision } from '@/components/Courses/TabEditor';
import { getTab } from '@/lib/courseStorage';
import { usePitchDetector } from '@/hooks/usePitchDetector';

/** Subdivision → grid units. Triplets produce non-integer steps (LCM is fractional). */
const SUB_STEP: Record<Subdivision, number> = {
  '1/4': GRID_PER_BEAT,
  '1/6': GRID_PER_BEAT * 2 / 3,
  '1/8': GRID_PER_BEAT / 2,
  '1/12': GRID_PER_BEAT / 3,
  '1/16': 1,
  '1/24': GRID_PER_BEAT / 6,
};

const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4'];
const BARS_OPTIONS = [2, 4, 8] as const;
const ANACRUSIS_BARS = 1;

export default function CourseCreator() {
  const { courseId, tabId } = useParams<{ courseId: string; tabId: string }>();
  const nav = useNavigate();
  const fb = useFretboard();
  const player = useCourseGuitarPlayer();
  const [authChecked, setAuthChecked] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [tab, setTab] = useState<CourseTabRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { updateTab } = useCourseTabs(courseId);

  // Editable fields
  const [title, setTitle] = useState('');
  const [keyRoot, setKeyRoot] = useState<NoteName>('A');
  const [keyQuality, setKeyQuality] = useState<KeyQuality>('Minor');
  const [timeSig, setTimeSig] = useState('4/4');
  const [tempo, setTempo] = useState(100);
  const [phrase, setPhrase] = useState<CoursePhrase>({ notes: [], lengthGrid: GRID_PER_BEAT * 4 * 4 });
  const [chordTrack, setChordTrack] = useState<ChordTrackEntry[]>([]);
  const [keyTrack, setKeyTrack] = useState<KeyChangeEntry[]>([]);
  const [tempoTrack, setTempoTrack] = useState<TempoChangeEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [pickedFretboardNote, setPickedFretboardNote] = useState<{ stringIndex: number; fret: number; nonce: number } | null>(null);

  // Staged input note from interactive fretboard (preview before commit via Enter)
  const [stagedNote, setStagedNote] = useState<{ stringIndex: number; fret: number } | null>(null);
  /** Subdivision drives BOTH grid snapping and default new-note duration. */
  const [subdivision, setSubdivision] = useState<Subdivision>('1/8');
  /** Insertion cursor (state, not ref) — also acts as the draggable playhead when stopped. */
  const [cursorGrid, setCursorGrid] = useState<number>(0);
  /** Tab cell width — shared between TabEditor and GlobalTracksEditor for column alignment. */
  const [cellW, setCellW] = useState<number>(28);
  // Embedded track-lane visibility toggles (live in the tab editor toolbar)
  const [showChordTrack, setShowChordTrack] = useState(true);
  const [showKeyTrack, setShowKeyTrack] = useState(true);
  const [showTempoTrack, setShowTempoTrack] = useState(true);

  // Bar window: viewport over the timeline. Indexed in MUSICAL bars (bar 1 = the first "real" bar).
  // Default: start AT bar 1 (windowStartBar = 0). User can scroll back ONE bar (-1) to view anacrusis.
  const [windowStartBar, setWindowStartBar] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadGrid, setPlayheadGrid] = useState(0);
  const [activePlaybackIds, setActivePlaybackIds] = useState<string[]>([]);
  const [metronome, setMetronome] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [techMenuOpen, setTechMenuOpen] = useState(false);
  /** "Listen" mode: turns on the position-focus box (light-blue) + mic pitch detection.
   * Detected pitches are mapped to a fret inside the box and STAGED for insertion. */
  const [listenMode, setListenMode] = useState(false);
  const pitch = usePitchDetector();
  const lastStagedMidiRef = useRef<number | null>(null);

  const beatsPerBar = useMemo(() => parseInt(timeSig.split('/')[0], 10) || 4, [timeSig]);
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  useEffect(() => {
    // Auth disabled for now — preview without sign-in.
    setAuthChecked(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, []);

  useEffect(() => {
    if (!tabId) return;
    const t = getTab(tabId);
    if (!t) { setLoading(false); return; }
    setTab(t);
    setTitle(t.title);
    setKeyRoot(t.key_root);
    setKeyQuality(t.key_quality);
    setTimeSig(t.time_signature);
    setTempo(t.tempo);
    setPhrase(t.phrase ?? { notes: [], lengthGrid: GRID_PER_BEAT * 4 * 4 });
    setChordTrack(Array.isArray(t.chord_track) ? t.chord_track : []);
    setKeyTrack(Array.isArray(t.key_track) ? t.key_track : []);
    setTempoTrack(Array.isArray(t.tempo_track) ? t.tempo_track : []);
    setLoading(false);
  }, [tabId]);

  // Sync fretboard primary scale with key
  useEffect(() => {
    fb.setPrimaryScale({ mode: 'scale', root: keyRoot, scale: KEY_QUALITY_SCALE[keyQuality] });
  }, [keyRoot, keyQuality]);

  const goBack = () => {
    player.stop();
    setAnimateIn(false);
    setTimeout(() => nav(`/courses/${courseId}`), 300);
  };

  const onSave = async () => {
    if (!tabId) return;
    setSaving(true);
    const { error } = await updateTab(tabId, {
      title, key_root: keyRoot, key_quality: keyQuality, time_signature: timeSig, tempo,
      phrase, chord_track: chordTrack, key_track: keyTrack, tempo_track: tempoTrack,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Saved');
  };

  /**
   * Insert one note at the current cursor with the subdivision-derived duration; advance cursor.
   * Also trims any earlier overlapping note (any string) so consecutive notes don't form
   * a chord-bar visually when they sit close together.
   */
  const insertNoteAtCursor = (stringIndex: number, fret: number) => {
    const dur = SUB_STEP[subdivision];
    const beatIndex = cursorGrid;
    const collision = phrase.notes.find(n => n.stringIndex === stringIndex && Math.abs(n.beatIndex - beatIndex) < 0.001);
    if (collision) {
      toast.info('A note already exists on that string at this position');
      return;
    }
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${stringIndex}`;
    const note: CourseNote = { id, stringIndex, fret, beatIndex, durationGrid: dur };
    // Trim ANY earlier note (any string) whose duration crosses into beatIndex.
    const trimmed = phrase.notes.map(n => {
      const nEnd = n.beatIndex + n.durationGrid;
      if (n.beatIndex < beatIndex && nEnd > beatIndex) {
        return { ...n, durationGrid: beatIndex - n.beatIndex };
      }
      return n;
    });
    const newLen = Math.max(phrase.lengthGrid, beatIndex + dur * 2);
    setPhrase({ notes: [...trimmed, note], lengthGrid: newLen });
    const nextCursor = beatIndex + dur;
    setCursorGrid(nextCursor);
    setStagedNote(null);
    fb.setArpAddReferenceNotes([]);
    const newBarIdx = Math.floor(nextCursor / gridPerBar);
    if (newBarIdx >= windowStartBar + VISIBLE_BARS - 1) {
      setWindowStartBar(Math.max(-ANACRUSIS_BARS, newBarIdx - 1));
    }
  };

  /** Commit current staged fretboard pick (Enter key). */
  const commitStaged = () => {
    if (!stagedNote) { toast.info('Pick a fret on the fretboard first'); return; }
    insertNoteAtCursor(stagedNote.stringIndex, stagedNote.fret);
  };

  // Always-fresh staged-note commit (avoids stale closures in the global keydown listener).
  const commitStagedRef = useRef(commitStaged);
  commitStagedRef.current = commitStaged;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const onPlayRef = useRef<(() => void) | null>(null);
  // onPlayRef.current is wired below, after onPlay is declared.

  // Track ⌘/Ctrl for delete-mode UI + Space=play/stop + Enter=insert staged note.
  // Bind ONCE; use refs so the latest staged note / play state is always read.
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) setDeleteMode(true);
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.code === 'Space' && !inField) {
        e.preventDefault();
        if (isPlayingRef.current) { player.stop(); setIsPlaying(false); setPlayheadGrid(0); }
        else { onPlayRef.current?.(); }
      }
      if (e.key === 'Enter' && !inField && stagedNoteRef.current) {
        e.preventDefault();
        commitStagedRef.current();
      }
    };
    const onKU = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey) setDeleteMode(false); };
    const onBlur = () => setDeleteMode(false);
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('blur', onBlur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a tab note is selected, sync cursor to the end of that note (so the next insert
  // continues from there). Subdivision/duration are NOT changed by selection — the
  // dropdown is the source of truth.
  useEffect(() => {
    if (selectedIds.length === 1) {
      const n = phrase.notes.find(x => x.id === selectedIds[0]);
      if (n) setCursorGrid(n.beatIndex + n.durationGrid);
    }
  }, [selectedIds, phrase.notes]);

  // Wire up fretboard clicks.
  // - If exactly one tab note is selected → update that note's string/fret (move).
  // - Otherwise → STAGE the click as a preview; user presses Enter to commit,
  //   OR clicking another fret immediately commits the previous staged note
  //   then stages the new one (rapid sequential input).
  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selectedIds;
  const stagedNoteRef = useRef<{ stringIndex: number; fret: number } | null>(null);
  stagedNoteRef.current = stagedNote;
  // Always-fresh insert function (avoids stale closures inside the fretboard callback).
  const insertRef = useRef(insertNoteAtCursor);
  insertRef.current = insertNoteAtCursor;
  useEffect(() => {
    fb.setArpAddMode(true);
    fb.setArpAddClickHandler(() => (si: number, fret: number) => {
      // If a single tab note is selected, clicking moves it (legacy behavior).
      if (selectedIdsRef.current.length === 1) {
        setPickedFretboardNote({ stringIndex: si, fret, nonce: Date.now() });
        return;
      }
      // Otherwise, ALWAYS just stage the click as a preview.
      // The user must press Enter (or click the Insert button) to commit.
      // Clicking a different fret while one is staged simply replaces the staged note —
      // it does NOT auto-commit the previous one.
      setStagedNote({ stringIndex: si, fret });
      fb.setArpAddReferenceNotes([{ stringIndex: si, fret }]);
    });
    return () => { fb.setArpAddMode(false); fb.setArpAddClickHandler(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When tab notes are selected, mirror them on the fretboard. Otherwise show staged note.
  // During playback, mirror the currently sounding notes (live).
  const fretboardReference = useMemo(() => {
    if (isPlaying && activePlaybackIds.length > 0) {
      return phrase.notes
        .filter(n => activePlaybackIds.includes(n.id))
        .map(n => ({ stringIndex: n.stringIndex, fret: n.fret }));
    }
    if (selectedIds.length > 0) {
      return phrase.notes
        .filter(n => selectedIds.includes(n.id))
        .map(n => ({ stringIndex: n.stringIndex, fret: n.fret }));
    }
    return stagedNote ? [stagedNote] : [];
  }, [selectedIds, phrase.notes, stagedNote, isPlaying, activePlaybackIds]);

  useEffect(() => {
    fb.setArpAddReferenceNotes(fretboardReference);
  }, [fretboardReference]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected/staged/playing notes should render at FULL opacity on the fretboard
  // (the arp-add overlay normally uses ~0.3 opacity for "ghost" reference notes).
  useEffect(() => {
    fb.setArpOverlayOpacity(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearStaged = () => { setStagedNote(null); fb.setArpAddReferenceNotes([]); };

  // ===== Listen mode: pitch detection → stage a note inside the position-focus box =====
  // Toggle: turn fret box on (light blue) and start mic. We drive `fb.setShowFretBox`
  // synchronously inside the click handler (see toggleListen below) so the box appears
  // on the FIRST click — this useEffect only handles the mic stream lifecycle.
  useEffect(() => {
    if (listenMode) {
      pitch.start(pitch.selectedDeviceId ?? undefined);
    } else {
      pitch.stop();
      lastStagedMidiRef.current = null;
    }
    return () => { if (listenMode) pitch.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenMode]);

  /** Toggle Listen mode + fret box together so the user sees the focus box immediately. */
  const toggleListen = () => {
    setListenMode(m => {
      const next = !m;
      // Show the fret box on first click; hide it again when listen turns off
      // (unless the user had it on for non-listen reasons — we conservatively turn it off).
      fb.setShowFretBox(next);
      return next;
    });
  };

  // When pitch.midi changes (and is stable), find the (string, fret) inside the fret box
  // that produces this MIDI value, and STAGE it. Only update when the rounded MIDI changes
  // (so a held note doesn't keep re-staging).
  useEffect(() => {
    if (!listenMode || pitch.midi == null) return;
    if (pitch.rms < 0.01) return;
    if (lastStagedMidiRef.current === pitch.midi) return;
    lastStagedMidiRef.current = pitch.midi;
    // Open-string MIDI = tuning[stringIndex] + 12 * octave. STANDARD_TUNING uses pitch
    // classes 4,9,2,7,11,4 for strings E2(40), A2(45), D3(50), G3(55), B3(59), e4(64).
    const stringMidiBase = [40, 45, 50, 55, 59, 64];
    const targetMidi = pitch.midi;
    const fretBoxEnd = fb.fretBoxStart + fb.fretBoxSize - 1;
    const candidates: { stringIndex: number; fret: number; dist: number }[] = [];
    for (let s = 0; s < 6; s++) {
      // Filter strings inside the vertical box (mapped to display rows).
      // stringOrder in Fretboard is [5,4,3,2,1,0] → row 0 = high e, row 5 = low E.
      const row = [5, 4, 3, 2, 1, 0].indexOf(s);
      if (row < fb.fretBoxStringStart || row >= fb.fretBoxStringStart + fb.fretBoxStringSize) continue;
      const fret = targetMidi - stringMidiBase[s];
      if (fret < fb.fretBoxStart || fret > fretBoxEnd) continue;
      // Prefer lowest fret (closest to box start) and lowest string distance.
      candidates.push({ stringIndex: s, fret, dist: fret - fb.fretBoxStart });
    }
    if (candidates.length === 0) {
      toast.info(`Note ${targetMidi} is outside the focus box`);
      return;
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const pick = candidates[0];
    setStagedNote({ stringIndex: pick.stringIndex, fret: pick.fret });
    fb.setArpAddReferenceNotes([{ stringIndex: pick.stringIndex, fret: pick.fret }]);
  }, [pitch.midi, pitch.rms, listenMode, fb.fretBoxStart, fb.fretBoxSize, fb.fretBoxStringStart, fb.fretBoxStringSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPlay = async () => {
    if (phrase.notes.length === 0) { toast.info('No notes to play'); return; }
    setIsPlaying(true);
    await player.play({
      notes: phrase.notes,
      lengthGrid: phrase.lengthGrid,
      bpm: tempo,
      beatsPerBar,
      metronome,
      onBeat: (idx) => setPlayheadGrid(idx),
      onEnd: () => { setIsPlaying(false); setPlayheadGrid(0); setActivePlaybackIds([]); },
      onActiveNotes: (ids) => setActivePlaybackIds(ids),
    });
  };
  onPlayRef.current = onPlay;
  const onStop = () => { player.stop(); setIsPlaying(false); setPlayheadGrid(0); setActivePlaybackIds([]); };

  const totalBars = Math.max(VISIBLE_BARS, Math.ceil(phrase.lengthGrid / gridPerBar) + 1);
  const minWindow = -ANACRUSIS_BARS; // -1 → user can scroll back exactly one bar
  const maxWindow = totalBars - VISIBLE_BARS;
  const goPrevBar = () => setWindowStartBar(b => Math.max(minWindow, b - 1));
  const goNextBar = () => setWindowStartBar(b => Math.min(maxWindow, b + 1));

  useEffect(() => {
    const needed = (windowStartBar + VISIBLE_BARS) * gridPerBar;
    if (phrase.lengthGrid < needed) {
      setPhrase(p => ({ ...p, lengthGrid: needed }));
    }
  }, [windowStartBar, gridPerBar, phrase.lengthGrid]);

  const applyTechnique = (t: Technique | 'none') => {
    if (selectedIds.length === 0) return;
    setPhrase({
      ...phrase,
      notes: phrase.notes.map(n =>
        selectedIds.includes(n.id) ? { ...n, technique: t === 'none' ? undefined : t } : n,
      ),
    });
  };
  const firstSelected = selectedIds[0] ? phrase.notes.find(n => n.id === selectedIds[0]) : null;
  const currentTechnique: Technique | 'none' = firstSelected?.technique ?? 'none';

  if (!authChecked || loading) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!tab) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center text-muted-foreground">Lesson not found</div>;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out overflow-y-auto"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-3 border-b border-border sticky top-0 bg-background z-30">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" /> Course
          </button>
          <Button size="sm" variant="outline" onClick={() => setShortcutsOpen(true)} className="ml-2">
            <Keyboard className="size-4 mr-1" /> Shortcuts
          </Button>
        </div>
        <h1 className="text-lg font-semibold">Lesson editor</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </header>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <TechniqueQuickMenu
        open={techMenuOpen}
        onOpenChange={setTechMenuOpen}
        onPick={applyTechnique}
        hasSelection={selectedIds.length > 0}
      />

      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* Left column: meta + scale + diatonic chords + techniques */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div>
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Lesson title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>

          <CompactScaleSelector
            root={keyRoot} setRoot={setKeyRoot}
            scale={KEY_QUALITY_SCALE[keyQuality]}
            setScale={(s) => {
              if (s === KEY_QUALITY_SCALE.Major) setKeyQuality('Major');
              else if (s === KEY_QUALITY_SCALE.Minor) setKeyQuality('Minor');
            }}
            setKeyQuality={setKeyQuality}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Time sig</Label>
              <div className="relative mt-1">
                <select
                  value={timeSig}
                  onChange={e => setTimeSig(e.target.value)}
                  className="appearance-none w-full bg-card border border-border rounded-md pl-2 pr-7 py-1.5 text-sm font-mono text-foreground hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {TIME_SIGS.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronLeft className="size-3 absolute right-2 top-1/2 -translate-y-1/2 -rotate-90 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Tempo</Label>
              <Input type="number" min={40} max={240} value={tempo}
                onChange={e => setTempo(parseInt(e.target.value, 10) || 100)} className="mt-1" />
            </div>
          </div>

          <DiatonicChordPalette keyRoot={keyRoot} keyQuality={keyQuality} />

          <TechniqueToolbar
            selectedTechnique={currentTechnique}
            onApply={applyTechnique}
            hasSelection={!!firstSelected}
          />
        </aside>

        {/* Right: fretboard + global tracks + tab editor */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Interactive fretboard (input + visualizer) */}
          <section className="border border-border rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {selectedIds.length === 1
                  ? 'Click a fret to move the selected note'
                  : stagedNote
                    ? `Staged: string ${stagedNote.stringIndex + 1}, fret ${stagedNote.fret} — press Enter or Insert to commit`
                    : 'Click a fret to stage; Enter inserts at cursor'}
              </div>
            </div>
            <Fretboard
              maxFrets={fb.maxFrets}
              primaryScale={fb.primaryScale}
              secondaryScale={fb.secondaryScale}
              secondaryEnabled={false}
              activePrimary={true}
              noteColors={fb.noteColors}
              onNoteClick={() => {}}
              displayMode={fb.displayMode}
              disabledStrings={fb.disabledStrings}
              onToggleString={fb.toggleStringDisabled}
              secondaryOpacity={fb.secondaryOpacity}
              secondaryColor={fb.secondaryColor}
              primaryColor={fb.primaryColor}
              activeChord={null}
              orientation={fb.orientation}
              showFretBox={listenMode || fb.showFretBox}
              fretBoxTintHsl={listenMode ? '200, 80%, 60%' : undefined}
              fretBoxStart={fb.fretBoxStart}
              fretBoxSize={fb.fretBoxSize}
              setFretBoxStart={fb.setFretBoxStart}
              setFretBoxSize={fb.setFretBoxSize}
              fretBoxStringStart={fb.fretBoxStringStart}
              fretBoxStringSize={fb.fretBoxStringSize}
              setFretBoxStringStart={fb.setFretBoxStringStart}
              setFretBoxStringSize={fb.setFretBoxStringSize}
              noteMarkerSize={fb.noteMarkerSize}
              degreeColors={false}
              setDegreeColors={fb.setDegreeColors}
              disabledDegrees={fb.disabledDegrees}
              toggleDegree={fb.toggleDegree}
              setShowFretBox={fb.setShowFretBox}
              identifyMode={false}
              identifyFrets={fb.identifyFrets}
              setIdentifyFrets={fb.setIdentifyFrets}
              identifyBarre={fb.identifyBarre}
              setIdentifyBarre={fb.setIdentifyBarre}
              identifyRoot={fb.identifyRoot}
              tuning={fb.tuning}
              tuningLabels={fb.tuningLabels}
              arpOverlayOpacity={fb.arpOverlayOpacity}
              ghostNoteOpacity={fb.ghostNoteOpacity}
              arpPathVisible={false}
              arpAddMode={true}
              arpAddReferenceNotes={fretboardReference}
              onArpAddClick={(si, fret) => fb.arpAddClickHandler?.(si, fret)}
              hideToolbar={true}
            />
            {/* Unified transport row: [input meter] Listen | Play | Click | Clear | Insert */}
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
              {/* Compact input device + level meter — sits to the LEFT of Listen, only when active */}
              {listenMode && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/30 border border-border mr-1">
                  <select
                    value={pitch.selectedDeviceId ?? ''}
                    onChange={e => pitch.selectDevice(e.target.value)}
                    className="appearance-none bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[7rem] truncate"
                    title="Select audio input"
                  >
                    {pitch.devices.length === 0 && <option value="">Default</option>}
                    {pitch.devices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                  {/* Small level meter — green→yellow→red gradient, fills with RMS */}
                  <div className="w-16 h-1.5 rounded-full bg-muted/60 overflow-hidden relative" title={pitch.midi != null ? `MIDI ${pitch.midi}` : 'listening'}>
                    <div
                      className="absolute left-0 top-0 bottom-0 transition-[width] duration-75"
                      style={{
                        width: `${Math.min(100, pitch.rms * 600)}%`,
                        background: 'linear-gradient(90deg, hsl(140,70%,45%) 0%, hsl(60,90%,55%) 60%, hsl(0,80%,55%) 100%)',
                      }}
                    />
                  </div>
                  {pitch.error && <span className="text-[10px] text-destructive">{pitch.error}</span>}
                </div>
              )}
              <Button
                size="lg"
                variant={listenMode ? 'default' : 'outline'}
                onClick={toggleListen}
                className="rounded-full px-4"
                title={listenMode ? 'Listening to mic — click to disable' : 'Listen: detect pitch and stage notes inside the focus box'}
              >
                {listenMode ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                <span className="ml-2 text-xs uppercase font-mono tracking-wider">Listen</span>
              </Button>
              {isPlaying ? (
                <Button size="lg" variant="destructive" onClick={onStop} className="rounded-full px-6">
                  <Square className="size-5 mr-2" /> Stop
                </Button>
              ) : (
                <Button size="lg" onClick={onPlay} className="rounded-full px-6">
                  <Play className="size-5 mr-2" /> Play
                </Button>
              )}
              <Button
                size="lg"
                variant={metronome ? 'default' : 'outline'}
                onClick={() => setMetronome(m => !m)}
                className="rounded-full px-4"
                title={metronome ? 'Metronome on — click to disable' : 'Metronome off — click to enable'}
              >
                {metronome ? <Bell className="size-5" /> : <BellOff className="size-5" />}
                <span className="ml-2 text-xs uppercase font-mono tracking-wider">Click</span>
              </Button>
              {/* Clear / Insert moved here to free space at top of screen */}
              <Button size="lg" variant="outline" onClick={clearStaged} disabled={!stagedNote} className="rounded-full px-4">
                Clear
              </Button>
              <Button size="lg" onClick={commitStaged} disabled={!stagedNote} className="rounded-full px-4">
                <Plus className="size-5 mr-1" /> Insert
              </Button>
            </div>
          </section>

          {/* Bar window controls */}
          <div className="flex items-center justify-between gap-2">
            <Button size="lg" variant="outline" onClick={goPrevBar} disabled={windowStartBar <= minWindow} className="rounded-full size-12 p-0">
              <ChevronLeft className="size-6" />
            </Button>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Bars {windowStartBar + 1} – {windowStartBar + VISIBLE_BARS} of {totalBars}
              {windowStartBar < 0 && <span className="ml-2 text-primary">(anacrusis visible)</span>}
            </p>
            <Button size="lg" variant="outline" onClick={goNextBar} disabled={windowStartBar >= maxWindow} className="rounded-full size-12 p-0">
              <ChevronRight className="size-6" />
            </Button>
          </div>

          {/* Tab editor with embedded global tracks (chord / key / tempo) */}
          <TabEditor
            phrase={phrase}
            setPhrase={setPhrase}
            tuning={STANDARD_TUNING}
            keyRoot={keyRoot}
            keyQuality={keyQuality}
            beatsPerBar={beatsPerBar}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            startGrid={windowStartBar * gridPerBar}
            visibleGrids={VISIBLE_BARS * gridPerBar}
            playheadGrid={isPlaying ? playheadGrid : null}
            pickedFretboardNote={pickedFretboardNote}
            deleteMode={deleteMode}
            cursorGrid={cursorGrid}
            setCursorGrid={setCursorGrid}
            subdivision={subdivision}
            setSubdivision={setSubdivision}
            cellW={cellW}
            setCellW={setCellW}
            chordTrack={chordTrack}
            activePlaybackIds={activePlaybackIds}
            onOpenTechniqueMenu={() => setTechMenuOpen(true)}
            showChordTrack={showChordTrack} setShowChordTrack={setShowChordTrack}
            showKeyTrack={showKeyTrack} setShowKeyTrack={setShowKeyTrack}
            showTempoTrack={showTempoTrack} setShowTempoTrack={setShowTempoTrack}
            tracksSlot={(showChordTrack || showKeyTrack || showTempoTrack) ? (
              <GlobalTracksEditor
                chordTrack={chordTrack} setChordTrack={setChordTrack}
                keyTrack={keyTrack} setKeyTrack={setKeyTrack}
                tempoTrack={tempoTrack} setTempoTrack={setTempoTrack}
                startGrid={windowStartBar * gridPerBar}
                visibleGrids={VISIBLE_BARS * gridPerBar}
                beatsPerBar={beatsPerBar}
                isOwner
                defaultKeyRoot={keyRoot}
                defaultKeyQuality={keyQuality}
                defaultTempo={tempo}
                pendingKey={{ root: keyRoot, quality: keyQuality }}
                deleteMode={deleteMode}
                playheadGrid={isPlaying ? playheadGrid : null}
                cellW={cellW}
                cursorGrid={cursorGrid}
                setCursorGrid={setCursorGrid}
                hideBarRow
                hideFooter
                embedded
                showChords={showChordTrack}
                showKey={showKeyTrack}
                showTempo={showTempoTrack}
              />
            ) : null}
          />

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(140, 60%, 45%)' }} /> Diatonic</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(210, 80%, 55%)' }} /> Chord</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(28, 90%, 55%)' }} /> Non-diatonic</span>
          </div>
        </main>
      </div>
    </div>
  );
}
