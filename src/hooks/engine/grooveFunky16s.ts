// "Funky 16s" — procedural Funk groove (genre: Funk, groove id 2).
// Straight 16ths, no swing. Bass rhythm mirrors the kick.
//
// Grid: 16 steps per bar, step = 0.25 beats. Steps 0/4/8/12 = beats 1..4.
// Default tempo suggestion: 86 BPM (range 76–104). Tempo is chosen by the
// user on the timeline; this generator does not force it.
import type { TimelineChord } from '@/hooks/useSongTimeline';
import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import { NOTE_NAMES } from '@/lib/music';
import { jitterTime, jitterVelocity } from './humanize';

let nextId = 1;
const nid = (p: string) => `${p}-f16-${nextId++}`;

const rand = () => Math.random();
const chance = (p: number) => Math.random() < p;
const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randRange = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// ±5 ticks assuming 480 PPQ = ±5/480 ≈ 0.0104 beats
const DRUM_TICK_JITTER = 5 / 480;
// ±4 ticks bass
const BASS_TICK_JITTER = 4 / 480;

function rootPc(chord: TimelineChord): number {
  const idx = NOTE_NAMES.indexOf(chord.root as any);
  return idx < 0 ? 0 : idx;
}

/** Anchor bass root inside E1..D2 (MIDI 28..38). */
function bassRootPitch(pc: number): number {
  let p = 24 + pc; // C1 base
  while (p < 28) p += 12;
  while (p > 38) p -= 12;
  return p;
}

function chordAtBeat(beat: number, chords: TimelineChord[]): TimelineChord | null {
  for (const c of chords) {
    if (beat >= c.startBeat && beat < c.startBeat + c.duration) return c;
  }
  // Fallback to last chord if beat past end
  return chords.length ? chords[chords.length - 1] : null;
}

export function generateFunky16s(
  chords: TimelineChord[],
  measures: number,
  _intensities: { piano: number; bass: number; drums: number },
  _complexities: { piano: number; bass: number; drums: number },
): Record<TrackId, MidiNote[]> {
  const drums: MidiNote[] = [];
  const bass: MidiNote[] = [];
  const piano: MidiNote[] = [];

  const pushDrum = (beat: number, pitch: number, vel: number, dur: number, humanize = true) => {
    drums.push({
      id: nid('d'),
      startBeat: humanize ? jitterTime(beat, DRUM_TICK_JITTER) : beat,
      duration: dur,
      pitch,
      velocity: humanize ? jitterVelocity(vel, 6) : Math.round(vel),
    });
  };
  const pushBass = (beat: number, pitch: number, vel: number, dur: number) => {
    bass.push({
      id: nid('b'),
      startBeat: jitterTime(beat, BASS_TICK_JITTER),
      duration: dur,
      pitch,
      velocity: jitterVelocity(vel, 5),
    });
  };

  const step = 0.25; // 1/16 in beats

  for (let bar = 0; bar < measures; bar++) {
    const barBeat = bar * 4;
    const isFillBar = (bar + 1) % 4 === 0; // every 4th bar
    const chord = chordAtBeat(barBeat, chords);
    if (!chord) continue;
    const pc = rootPc(chord);
    const root = bassRootPitch(pc);

    // ─── KICK ────────────────────────────────────────────────
    // Base steps: 0, 3, 7, 9, 10 (velocity 110–120).
    // Variation: ~40% of bars drop step 3 OR step 9.
    let kickSteps = new Set<number>([0, 3, 7, 9, 10]);
    if (!isFillBar && chance(0.4)) {
      kickSteps.delete(pickOne([3, 9]));
    }
    if (isFillBar) {
      // Only the downbeat kick during the fill; hats & rest handled below.
      kickSteps = new Set<number>([0]);
    }
    for (const s of kickSteps) {
      pushDrum(barBeat + s * step, DRUM_PITCHES.kick, randRange(110, 120), 0.2);
    }

    // ─── SNARE BACKBEAT (never varied) ───────────────────────
    // On fill bar keep only step 4 backbeat.
    const backbeatSteps = isFillBar ? [4] : [4, 12];
    for (const s of backbeatSteps) {
      // No humanization on backbeat (per spec).
      pushDrum(barBeat + s * step, DRUM_PITCHES.snare, randRange(115, 124), 0.25, false);
    }

    // ─── SNARE GHOSTS ───────────────────────────────────────
    if (!isFillBar) {
      const ghostPool = [5, 6, 9, 11, 15].filter(
        s => !kickSteps.has(s) && s !== 4 && s !== 12,
      );
      // Shuffle, take 2–3
      const shuffled = [...ghostPool].sort(() => Math.random() - 0.5);
      const count = 2 + (chance(0.5) ? 1 : 0);
      for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        pushDrum(barBeat + shuffled[i] * step, DRUM_PITCHES.snare, randRange(25, 50), 0.05);
      }
    }

    // ─── CLOSED HI-HAT — all 16 steps ───────────────────────
    for (let s = 0; s < 16; s++) {
      // On fill bar: drop hats from step 8 onward
      if (isFillBar && s >= 8) continue;
      const isEven = s % 2 === 0;
      const vel = isEven ? randRange(95, 110) : randRange(55, 70);
      pushDrum(barBeat + s * step, DRUM_PITCHES.hihat_closed, vel, 0.09);
    }

    // ─── FILL CONTENT (every 4th bar) ───────────────────────
    if (isFillBar) {
      // Snare hits on steps 8 and 9 (vel ~115)
      pushDrum(barBeat + 8 * step, DRUM_PITCHES.snare, 115, 0.2);
      pushDrum(barBeat + 9 * step, DRUM_PITCHES.snare, 115, 0.2);
      // tom3 (48) double-hit on step 11, ~30 ticks apart
      const step11 = barBeat + 11 * step;
      pushDrum(step11, DRUM_PITCHES.tom3, 108, 0.15);
      pushDrum(step11 + 30 / 480, DRUM_PITCHES.tom3, 112, 0.15);
      // tom2 (47) on steps 13 and 14
      pushDrum(barBeat + 13 * step, DRUM_PITCHES.tom2, 110, 0.2);
      pushDrum(barBeat + 14 * step, DRUM_PITCHES.tom2, 114, 0.2);
      // Crash + kick on step 0 of the NEXT bar
      const nextDown = (bar + 1) * 4;
      if (bar + 1 < measures) {
        pushDrum(nextDown, DRUM_PITCHES.crash, 118, 0.6);
        pushDrum(nextDown, DRUM_PITCHES.kick, 118, 0.25);
      }
    }

    // ─── BASS — mirrors kick, gaps on 4 & 12 (snare territory) ───
    // Alternate the "pop" note between octave and b7 per bar.
    const usePop = bar % 2 === 0; // even bars: octave-up ; odd bars: b7
    const popPitch = usePop ? root + 12 : root + 10;

    // Determine which key kick steps are actually present this bar
    // (so bass rhythm truly mirrors kick — including the dropped step).
    // NOTE: even on a fill bar the bass keeps its own bar-length pattern
    // (the fill is a drum event, not a bass rest).
    const bassKickSteps = isFillBar ? new Set([0, 3, 7, 9, 10]) : kickSteps;

    // Step 0 — root, 8th-note length, the anchor.
    if (bassKickSteps.has(0)) {
      pushBass(barBeat + 0, root, randRange(100, 110), 0.5);
    }
    // Step 3 — root staccato (60% of a 16th)
    if (bassKickSteps.has(3)) {
      pushBass(barBeat + 3 * step, root, randRange(85, 95), step * 0.6);
    }
    // Step 7 — pop note (octave or b7), staccato
    if (bassKickSteps.has(7)) {
      pushBass(barBeat + 7 * step, popPitch, randRange(95, 105), step * 0.6);
    }
    // Steps 9 & 10 — two staccato 16ths, crescendo
    if (bassKickSteps.has(9)) {
      pushBass(barBeat + 9 * step, root, randRange(80, 90), step * 0.6);
    }
    if (bassKickSteps.has(10)) {
      pushBass(barBeat + 10 * step, root, randRange(90, 100), step * 0.6);
    }

    // Dead note ~30% of bars, on step 5 or 11 (mirror the ghosts).
    if (chance(0.3)) {
      const dStep = pickOne([5, 11]);
      pushBass(barBeat + dStep * step, root, randRange(30, 45), 0.05);
    }

    // Pickup: 50% of bars, at step 14 or 15, chromatic-below OR 5th of NEXT chord.
    if (chance(0.5) && bar + 1 < measures) {
      const nextChord = chordAtBeat((bar + 1) * 4, chords);
      if (nextChord) {
        const nextPc = rootPc(nextChord);
        const nextRoot = bassRootPitch(nextPc);
        const pickupStep = pickOne([14, 15]);
        // Chromatic approach = semitone below next root; else 5th (root+7)
        const useChromatic = chance(0.6);
        let p = useChromatic ? nextRoot - 1 : nextRoot + 7;
        // Keep within E1..D3 (28..50) — octave pops may reach D3.
        while (p < 28) p += 12;
        while (p > 50) p -= 12;
        pushBass(barBeat + pickupStep * step, p, randRange(75, 85), step * 0.6);
      }
    }
  }

  return { piano, bass, drums };
}
