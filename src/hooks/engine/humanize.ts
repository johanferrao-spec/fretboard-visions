/** Random number in [-1, 1] */
function rand(): number {
  return Math.random() * 2 - 1;
}

/** Apply timing jitter (in beats) — typically ±0.01–0.02 */
export function jitterTime(beats: number, amount: number = 0.015): number {
  return Math.max(0, beats + rand() * amount);
}

/** Apply velocity humanization, clamped 1-127 */
export function jitterVelocity(velocity: number, amount: number = 12): number {
  const v = velocity + rand() * amount;
  return Math.max(1, Math.min(127, Math.round(v)));
}

/** Convert MIDI pitch (0-127) to note string e.g. "C4" */
const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToNote(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const letter = NOTE_LETTERS[pitch % 12];
  return `${letter}${octave}`;
}

/** Velocity (0-127) to gain multiplier (0..1) */
export function velocityToGain(velocity: number): number {
  return Math.max(0, Math.min(1, velocity / 127));
}
