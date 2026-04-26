/**
 * Groove-template-based generator.
 *
 * Uses an imported MIDI groove (rhythm + feel) and re-pitches notes so they
 * follow the user's chord progression on the timeline.
 *
 *   • Drum pitches are absolute (kit pieces) → preserved as-is.
 *   • Bass notes are transposed by the interval between the active user
 *     chord root and the groove's bar root, so the funky bass rhythm stays
 *     intact but follows the new key/chords.
 *   • Piano notes are transposed the same way; if the chord is e.g. minor
 *     or 7, the resulting voicing is snapped back into chord tones so it
 *     never clashes harmonically.
 */
import type { TimelineChord } from '@/hooks/useSongTimeline';
import type { MidiNote } from '@/lib/backingTrackTypes';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';
import type { GrooveTemplate, GrooveNote } from './groove1';

let nextId = 1;
const newId = (prefix: string) => `${prefix}-g${nextId++}`;

interface GenContext {
  template: GrooveTemplate;
  chords: TimelineChord[];
  totalBeats: number;
  intensity: number;
  complexity: number;
}

/** Find the chord active at `beat`, or null. */
function chordAt(beat: number, chords: TimelineChord[]): TimelineChord | null {
  for (const c of chords) {
    if (beat >= c.startBeat && beat < c.startBeat + c.duration) return c;
  }
  return null;
}

/** Returns the bar-root MIDI pitch of the groove template at `beat`. */
function templateBarRootAt(beat: number, template: GrooveTemplate): number {
  const bar = Math.floor((beat % template.lengthBeats) / 4);
  return template.barRoots[Math.min(bar, template.barRoots.length - 1)];
}

/** Convert chord root name to a MIDI pitch class (0-11). */
function chordRootPc(chord: TimelineChord): number {
  const idx = NOTE_NAMES.indexOf(chord.root as any);
  return idx < 0 ? 0 : idx;
}

/** Build chord tones (pitch classes 0-11) for a given chord. */
function chordPcs(chord: TimelineChord): number[] {
  const root = chordRootPc(chord);
  const formula = CHORD_FORMULAS[chord.chordType] || [0, 4, 7];
  return formula.map(i => (root + i) % 12);
}

/** Snap a midi pitch to the nearest chord tone (preserving register). */
function snapToChord(pitch: number, chord: TimelineChord): number {
  const tones = chordPcs(chord);
  const pc = ((pitch % 12) + 12) % 12;
  if (tones.includes(pc)) return pitch;
  // Find nearest chord tone by semitone distance
  let bestDelta = 12;
  let bestPc = pc;
  for (const t of tones) {
    const d = Math.min(Math.abs(t - pc), 12 - Math.abs(t - pc));
    if (d < bestDelta) { bestDelta = d; bestPc = t; }
  }
  // Apply the smallest signed shift
  const candidates = [bestPc - pc, bestPc - pc + 12, bestPc - pc - 12];
  candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
  return pitch + candidates[0];
}

/**
 * Transpose a groove note's pitch so that the original groove's bar-root
 * is mapped to the active user chord's root, then snap to chord tones.
 */
function repitchHarmonic(
  note: GrooveNote,
  chord: TimelineChord,
  templateBarRoot: number,
  snap: boolean,
): number {
  const targetRootPc = chordRootPc(chord);
  const sourceRootPc = ((templateBarRoot % 12) + 12) % 12;
  // semitone shift in pc space (smallest signed)
  let shift = targetRootPc - sourceRootPc;
  if (shift > 6) shift -= 12;
  if (shift < -6) shift += 12;
  const transposed = note.p + shift;
  return snap ? snapToChord(transposed, chord) : transposed;
}

function tileBeats(template: GrooveTemplate, totalBeats: number, instrument: 'bass' | 'drums' | 'piano') {
  const out: { absBeat: number; note: GrooveNote }[] = [];
  const src = template[instrument];
  const len = template.lengthBeats;
  for (let offset = 0; offset < totalBeats; offset += len) {
    for (const n of src) {
      const abs = offset + n.s;
      if (abs >= totalBeats) break;
      out.push({ absBeat: abs, note: n });
    }
  }
  return out;
}

export function generateBassFromGroove(ctx: GenContext): MidiNote[] {
  const out: MidiNote[] = [];
  const tiled = tileBeats(ctx.template, ctx.totalBeats, 'bass');
  for (const { absBeat, note } of tiled) {
    const chord = chordAt(absBeat, ctx.chords);
    if (!chord) continue;
    const tplRoot = templateBarRootAt(absBeat, ctx.template);
    let pitch = repitchHarmonic(note, chord, tplRoot, /*snap*/ true);
    // Use slash bass if specified and this is the chord's downbeat
    if (chord.bassNote && Math.abs(absBeat - chord.startBeat) < 0.05) {
      const idx = NOTE_NAMES.indexOf(chord.bassNote as any);
      if (idx >= 0) pitch = (Math.floor(pitch / 12) * 12) + idx;
    }
    // Keep bass in a sensible range (E1–G3)
    while (pitch > 55) pitch -= 12;
    while (pitch < 28) pitch += 12;
    out.push({
      id: newId('b'),
      startBeat: absBeat,
      duration: Math.max(0.05, note.d),
      pitch,
      velocity: Math.max(20, Math.min(127, Math.round(note.v * (0.7 + ctx.intensity * 0.4)))),
    });
  }
  return out;
}

export function generateDrumsFromGroove(ctx: GenContext): MidiNote[] {
  const out: MidiNote[] = [];
  const tiled = tileBeats(ctx.template, ctx.totalBeats, 'drums');
  for (const { absBeat, note } of tiled) {
    out.push({
      id: newId('d'),
      startBeat: absBeat,
      duration: Math.max(0.05, note.d),
      // Drum pitches are absolute kit pieces — keep them unchanged
      pitch: note.p,
      velocity: Math.max(20, Math.min(127, Math.round(note.v * (0.75 + ctx.intensity * 0.35)))),
    });
  }
  return out;
}

export function generatePianoFromGroove(ctx: GenContext): MidiNote[] {
  const out: MidiNote[] = [];
  const tiled = tileBeats(ctx.template, ctx.totalBeats, 'piano');
  for (const { absBeat, note } of tiled) {
    const chord = chordAt(absBeat, ctx.chords);
    if (!chord) continue;
    const tplRoot = templateBarRootAt(absBeat, ctx.template);
    let pitch = repitchHarmonic(note, chord, tplRoot, /*snap*/ true);
    // Keep piano in the C3–C6 range
    while (pitch > 84) pitch -= 12;
    while (pitch < 48) pitch += 12;
    out.push({
      id: newId('p'),
      startBeat: absBeat,
      duration: Math.max(0.05, note.d),
      pitch,
      velocity: Math.max(20, Math.min(127, Math.round(note.v * (0.7 + ctx.intensity * 0.4)))),
    });
  }
  return out;
}

export function generateAllFromGroove(
  template: GrooveTemplate,
  chords: TimelineChord[],
  measures: number,
  intensities: { piano: number; bass: number; drums: number },
  complexities: { piano: number; bass: number; drums: number },
) {
  const totalBeats = measures * 4;
  return {
    piano: generatePianoFromGroove({ template, chords, totalBeats, intensity: intensities.piano, complexity: complexities.piano }),
    bass:  generateBassFromGroove({ template, chords, totalBeats, intensity: intensities.bass, complexity: complexities.bass }),
    drums: generateDrumsFromGroove({ template, chords, totalBeats, intensity: intensities.drums, complexity: complexities.drums }),
  };
}
