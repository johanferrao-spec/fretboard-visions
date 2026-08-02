import * as Tone from 'tone';

/**
 * Lightweight "MIDI guitar" preview engine.
 *
 * A single plucked-string synth shared by the whole app so that clicking notes
 * on the fretboard, picking a chord in the chord library, or selecting a
 * voicing in Fretboard Mastery can be auditioned.
 *
 * The enabled flag lives at module level (mirrored into React state by the
 * toolbar toggle) so deeply-nested components can call the play helpers
 * without prop-drilling.
 */

let enabled = false;
let synth: Tone.PolySynth | null = null;
const listeners = new Set<(v: boolean) => void>();

export function isMidiPlaybackEnabled() {
  return enabled;
}

export function setMidiPlaybackEnabled(v: boolean) {
  enabled = v;
  if (v) void ensureSynth();
  listeners.forEach(l => l(v));
}

export function subscribeMidiPlayback(fn: (v: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

async function ensureSynth(): Promise<Tone.PolySynth | null> {
  try {
    if (Tone.getContext().state !== 'running') await Tone.start();
  } catch {/* ignore — user gesture will unlock later */}
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.004, decay: 0.9, sustain: 0.12, release: 1.1 },
      volume: -12,
    }).toDestination();
    synth.maxPolyphony = 12;
  }
  return synth;
}

/** Absolute MIDI pitch of a fretboard position for a tuning of pitch classes. */
export function fretToMidi(tuning: number[], stringIndex: number, fret: number): number {
  const openAbs: number[] = new Array(tuning.length);
  openAbs[0] = 40 + ((tuning[0] - 4 + 12) % 12);
  for (let s = 1; s < tuning.length; s++) {
    const targetPc = ((tuning[s] % 12) + 12) % 12;
    let candidate = openAbs[s - 1] + 1;
    while (candidate % 12 !== targetPc) candidate++;
    openAbs[s] = candidate;
  }
  return (openAbs[stringIndex] ?? 40) + fret;
}

/** Play a set of absolute MIDI pitches, lightly strummed low→high. */
export function playMidiPitches(pitches: number[], opts: { strum?: number; duration?: number } = {}) {
  if (!enabled || pitches.length === 0) return;
  const strum = opts.strum ?? 0.022;
  const duration = opts.duration ?? 1.6;
  void ensureSynth().then(s => {
    if (!s) return;
    const now = Tone.now() + 0.02;
    [...pitches].sort((a, b) => a - b).forEach((p, i) => {
      try {
        s.triggerAttackRelease(Tone.Frequency(p, 'midi').toNote(), duration, now + i * strum, 0.8);
      } catch {/* ignore */}
    });
  });
}

/** Play a single fretboard position. */
export function playFretNote(tuning: number[], stringIndex: number, fret: number) {
  if (!enabled) return;
  playMidiPitches([fretToMidi(tuning, stringIndex, fret)], { duration: 1.2 });
}

/** Play a chord shape given as per-string frets (-1 = muted). */
export function playFretShape(tuning: number[], frets: (number | -1)[]) {
  if (!enabled) return;
  const pitches: number[] = [];
  frets.forEach((f, si) => { if (typeof f === 'number' && f >= 0) pitches.push(fretToMidi(tuning, si, f)); });
  playMidiPitches(pitches);
}

/**
 * Play a chord from pitch classes, voiced upwards from a starting octave so the
 * exact chord tones sound (used by the chord library / mode panels).
 */
export function playPitchClasses(rootPc: number, intervals: number[], baseMidi = 48) {
  if (!enabled) return;
  const base = baseMidi + (((rootPc - baseMidi) % 12) + 12) % 12;
  const pitches: number[] = [];
  let prev = -Infinity;
  for (const i of intervals) {
    let p = base + i;
    while (p <= prev) p += 12;
    pitches.push(p);
    prev = p;
  }
  playMidiPitches(pitches);
}
