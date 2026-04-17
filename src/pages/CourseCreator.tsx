import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCourseTabs } from '@/hooks/useCourses';
import { useFretboard } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import { CourseScaleSelector } from '@/components/Courses/CourseScaleSelector';
import { TabEditor } from '@/components/Courses/TabEditor';
import { GlobalTracksEditor } from '@/components/Courses/GlobalTracksEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Square, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCourseGuitarPlayer } from '@/hooks/useCourseGuitarPlayer';
import type { CoursePhrase, CourseTabRow, KeyQuality, ChordTrackEntry, KeyChangeEntry, TempoChangeEntry, CourseNote } from '@/lib/courseTypes';
import { GRID_PER_BEAT, KEY_QUALITY_SCALE } from '@/lib/courseTypes';
import { STANDARD_TUNING, type NoteName } from '@/lib/music';

const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4'];

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Staged input notes (from interactive fretboard)
  const [stagedNotes, setStagedNotes] = useState<{ stringIndex: number; fret: number }[]>([]);

  // Bar window: viewport over the timeline. Show 4 bars (1 before + 2 main + 1 after).
  const [windowStartBar, setWindowStartBar] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadGrid, setPlayheadGrid] = useState(0);

  const beatsPerBar = useMemo(() => parseInt(timeSig.split('/')[0], 10) || 4, [timeSig]);
  const gridPerBar = beatsPerBar * GRID_PER_BEAT;
  const VISIBLE_BARS = 4;

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
    // next available slot = max beatIndex+duration of existing notes (or 0)
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
    // auto-advance bar window if past end
    const newBarIdx = Math.floor(nextSlot / gridPerBar);
    if (newBarIdx >= windowStartBar + VISIBLE_BARS - 1) {
      setWindowStartBar(Math.max(0, newBarIdx - 1));
    }
  };

  // Wire up staged-note clicks via Fretboard's arp-add mechanism
  useEffect(() => {
    fb.setArpAddMode(true);
    fb.setArpAddClickHandler(() => (si: number, fret: number) => {
      setStagedNotes(prev => {
        // toggle: remove if exact match, else add (one note per string max)
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

  // Bar window navigation
  const totalBars = Math.max(VISIBLE_BARS, Math.ceil(phrase.lengthGrid / gridPerBar) + 1);
  const goPrevBar = () => setWindowStartBar(b => Math.max(0, b - 1));
  const goNextBar = () => setWindowStartBar(b => Math.min(totalBars - VISIBLE_BARS, b + 1));

  // Auto-grow length when needed for editing the upcoming bar
  useEffect(() => {
    const needed = (windowStartBar + VISIBLE_BARS) * gridPerBar;
    if (phrase.lengthGrid < needed) {
      setPhrase(p => ({ ...p, lengthGrid: needed }));
    }
  }, [windowStartBar, gridPerBar, phrase.lengthGrid]);

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
        {/* Left: scale selector + meta */}
        <aside className="lg:w-64 shrink-0 space-y-3">
          <div>
            <Label>Lesson title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <CourseScaleSelector
            root={keyRoot} setRoot={setKeyRoot}
            scale={KEY_QUALITY_SCALE[keyQuality]}
            setScale={(s) => {
              if (s === KEY_QUALITY_SCALE.Major) setKeyQuality('Major');
              else if (s === KEY_QUALITY_SCALE.Minor) setKeyQuality('Minor');
            }}
            setKeyQuality={setKeyQuality}
          />
          <div>
            <Label>Time signature</Label>
            <select value={timeSig} onChange={e => setTimeSig(e.target.value)}
              className="bg-background border border-border rounded px-2 py-2 text-sm w-full">
              {TIME_SIGS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Tempo (bpm)</Label>
            <Input type="number" min={40} max={240} value={tempo} onChange={e => setTempo(parseInt(e.target.value, 10) || 100)} />
          </div>
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
            <Button size="lg" variant="outline" onClick={goPrevBar} disabled={windowStartBar === 0} className="rounded-full size-12 p-0">
              <ChevronLeft className="size-6" />
            </Button>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Bars {windowStartBar + 1} – {windowStartBar + VISIBLE_BARS} of {totalBars}
            </p>
            <Button size="lg" variant="outline" onClick={goNextBar} disabled={windowStartBar + VISIBLE_BARS >= totalBars} className="rounded-full size-12 p-0">
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
          />

          {/* Tab editor with bar window */}
          <TabEditor
            phrase={phrase}
            setPhrase={setPhrase}
            tuning={STANDARD_TUNING}
            keyRoot={keyRoot}
            keyQuality={keyQuality}
            beatsPerBar={beatsPerBar}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            startGrid={windowStartBar * gridPerBar}
            visibleGrids={VISIBLE_BARS * gridPerBar}
            playheadGrid={isPlaying ? playheadGrid : null}
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
