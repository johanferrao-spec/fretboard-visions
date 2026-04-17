import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Square, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCourseGuitarPlayer } from '@/hooks/useCourseGuitarPlayer';
import type { CoursePhrase, CourseTabRow, KeyQuality, ChordTrackEntry, KeyChangeEntry, TempoChangeEntry, CourseNote, Technique } from '@/lib/courseTypes';
import { GRID_PER_BEAT, KEY_QUALITY_SCALE } from '@/lib/courseTypes';
import { STANDARD_TUNING, type NoteName } from '@/lib/music';
import type { Subdivision } from '@/components/Courses/TabEditor';

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
/** Show one bar of anacrusis before bar 1, plus 3 bars after = 4 bars visible. */
const VISIBLE_BARS = 4;
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

  // Bar window: viewport over the timeline. Indexed in MUSICAL bars (bar 1 = the first "real" bar).
  // Default: start AT bar 1 (windowStartBar = 0). User can scroll back ONE bar (-1) to view anacrusis.
  const [windowStartBar, setWindowStartBar] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadGrid, setPlayheadGrid] = useState(0);

  const beatsPerBar = useMemo(() => parseInt(timeSig.split('/')[0], 10) || 4, [timeSig]);
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  useEffect(() => {
    // Auth disabled for now — preview without sign-in.
    setAuthChecked(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, []);

  useEffect(() => {
    if (!tabId) return;
    supabase.from('course_tabs').select('*').eq('id', tabId).single().then(({ data, error }) => {
      if (error || !data) { setLoading(false); return; }
      const t = data as unknown as CourseTabRow;
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
    });
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

  // Track ⌘/Ctrl for delete-mode UI + Space=play/stop + Enter=insert staged note
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) setDeleteMode(true);
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.code === 'Space' && !inField) {
        e.preventDefault();
        if (isPlaying) { player.stop(); setIsPlaying(false); setPlayheadGrid(0); }
        else { onPlay(); }
      }
      if (e.key === 'Enter' && !inField && stagedNote) {
        e.preventDefault();
        commitStaged();
      }
    };
    const onKU = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey) setDeleteMode(false); };
    const onBlur = () => setDeleteMode(false);
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('blur', onBlur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, phrase.notes, phrase.lengthGrid, tempo, stagedNote]);

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
      if (selectedIdsRef.current.length === 1) {
        setPickedFretboardNote({ stringIndex: si, fret, nonce: Date.now() });
        return;
      }
      if (stagedNoteRef.current) {
        const prev = stagedNoteRef.current;
        insertRef.current(prev.stringIndex, prev.fret);
        setStagedNote({ stringIndex: si, fret });
        fb.setArpAddReferenceNotes([{ stringIndex: si, fret }]);
        return;
      }
      setStagedNote({ stringIndex: si, fret });
      fb.setArpAddReferenceNotes([{ stringIndex: si, fret }]);
    });
    return () => { fb.setArpAddMode(false); fb.setArpAddClickHandler(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When tab notes are selected, mirror them on the fretboard. Otherwise show staged note.
  const fretboardReference = useMemo(() => {
    if (selectedIds.length > 0) {
      return phrase.notes
        .filter(n => selectedIds.includes(n.id))
        .map(n => ({ stringIndex: n.stringIndex, fret: n.fret }));
    }
    return stagedNote ? [stagedNote] : [];
  }, [selectedIds, phrase.notes, stagedNote]);

  useEffect(() => {
    fb.setArpAddReferenceNotes(fretboardReference);
  }, [fretboardReference]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearStaged = () => { setStagedNote(null); fb.setArpAddReferenceNotes([]); };

  const onPlay = async () => {
    if (phrase.notes.length === 0) { toast.info('No notes to play'); return; }
    setIsPlaying(true);
    await player.play(
      phrase.notes,
      phrase.lengthGrid,
      tempo,
      (idx) => setPlayheadGrid(idx),
      () => { setIsPlaying(false); setPlayheadGrid(0); },
    );
  };
  const onStop = () => { player.stop(); setIsPlaying(false); setPlayheadGrid(0); };

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
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" /> Course
        </button>
        <h1 className="text-lg font-semibold">Lesson editor</h1>
        <div className="flex gap-2">
          {isPlaying ? (
            <Button size="sm" variant="destructive" onClick={onStop}><Square className="size-4 mr-1" /> Stop</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onPlay}><Play className="size-4 mr-1" /> Play</Button>
          )}
          <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </header>

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
              <select value={timeSig} onChange={e => setTimeSig(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1.5 text-sm w-full mt-1">
                {TIME_SIGS.map(t => <option key={t}>{t}</option>)}
              </select>
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
                    ? `Staged: string ${stagedNote.stringIndex + 1}, fret ${stagedNote.fret} — press Enter or click another fret to insert`
                    : 'Click a fret to stage; Enter inserts at cursor'}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={clearStaged} disabled={!stagedNote}>Clear</Button>
                <Button size="sm" onClick={commitStaged} disabled={!stagedNote}>
                  <Plus className="size-4 mr-1" /> Insert
                </Button>
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
              showFretBox={false}
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

          {/* Global tracks (chords + key + tempo) */}
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
          />

          {/* Tab editor with bar window */}
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
