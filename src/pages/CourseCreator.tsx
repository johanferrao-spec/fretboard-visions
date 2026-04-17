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

  // Staged input notes (from interactive fretboard)
  const [stagedNotes, setStagedNotes] = useState<{ stringIndex: number; fret: number }[]>([]);

  // Bar window: viewport over the timeline. Indexed in MUSICAL bars (bar 1 = the first "real" bar).
  // We allow windowStartBar to be negative so the user can edit anacrusis bars (bar 0, bar -1, …).
  // Default: start one bar BEFORE bar 1 so end of bar 0 is visible just before bar 1.
  const [windowStartBar, setWindowStartBar] = useState(-ANACRUSIS_BARS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadGrid, setPlayheadGrid] = useState(0);

  const beatsPerBar = useMemo(() => parseInt(timeSig.split('/')[0], 10) || 4, [timeSig]);
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthChecked(true);
      if (!data.session) nav('/auth');
    });
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, [nav]);

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

  // Insert staged notes into next available slot
  const onInsert = () => {
    if (stagedNotes.length === 0) { toast.info('Click frets on the fretboard first'); return; }
    const nextSlot = phrase.notes.length === 0
      ? 0
      : Math.max(...phrase.notes.map(n => n.beatIndex + n.durationGrid));
    const newNotes: CourseNote[] = stagedNotes.map(s => ({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${s.stringIndex}`,
      stringIndex: s.stringIndex,
      fret: s.fret,
      beatIndex: nextSlot,
      durationGrid: GRID_PER_BEAT,
    }));
    const newLen = Math.max(phrase.lengthGrid, nextSlot + GRID_PER_BEAT * 2);
    setPhrase({ notes: [...phrase.notes, ...newNotes], lengthGrid: newLen });
    setStagedNotes([]);
    fb.setArpAddReferenceNotes([]);
    const newBarIdx = Math.floor(nextSlot / gridPerBar);
    if (newBarIdx >= windowStartBar + VISIBLE_BARS - 1) {
      setWindowStartBar(Math.max(-ANACRUSIS_BARS, newBarIdx - 1));
    }
  };

  // Track ⌘/Ctrl for delete-mode UI
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => { if (e.metaKey || e.ctrlKey) setDeleteMode(true); };
    const onKU = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey) setDeleteMode(false); };
    const onBlur = () => setDeleteMode(false);
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('blur', onBlur); };
  }, []);

  // Wire up fretboard clicks. If exactly one tab note is selected → set its fret/string.
  // Otherwise → stage the click as part of a chord/note to insert.
  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selectedIds;
  useEffect(() => {
    fb.setArpAddMode(true);
    fb.setArpAddClickHandler(() => (si: number, fret: number) => {
      if (selectedIdsRef.current.length === 1) {
        setPickedFretboardNote({ stringIndex: si, fret, nonce: Date.now() });
        return;
      }
      setStagedNotes(prev => {
        const existing = prev.find(p => p.stringIndex === si);
        let next: { stringIndex: number; fret: number }[];
        if (existing && existing.fret === fret) {
          next = prev.filter(p => p.stringIndex !== si);
        } else if (existing) {
          next = prev.map(p => p.stringIndex === si ? { stringIndex: si, fret } : p);
        } else {
          next = [...prev, { stringIndex: si, fret }];
        }
        fb.setArpAddReferenceNotes(next);
        return next;
      });
    });
    return () => { fb.setArpAddMode(false); fb.setArpAddClickHandler(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearStaged = () => { setStagedNotes([]); fb.setArpAddReferenceNotes([]); };

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
  const minWindow = -ANACRUSIS_BARS;
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
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Interactive fretboard — click frets to stage a chord/note</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={clearStaged} disabled={stagedNotes.length === 0}>Clear</Button>
                <Button size="sm" onClick={onInsert} disabled={stagedNotes.length === 0}>
                  <Plus className="size-4 mr-1" /> Insert ({stagedNotes.length})
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
              showFretBox={fb.showFretBox}
              fretBoxStart={fb.fretBoxStart}
              fretBoxSize={fb.fretBoxSize}
              setFretBoxStart={fb.setFretBoxStart}
              setFretBoxSize={fb.setFretBoxSize}
              fretBoxStringStart={fb.fretBoxStringStart}
              fretBoxStringSize={fb.fretBoxStringSize}
              setFretBoxStringStart={fb.setFretBoxStringStart}
              setFretBoxStringSize={fb.setFretBoxStringSize}
              noteMarkerSize={fb.noteMarkerSize}
              degreeColors={fb.degreeColors}
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
              arpAddReferenceNotes={stagedNotes}
              onArpAddClick={(si, fret) => fb.arpAddClickHandler?.(si, fret)}
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
