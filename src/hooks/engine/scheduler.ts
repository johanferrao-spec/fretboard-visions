import * as Tone from 'tone';
import type { MidiNote, TrackId, DrumPart } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { EngineInstruments } from './instruments';
import type { Genre } from '@/hooks/useSongTimeline';
import { midiToNote, velocityToGain } from './humanize';
import { getUserPlayer } from './userSamples';
import type { StoredSample } from '@/lib/sampleStorage';
import type { BuiltInKitSample } from '@/lib/builtInKits';

/** A resolved sample for a slot — may be a user-uploaded blob OR a built-in kit choice. */
export type SampleResolution =
  | { kind: 'user'; sample: StoredSample }
  | { kind: 'builtin'; sample: BuiltInKitSample };

/** Resolver: given a slot key (e.g. 'drums:snare', 'bass', 'keys'), return active resolution or null. */
export type UserSampleResolver = (slot: string) => SampleResolution | null;

/** Map MIDI drum pitch -> our DrumPart slot key. */
function pitchToDrumPart(pitch: number): DrumPart | null {
  switch (pitch) {
    case DRUM_PITCHES.kick:  return 'kick';
    case DRUM_PITCHES.snare: return 'snare';
    case DRUM_PITCHES.hihat: return 'hihat';
    case DRUM_PITCHES.ride:  return 'ride';
    case DRUM_PITCHES.tom1:  return 'tom1';
    case DRUM_PITCHES.tom2:  return 'tom2';
    case DRUM_PITCHES.crash: return 'crash';
    default: return null;
  }
}

/** Trigger a synthesised drum voice for a given pitch. */
function playSynthDrum(inst: EngineInstruments, pitch: number, dur: number, t: number, gain: number) {
  switch (pitch) {
    case DRUM_PITCHES.kick:
      inst.kick.triggerAttackRelease('C1', dur, t, gain);
      break;
    case DRUM_PITCHES.snare:
      inst.snare.triggerAttackRelease(dur, t, gain);
      break;
    case DRUM_PITCHES.hihat:
      inst.hihat.triggerAttackRelease('C5', dur * 0.5, t, gain);
      break;
    case DRUM_PITCHES.ride:
      inst.ride.triggerAttackRelease('C5', dur, t, gain);
      break;
    case DRUM_PITCHES.tom1:
      inst.kick.triggerAttackRelease('G2', dur, t, gain * 0.9);
      break;
    case DRUM_PITCHES.tom2:
      inst.kick.triggerAttackRelease('D2', dur, t, gain * 0.9);
      break;
    case DRUM_PITCHES.crash:
      inst.ride.triggerAttackRelease('G5', dur * 1.2, t, gain);
      break;
    default:
      inst.snare.triggerAttackRelease(dur, t, gain);
  }
}

/** Trigger a Jazz acoustic kit Tone.Player for a given pitch (only kick/snare/hihat/ride exist). */
function playJazzKitSample(inst: EngineInstruments, pitch: number, t: number, gain: number) {
  const playSample = (pl: Tone.Player) => {
    if (!pl.loaded) return;
    try {
      pl.volume.value = Tone.gainToDb(Math.max(0.001, gain));
      pl.start(t);
    } catch {}
  };
  switch (pitch) {
    case DRUM_PITCHES.kick:  playSample(inst.jazzKit.kick);  return true;
    case DRUM_PITCHES.snare: playSample(inst.jazzKit.snare); return true;
    case DRUM_PITCHES.hihat: playSample(inst.jazzKit.hihat); return true;
    case DRUM_PITCHES.ride:  playSample(inst.jazzKit.ride);  return true;
    default: return false;
  }
}

/**
 * Schedule a single track's notes on the Transport.
 * Returns no value — caller is expected to call Transport.cancel() before re-scheduling.
 */
export function scheduleTrack(
  trackId: TrackId,
  notes: MidiNote[],
  inst: EngineInstruments,
  isMutedRef: { current: boolean },
  genre: Genre = 'Rock',
  resolveUserSample?: UserSampleResolver,
) {
  // Bass / keys user samplers anchor pitch via playbackRate.
  const BASS_ROOT = 40; // E2
  const KEYS_ROOT = 60; // C4

  for (const n of notes) {
    const beats = n.startBeat;
    const bars = Math.floor(beats / 4);
    const beatInt = Math.floor(beats % 4);
    const sixteenthFloat = (beats % 1) * 4;
    const sixteenth = Math.floor(sixteenthFloat);
    const remainder = sixteenthFloat - sixteenth;
    const baseTime = `${bars}:${beatInt}:${sixteenth}`;
    const microOffset = remainder * (60 / Tone.getTransport().bpm.value) / 4;
    const dur = (n.duration * 60) / Tone.getTransport().bpm.value;
    const gain = velocityToGain(n.velocity);

    Tone.getTransport().schedule((time) => {
      if (isMutedRef.current) return;
      const t = time + microOffset;

      if (trackId === 'drums') {
        const part = pitchToDrumPart(n.pitch);
        const resolution = part && resolveUserSample ? resolveUserSample(`drums:${part}`) : null;

        // 1) User-uploaded sample takes top priority.
        if (resolution?.kind === 'user') {
          const p = getUserPlayer(resolution.sample, inst.master);
          if (p && p.loaded) {
            try {
              p.playbackRate = 1;
              p.volume.value = Tone.gainToDb(Math.max(0.001, gain));
              p.start(t);
            } catch {}
            return;
          }
        }

        // 2) Built-in kit selection — jazz samples or synth fallback.
        if (resolution?.kind === 'builtin') {
          if (resolution.sample.source === 'jazz-sample') {
            const ok = playJazzKitSample(inst, n.pitch, t, gain);
            if (ok) return;
          }
          // synth (or jazz-sample miss) → synthesised voice
          playSynthDrum(inst, n.pitch, dur, t, gain);
          return;
        }

        // 3) No selection → default by genre (jazz uses jazz kit, others synth).
        if (genre === 'Jazz' && playJazzKitSample(inst, n.pitch, t, gain)) return;
        playSynthDrum(inst, n.pitch, dur, t, gain);
      } else if (trackId === 'bass') {
        const resolution = resolveUserSample?.('bass');
        if (resolution?.kind === 'user') {
          const p = getUserPlayer(resolution.sample, inst.master);
          if (p && p.loaded) {
            try {
              const semis = n.pitch - BASS_ROOT;
              p.playbackRate = Math.pow(2, semis / 12);
              p.volume.value = Tone.gainToDb(Math.max(0.001, gain));
              p.start(t);
            } catch {}
            return;
          }
        }
        inst.bass.triggerAttackRelease(midiToNote(n.pitch), dur, t, gain);
      } else if (trackId === 'piano') {
        const resolution = resolveUserSample?.('keys');
        if (resolution?.kind === 'user') {
          const p = getUserPlayer(resolution.sample, inst.master);
          if (p && p.loaded) {
            try {
              const semis = n.pitch - KEYS_ROOT;
              p.playbackRate = Math.pow(2, semis / 12);
              p.volume.value = Tone.gainToDb(Math.max(0.001, gain));
              p.start(t);
            } catch {}
            return;
          }
        }
        inst.piano.triggerAttackRelease(midiToNote(n.pitch), dur, t, gain);
      }
    }, baseTime);
  }
}

export function clearSchedule() {
  Tone.getTransport().cancel();
}

export function setupLoop(measures: number) {
  Tone.getTransport().loop = true;
  Tone.getTransport().loopStart = 0;
  Tone.getTransport().loopEnd = `${measures}:0:0`;
}

export function schedulePlayhead(onBeat: (beat: number) => void) {
  return Tone.getTransport().scheduleRepeat((time) => {
    const pos = Tone.getTransport().position;
    if (typeof pos === 'string') {
      const parts = pos.split(':').map(Number);
      const beat = parts[0] * 4 + parts[1] + parts[2] / 4;
      Tone.getDraw().schedule(() => onBeat(beat), time);
    }
  }, '16n');
}
