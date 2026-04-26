/**
 * Built-in drum kits per genre. Each kit provides a sound source for every
 * drum part; users can mix and match across kits via the sample list (e.g.
 * jazz snare with a rock kick).
 *
 * Sound sources:
 *   - 'jazz-sample': use the loaded Tone.Player from the jazz folder.
 *   - 'synth':       use the synthesised drum voices from createInstruments().
 *
 * The id is unique across all kits so it can be stored as the "active" sample
 * id in the sample library, alongside user-uploaded sample ids.
 */

import type { DrumPart } from './backingTrackTypes';
import type { Genre } from '@/hooks/useSongTimeline';

export type DrumKitGenre = Extract<Genre, 'Funk' | 'Jazz' | 'Rock' | 'Latin'>;

export interface BuiltInKitSample {
  /** Stable, prefixed id (e.g. "kit:jazz:snare") used in active-sample maps. */
  id: string;
  /** Display name shown in the sample list. */
  name: string;
  /** Owning kit (for color + grouping). */
  kit: DrumKitGenre;
  /** Drum part this sample plays. */
  part: DrumPart;
  /** HSL color string (no `hsl()`) — matches the kit color. */
  color: string;
  /** Where the audio comes from. */
  source: 'jazz-sample' | 'synth';
}

/** Per-genre kit shell color (HSL string, no wrapper). Used for drum SHELLS only. */
export const KIT_COLORS: Record<DrumKitGenre, string> = {
  Funk:  '215 85% 58%', // blue
  Jazz:  '145 60% 45%', // green
  Rock:  '0 75% 55%',   // red
  Latin: '25 90% 55%',  // orange
};

/** Per-genre cymbal color — bronze/brass variations (NOT the shell color). */
export const KIT_CYMBAL_COLORS: Record<DrumKitGenre, string> = {
  Funk:  '38 65% 55%',  // warm brass
  Jazz:  '32 55% 48%',  // dark bronze
  Rock:  '20 70% 50%',  // hot bronze (reddish)
  Latin: '45 80% 58%',  // bright brass
};

/** Drum parts that are cymbals (use bronze coloring instead of kit shell color). */
export const CYMBAL_PARTS: ReadonlySet<DrumPart> = new Set<DrumPart>(['hihat_closed', 'hihat_pedal', 'hihat_open', 'ride', 'crash']);

/** Return the appropriate color for a given (kit, part): bronze for cymbals,
 *  shell color for drums. */
export function colorForKitPart(kit: DrumKitGenre, part: DrumPart): string {
  return CYMBAL_PARTS.has(part) ? KIT_CYMBAL_COLORS[kit] : KIT_COLORS[kit];
}

/** Drum parts available on every kit. */
export const KIT_PARTS: DrumPart[] = ['kick', 'snare', 'hihat_closed', 'hihat_pedal', 'hihat_open', 'ride', 'tom1', 'tom2', 'crash'];

/** Build the full set of built-in samples for all kits. */
export const BUILT_IN_KIT_SAMPLES: BuiltInKitSample[] = (Object.keys(KIT_COLORS) as DrumKitGenre[])
  .flatMap(kit =>
    KIT_PARTS.map<BuiltInKitSample>(part => ({
      id: `kit:${kit.toLowerCase()}:${part}`,
      name: `${kit} ${part}`,
      kit,
      part,
      color: colorForKitPart(kit, part),
      // Only the Jazz kit currently has loaded audio samples; others fall back
      // to the synthesised voices. Even within Jazz, only kick/snare/hihat/ride
      // have wav files — toms/crash use the synth fallback.
      source: kit === 'Jazz' && (part === 'kick' || part === 'snare' || part === 'hihat_closed' || part === 'hihat_pedal' || part === 'hihat_open' || part === 'ride')
        ? 'jazz-sample'
        : 'synth',
    })),
  );

/** Lookup by id. */
export function getBuiltInKitSample(id: string): BuiltInKitSample | null {
  if (!id.startsWith('kit:')) return null;
  return BUILT_IN_KIT_SAMPLES.find(s => s.id === id) ?? null;
}

/** Default selection: Jazz kit assigned to every part on first load. */
export function defaultActiveKitMap(genre: DrumKitGenre = 'Rock'): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of KIT_PARTS) {
    map[`drums:${part}`] = `kit:${genre.toLowerCase()}:${part}`;
  }
  return map;
}
