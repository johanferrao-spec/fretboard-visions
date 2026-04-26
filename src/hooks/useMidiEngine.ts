import { useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import type { TimelineChord, Genre } from './useSongTimeline';
import { NOTE_NAMES, CHORD_FORMULAS } from '@/lib/music';

// Drum pattern definitions per genre (16 steps = 1 measure of 16th notes)
// K=kick, S=snare, H=hihat, R=ride
type DrumHit = 'K' | 'S' | 'H' | 'R';

interface DrumPattern {
  kick: number[];    // step indices (0-15)
  snare: number[];
  hihat: number[];
  ride?: number[];
}

const DRUM_PATTERNS: Record<Genre, DrumPattern> = {
  Rock: {
    kick:  [0, 8],
    snare: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  Pop: {
    kick:  [0, 6, 8],
    snare: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  Jazz: {
    kick:  [0, 10],
    snare: [6, 14],
    hihat: [],
    ride:  [0, 3, 6, 8, 9, 12, 15], // swing pattern
  },
  Funk: {
    kick:  [0, 6, 8, 14],
    snare: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  Latin: {
    // Tumbao-flavoured kick + cross-stick snare on 3, busy 8th hats
    kick:  [0, 6, 8, 14],
    snare: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

// Bass patterns (scale degree offsets from root, in 16th note steps)
interface BassPattern {
  steps: { step: number; interval: number; duration: string }[];
}

const BASS_PATTERNS: Record<Genre, BassPattern> = {
  Rock: {
    steps: [
      { step: 0, interval: 0, duration: '8n' },
      { step: 4, interval: 0, duration: '8n' },
      { step: 8, interval: 7, duration: '8n' }, // 5th
      { step: 12, interval: 0, duration: '8n' },
    ],
  },
  Pop: {
    steps: [
      { step: 0, interval: 0, duration: '4n' },
      { step: 4, interval: 7, duration: '8n' },
      { step: 8, interval: 0, duration: '4n' },
      { step: 12, interval: 5, duration: '8n' }, // 4th
    ],
  },
  Jazz: {
    steps: [
      { step: 0, interval: 0, duration: '8n' },
      { step: 4, interval: 7, duration: '8n' },
      { step: 8, interval: 4, duration: '8n' }, // 3rd
      { step: 12, interval: 7, duration: '8n' },
    ],
  },
  Funk: {
    steps: [
      { step: 0, interval: 0, duration: '16n' },
      { step: 3, interval: 0, duration: '16n' },
      { step: 6, interval: 7, duration: '16n' },
      { step: 10, interval: 0, duration: '16n' },
      { step: 14, interval: 5, duration: '16n' },
    ],
  },
  Latin: {
    // Anticipated tumbao-style root → 5th
    steps: [
      { step: 0, interval: 0, duration: '8n' },
      { step: 6, interval: 7, duration: '8n' },
      { step: 8, interval: 0, duration: '8n' },
      { step: 14, interval: 7, duration: '8n' },
    ],
  },
};

function chordToNotes(root: string, chordType: string, octave: number = 4): string[] {
  const formula = CHORD_FORMULAS[chordType];
  if (!formula) return [`${root}${octave}`];
  const rootIdx = NOTE_NAMES.indexOf(root as any);
  if (rootIdx === -1) return [`${root}${octave}`];
  return formula.map(interval => {
    const noteIdx = (rootIdx + (interval % 12)) % 12;
    const oct = octave + Math.floor(interval / 12);
    const noteName = NOTE_NAMES[noteIdx];
    return `${noteName}${oct}`;
  });
}

function rootToFreq(root: string, octave: number = 2): string {
  return `${root}${octave}`;
}

export function useMidiEngine() {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const bassRef = useRef<Tone.Synth | null>(null);
  const kickRef = useRef<Tone.MembraneSynth | null>(null);
  const snareRef = useRef<Tone.NoiseSynth | null>(null);
  const hihatRef = useRef<Tone.MetalSynth | null>(null);
  const rideRef = useRef<Tone.MetalSynth | null>(null);
  const seqRef = useRef<Tone.Part | null>(null);
  const isInitRef = useRef(false);
  const volumeRef = useRef(-12); // dB

  const init = useCallback(async () => {
    if (isInitRef.current) return;
    await Tone.start();

    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      volume: -12,
    }).toDestination();

    bassRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
      volume: -8,
    }).toDestination();

    kickRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -6,
    }).toDestination();

    snareRef.current = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -10,
    }).toDestination();

    hihatRef.current = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20,
    }).toDestination();

    rideRef.current = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 5000,
      octaves: 1,
      volume: -18,
    }).toDestination();

    isInitRef.current = true;
  }, []);

  const play = useCallback(async (
    chords: TimelineChord[],
    measures: number,
    bpm: number,
    genre: Genre,
    onBeatUpdate: (beat: number) => void,
    onStop: () => void,
  ) => {
    // Ensure the AudioContext is resumed in the same call stack as the user
    // gesture that triggered playback — must run BEFORE init().
    await Tone.start();
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (rawCtx && rawCtx.state !== 'running') {
      try { await rawCtx.resume(); } catch {}
    }
    await init();
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().bpm.value = bpm;

    const totalBeats = measures * 4;
    const drumPattern = DRUM_PATTERNS[genre];
    const bassPattern = BASS_PATTERNS[genre];

    // Build events array
    const events: { time: string; callback: () => void }[] = [];

    // Beat update events (every 16th note for smooth playhead)
    for (let step = 0; step < totalBeats * 4; step++) {
      const beat = step / 4;
      const time = `0:0:${step}`;
      events.push({
        time: Tone.Time(`${Math.floor(beat / 4)}:${Math.floor(beat % 4)}:0`).toBarsBeatsSixteenths(),
        callback: () => {},
      });
    }

    // Schedule using Tone.Transport
    // Drums: repeat each measure
    for (let m = 0; m < measures; m++) {
      const measureOffset = m * 4; // beats

      // Find chords in this measure for accent shifting
      const measureChords = chords.filter(c => {
        const cEnd = c.startBeat + c.duration;
        return c.startBeat < (m + 1) * 4 && cEnd > m * 4;
      });

      // Check if any chord starts on an upbeat in this measure
      const hasUpbeatChord = measureChords.some(c => {
        const relBeat = c.startBeat - m * 4;
        return relBeat > 0 && relBeat % 1 !== 0; // off-beat
      });

      drumPattern.kick.forEach(step => {
        let adjustedStep = step;
        // Shift kick to match chord on upbeat
        if (hasUpbeatChord && measureChords.length > 0) {
          const firstChord = measureChords[0];
          const relBeat = firstChord.startBeat - m * 4;
          if (step === 0 && relBeat > 0 && relBeat < 1) {
            adjustedStep = Math.round(relBeat * 4);
          }
        }
        const beatPos = measureOffset + adjustedStep / 4;
        const timeStr = `${Math.floor(beatPos / 4)}:${Math.floor(beatPos % 4)}:${(adjustedStep % 4)}`;
        Tone.getTransport().schedule((time) => {
          kickRef.current?.triggerAttackRelease('C1', '8n', time);
        }, timeStr);
      });

      drumPattern.snare.forEach(step => {
        const beatPos = measureOffset + step / 4;
        const timeStr = `${Math.floor(beatPos / 4)}:${Math.floor(beatPos % 4)}:${step % 4}`;
        Tone.getTransport().schedule((time) => {
          snareRef.current?.triggerAttackRelease('8n', time);
        }, timeStr);
      });

      drumPattern.hihat.forEach(step => {
        const beatPos = measureOffset + step / 4;
        const timeStr = `${Math.floor(beatPos / 4)}:${Math.floor(beatPos % 4)}:${step % 4}`;
        Tone.getTransport().schedule((time) => {
          hihatRef.current?.triggerAttackRelease('32n', time);
        }, timeStr);
      });

      if (drumPattern.ride) {
        drumPattern.ride.forEach(step => {
          const beatPos = measureOffset + step / 4;
          const timeStr = `${Math.floor(beatPos / 4)}:${Math.floor(beatPos % 4)}:${step % 4}`;
          Tone.getTransport().schedule((time) => {
            rideRef.current?.triggerAttackRelease('16n', time);
          }, timeStr);
        });
      }
    }

    // Schedule chord pads and bass
    chords.forEach(chord => {
      const notes = chordToNotes(chord.root, chord.chordType, 4);
      const startMeasure = Math.floor(chord.startBeat / 4);
      const startBeatInMeasure = chord.startBeat % 4;
      const startSixteenth = Math.round((startBeatInMeasure % 1) * 4);
      const beatInt = Math.floor(startBeatInMeasure);
      const timeStr = `${startMeasure}:${beatInt}:${startSixteenth}`;
      const durBeats = chord.duration;
      // Convert duration in beats to seconds for precise timing
      const durSeconds = (durBeats / bpm) * 60;

      // Chord pad — use exact seconds duration so it stops when the block ends
      Tone.getTransport().schedule((time) => {
        synthRef.current?.triggerAttackRelease(notes, durSeconds, time);
      }, timeStr);

      // Bass follows chord root
      const rootIdx = NOTE_NAMES.indexOf(chord.root as any);
      bassPattern.steps.forEach(bs => {
        const stepBeat = chord.startBeat + bs.step / 4;
        if (stepBeat >= chord.startBeat + chord.duration) return;
        if (stepBeat >= measures * 4) return;
        const sm = Math.floor(stepBeat / 4);
        const sb = stepBeat % 4;
        const ss = Math.round((sb % 1) * 4);
        const bTimeStr = `${sm}:${Math.floor(sb)}:${ss}`;

        const noteIdx = (rootIdx + bs.interval) % 12;
        const bassNote = `${NOTE_NAMES[noteIdx]}2`;

        Tone.getTransport().schedule((time) => {
          bassRef.current?.triggerAttackRelease(bassNote, bs.duration, time);
        }, bTimeStr);
      });
    });

    // Playhead update
    const updateInterval = Tone.getTransport().scheduleRepeat((time) => {
      const pos = Tone.getTransport().position;
      // Parse position string "bars:beats:sixteenths"
      if (typeof pos === 'string') {
        const parts = pos.split(':').map(Number);
        const beat = parts[0] * 4 + parts[1] + parts[2] / 4;
        Tone.getDraw().schedule(() => {
          onBeatUpdate(beat);
        }, time);
      }
    }, '16n');

    // Loop: set transport to loop
    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = `${measures}:0:0`;

    Tone.getTransport().position = 0;
    Tone.getTransport().start();
  }, [init]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    Tone.getTransport().loop = false;
  }, []);

  const dispose = useCallback(() => {
    stop();
    synthRef.current?.dispose();
    bassRef.current?.dispose();
    kickRef.current?.dispose();
    snareRef.current?.dispose();
    hihatRef.current?.dispose();
    rideRef.current?.dispose();
    isInitRef.current = false;
  }, [stop]);

  useEffect(() => {
    return () => { dispose(); };
  }, [dispose]);

  const setVolume = useCallback((vol: number) => {
    // vol: 0-1, map to dB range -40 to 0
    const db = vol <= 0 ? -Infinity : -40 + vol * 40;
    volumeRef.current = db;
    if (synthRef.current) synthRef.current.volume.value = db;
    if (bassRef.current) bassRef.current.volume.value = db + 4;
    if (kickRef.current) kickRef.current.volume.value = db + 6;
    if (snareRef.current) snareRef.current.volume.value = db + 2;
    if (hihatRef.current) hihatRef.current.volume.value = db - 8;
    if (rideRef.current) rideRef.current.volume.value = db - 6;
  }, []);

  return { play, stop, dispose, setVolume };
}
