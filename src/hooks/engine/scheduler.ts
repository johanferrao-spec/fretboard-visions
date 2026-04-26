import * as Tone from 'tone';
import type { MidiNote, TrackId, DrumPart } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { EngineInstruments } from './instruments';
import type { Genre } from '@/hooks/useSongTimeline';
import { midiToNote, velocityToGain } from './humanize';
import { getUserPlayer } from './userSamples';
import type { StoredSample } from '@/lib/sampleStorage';

/** Resolver: given a slot key (e.g. 'drums:snare', 'bass', 'keys'), return active user sample or null. */
export type UserSampleResolver = (slot: string) => StoredSample | null;

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
  const useJazzKit = genre === 'Jazz';
  // Bass / keys user samplers anchor at MIDI 60 (C4) — pitch shift via playbackRate.
  const BASS_ROOT = 40; // E2 — typical bass guitar low E
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
        // 1) User sample takes priority if assigned for this drum part.
        const part = pitchToDrumPart(n.pitch);
        const userSample = part && resolveUserSample ? resolveUserSample(`drums:${part}`) : null;
        if (userSample) {
          const p = getUserPlayer(userSample, inst.master);
          if (p && p.loaded) {
            try {
              p.playbackRate = 1;
              p.volume.value = Tone.gainToDb(Math.max(0.001, gain));
              p.start(t);
            } catch {}
            return;
          }
        }
        // 2) Jazz acoustic kit
        if (useJazzKit) {
          const playSample = (pl: Tone.Player) => {
            if (!pl.loaded) return;
            try {
              pl.volume.value = Tone.gainToDb(Math.max(0.001, gain));
              pl.start(t);
            } catch {}
          };
          switch (n.pitch) {
            case DRUM_PITCHES.kick:  playSample(inst.jazzKit.kick);  break;
            case DRUM_PITCHES.snare: playSample(inst.jazzKit.snare); break;
            case DRUM_PITCHES.hihat: playSample(inst.jazzKit.hihat); break;
            case DRUM_PITCHES.ride:  playSample(inst.jazzKit.ride);  break;
            default: playSample(inst.jazzKit.snare);
          }
          return;
        }
        // 3) Synth fallback
        switch (n.pitch) {
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
          default:
            inst.snare.triggerAttackRelease(dur, t, gain);
        }
      } else if (trackId === 'bass') {
        const userSample = resolveUserSample?.('bass');
        if (userSample) {
          const p = getUserPlayer(userSample, inst.master);
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
        const userSample = resolveUserSample?.('keys');
        if (userSample) {
          const p = getUserPlayer(userSample, inst.master);
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
