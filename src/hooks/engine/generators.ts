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

/* ════════════════════════════════════════════════════════════════════════
 * USER-DESIGNATED FILL — crash-led, snare build, low-tom resolution.
 *
 * Layout per fill of N bars (occupies bars [startBar..startBar+N)):
 *   • Crash on the first downbeat of the fill (bar startBar, beat 0).
 *   • Snare density grows over the fill: starts as 8ths, accelerates to
 *     16ths in the second half, velocities ramp from ~55 to ~110.
 *   • The LAST beat before the fill ends is replaced by a low-tom run
 *     (tom2 → tom1) to "set up" the return to the groove.
 *   • Foot-hi-hat pulse on 2 & 4 is preserved through the fill so it
 *     still feels glued to the beat.
 * ════════════════════════════════════════════════════════════════════════ */
function generateUserFill(
  startBeat: number,
  lengthBars: number,
  intensity: number,
  pushNote: (beat: number, pitch: number, vel: number, dur?: number) => void,
) {
  const lengthBeats = lengthBars * 4;
  // 1) Crash on the very first downbeat
  pushNote(startBeat, DRUM_PITCHES.crash, 100 + intensity * 20, 0.6);

  // 2) Foot hat on 2 & 4 of every bar in the fill (keeps the time)
  for (let b = 0; b < lengthBars; b++) {
    pushNote(startBeat + b * 4 + 1, DRUM_PITCHES.hihat, 60 + intensity * 15, 0.05);
    pushNote(startBeat + b * 4 + 3, DRUM_PITCHES.hihat, 60 + intensity * 15, 0.05);
  }

  // 3) Snare build — start at 8th notes, switch to 16th notes halfway,
  //    velocity ramps from ~55 to ~108. We exclude the LAST beat which
  //    is reserved for the tom resolution.
  const buildEnd = lengthBeats - 1; // last beat is for toms
  const halfPoint = buildEnd / 2;
  let beat = 0;
  while (beat < buildEnd - 0.001) {
    // Sub-division: 8ths in the first half, 16ths in the second
    const sub = beat < halfPoint ? 0.5 : 0.25;
    const progress = beat / buildEnd;
    const vel = 55 + progress * 50 + intensity * 10;
    pushNote(startBeat + beat, DRUM_PITCHES.snare, vel, sub * 0.9);
    beat += sub;
  }

  // 4) Tom resolution on the final beat — tom2 then tom1 as a "boom-boom"
  const finalBeat = startBeat + lengthBeats - 1;
  pushNote(finalBeat,         DRUM_PITCHES.tom2, 100 + intensity * 15, 0.25);
  pushNote(finalBeat + 0.5,   DRUM_PITCHES.tom1, 105 + intensity * 15, 0.25);
}

/* ════════════════════════════════════════════════════════════════════════
 * JAZZ DRUMS — bar-by-bar generator modeled on Swing_jazz_groove.mid.
 *
 * Reference observations (171 hits across ~16 bars of "Cool Jazz Drumset 01"):
 *   • Ride (51): 4–7 hits per bar. Always lands on beats 1, 2, 3, 4 with a
 *     swung "skip" feel; bars vary by adding extras at ~0.65 (& of 1, swung)
 *     ~1.65 (& of 2), ~2.65 (& of 3), ~3.65 (& of 4) and occasional
 *     pickups at ~3.97 (a "16th-before-1"). Velocities 33–87, avg ~66.
 *   • Foot hi-hat: rock-solid on beats 2 & 4 every bar. Vel 60–80.
 *   • Snare: AVOIDS exact 2 & 4. Sits at ~0.7, ~1.7, ~2.7, ~3.7 (swung &-of)
 *     with occasional accents on 2.0 or 4.0. Mostly ghost notes (vel 12–40).
 *     1–4 hits per bar, sometimes none.
 *   • Kick: extremely sparse. Often only on beat 1 (vel 25–55, "feathered").
 *     Sometimes one extra hit at ~1.75 (& of 2) or ~3.95 (16th-before-1).
 *     Many bars have NO kick at all.
 *   • Crash: rare, only at phrase starts.
 *   • Wide velocity range across all instruments.
 *
 * Variation strategy: every bar generated independently from random rolls;
 * we keep a "fingerprint" of the previous bar and reroll up to 3 times if
 * a bar would be identical, guaranteeing no consecutive repeats.
 * ════════════════════════════════════════════════════════════════════════ */

interface JazzBar {
  ride: number[];   // beats positions of ride hits
  snare: { beat: number; vel: number }[];
  kick:  { beat: number; vel: number }[];
}

function rollJazzBar(intensity: number, complexity: number): JazzBar {
  // ── RIDE ──
  // Spine: 4 quarter-note hits (with tiny humanization on 2 & 4 due to swing).
  const ride: number[] = [0, 1, 2, 3];
  // Add &-of-X hits stochastically (swung positions ~0.65, 1.65, 2.65, 3.65).
  // More likely as complexity rises.
  const swingPos = [0.66, 1.66, 2.66, 3.66];
  for (const p of swingPos) {
    // Each spot independently — biased so ride averages 4–6 hits
    if (chance(0.25 + complexity * 0.4)) ride.push(p);
  }
  // Occasional "pickup" 16th-before-1 (i.e. position 3.95) — sparingly.
  if (chance(0.10 + intensity * 0.10)) ride.push(3.95);
  ride.sort((a, b) => a - b);

  // ── SNARE GHOSTS ──
  // Pool of swung positions where snare ghosts/comments tend to fall.
  const snarePool = [0.66, 1.0, 1.66, 2.0, 2.66, 3.0, 3.66];
  const ghosts: { beat: number; vel: number }[] = [];
  // Pick 2–4 positions (more if complexity is higher), shuffled
  const numGhosts = 1 + Math.floor(rand() * 2 + complexity * 2.5); // 1..4
  const shuffled = [...snarePool].sort(() => rand() - 0.5);
  for (let i = 0; i < Math.min(numGhosts, shuffled.length); i++) {
    const beat = shuffled[i];
    // Most ghosts soft (12–40), occasional accent (60–95) — wide range.
    const isAccent = chance(0.18 + intensity * 0.2);
    const vel = isAccent
      ? 60 + rand() * 35 + intensity * 5
      : 14 + rand() * 26;
    ghosts.push({ beat, vel });
  }

  // ── KICK ──
  // Very sparse: ~50% chance of a feathered "1", small chance of an extra hit.
  const kick: { beat: number; vel: number }[] = [];
  if (chance(0.45 + intensity * 0.2)) {
    // Feathered downbeat — soft
    kick.push({ beat: 0, vel: 22 + rand() * 30 + intensity * 8 });
  }
  // Occasional anticipations: & of 2 (1.75) or 16th-before-1 (3.95)
  if (chance(0.12 + complexity * 0.18)) {
    kick.push({ beat: 1.75, vel: 18 + rand() * 25 });
  }
  if (chance(0.08 + complexity * 0.15)) {
    kick.push({ beat: 3.95, vel: 30 + rand() * 35 + intensity * 10 });
  }

  return { ride, snare: ghosts, kick };
}

/** Compact signature used to detect identical consecutive bars. */
function jazzBarSignature(b: JazzBar): string {
  const r = b.ride.map(x => x.toFixed(2)).join(',');
  const s = b.snare.map(x => x.beat.toFixed(2)).join(',');
  const k = b.kick.map(x => x.beat.toFixed(2)).join(',');
  return `${r}|${s}|${k}`;
}

function generateJazzDrums(
  measures: number,
  intensity: number,
  complexity: number,
  fills: DrumFill[],
  pushNote: (beat: number, pitch: number, vel: number, dur?: number) => void,
): void {
  // Build a quick "bar is fill-covered" lookup.
  const fillByStartBar = new Map<number, DrumFill>();
  const coveredBars = new Set<number>();
  for (const f of fills) {
    fillByStartBar.set(f.startBar, f);
    for (let i = 0; i < f.lengthBars; i++) coveredBars.add(f.startBar + i);
  }

  let prevSig = '';
  for (let m = 0; m < measures; m++) {
    // If this bar is the start of a fill, render the fill and skip the groove for its bars.
    const fill = fillByStartBar.get(m);
    if (fill) {
      generateUserFill(m * 4, fill.lengthBars, intensity, pushNote);
      continue;
    }
    // If we're inside a fill that started earlier, skip — it was already rendered.
    if (coveredBars.has(m)) continue;

    // Otherwise: roll a fresh bar, ensuring it isn't identical to the previous one.
    let bar = rollJazzBar(intensity, complexity);
    let attempts = 0;
    while (jazzBarSignature(bar) === prevSig && attempts < 3) {
      bar = rollJazzBar(intensity, complexity);
      attempts++;
    }
    prevSig = jazzBarSignature(bar);

    const base = m * 4;

    // RIDE
    for (const r of bar.ride) {
      // Vel 33–87, slight accent on beats 1 & 3
      const isMain = Math.abs(r - Math.round(r)) < 0.05 && (Math.round(r) % 2 === 0);
      const baseVel = isMain ? 70 + rand() * 18 : 50 + rand() * 30;
      const vel = baseVel * (0.75 + intensity * 0.25);
      pushNote(base + r, DRUM_PITCHES.ride, vel, 0.22);
    }

    // FOOT HI-HAT on 2 & 4
    pushNote(base + 1, DRUM_PITCHES.hihat, 60 + rand() * 18, 0.06);
    pushNote(base + 3, DRUM_PITCHES.hihat, 62 + rand() * 18, 0.06);

    // SNARE ghosts/accents
    for (const s of bar.snare) {
      pushNote(base + s.beat, DRUM_PITCHES.snare, s.vel, s.vel < 45 ? 0.10 : 0.18);
    }

    // KICK (feathered)
    for (const k of bar.kick) {
      pushNote(base + k.beat, DRUM_PITCHES.kick, k.vel, 0.16);
    }
  }
}

export function generateDrums(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
  fills: DrumFill[] = [],
): MidiNote[] {
  const notes: MidiNote[] = [];
  const pushNote = (beat: number, pitch: number, vel: number, dur = 0.25) => {
    notes.push({
      id: newId('d'),
      startBeat: jitterTime(beat, 0.008),
      duration: dur,
      pitch,
      velocity: jitterVelocity(Math.max(8, Math.min(127, vel)), 6),
    });
  };

  // Jazz uses its own per-bar generator, with user fills replacing whole bars.
  if (genre === 'Jazz') {
    generateJazzDrums(measures, intensity, complexity, fills, pushNote);
    return notes;
  }

  // ── Other genres: existing cell-based system, with optional user fills. ──
  const useRide = intensity > 0.75 && chance(0.35);
  const swing = 0;

  // Build a covered-bar lookup for user fills.
  const fillByStartBar = new Map<number, DrumFill>();
  const coveredBars = new Set<number>();
  for (const f of fills) {
    fillByStartBar.set(f.startBar, f);
    for (let i = 0; i < f.lengthBars; i++) coveredBars.add(f.startBar + i);
  }

  // Phrase length — Logic uses 4 or 8 bar phrases
  const phraseLen = measures >= 8 ? 4 : Math.min(4, measures);

  for (let m = 0; m < measures; m++) {
    const fill = fillByStartBar.get(m);
    if (fill) {
      generateUserFill(m * 4, fill.lengthBars, intensity, pushNote);
      continue;
    }
    if (coveredBars.has(m)) continue;

    const measureBase = m * 4;
    const phrasePos = m % phraseLen;
    const isPhraseEnd = phrasePos === phraseLen - 1;
    // When the user is driving fills explicitly, suppress automatic fills.
    const autoFillsAllowed = fills.length === 0;
    const fillProb = autoFillsAllowed
      ? (isPhraseEnd ? 0.7 + intensity * 0.25 : (m === measures - 1 ? 0.85 : intensity * 0.12))
      : 0;
    const wantFill = chance(fillProb);
    const fillBeats = wantFill
      ? (intensity > 0.6 && chance(0.4) ? 2 : 1)
      : 0;
    const isCrashBar = (m === 0) || (m > 0 && (m - 1) % phraseLen === phraseLen - 1 && chance(0.85));

    const kickCell  = chooseCell(KICK_CELLS[genre],  complexity);
    const snareCell = chooseCell(SNARE_CELLS[genre], complexity);
    const cymbalCell = chooseCell(HAT_CELLS[genre], complexity);

    // KICK
    for (let s = 0; s < 16; s++) {
      const v = kickCell.steps[s];
      if (!v) continue;
      if (s >= 16 - fillBeats * 4) continue;
      if (chance(0.05 - intensity * 0.04)) continue;
      const baseVel = (s === 0 ? 110 : 100) * (0.7 + intensity * 0.4);
      pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), DRUM_PITCHES.kick, baseVel, 0.2);
    }

    // SNARE
    for (let s = 0; s < 16; s++) {
      const v = snareCell.steps[s];
      if (!v) continue;
      if (s >= 16 - fillBeats * 4) continue;
      if (chance(0.04)) continue;
      const accent = s === 4 || s === 12;
      const vel = (accent ? 102 : 88) * (0.65 + intensity * 0.45);
      pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), DRUM_PITCHES.snare, vel, 0.22);
    }

    // GHOST snares
    if (complexity > 0.35) {
      const ghostSteps = [3, 7, 11, 15, 2, 6, 10, 14];
      ghostSteps.forEach(step => {
        if (step >= 16 - fillBeats * 4) return;
        const p = (complexity - 0.35) * 0.6;
        if (chance(p)) {
          if (snareCell.steps[step]) return;
          pushNote(measureBase + step / 4 + swingOffset(step, genre, swing), DRUM_PITCHES.snare, 38 + complexity * 20, 0.1);
        }
      });
    }

    // CYMBAL
    for (let s = 0; s < 16; s++) {
      const v = cymbalCell.steps[s];
      if (!v) continue;
      if (s >= 16 - fillBeats * 4) continue;
      if (s === 14 && complexity > 0.5 && chance(0.25)) {
        pushNote(measureBase + s / 4, DRUM_PITCHES.hihat, 95 * (0.7 + intensity * 0.35), 0.45);
        continue;
      }
      if (complexity > 0.7 && s % 2 === 1 && chance(0.3)) continue;
      const pitch = useRide && intensity > 0.75 ? DRUM_PITCHES.ride : DRUM_PITCHES.hihat;
      const vel = v * (0.6 + intensity * 0.5);
      pushNote(measureBase + s / 4 + swingOffset(s, genre, swing), pitch, vel, pitch === DRUM_PITCHES.hihat ? 0.08 : 0.2);
    }

    // CRASH on bar 1 of new phrase
    if (isCrashBar) {
      pushNote(measureBase, DRUM_PITCHES.ride, 115 * (0.75 + intensity * 0.3), 0.6);
    }

    // Auto-fill (only when user hasn't placed any)
    if (fillBeats > 0 && autoFillsAllowed) {
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
  drumFills: DrumFill[] = [],
): Record<TrackId, MidiNote[]> {
  if (genre === 'Funk' && groove === 1) {
    return generateAllFromGroove(GROOVE_FUNK_1, chords, measures, intensities, complexities);
  }
  return {
    piano: generatePiano(chords, measures, intensities.piano, complexities.piano, genre),
    bass:  generateBass(chords, measures, intensities.bass, complexities.bass, genre),
    drums: generateDrums(chords, measures, intensities.drums, complexities.drums, genre, drumFills),
  };
}
