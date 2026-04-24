import * as Tone from 'tone';
import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { DRUM_PITCHES } from '@/lib/backingTrackTypes';
import type { EngineInstruments } from './instruments';
import { midiToNote, velocityToGain } from './humanize';

/**
 * Schedule a single track's notes on the Transport.
 * Returns no value — caller is expected to call Transport.cancel() before re-scheduling.
 */
export function scheduleTrack(
  trackId: TrackId,
  notes: MidiNote[],
  inst: EngineInstruments,
  isMutedRef: { current: boolean },
) {
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
        inst.bass.triggerAttackRelease(midiToNote(n.pitch), dur, t, gain);
      } else if (trackId === 'piano') {
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
