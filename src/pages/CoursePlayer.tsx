import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, MicOff, RotateCcw } from 'lucide-react';
import { usePitchDetector } from '@/hooks/usePitchDetector';
import type { CourseRow } from '@/lib/courseTypes';
import { STANDARD_TUNING } from '@/lib/music';

const FRET_W = 44;
const STRING_H = 32;
const FRET_COUNT = 16;

export default function CoursePlayer() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [animateIn, setAnimateIn] = useState(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const [hits, setHits] = useState<Set<string>>(new Set());
  const lastAdvanceRef = useRef(0);
  const pitch = usePitchDetector();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) nav('/auth'); });
    requestAnimationFrame(() => setAnimateIn(true));
  }, [nav]);

  useEffect(() => {
    if (!id) return;
    supabase.from('courses').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { setLoading(false); return; }
      setCourse(data as unknown as CourseRow);
      setLoading(false);
    });
  }, [id]);

  // Sort notes by beatIndex; group same beatIndex into chords
  const sortedGroups = useMemo(() => {
    if (!course) return [];
    const map = new Map<number, typeof course.phrase.notes>();
    course.phrase.notes.forEach(n => {
      const arr = map.get(n.beatIndex) ?? [];
      arr.push(n);
      map.set(n.beatIndex, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, notes]) => notes);
  }, [course]);

  const currentGroup = sortedGroups[currentNoteIdx] ?? [];
  const isChord = currentGroup.length > 1;

  // Compute target MIDI pitches for current group
  const targetMidis = useMemo(() => {
    return currentGroup.map(n => 40 + (STANDARD_TUNING[n.stringIndex] ?? 0) + n.fret + (n.stringIndex >= 3 ? 12 : 0));
    // (Approximate — we mainly need pitch class match)
  }, [currentGroup]);
  const targetPCs = useMemo(() => new Set(targetMidis.map(m => m % 12)), [targetMidis]);

  // Pitch listener → advance when matched
  useEffect(() => {
    if (!pitch.enabled || currentGroup.length === 0) return;
    const now = performance.now();
    if (now - lastAdvanceRef.current < 350) return; // debounce

    if (isChord) {
      // need at least 2 of the chord pitch classes detected via FFT peaks
      let hitCount = 0;
      targetPCs.forEach(pc => { if (pitch.activeChordTones.has(pc)) hitCount++; });
      if (hitCount >= Math.min(2, targetPCs.size)) {
        lastAdvanceRef.current = now;
        setHits(prev => { const s = new Set(prev); currentGroup.forEach(n => s.add(n.id)); return s; });
        setTimeout(() => setCurrentNoteIdx(i => Math.min(i + 1, sortedGroups.length)), 200);
      }
    } else {
      // monophonic — match pitch class
      if (pitch.midi != null && targetPCs.has(pitch.midi % 12)) {
        lastAdvanceRef.current = now;
        setHits(prev => { const s = new Set(prev); currentGroup.forEach(n => s.add(n.id)); return s; });
        setTimeout(() => setCurrentNoteIdx(i => Math.min(i + 1, sortedGroups.length)), 200);
      }
    }
  }, [pitch.midi, pitch.activeChordTones, pitch.enabled, currentGroup, isChord, targetPCs, sortedGroups.length]);

  const goBack = () => { pitch.stop(); setAnimateIn(false); setTimeout(() => nav('/courses'), 300); };

  const restart = () => { setCurrentNoteIdx(0); setHits(new Set()); };

  const finished = sortedGroups.length > 0 && currentNoteIdx >= sortedGroups.length;

  if (loading) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">Loading…</div>;
  if (!course) return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center text-muted-foreground">Course not found</div>;

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground transition-transform duration-300 ease-out flex flex-col"
      style={{ transform: animateIn ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-5" /> Back</button>
        <div>
          <h1 className="text-lg font-semibold">{course.title}</h1>
          <p className="text-xs text-muted-foreground">{course.key_root} {course.key_quality} · {course.tempo} bpm</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={restart}><RotateCcw className="size-4 mr-1" /> Restart</Button>
          {pitch.enabled
            ? <Button size="sm" variant="destructive" onClick={pitch.stop}><MicOff className="size-4 mr-1" /> Stop</Button>
            : <Button size="sm" onClick={pitch.start}><Mic className="size-4 mr-1" /> Listen</Button>}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Interactive fretboard — shows ONLY the current note(s) */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-2">{finished ? '✅ Course complete!' : isChord ? 'Play this chord' : 'Play this note'}</p>
          <div className="relative mx-auto" style={{ width: (FRET_COUNT + 1) * FRET_W, height: 6 * STRING_H }}>
            {/* Strings */}
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="absolute left-0 right-0 bg-muted-foreground/40" style={{ top: idx * STRING_H + STRING_H / 2, height: 1 + Math.floor((5 - idx) / 2) }} />
            ))}
            {/* Frets */}
            {Array.from({ length: FRET_COUNT + 1 }).map((_, idx) => (
              <div key={idx} className="absolute top-0 bottom-0 bg-border" style={{ left: idx * FRET_W, width: idx === 0 ? 4 : 2 }} />
            ))}
            {/* Inlays */}
            {[3, 5, 7, 9, 12, 15].map(f => (
              <div key={f} className="absolute rounded-full bg-muted-foreground/20" style={{ left: (f - 0.5) * FRET_W - 6, top: 3 * STRING_H - 6, width: 12, height: 12 }} />
            ))}
            {/* Current note(s) only */}
            {!finished && currentGroup.map(n => {
              // display row: high e top → low E bottom (stringIndex 5 → row 0)
              const row = 5 - n.stringIndex;
              const x = n.fret === 0 ? -28 : (n.fret - 0.5) * FRET_W;
              const y = row * STRING_H + STRING_H / 2;
              return (
                <div key={n.id}
                  className="absolute rounded-full flex items-center justify-center text-xs font-bold animate-pulse"
                  style={{
                    left: x - 14, top: y - 14, width: 28, height: 28,
                    background: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    boxShadow: '0 0 16px hsl(var(--primary) / 0.7)',
                  }}>
                  {n.fret}
                </div>
              );
            })}
          </div>

          {/* Mic feedback */}
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
            {pitch.error && <span className="text-destructive">{pitch.error}</span>}
            {pitch.enabled && (
              <>
                <span>Detected: {pitch.midi != null ? `MIDI ${pitch.midi} (${pitch.cents > 0 ? '+' : ''}${pitch.cents}¢)` : '—'}</span>
                <span>RMS: {pitch.rms.toFixed(3)}</span>
              </>
            )}
          </div>
        </div>

        {/* Tab + chasing playhead */}
        <div className="bg-card border border-border rounded-2xl p-4 overflow-x-auto">
          <PhrasePreview course={course} currentIdx={currentNoteIdx} groups={sortedGroups} hits={hits} />
        </div>
      </main>
    </div>
  );
}

function PhrasePreview({ course, currentIdx, groups, hits }: {
  course: CourseRow;
  currentIdx: number;
  groups: CourseRow['phrase']['notes'][];
  hits: Set<string>;
}) {
  const CELL_W = 28;
  const ROW_H = 22;
  const totalCells = course.phrase.lengthGrid;
  const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
  const playheadCell = groups[currentIdx]?.[0]?.beatIndex ?? totalCells;

  return (
    <div className="relative" style={{ width: totalCells * CELL_W + 24, minWidth: '100%' }}>
      {[5, 4, 3, 2, 1, 0].map(stringIndex => (
        <div key={stringIndex} className="relative border-b border-border" style={{ height: ROW_H }}>
          <div className="absolute left-0 top-0 h-full w-6 flex items-center justify-center text-[10px] font-mono text-muted-foreground bg-muted/30 border-r border-border z-10">
            {STRING_LABELS[stringIndex]}
          </div>
          {course.phrase.notes.filter(n => n.stringIndex === stringIndex).map(n => (
            <div key={n.id}
              className={`absolute top-0.5 z-10 text-xs font-mono rounded px-1 ${hits.has(n.id) ? 'bg-green-500/60 text-white' : 'bg-background/90 text-foreground'}`}
              style={{ left: 24 + n.beatIndex * CELL_W + 2, height: ROW_H - 4, lineHeight: `${ROW_H - 4}px`, minWidth: 18 }}
            >
              {n.fret}
            </div>
          ))}
        </div>
      ))}
      {/* Playhead */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 transition-all duration-200" style={{ left: 24 + playheadCell * CELL_W }} />
    </div>
  );
}
