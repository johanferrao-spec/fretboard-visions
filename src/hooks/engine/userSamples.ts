import * as Tone from 'tone';
import type { StoredSample } from '@/lib/sampleStorage';

/**
 * Cache of decoded Tone.Players keyed by stored-sample id, sharing a destination.
 * Players are created lazily, the first time a slot is asked for during scheduling.
 */
const playerCache = new Map<string, { player: Tone.Player; objectUrl: string }>();

export function getUserPlayer(sample: StoredSample, destination: Tone.ToneAudioNode): Tone.Player | null {
  const cached = playerCache.get(sample.id);
  if (cached) return cached.player;

  try {
    const objectUrl = URL.createObjectURL(sample.blob);
    const player = new Tone.Player({ url: objectUrl, autostart: false }).connect(destination);
    playerCache.set(sample.id, { player, objectUrl });
    return player;
  } catch {
    return null;
  }
}

export function disposeUserPlayers() {
  playerCache.forEach(({ player, objectUrl }) => {
    try { player.dispose(); } catch {}
    try { URL.revokeObjectURL(objectUrl); } catch {}
  });
  playerCache.clear();
}

/**
 * Look up an active user sample for a slot key from the active map + sample list.
 */
export function resolveActiveSample(
  slot: string,
  active: Record<string, string>,
  samples: StoredSample[],
): StoredSample | null {
  const id = active[slot];
  if (!id) return null;
  return samples.find(s => s.id === id) || null;
}
