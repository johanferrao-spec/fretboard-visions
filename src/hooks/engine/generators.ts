import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';
import { jitterTime, jitterVelocity } from './humanize';

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${nextId++}`;

// ─── Pseudo-random helpers ──────────────────────────────────────────
// Deterministic-ish: still uses Math.random but biased by a "variation seed"
// so that each chord region gets unique-feeling variation.
const rand = () => Math.random();
const chance = (p: number) => Math.random() < p;
const pickWeighted = <T,>(items: T[], weights: number[]): T => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};

function chordPitches(root: string, chordType: string, octave: number = 4): number[] {
  const formula = CHORD_FORMULAS[chordType];
  const rootIdx = NOTE_NAMES.indexOf(root as any);
  if (rootIdx < 0) return [];
  if (!formula) return [60 + rootIdx];
  const base = (octave + 1) * 12 + rootIdx;
  return formula.map(i => base + i);
}

/**
 * intensity: 0..1  → density / velocity / fills / ghost notes
 * complexity: 0..1 → syncopation, passing tones, extensions, voicing variety
 */

// ───────────────────────────────────────────────────────────────────────
// PIANO — comping with rhythmic patterns, voicing inversions, anticipation
// ───────────────────────────────────────────────────────────────────────
export function generatePiano(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
): MidiNote[] {
  const notes: MidiNote[] = [];

  // Pre-built rhythmic templates (in 16ths, length 16 per bar)
  // 1 = strong hit, 0.6 = medium, 0.3 = soft/ghost, 0 = rest
  const rhythmLibrary: number[][] = [
    // Sparse pad
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    // Charleston (jazz)
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 2+3+3 clave-ish
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    // Off-beat comp
    [0, 0, 0.6, 0, 1, 0, 0.6, 0, 0, 0, 0.6, 0, 1, 0, 0.6, 0],
    // Steady 8ths
    [1, 0, 0.6, 0, 0.8, 0, 0.6, 0, 1, 0, 0.6, 0, 0.8, 0, 0.6, 0],
    // Syncopated busy
    [1, 0, 0.5, 0.7, 0, 0.6, 0, 0.8, 1, 0, 0.5, 0.7, 0, 0.6, 0, 0.8],
    // Anticipation push (and-of-4 leads next)
    [1, 0, 0, 0, 0.8, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0.7, 0],
  ];

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci];
    let pitches = chordPitches(chord.root, chord.chordType, 4);
    if (pitches.length === 0) continue;

    // Voicing diversity — choose inversion based on complexity & a per-chord roll
    const inversionRoll = Math.random();
    if (complexity > 0.3 && inversionRoll < 0.4) {
      // 1st inversion — bottom note up an octave
      pitches = [...pitches.slice(1), pitches[0] + 12];
    } else if (complexity > 0.55 && inversionRoll < 0.65) {
      // 2nd inversion
      pitches = [...pitches.slice(2), pitches[0] + 12, pitches[1] + 12];
    }

    // Drop the lowest note for a rootless voicing (jazz)
    const rootless = complexity > 0.7 && chance(0.4);
    if (rootless && pitches.length >= 3) pitches = pitches.slice(1);

    // Add 7th color
    if (complexity > 0.4 && pitches.length >= 3 && !chance(0.3)) {
      const formula = CHORD_FORMULAS[chord.chordType];
      const has7 = formula && formula.length >= 4;
      if (!has7) pitches.push(pitches[0] + 10); // dominant 7
    }
    // Tensions (9, 13)
    if (complexity > 0.6 && chance(0.5)) pitches.push(pitches[0] + 14);
    if (complexity > 0.85 && chance(0.4)) pitches.push(pitches[0] + 21);

    // Cap voice count
    while (pitches.length > 5) pitches.pop();

    // Pick rhythm template — weight depends on intensity
    const rhythmIdx = (() => {
      const weights = rhythmLibrary.map((_, i) => {
        // sparse early, busy at high intensity
        const sparseness = i / rhythmLibrary.length;
        return Math.max(0.05, 1 - Math.abs(sparseness - intensity) * 1.6);
      });
      return rhythmLibrary.indexOf(pickWeighted(rhythmLibrary, weights));
    })();
    const baseRhythm = rhythmLibrary[rhythmIdx];

    // Walk through chord region in 16ths
    const sixteenths = Math.round(chord.duration * 4);
    for (let s = 0; s < sixteenths; s++) {
      const stepInBar = s % 16;
      let strength = baseRhythm[stepInBar];
      if (strength === 0) continue;

      // Random subtraction for organic feel
      if (chance(0.15 - intensity * 0.1)) continue;

      // Anticipation push: occasionally hit on the and-of-4 to lead into next chord
      const isAnticipation = ci < chords.length - 1
        && s === sixteenths - 2
        && complexity > 0.5
        && chance(0.5);

      const beat = chord.startBeat + s / 4;
      const dur = (strength >= 1 ? 1.5 : 0.9) / 4;
      const baseVel = strength === 1 ? 88 : strength >= 0.6 ? 72 : 50;
      const vel = jitterVelocity(baseVel + intensity * 10, 14);

      // Voicing rotation — alternate full / upper / lower halves
      let voicing = pitches;
      if (s % 2 === 1 && complexity > 0.4) {
        voicing = pitches.slice(Math.floor(pitches.length / 3));
      }
      if (s % 4 === 3 && complexity > 0.6 && chance(0.5)) {
        // a single high color tone for variety
        voicing = [pitches[pitches.length - 1] + (chance(0.5) ? 0 : 7)];
      }

      // If this is anticipation, use NEXT chord's pitches
      if (isAnticipation) {
        const next = chords[ci + 1];
        const nextPitches = chordPitches(next.root, next.chordType, 4);
        if (nextPitches.length) voicing = nextPitches.slice(0, 3);
      }

      for (const p of voicing) {
        notes.push({
          id: newId('p'),
          startBeat: jitterTime(beat, 0.012),
          duration: dur,
          pitch: p,
          velocity: vel,
        });
      }
    }
  }
  return notes;
}

// ───────────────────────────────────────────────────────────────────────
// BASS — root motion, walking, octaves, chromatic approach, ghost notes
// ───────────────────────────────────────────────────────────────────────
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

    // Resolve target for next chord (for chromatic approach)
    let targetNext = root;
    if (ci < chords.length - 1) {
      const nIdx = NOTE_NAMES.indexOf(chords[ci + 1].root as any);
      if (nIdx >= 0) targetNext = 36 + nIdx;
    }

    const beats = Math.floor(chord.duration);
    const pushNote = (beat: number, pitch: number, vel: number, dur = 0.9) => {
      notes.push({
        id: newId('b'),
        startBeat: jitterTime(beat, 0.012),
        duration: dur,
        pitch,
        velocity: jitterVelocity(vel, 8),
      });
    };

    if (genre === 'Jazz' && intensity > 0.3) {
      // Walking bass — quarter notes, mix of chord tones + chromatic approaches
      const tones = [root, third, fifth, seventh].filter(t => Math.abs(t - root) <= 12);
      for (let b = 0; b < beats; b++) {
        const beat = chord.startBeat + b;
        let pitch: number;
        if (b === 0) pitch = root;
        else if (b === beats - 1 && ci < chords.length - 1 && complexity > 0.4) {
          // Chromatic approach to next root
          pitch = targetNext + (chance(0.5) ? -1 : 1);
        } else if (complexity > 0.5 && chance(0.3)) {
          // Passing tone (any scale step)
          pitch = root + ([2, 5, 9][Math.floor(Math.random() * 3)]);
        } else {
          pitch = tones[Math.floor(Math.random() * tones.length)];
        }
        pushNote(beat, pitch, b === 0 ? 95 : 78);
      }
    } else {
      // Rock/Pop — root focus with selectable patterns, ghost notes, fills
      const patterns: number[][][] = [
        // [pitch-index pattern], 0=root,1=fifth,2=octave,3=third,4=ghost
        // Steady root quarters
        [[0], [0], [0], [0]],
        // Root-fifth alternation
        [[0], [1], [0], [1]],
        // Root, root, fifth, root
        [[0], [0], [1], [0]],
        // Eighth-note root w/ off-beat fifth
        [[0, 1], [0, 1], [0, 1], [0, 1]],
        // Driving 8ths
        [[0, 0], [0, 0], [0, 0], [0, 1]],
        // Syncopated push (and-of-2)
        [[0], [0, 1], [0], [3, 1]],
      ];
      const idx = Math.min(patterns.length - 1, Math.floor(intensity * patterns.length + complexity * 2 * Math.random()));
      const pat = patterns[Math.max(0, idx)];

      for (let b = 0; b < beats; b++) {
        const slot = pat[b % pat.length];
        for (let s = 0; s < slot.length; s++) {
          const subBeat = chord.startBeat + b + s / slot.length;
          let pitch = root;
          switch (slot[s]) {
            case 0: pitch = root; break;
            case 1: pitch = fifth; break;
            case 2: pitch = octave; break;
            case 3: pitch = third; break;
          }
          // Ghost note variation at high complexity
          const isGhost = complexity > 0.6 && s > 0 && chance(0.18);
          const vel = isGhost ? 45 : (b === 0 && s === 0 ? 100 : 80);
          pushNote(subBeat, pitch, vel, 0.4);
        }
      }

      // Chromatic / scalar fill on last beat into next chord
      if (ci < chords.length - 1 && intensity > 0.5 && complexity > 0.4 && chance(0.6)) {
        const fillBeat = chord.startBeat + beats - 1;
        const stepDir = targetNext >= root ? 1 : -1;
        for (let i = 0; i < 4; i++) {
          pushNote(fillBeat + i / 4, targetNext - stepDir * (3 - i), 70, 0.22);
        }
      }
    }
  }
  return notes;
}

// ───────────────────────────────────────────────────────────────────────
// DRUMS — pattern banks per genre, intensity-driven density, fills
// ───────────────────────────────────────────────────────────────────────
export function generateDrums(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];

  // Per-genre pattern banks (each pattern: 16 steps)
  const banks: Record<Genre, { kick: number[][]; snare: number[][]; hihat: number[][]; ride?: number[] }> = {
    Rock: {
      kick: [
        [0, 8],
        [0, 6, 8],
        [0, 8, 10],
        [0, 6, 8, 14],
      ],
      snare: [
        [4, 12],
        [4, 12],
        [4, 11, 12],
      ],
      hihat: [
        [0, 2, 4, 6, 8, 10, 12, 14],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      ],
    },
    Pop: {
      kick: [
        [0, 6, 8],
        [0, 8],
        [0, 6, 8, 10],
      ],
      snare: [
        [4, 12],
        [4, 12, 14],
      ],
      hihat: [
        [0, 2, 4, 6, 8, 10, 12, 14],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      ],
    },
    Jazz: {
      kick: [
        [0, 10],
        [0],
        [0, 7, 10],
      ],
      snare: [
        [6, 14],
        [4, 14],
      ],
      hihat: [[2, 10]], // foot hi-hat on 2 & 4
      ride: [0, 3, 6, 8, 9, 12, 15],
    },
  };

  for (let m = 0; m < measures; m++) {
    const measureBase = m * 4;
    const isFillMeasure = (m === measures - 1) || (m > 0 && m % 4 === 3 && chance(0.5));
    const isFill = isFillMeasure && intensity > 0.4;

    // Pick a pattern variant per measure for variety
    const bank = banks[genre];
    const kickPat = bank.kick[Math.floor(Math.random() * bank.kick.length)];
    const snarePat = bank.snare[Math.floor(Math.random() * bank.snare.length)];
    const hatVariantIdx = intensity > 0.7 ? bank.hihat.length - 1 : Math.floor(Math.random() * bank.hihat.length);
    const hatPat = bank.hihat[hatVariantIdx];

    // KICK — sometimes drop the and-of-3 hit for variety
    kickPat.forEach(step => {
      if (chance(0.08)) return; // tiny chance to skip
      notes.push({
        id: newId('d'),
        startBeat: jitterTime(measureBase + step / 4, 0.008),
        duration: 0.25,
        pitch: DRUM_PITCHES.kick,
        velocity: jitterVelocity(105 + (step === 0 ? 8 : 0), 10),
      });
    });

    // SNARE — main backbeat
    snarePat.forEach(step => {
      notes.push({
        id: newId('d'),
        startBeat: jitterTime(measureBase + step / 4, 0.008),
        duration: 0.25,
        pitch: DRUM_PITCHES.snare,
        velocity: jitterVelocity(95, 10),
      });
    });

    // GHOST snares at high complexity
    if (complexity > 0.55) {
      const ghostSteps = [3, 7, 11, 15];
      ghostSteps.forEach(step => {
        if (chance(complexity * 0.4)) {
          notes.push({
            id: newId('d'),
            startBeat: jitterTime(measureBase + step / 4, 0.012),
            duration: 0.12,
            pitch: DRUM_PITCHES.snare,
            velocity: jitterVelocity(38, 8),
          });
        }
      });
    }

    // HI-HAT
    if (!isFill || genre === 'Jazz') {
      hatPat.forEach((step, i) => {
        const isAccent = step % 4 === 0;
        // Open hat on the and-of-4 sometimes
        if (complexity > 0.4 && step === 14 && chance(0.3)) {
          notes.push({
            id: newId('d'),
            startBeat: jitterTime(measureBase + step / 4, 0.006),
            duration: 0.3,
            pitch: DRUM_PITCHES.hihat,
            velocity: jitterVelocity(85, 6),
          });
          return;
        }
        if (complexity > 0.7 && i % 4 === 2 && chance(0.4)) return; // dropped
        notes.push({
          id: newId('d'),
          startBeat: jitterTime(measureBase + step / 4, 0.006),
          duration: 0.1,
          pitch: DRUM_PITCHES.hihat,
          velocity: jitterVelocity(isAccent ? 78 : 52, 10),
        });
      });
    }

    // RIDE for Jazz
    if (bank.ride && genre === 'Jazz' && !isFill) {
      bank.ride.forEach(step => {
        notes.push({
          id: newId('d'),
          startBeat: jitterTime(measureBase + step / 4, 0.008),
          duration: 0.2,
          pitch: DRUM_PITCHES.ride,
          velocity: jitterVelocity(70, 8),
        });
      });
    }

    // FILL on last beat of fill measure
    if (isFill) {
      // Choose fill type
      const fillType = Math.floor(Math.random() * 3);
      const fillBeat = measureBase + 3;
      if (fillType === 0) {
        // 16th-note snare roll
        for (let i = 0; i < 4; i++) {
          notes.push({
            id: newId('d'),
            startBeat: fillBeat + i / 4,
            duration: 0.18,
            pitch: DRUM_PITCHES.snare,
            velocity: jitterVelocity(70 + i * 8, 6),
          });
        }
      } else if (fillType === 1) {
        // Tom run (snare + tom alternating)
        for (let i = 0; i < 4; i++) {
          notes.push({
            id: newId('d'),
            startBeat: fillBeat + i / 4,
            duration: 0.18,
            pitch: i % 2 === 0 ? DRUM_PITCHES.snare : DRUM_PITCHES.tom,
            velocity: jitterVelocity(85, 8),
          });
        }
      } else {
        // Kick + snare flam
        for (let i = 0; i < 4; i++) {
          notes.push({
            id: newId('d'),
            startBeat: fillBeat + i / 4,
            duration: 0.2,
            pitch: i < 2 ? DRUM_PITCHES.kick : DRUM_PITCHES.snare,
            velocity: jitterVelocity(95, 6),
          });
        }
      }
      // Crash on next measure 1 (if exists, otherwise loop start)
      if (m < measures - 1) {
        notes.push({
          id: newId('d'),
          startBeat: measureBase + 4,
          duration: 0.5,
          pitch: DRUM_PITCHES.ride,
          velocity: 110,
        });
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
): Record<TrackId, MidiNote[]> {
  return {
    piano: generatePiano(chords, measures, intensities.piano, complexities.piano),
    bass: generateBass(chords, measures, intensities.bass, complexities.bass, genre),
    drums: generateDrums(chords, measures, intensities.drums, complexities.drums, genre),
  };
}
