import type { TimelineChord, Genre, GrooveId } from '@/hooks/useSongTimeline';
import type { MidiNote, TrackId, DrumFill } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';
import { jitterTime, jitterVelocity } from './humanize';
import { GROOVE_FUNK_1 } from './groove1';
import { generateAllFromGroove } from './grooveGenerator';

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${nextId++}`;

// ─── Probability helpers (Logic Drummer style) ──────────────────────
const rand = () => Math.random();
const chance = (p: number) => Math.random() < p;
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function chordPitches(root: string, chordType: string, octave = 4): number[] {
  const formula = CHORD_FORMULAS[chordType];
  const rootIdx = NOTE_NAMES.indexOf(root as any);
  if (rootIdx < 0) return [];
  if (!formula) return [60 + rootIdx];
  const base = (octave + 1) * 12 + rootIdx;
  return formula.map(i => base + i);
}

/* ════════════════════════════════════════════════════════════════════════
 * DRUMS — Logic-Pro-Drummer inspired probabilistic generator.
 *
 * Approach (mirrors Apple's Drummer + GE3 model):
 *   • Two macro controls drive everything:
 *       loudness   = intensity   → velocities, cymbal choice (hat→ride), fills
 *       complexity = complexity  → syncopation, ghost notes, hat openings, kick density
 *   • Each bar is COMPOSED, not picked. We assemble three micro-cells:
 *       kickCell  (bar pattern, weighted by complexity & genre)
 *       snareCell (backbeat + ghost / cross-stick variations)
 *       cymbalCell(hat or ride pattern)
 *   • Phrase-aware: 4-bar phrases with a fill bar at the end of each.
 *     Crash on the downbeat after a fill. 8-bar markers get a stronger fill.
 *   • Per-hit randomization: micro-timing drift, velocity humanization,
 *     occasional drops/adds for natural feel.
 * ════════════════════════════════════════════════════════════════════════ */

interface DrumCell {
  /** 16-step array, each entry is 0 (rest) or velocity hint 1..127 */
  steps: number[];
  /** weight bias: how often to pick this cell */
  weight: number;
  /** complexity: 0=simple, 1=busy. Used to bias by complexity macro */
  busyness: number;
}

// ─── KICK CELLS (16 steps per bar) ──────────────────────────────────
const KICK_CELLS: Record<Genre, DrumCell[]> = {
  Rock: [
    { steps: bar([0, 8]),                             weight: 1.0, busyness: 0.0 },
    { steps: bar([0, 6, 8]),                          weight: 1.0, busyness: 0.25 },
    { steps: bar([0, 8, 10]),                         weight: 0.9, busyness: 0.35 },
    { steps: bar([0, 6, 8, 14]),                      weight: 0.7, busyness: 0.55 },
    { steps: bar([0, 3, 8, 11]),                      weight: 0.6, busyness: 0.6 },
    { steps: bar([0, 6, 8, 10, 14]),                  weight: 0.5, busyness: 0.8 },
    { steps: bar([0, 2, 6, 8, 10, 14]),               weight: 0.4, busyness: 1.0 },
  ],
  Pop: [
    { steps: bar([0, 8]),                             weight: 1.0, busyness: 0.0 },
    { steps: bar([0, 6, 8]),                          weight: 1.1, busyness: 0.3 },
    { steps: bar([0, 7, 8]),                          weight: 0.9, busyness: 0.4 },
    { steps: bar([0, 6, 8, 10]),                      weight: 0.7, busyness: 0.55 },
    { steps: bar([0, 6, 8, 14]),                      weight: 0.6, busyness: 0.7 },
    { steps: bar([0, 3, 6, 8, 11, 14]),               weight: 0.4, busyness: 0.95 },
  ],
  Jazz: [
    { steps: bar([0]),                                weight: 1.0, busyness: 0.0 }, // feathered "1"
    { steps: bar([0, 10]),                            weight: 0.9, busyness: 0.3 },
    { steps: bar([0, 6, 10]),                         weight: 0.6, busyness: 0.55 },
    { steps: bar([0, 7, 10, 13]),                     weight: 0.4, busyness: 0.85 },
  ],
  Funk: [
    { steps: bar([0, 6, 8, 14]),                      weight: 1.0, busyness: 0.4 },
    { steps: bar([0, 3, 8, 11, 14]),                  weight: 0.8, busyness: 0.7 },
  ],
  Latin: [
    // Tumbao-style: anticipated kick on the "and of 2" + downbeat 3
    { steps: bar([0, 6, 8]),                          weight: 1.0, busyness: 0.3 },
    { steps: bar([0, 6, 8, 14]),                      weight: 0.7, busyness: 0.6 },
  ],
};

// ─── SNARE CELLS — main backbeat patterns ──────────────────────────
const SNARE_CELLS: Record<Genre, DrumCell[]> = {
  Rock: [
    { steps: bar([4, 12]),                            weight: 1.0, busyness: 0.0 },
    { steps: bar([4, 12, 14]),                        weight: 0.6, busyness: 0.5 },
    { steps: bar([4, 11, 12]),                        weight: 0.5, busyness: 0.65 },
    { steps: bar([4, 7, 12, 15]),                     weight: 0.3, busyness: 0.9 },
  ],
  Pop: [
    { steps: bar([4, 12]),                            weight: 1.0, busyness: 0.0 },
    { steps: bar([4, 12, 14]),                        weight: 0.7, busyness: 0.45 },
    { steps: bar([4, 10, 12]),                        weight: 0.5, busyness: 0.65 },
    { steps: bar([4, 12, 13]),                        weight: 0.4, busyness: 0.8 },
  ],
  Jazz: [
    { steps: bar([6, 14]),                            weight: 1.0, busyness: 0.0 }, // displaced
    { steps: bar([4, 14]),                            weight: 0.7, busyness: 0.4 },
    { steps: bar([6, 11, 14]),                        weight: 0.5, busyness: 0.7 },
  ],
  Funk: [
    { steps: bar([4, 12]),                            weight: 1.0, busyness: 0.3 },
    { steps: bar([4, 10, 12, 14]),                    weight: 0.6, busyness: 0.7 },
  ],
  Latin: [
    // Cross-stick / rim feel on 3, light ghosts
    { steps: bar([8]),                                weight: 1.0, busyness: 0.0 },
    { steps: bar([4, 12]),                            weight: 0.5, busyness: 0.6 },
  ],
};

// ─── HI-HAT CELLS ──────────────────────────────────────────────────
const HAT_CELLS: Record<Genre, DrumCell[]> = {
  Rock: [
    { steps: barVel([0, 2, 4, 6, 8, 10, 12, 14], [80, 50, 80, 50, 80, 50, 80, 50]), weight: 1.0, busyness: 0.0 },
    { steps: barVel([0, 2, 4, 6, 8, 10, 12, 14], [85, 55, 85, 55, 85, 55, 85, 55]), weight: 1.0, busyness: 0.2 },
    { steps: stepsAll(80, 50),                        weight: 0.7, busyness: 0.7 }, // 16ths
    { steps: barVel([0, 4, 8, 12], [95, 95, 95, 95]), weight: 0.5, busyness: -0.3 }, // sparse 4 on the floor
  ],
  Pop: [
    { steps: barVel([0, 2, 4, 6, 8, 10, 12, 14], [78, 55, 78, 55, 78, 55, 78, 55]), weight: 1.0, busyness: 0.0 },
    { steps: stepsAll(75, 50),                        weight: 0.8, busyness: 0.6 },
    { steps: barVel([0, 4, 8, 12], [90, 90, 90, 90]), weight: 0.4, busyness: -0.3 },
  ],
  Jazz: [
    // Foot-hat on 2 & 4 only (jazz tradition; ride is the timekeeper)
    { steps: bar([2, 10]),                            weight: 1.0, busyness: 0.0 },
    { steps: bar([2, 10]),                            weight: 1.0, busyness: 0.4 },
  ],
  Funk: [
    { steps: stepsAll(78, 55),                        weight: 1.0, busyness: 0.5 },
    { steps: barVel([0, 2, 4, 6, 8, 10, 12, 14], [80, 55, 80, 55, 80, 55, 80, 55]), weight: 0.7, busyness: 0.2 },
  ],
  Latin: [
    // Steady 8ths, lightly accented like cascara
    { steps: barVel([0, 2, 4, 6, 8, 10, 12, 14], [85, 55, 70, 55, 85, 55, 70, 55]), weight: 1.0, busyness: 0.3 },
    { steps: stepsAll(72, 50),                        weight: 0.6, busyness: 0.7 },
  ],
};

// ─── RIDE CELL (Jazz primary, Rock high-intensity) ─────────────────
const JAZZ_RIDE: number[] = (() => {
  // Classic swung ride: ding-da-ding pattern — beats 1,2&,3,4&  with skip note
  const s = new Array(16).fill(0);
  s[0] = 95; s[3] = 0; s[4] = 80; s[6] = 65; s[8] = 95; s[11] = 0; s[12] = 80; s[14] = 65;
  return s;
})();

function bar(steps: number[]): number[] {
  const out = new Array(16).fill(0);
  for (const s of steps) out[s] = 100;
  return out;
}
function barVel(steps: number[], vels: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let i = 0; i < steps.length; i++) out[steps[i]] = vels[i];
  return out;
}
function stepsAll(accent: number, off: number): number[] {
  const out = new Array(16).fill(0);
  for (let i = 0; i < 16; i++) out[i] = i % 4 === 0 ? accent : (i % 2 === 0 ? off + 5 : off);
  return out;
}

/** Pick a cell biased by complexity macro: high complexity favors busier cells. */
function chooseCell(cells: DrumCell[], complexity: number): DrumCell {
  const weights = cells.map(c => {
    // Distance from desired busyness — closer = higher weight
    const diff = Math.abs(c.busyness - complexity);
    return c.weight * (1.2 - diff);
  });
  return pickWeighted(cells, weights.map(w => Math.max(0.05, w)));
}

function swingOffset(step: number, genre: Genre, amount: number) {
  if (genre !== 'Jazz' || step % 2 === 0) return 0;
  return 0.1 + amount * 0.12;
}

// ─── FILLS — composed by length and intensity ──────────────────────
function generateFill(
  measureBase: number,
  fillBeats: number,         // length of fill in beats (1, 2, or 4)
  intensity: number,
  complexity: number,
  pushNote: (beat: number, pitch: number, vel: number, dur?: number) => void,
) {
  const startBeat = measureBase + (4 - fillBeats);
  const totalSteps = fillBeats * 4; // 16ths
  // Pick fill type: 0=snare roll, 1=tom run, 2=kick+snare flam, 3=accelerating
  const types = [0, 1, 2, 3];
  const typeWeights = [
    1.0,
    0.8 + complexity * 0.6,
    0.6,
    intensity * 0.9 + complexity * 0.5,
  ];
  const type = pickWeighted(types, typeWeights);

  if (type === 0) {
    // Snare roll — accelerating velocity
    for (let i = 0; i < totalSteps; i++) {
      const beat = startBeat + i / 4;
      const vel = 60 + (i / totalSteps) * 50 + intensity * 10;
      pushNote(beat, DRUM_PITCHES.snare, vel, 0.18);
    }
  } else if (type === 1) {
    // Tom run — snare → mid tom → low tom (alternating)
    const pitches = [DRUM_PITCHES.snare, DRUM_PITCHES.tom, DRUM_PITCHES.tom - 2, DRUM_PITCHES.tom - 4];
    for (let i = 0; i < totalSteps; i++) {
      const beat = startBeat + i / 4;
      const p = pitches[Math.min(pitches.length - 1, Math.floor(i / 2))];
      pushNote(beat, p, 80 + intensity * 20, 0.2);
    }
  } else if (type === 2) {
    // Kick + snare ostinato
    for (let i = 0; i < totalSteps; i++) {
      const beat = startBeat + i / 4;
      const p = i % 2 === 0 ? DRUM_PITCHES.kick : DRUM_PITCHES.snare;
      pushNote(beat, p, 90 + intensity * 15, 0.2);
    }
  } else {
    // Accelerating fill: 8th, 8th, 16th, 16th, 16th, 16th, ...
    const positions = [0, 0.5];
    for (let i = 0; i < totalSteps - 2; i++) positions.push(1 + i / 4);
    positions.forEach((pos, i) => {
      if (pos >= fillBeats) return;
      const beat = startBeat + pos;
      const vel = 70 + (i / positions.length) * 45;
      const useTom = complexity > 0.5 && i > positions.length / 2;
      pushNote(beat, useTom ? DRUM_PITCHES.tom : DRUM_PITCHES.snare, vel, 0.18);
    });
  }
}

export function generateDrums(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];
  const useRide = genre === 'Jazz' || (intensity > 0.75 && chance(0.35));
  const swing = genre === 'Jazz' ? 0.75 + complexity * 0.15 : 0;

  const pushNote = (beat: number, pitch: number, vel: number, dur = 0.25) => {
    notes.push({
      id: newId('d'),
      startBeat: jitterTime(beat, 0.008),
      duration: dur,
      pitch,
      velocity: jitterVelocity(Math.max(20, Math.min(127, vel)), 8),
    });
  };

  // Phrase length — Logic uses 4 or 8 bar phrases
  const phraseLen = measures >= 8 ? 4 : Math.min(4, measures);

  for (let m = 0; m < measures; m++) {
    const measureBase = m * 4;
    const phrasePos = m % phraseLen;
    const isPhraseEnd = phrasePos === phraseLen - 1;
    // Fill probability climbs with intensity & at the end of phrases
      const fillProb = genre === 'Jazz'
        ? (isPhraseEnd ? 0.18 + intensity * 0.14 : intensity * 0.04)
        : (isPhraseEnd ? 0.7 + intensity * 0.25 : (m === measures - 1 ? 0.85 : intensity * 0.12));
    const wantFill = chance(fillProb);
      const fillBeats = wantFill
        ? (genre === 'Jazz' ? 1 : (intensity > 0.6 && chance(0.4) ? 2 : 1))
        : 0;
    const isCrashBar = (m === 0) || (m > 0 && (m - 1) % phraseLen === phraseLen - 1 && chance(0.85));

    // Choose cells for this measure
    const kickCell  = chooseCell(KICK_CELLS[genre],  complexity);
    const snareCell = chooseCell(SNARE_CELLS[genre], complexity);
      const cymbalCells = useRide && genre === 'Jazz'
      ? [{ steps: JAZZ_RIDE, weight: 1, busyness: 0.5 }]
      : HAT_CELLS[genre];
    const cymbalCell = chooseCell(cymbalCells, complexity);

    // ── Render KICK ──
      for (let s = 0; s < 16; s++) {
      const v = kickCell.steps[s];
      if (!v) continue;
      // Skip notes that fall inside the fill region
      if (s >= 16 - fillBeats * 4) continue;
      // Random note drop for organic feel
        if (chance(genre === 'Jazz' ? 0.12 : 0.05 - intensity * 0.04)) continue;
        const baseVel = genre === 'Jazz'
          ? (s === 0 ? 54 : 44) * (0.75 + intensity * 0.2)
          : (s === 0 ? 110 : 100) * (0.7 + intensity * 0.4);
        pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), DRUM_PITCHES.kick, baseVel, genre === 'Jazz' ? 0.16 : 0.2);
    }

    // ── Render SNARE backbeat ──
      for (let s = 0; s < 16; s++) {
      const v = snareCell.steps[s];
      if (!v) continue;
      if (s >= 16 - fillBeats * 4) continue;
        if (chance(genre === 'Jazz' ? 0.1 : 0.04)) continue;
      const accent = s === 4 || s === 12;
        const vel = genre === 'Jazz'
          ? (accent ? 58 : 46) * (0.85 + intensity * 0.2)
          : (accent ? 102 : 88) * (0.65 + intensity * 0.45);
        pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), DRUM_PITCHES.snare, vel, genre === 'Jazz' ? 0.12 : 0.22);
    }

    // ── GHOST snares (complexity-driven) ──
    if (complexity > 0.35) {
      const ghostSteps = [3, 7, 11, 15, 2, 6, 10, 14];
      ghostSteps.forEach(step => {
        if (step >= 16 - fillBeats * 4) return;
        const p = genre === 'Jazz' ? (complexity - 0.35) * 0.28 : (complexity - 0.35) * 0.6;
        if (chance(p)) {
          // Don't double-up on existing snare hits
          if (snareCell.steps[step]) return;
          pushNote(measureBase + step / 4 + swingOffset(step, genre, swing), DRUM_PITCHES.snare, genre === 'Jazz' ? 28 + complexity * 10 : 38 + complexity * 20, 0.1);
        }
      });
    }

    // ── Render CYMBAL (hat or ride) ──
      for (let s = 0; s < 16; s++) {
      const v = cymbalCell.steps[s];
      if (!v) continue;
      if (s >= 16 - fillBeats * 4) continue;
      // High complexity: occasional hat-open on the and-of-4
      if (s === 14 && complexity > 0.5 && chance(0.25)) {
        pushNote(measureBase + s / 4, DRUM_PITCHES.hihat, 95 * (0.7 + intensity * 0.35), 0.45);
        continue;
      }
      // High complexity: random hat drops for syncopation
      if (complexity > 0.7 && s % 2 === 1 && chance(0.3)) continue;
        const pitch = useRide && genre === 'Jazz' ? DRUM_PITCHES.ride
        : (useRide && intensity > 0.75 ? DRUM_PITCHES.ride : DRUM_PITCHES.hihat);
        const vel = genre === 'Jazz'
          ? v * (0.42 + intensity * 0.18)
          : v * (0.6 + intensity * 0.5);
        pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), pitch, vel, pitch === DRUM_PITCHES.hihat ? 0.08 : 0.2);
    }

    // ── CRASH on bar 1 of new phrase ──
    if (isCrashBar && genre !== 'Jazz') {
      pushNote(measureBase, DRUM_PITCHES.ride, 115 * (0.75 + intensity * 0.3), 0.6);
    }

    // ── FILL ──
    if (fillBeats > 0) {
      generateFill(measureBase, fillBeats, intensity, complexity, pushNote);
    }
  }

  return notes;
}

/* ════════════════════════════════════════════════════════════════════════
 * PIANO — bar-position-aware comping (Logic-Drummer-style for keys).
 *   • Per chord region we compose a rhythm out of 4 beat-cells.
 *   • Voicings: shell on bar-start, full mid-bar, color tones at high complexity.
 *   • Anticipations push the and-of-4 to lead into the next chord.
 *   • Sustain length scales with complexity; rests scale with intensity inversely.
 * ════════════════════════════════════════════════════════════════════════ */
const PIANO_BEAT_CELLS: { hits: number[]; vel: number[]; busyness: number; weight: number }[] = [
  { hits: [0],           vel: [88],          busyness: 0.0, weight: 1.0 },  // pad / whole-beat
  { hits: [0, 0.5],      vel: [85, 60],      busyness: 0.35, weight: 0.9 }, // 8ths
  { hits: [0.5],         vel: [78],          busyness: 0.4, weight: 0.7 },  // off-beat
  { hits: [0, 0.25, 0.5],vel: [80, 55, 65],  busyness: 0.65, weight: 0.5 },
  { hits: [0.25, 0.75],  vel: [70, 70],      busyness: 0.55, weight: 0.5 },
  { hits: [0, 0.5, 0.75],vel: [85, 60, 70],  busyness: 0.7, weight: 0.4 },  // syncopated
  { hits: [],            vel: [],            busyness: 0.0, weight: 0.45 }, // rest beat
];

export function generatePiano(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];
  const jazzSwing = genre === 'Jazz' ? 0.12 + complexity * 0.08 : 0;

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci];
    let pitches = chordPitches(chord.root, chord.chordType, 4);
    if (pitches.length === 0) continue;

    // Voicing variety
    const inversionRoll = Math.random();
    if (complexity > 0.3 && inversionRoll < 0.4) {
      pitches = [...pitches.slice(1), pitches[0] + 12];
    } else if (complexity > 0.55 && inversionRoll < 0.65) {
      pitches = [...pitches.slice(2), pitches[0] + 12, pitches[1] + 12];
    }
    if (complexity > 0.7 && chance(0.35) && pitches.length >= 3) pitches = pitches.slice(1); // rootless

    const fullBeats = Math.floor(chord.duration);
    const sub = chord.duration - fullBeats;

    for (let b = 0; b < fullBeats; b++) {
      const beatStart = chord.startBeat + b;
      // Pick a beat cell weighted by complexity & intensity
      const weights = PIANO_BEAT_CELLS.map(c => {
        const diff = Math.abs(c.busyness - (complexity * 0.6 + intensity * 0.4));
        // Rests more likely on inner beats than beat 1 of region
        const restPenalty = (c.hits.length === 0 && b === 0) ? 0.3 : 1;
        return c.weight * (1.2 - diff) * restPenalty;
      });
      const cell = pickWeighted(PIANO_BEAT_CELLS, weights.map(w => Math.max(0.04, w)));

      // Random skip for organic phrasing
      if (chance(0.08 - intensity * 0.06)) continue;

      // Voicing rotation: shell on b==0, full elsewhere, color-tone occasionally
      let voicing = pitches;
      if (b === 0) voicing = [pitches[0], pitches[Math.min(2, pitches.length - 1)]]; // root + 7th-ish shell
      if (b === 1 && complexity > 0.5) voicing = pitches.slice(1); // upper structure
      if (b === fullBeats - 1 && complexity > 0.7 && chance(0.35)) voicing = [pitches[pitches.length - 1] + 7]; // single high color

      cell.hits.forEach((off, i) => {
        const beat = beatStart + off + (genre === 'Jazz' && off % 1 !== 0 ? jazzSwing : 0);
        const isAnticipation = ci < chords.length - 1 && b === fullBeats - 1 && off >= 0.5 && complexity > 0.5 && chance(0.45);
        let v = voicing;
        if (isAnticipation) {
          const next = chordPitches(chords[ci + 1].root, chords[ci + 1].chordType, 4);
          if (next.length) v = next.slice(0, Math.min(3, next.length));
        }
        const dur = (off === 0 ? 0.7 : 0.45) * (1 + complexity * 0.4);
        const vel = jitterVelocity(cell.vel[i] + intensity * 8, 12);
        for (const p of v) {
          notes.push({
            id: newId('p'),
            startBeat: jitterTime(beat, 0.012),
            duration: dur,
            pitch: p,
            velocity: vel,
          });
        }
      });
    }

    // Tail subdivision (when chord duration isn't a whole number of beats)
    if (sub > 0.1) {
      const beat = chord.startBeat + fullBeats;
      const vel = jitterVelocity(70 + intensity * 10, 10);
      for (const p of pitches) notes.push({ id: newId('p'), startBeat: beat, duration: sub * 0.8, pitch: p, velocity: vel });
    }
  }

  return notes;
}

/* ════════════════════════════════════════════════════════════════════════
 * BASS — Walking (Jazz) / patterned (Rock/Pop) with chromatic approach
 *   to next chord; intensity drives ghost notes & fills, complexity drives
 *   passing tones & syncopation.
 * ════════════════════════════════════════════════════════════════════════ */
export function generateBass(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci];
    const rootIdx = NOTE_NAMES.indexOf(chord.root as any);
    if (rootIdx < 0) continue;
    const formula = CHORD_FORMULAS[chord.chordType] || [0, 4, 7];
    const root = 36 + rootIdx;
    const fifth = root + 7;
    const third = root + (formula[1] ?? 4);
    const seventh = root + (formula[3] ?? 10);
    const octave = root + 12;

    let targetNext = root;
    if (ci < chords.length - 1) {
      const nIdx = NOTE_NAMES.indexOf(chords[ci + 1].root as any);
      if (nIdx >= 0) targetNext = 36 + nIdx;
    }
    // If chord has a slash bass, use it as the bass note for beat 1
    let beat1Pitch = root;
    if (chord.bassNote) {
      const bIdx = NOTE_NAMES.indexOf(chord.bassNote as any);
      if (bIdx >= 0) beat1Pitch = 36 + bIdx;
    }

    const beats = Math.max(1, Math.floor(chord.duration));
    const push = (beat: number, pitch: number, vel: number, dur = 0.85) => {
      notes.push({
        id: newId('b'),
        startBeat: jitterTime(beat, 0.012),
        duration: dur,
        pitch,
        velocity: jitterVelocity(vel, 8),
      });
    };

    if (genre === 'Jazz' && intensity > 0.25) {
      // Walking bass — quarters with chord/scale tones + chromatic approach
      const tones = [root, third, fifth, seventh];
      for (let b = 0; b < beats; b++) {
        const beat = chord.startBeat + b;
        let pitch: number;
        if (b === 0) pitch = beat1Pitch;
        else if (b === beats - 1 && ci < chords.length - 1) {
          // Chromatic approach — half-step above OR below
          pitch = targetNext + (chance(0.5) ? -1 : 1);
        } else if (complexity > 0.55 && chance(0.35)) {
          // Scalar passing tone
          pitch = root + [2, 5, 9, 11][Math.floor(Math.random() * 4)];
        } else {
          pitch = tones[Math.floor(Math.random() * tones.length)];
        }
        push(beat, pitch, b === 0 ? 95 : 76, 0.9);
      }
    } else {
      // Rock/Pop — patterned bass with ghost notes & fills
      const patterns: number[][][] = [
        [[0], [0], [0], [0]],                      // root quarters
        [[0], [1], [0], [1]],                      // root-fifth
        [[0], [0], [1], [0]],                      // root,root,5,root
        [[0, 0], [0, 0], [0, 1], [0, 0]],          // 8ths driving
        [[0], [0, 1], [0], [3, 1]],                // syncopated
        [[0, 4], [0], [1], [0, 4]],                // ghost-on-and
      ];
      // Pick by intensity+complexity
      const idx = Math.min(
        patterns.length - 1,
        Math.floor(intensity * 3 + complexity * 3 * Math.random()),
      );
      const pat = patterns[Math.max(0, idx)];

      for (let b = 0; b < beats; b++) {
        const slot = pat[b % pat.length];
        for (let s = 0; s < slot.length; s++) {
          const subBeat = chord.startBeat + b + s / slot.length;
          let pitch = root;
          switch (slot[s]) {
            case 0: pitch = b === 0 && s === 0 ? beat1Pitch : root; break;
            case 1: pitch = fifth; break;
            case 2: pitch = octave; break;
            case 3: pitch = third; break;
            case 4: pitch = root; break; // ghost (low velocity)
          }
          const isGhost = slot[s] === 4 || (complexity > 0.6 && s > 0 && chance(0.18));
          const vel = isGhost ? 38 + complexity * 15 : (b === 0 && s === 0 ? 100 : 80);
          push(subBeat, pitch, vel, isGhost ? 0.18 : 0.4);
        }
      }

      // Approach fill on last beat into next chord
      if (ci < chords.length - 1 && intensity > 0.55 && chance(0.6)) {
        const fillBeat = chord.startBeat + beats - 1;
        const stepDir = targetNext >= root ? 1 : -1;
        for (let i = 0; i < 4; i++) {
          push(fillBeat + i / 4, targetNext - stepDir * (3 - i), 65 + i * 5, 0.22);
        }
      }
    }
  }

  return notes;
}

export function generateAllTracks(
  chords: TimelineChord[],
  measures: number,
  genre: Genre,
  intensities: { piano: number; bass: number; drums: number },
  complexities: { piano: number; bass: number; drums: number },
  groove?: GrooveId,
): Record<TrackId, MidiNote[]> {
  // Funk uses an imported MIDI groove template (rhythm + feel preserved,
  // pitches transposed to follow the user's chords on the timeline).
  if (genre === 'Funk' && groove === 1) {
    return generateAllFromGroove(GROOVE_FUNK_1, chords, measures, intensities, complexities);
  }
  return {
    piano: generatePiano(chords, measures, intensities.piano, complexities.piano, genre),
    bass:  generateBass(chords, measures, intensities.bass, complexities.bass, genre),
    drums: generateDrums(chords, measures, intensities.drums, complexities.drums, genre),
  };
}
