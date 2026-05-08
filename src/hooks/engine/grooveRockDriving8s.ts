// Hand-authored Rock groove · "Driving 8s".
// 4-bar pattern (16 beats) with a tom fill on the last beat of bar 4.
//
// Drums (General-MIDI pitches):
//   • Kick (36)        — beats 1 & 3 every bar; "and of 2" added in bar 3 and
//                        "and of 4" in bar 2 for the driving feel.
//   • Snare (38)       — backbeat on 2 & 4 every bar; ghost note on the "e" of
//                        4 in bar 3 to inject swing.
//   • Closed hat (42)  — every eighth note, accents on downbeats.
//   • Open hat  (46)   — replaces the closed hat on the "and" of 4 of bars
//                        1-3 (lift into the next bar).
//   • Crash     (49)   — bar 1 beat 1, and again right after the fill on bar 1
//                        of the next iteration (handled by tiling).
//   • Tom fill         — last beat of bar 4: high-tom (50) → mid-tom (47) →
//                        low-tom (45) → floor-tom (43) as four sixteenths.
//
// Bass: locks with the kick. Each bar plays root → root → fifth → octave →
// chromatic-passing leading note (semitone below next root). Velocities sit
// at a consistent 95–110 to simulate a picked tone. The template root is C2
// (MIDI 36); the generator transposes and snaps these intervals to whatever
// chord is active in the user's progression.
//
// Piano: stab on beat 1 of every bar (the generator snaps the pitch into the
// active chord's tones).

import type { GrooveTemplate, GrooveNote } from './groove1';

const ROOT = 36; // C2 reference

// ─── DRUMS ────────────────────────────────────────────────────────────
const drums: GrooveNote[] = [];

const KICK = 36;
const SNARE = 38;
const HH_C = 42;
const HH_O = 46;
const CRASH = 49;
const TOM_HI = 50;
const TOM_MID = 47;
const TOM_LO = 45;
const TOM_FLR = 43;

for (let bar = 0; bar < 4; bar++) {
  const b = bar * 4;
  const isFillBar = bar === 3;

  // Kick — beats 1 & 3, plus driving variations
  drums.push({ s: b + 0, d: 0.25, p: KICK, v: 108 });
  drums.push({ s: b + 2, d: 0.25, p: KICK, v: 105 });
  if (bar === 1) drums.push({ s: b + 3.5, d: 0.2, p: KICK, v: 100 }); // "and of 4"
  if (bar === 2) drums.push({ s: b + 1.5, d: 0.2, p: KICK, v: 100 }); // "and of 2"

  // Snare — backbeat 2 & 4 (skip beat-4 backbeat in fill bar; the fill takes over)
  drums.push({ s: b + 1, d: 0.25, p: SNARE, v: 112 });
  if (!isFillBar) drums.push({ s: b + 3, d: 0.25, p: SNARE, v: 113 });
  // Ghost note on "e of 4" in bar 3 (index 2)
  if (bar === 2) drums.push({ s: b + 3.25, d: 0.1, p: SNARE, v: 50 });

  // Hi-hat — eighth notes; last "and of 4" becomes open (lift) on bars 1-3.
  // In the fill bar the hat stops on beat 3 to leave room for the toms.
  const lastHat = isFillBar ? 3 : 4;
  for (let e = 0; e < lastHat * 2; e++) {
    const t = b + e * 0.5;
    const onDown = (e % 2 === 0);
    const isLastEighth = !isFillBar && e === 7; // "and of 4"
    drums.push({
      s: t,
      d: 0.25,
      p: isLastEighth ? HH_O : HH_C,
      v: isLastEighth ? 92 : (onDown ? 88 : 74),
    });
  }

  // Crash on beat 1 of bar 1 only (loops naturally on tile)
  if (bar === 0) drums.push({ s: b + 0, d: 0.6, p: CRASH, v: 110 });

  // Fill — last beat of bar 4, four descending sixteenths
  if (isFillBar) {
    drums.push({ s: b + 3.0,  d: 0.2, p: TOM_HI,  v: 110 });
    drums.push({ s: b + 3.25, d: 0.2, p: TOM_MID, v: 108 });
    drums.push({ s: b + 3.5,  d: 0.2, p: TOM_LO,  v: 110 });
    drums.push({ s: b + 3.75, d: 0.25, p: TOM_FLR, v: 115 });
  }
}

// ─── BASS ─────────────────────────────────────────────────────────────
const bass: GrooveNote[] = [];

for (let bar = 0; bar < 4; bar++) {
  const b = bar * 4;
  // Beat 1 — root (longer), locks with kick
  bass.push({ s: b + 0,    d: 0.45, p: ROOT,        v: 108 });
  // Beat 2 — root again, locks with snare backbeat
  bass.push({ s: b + 1,    d: 0.45, p: ROOT,        v: 100 });
  // Beat 3 — fifth, locks with kick on 3
  bass.push({ s: b + 2,    d: 0.4,  p: ROOT + 7,    v: 102 });
  // Beat 3.5 — driving eighth (fifth)
  bass.push({ s: b + 2.5,  d: 0.4,  p: ROOT + 7,    v: 98  });
  // Beat 4 — octave
  bass.push({ s: b + 3,    d: 0.4,  p: ROOT + 12,   v: 104 });
  // "and of 4" — chromatic approach (semitone below next bar's root)
  bass.push({ s: b + 3.5,  d: 0.4,  p: ROOT - 1,    v: 100 });
}

// ─── PIANO ────────────────────────────────────────────────────────────
const piano: GrooveNote[] = [];
for (let bar = 0; bar < 4; bar++) {
  const b = bar * 4;
  // Whole-bar chord stab; gen-time snap will reshape into the active chord.
  piano.push({ s: b + 0, d: 3.8, p: 60, v: 78 });          // root
  piano.push({ s: b + 0, d: 3.8, p: 64, v: 72 });          // 3rd
  piano.push({ s: b + 0, d: 3.8, p: 67, v: 72 });          // 5th
}

export const GROOVE_ROCK_DRIVING_8S: GrooveTemplate = {
  lengthBeats: 16,
  numBars: 4,
  // All bars share the same reference root (C2) — the generator transposes
  // every note to whatever chord is active in the user's progression.
  barRoots: [ROOT, ROOT, ROOT, ROOT],
  bass,
  drums,
  piano,
};
