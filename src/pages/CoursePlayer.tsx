import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, MicOff, RotateCcw } from 'lucide-react';
import { usePitchDetector } from '@/hooks/usePitchDetector';
import { useFretboard } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import type { CourseTabRow } from '@/lib/courseTypes';
import { KEY_QUALITY_SCALE } from '@/lib/courseTypes';
import { STANDARD_TUNING } from '@/lib/music';

export default function CoursePlayer() {
  const { courseId, tabId } = useParams<{ courseId: string; tabId: string }>();
  const nav = useNavigate();
  const fb = useFretboard();
  const [animateIn, setAnimateIn] = useState(false);
  const [tab, setTab] = useState<CourseTabRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const [hits, setHits] = useState<Set<string>>(new Set());
  const lastAdvanceRef = useRef(0);
  const pitch = usePitchDetector();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) nav('/auth'); });
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
  }, [nav]);

  useEffect(() => {
    if (!tabId) return;
    supabase.from('course_tabs').select('*').eq('id', tabId).single().then(({ data, error }) => {
      if (error || !data) { setLoading(false); return; }
      setTab(data as unknown as CourseTabRow);
      setLoading(false);
    });
  }, [tabId]);

  // Sync fretboard scale with lesson key
  useEffect(() => {
    if (!tab) return;
    fb.setPrimaryScale({ mode: 'scale', root: tab.key_root, scale: KEY_QUALITY_SCALE[tab.key_quality] });
  }, [tab]);

  // Sort notes by beatIndex; group same beatIndex into chords
  const sortedGroups = useMemo(() => {
    if (!tab?.phrase) return [] as typeof tab.phrase.notes[];
    const map = new Map<number, typeof tab.phrase.notes>();
    tab.phrase.notes.forEach(n => {
      const arr = map.get(n.beatIndex) ?? [];
      arr.push(n);
      map.set(n.beatIndex, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, notes]) => notes);
  }, [tab]);

  const currentGroup = sortedGroups[currentNoteIdx] ?? [];
  const isChord = currentGroup.length > 1;

  const baseMidis = [40, 45, 50, 55, 59, 64];
  const targetPCs = useMemo(() => new Set(currentGroup.map(n => (baseMidis[n.stringIndex] + n.fret) % 12)), [currentGroup]);

  // Pitch listener → advance when matched
  useEffect(() => {
    if (!pitch.enabled || currentGroup.length === 0) return;
    const now = performance.now();
    if (now - lastAdvanceRef.current < 350) return;

    if (isChord) {
      let hitCount = 0;
      targetPCs.forEach(pc => { if (pitch.activeChordTones.has(pc)) hitCount++; });
      if (hitCount >= Math.min(2, targetPCs.size)) {
        lastAdvanceRef.current = now;
        setHits(prev => { const s = new Set(prev); currentGroup.forEach(n => s.add(n.id)); return s; });
        setTimeout(() => setCurrentNoteIdx(i => Math.min(i + 1, sortedGroups.length)), 200);
      }
    } else {
      if (pitch.midi != null && targetPCs.has((pitch.midi as number) % 12)) {
        lastAdvanceRef.current = now;
        setHits(prev => { const s = new Set(prev); currentGroup.forEach(n => s.add(n.id)); return s; });
        setTimeout(() => setCurrentNoteIdx(i => Math.min(i + 1, sortedGroups.length)), 200);
      }
    }
  }, [pitch.midi, pitch.activeChordTones, pitch.enabled, currentGroup, isChord, targetPCs, sortedGroups.length]);

  const goBack = () => { pitch.stop(); setAnimateIn(false); setTimeout(() => nav(`/courses/${courseId}`), 300); };
  const restart = () => { setCurrentNoteIdx(0); setHits(new Set()); };
  const finished = sortedGroups.length > 0 && currentNoteIdx >= sortedGroups.length;

  // tabVisNotes for the Fretboard: only show CURRENT group + an upcoming preview
  const tabVisNotes = useMemo(() => {
    if (finished || currentGroup.length === 0) return null;
    const current = currentGroup.map(n => ({ string: 5 - n.stringIndex, fret: n.fret })); // Fretboard uses string 0=high e
    const upcoming = sortedGroups.slice(currentNoteIdx + 1, currentNoteIdx + 4)
      .map(g => g.map(n => ({ string: 5 - n.stringIndex, fret: n.fret })));
    return { current, upcoming };
  }, [currentGroup, sortedGroups, currentNoteIdx, finished]);

  if (loading) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">Loading…</div>;
  if (!tab) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center text-muted-foreground">Lesson not found</div>;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out flex flex-col"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-5" /> Back</button>
        <div>
          <h1 className="text-lg font-semibold">{tab.title}</h1>
          <p className="text-xs text-muted-foreground">{tab.key_root} {tab.key_quality} · {tab.tempo} bpm</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={restart}><RotateCcw className="size-4 mr-1" /> Restart</Button>
          {pitch.enabled
            ? <Button size="sm" variant="destructive" onClick={pitch.stop}><MicOff className="size-4 mr-1" /> Stop</Button>
            : <Button size="sm" onClick={pitch.start}><Mic className="size-4 mr-1" /> Listen</Button>}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          {finished ? '✅ Lesson complete!' : isChord ? 'Play this chord' : 'Play this note'}
        </p>

        {/* Real Fretboard, identical to main page */}
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
          tabVisNotes={tabVisNotes}
          suppressScaleNotes={true}
        />

        {/* Mic feedback */}
        <div className="text-xs text-muted-foreground flex items-center gap-3 justify-center">
          {pitch.error && <span className="text-destructive">{pitch.error}</span>}
          {pitch.enabled && (
            <>
              <span>Detected: {pitch.midi != null ? `MIDI ${pitch.midi} (${pitch.cents > 0 ? '+' : ''}${pitch.cents}¢)` : '—'}</span>
              <span>RMS: {pitch.rms.toFixed(3)}</span>
            </>
          )}
        </div>

        {/* Tab + chasing playhead */}
        <div className="bg-card border border-border rounded-2xl p-4 overflow-x-auto">
          <PhrasePreview tab={tab} currentIdx={currentNoteIdx} groups={sortedGroups} hits={hits} />
        </div>
      </main>
    </div>
  );
}

function PhrasePreview({ tab, currentIdx, groups, hits }: {
  tab: CourseTabRow;
  currentIdx: number;
  groups: CourseTabRow['phrase']['notes'][];
  hits: Set<string>;
}) {
  const CELL_W = 28;
  const ROW_H = 22;
  const totalCells = tab.phrase.lengthGrid;
  const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
  const playheadCell = groups[currentIdx]?.[0]?.beatIndex ?? totalCells;

  return (
    <div className="relative" style={{ width: totalCells * CELL_W + 24, minWidth: '100%' }}>
      {[5, 4, 3, 2, 1, 0].map(stringIndex => (
        <div key={stringIndex} className="relative border-b border-border" style={{ height: ROW_H }}>
          <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[10px] font-mono text-muted-foreground bg-muted/30 border-r border-border z-10">
            {STRING_LABELS[stringIndex]}
          </div>
          {tab.phrase.notes.filter(n => n.stringIndex === stringIndex).map(n => (
            <div key={n.id}
              className={`absolute top-0.5 z-10 text-xs font-mono rounded px-1 ${hits.has(n.id) ? 'bg-green-500/60 text-white' : 'bg-background/90 text-foreground'}`}
              style={{ left: 24 + n.beatIndex * CELL_W + 2, height: ROW_H - 4, lineHeight: `${ROW_H - 4}px`, minWidth: 18 }}>
              {n.fret}
            </div>
          ))}
        </div>
      ))}
      <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 transition-all duration-200" style={{ left: 24 + playheadCell * CELL_W }} />
    </div>
  );
}
