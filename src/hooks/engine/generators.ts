import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';
import { jitterTime, jitterVelocity } from './humanize';

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${nextId++}`;

function chordPitches(root: string, chordType: string, octave: number = 4): number[] {
  const formula = CHORD_FORMULAS[chordType];
  const rootIdx = NOTE_NAMES.indexOf(root as any);
  if (rootIdx < 0) return [];
  if (!formula) return [60 + rootIdx];
  const base = (octave + 1) * 12 + rootIdx; // MIDI: C-1=0 → C4=60
  return formula.map(i => base + i);
}

/**
 * intensity: 0..1  → density / velocity / fills
 * complexity: 0..1 → syncopation, passing tones, extensions, variation
 */

export function generatePiano(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
): MidiNote[] {
  const notes: MidiNote[] = [];
  // Step grid: subdivisions per beat — more dense at higher intensity
  const subdivPerBeat = intensity > 0.66 ? 4 : intensity > 0.33 ? 2 : 1;

  for (const chord of chords) {
    const pitches = chordPitches(chord.root, chord.chordType, 4);
    if (pitches.length === 0) continue;

    // Add 9/13 extensions at high complexity
    if (complexity > 0.6 && pitches.length >= 3) {
      pitches.push(pitches[0] + 14); // 9th
    }
    if (complexity > 0.85) {
      pitches.push(pitches[0] + 21); // 13th
    }

    const totalSteps = Math.round(chord.duration * subdivPerBeat);
    const isComping = intensity > 0.4;

    if (!isComping) {
      // Sustain block chord
      for (const p of pitches) {
        notes.push({
          id: newId('p'),
          startBeat: jitterTime(chord.startBeat, 0.01),
          duration: chord.duration * 0.95,
          pitch: p,
          velocity: jitterVelocity(70, 8),
        });
      }
    } else {
      // Comping: pick rhythm pattern
      for (let s = 0; s < totalSteps; s++) {
        const beat = chord.startBeat + s / subdivPerBeat;
        // syncopation skip pattern based on complexity
        const skip = complexity > 0.5
          ? (s % 3 === 1)
          : (s % 2 === 1 && Math.random() > intensity);
        if (skip && Math.random() > complexity) continue;

        const dur = 1 / subdivPerBeat * 0.85;
        // Voice: alternate full chord vs upper extensions
        const voiceUpper = s % 2 === 1 && complexity > 0.4;
        const voicing = voiceUpper ? pitches.slice(1) : pitches;
        const vel = jitterVelocity(s === 0 ? 85 : 65, 14);

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
  }
  return notes;
}

export function generateBass(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];
  const subdivPerBeat = intensity > 0.7 ? 2 : 1;

  for (const chord of chords) {
    const rootIdx = NOTE_NAMES.indexOf(chord.root as any);
    if (rootIdx < 0) continue;
    const formula = CHORD_FORMULAS[chord.chordType] || [0, 4, 7];
    const rootPitch = 36 + rootIdx; // C2 = 36
    const fifth = rootPitch + 7;
    const third = rootPitch + (formula[1] ?? 4);
    const seventh = rootPitch + (formula[3] ?? 10);

    const totalSteps = Math.round(chord.duration * subdivPerBeat);

    if (genre === 'Jazz' && complexity > 0.5) {
      // Walking bass: 1, 2, 3, chromatic approach
      const walk = [rootPitch, third, fifth, rootPitch + 11, rootPitch];
      const stepsPerBeat = 1;
      const totalBeats = Math.floor(chord.duration);
      for (let b = 0; b < totalBeats; b++) {
        const idx = b % walk.length;
        notes.push({
          id: newId('b'),
          startBeat: jitterTime(chord.startBeat + b, 0.01),
          duration: 0.9,
          pitch: walk[idx],
          velocity: jitterVelocity(80, 10),
        });
      }
    } else {
      // Rock/Pop: root + fifth pattern
      const pattern = complexity > 0.5
        ? [rootPitch, rootPitch, fifth, rootPitch, rootPitch, third, fifth, rootPitch]
        : [rootPitch, rootPitch, fifth, rootPitch];
      for (let s = 0; s < totalSteps; s++) {
        const idx = s % pattern.length;
        const beat = chord.startBeat + s / subdivPerBeat;
        notes.push({
          id: newId('b'),
          startBeat: jitterTime(beat, 0.012),
          duration: 1 / subdivPerBeat * 0.9,
          pitch: pattern[idx],
          velocity: jitterVelocity(s === 0 ? 95 : 78, 10),
        });
      }
    }
  }
  return notes;
}

export function generateDrums(
  chords: TimelineChord[],
  measures: number,
  intensity: number,
  complexity: number,
  genre: Genre,
): MidiNote[] {
  const notes: MidiNote[] = [];
  const totalBeats = measures * 4;

  // 16-step pattern per measure, indexed in 16th notes
  // Pick base pattern by genre
  const patterns: Record<Genre, { kick: number[]; snare: number[]; hihat: number[]; ride?: number[] }> = {
    Rock: { kick: [0, 8], snare: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] },
    Pop:  { kick: [0, 6, 8], snare: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] },
    Jazz: { kick: [0, 10], snare: [6, 14], hihat: [], ride: [0, 3, 6, 8, 9, 12, 15] },
  };
  const pat = patterns[genre];

  for (let m = 0; m < measures; m++) {
    const measureBase = m * 4;

    // Add fill on last measure if intensity high
    const isFillMeasure = intensity > 0.6 && m === measures - 1 && measures > 1;

    pat.kick.forEach(step => {
      notes.push({
        id: newId('d'),
        startBeat: jitterTime(measureBase + step / 4, 0.008),
        duration: 0.25,
        pitch: DRUM_PITCHES.kick,
        velocity: jitterVelocity(110, 8),
      });
    });

    pat.snare.forEach(step => {
      notes.push({
        id: newId('d'),
        startBeat: jitterTime(measureBase + step / 4, 0.008),
        duration: 0.25,
        pitch: DRUM_PITCHES.snare,
        velocity: jitterVelocity(95, 12),
      });
    });

    // Hihat density scales with intensity
    const hiSteps = intensity > 0.8 ? [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] : pat.hihat;
    hiSteps.forEach((step, i) => {
      // accent on downbeats
      const isAccent = step % 4 === 0;
      // ghost notes at high complexity
      if (complexity > 0.7 && i % 4 === 2 && Math.random() > 0.5) return;
      notes.push({
        id: newId('d'),
        startBeat: jitterTime(measureBase + step / 4, 0.006),
        duration: 0.1,
        pitch: DRUM_PITCHES.hihat,
        velocity: jitterVelocity(isAccent ? 80 : 55, 10),
      });
    });

    if (pat.ride) {
      pat.ride.forEach(step => {
        notes.push({
          id: newId('d'),
          startBeat: jitterTime(measureBase + step / 4, 0.008),
          duration: 0.2,
          pitch: DRUM_PITCHES.ride,
          velocity: jitterVelocity(70, 10),
        });
      });
    }

    // Snare fill on the last beat of fill measure
    if (isFillMeasure) {
      for (let i = 0; i < 4; i++) {
        notes.push({
          id: newId('d'),
          startBeat: measureBase + 3 + i / 4,
          duration: 0.2,
          pitch: DRUM_PITCHES.snare,
          velocity: jitterVelocity(80 + i * 5, 8),
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
