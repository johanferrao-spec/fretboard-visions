import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { TimelineChord, Genre } from '@/hooks/useSongTimeline';
import type { TrackId, MidiNote } from '@/lib/backingTrackTypes';
import { TRACK_LABELS } from '@/lib/backingTrackTypes';
import { useBackingTrack } from '@/hooks/useBackingTrack';
import TrackLane from './TrackLane';
import TransportBar from './TransportBar';
import PianoRoll from './PianoRoll';

interface BackingTrackViewProps {
  chords: TimelineChord[];
  measures: number;
  bpm: number;
  genre: Genre;
  /** Beat from main song timeline (when synced playback occurs externally) */
  externalBeat?: number;
  externalIsPlaying?: boolean;
}

export default function BackingTrackView({ chords, measures, bpm, genre }: BackingTrackViewProps) {
  const bt = useBackingTrack();
  const [openEditor, setOpenEditor] = useState<TrackId | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Auto-generate on first mount when chords exist
  useEffect(() => {
    if (chords.length > 0 && !hasGenerated) {
      bt.regenerateAll(chords, measures, genre, true);
      setHasGenerated(true);
    }
  }, [chords, measures, genre, hasGenerated, bt]);

  // Re-generate non-edited tracks when chords/measures/genre change
  useEffect(() => {
    if (hasGenerated && chords.length > 0) {
      bt.regenerateAll(chords, measures, genre, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chords, measures, genre]);

  // Re-generate a specific track when its intensity/complexity changes (debounced)
  const trackKey = (id: TrackId) => `${bt.tracks[id].intensity.toFixed(2)}-${bt.tracks[id].complexity.toFixed(2)}`;
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.piano.manuallyEdited) bt.regenerateTrack('piano', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('piano')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.bass.manuallyEdited) bt.regenerateTrack('bass', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('bass')]);
  useEffect(() => {
    if (chords.length === 0) return;
    if (!bt.tracks.drums.manuallyEdited) bt.regenerateTrack('drums', chords, measures, genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey('drums')]);

  const handlePlay = () => {
    if (chords.length === 0) {
      toast.error('Add chords to the progression first');
      return;
    }
    bt.setMasterVolume(volume);
    bt.play(bpm, measures);
  };

  const handleSave = (name: string) => {
    bt.save(name, chords, measures, bpm, genre);
    toast.success(`Saved "${name}"`);
  };

  const handleLoad = (id: string) => {
    const loaded = bt.load(id);
    if (loaded) toast.success(`Loaded "${loaded.name}"`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <TransportBar
        isPlaying={bt.isPlaying}
        onPlay={handlePlay}
        onStop={bt.stop}
        onRegenerateAll={() => bt.regenerateAll(chords, measures, genre, true)}
        onSave={handleSave}
        savedTracks={bt.savedTracks.map(t => ({ id: t.id, name: t.name }))}
        onLoad={handleLoad}
        onDelete={(id) => { bt.remove(id); toast('Backing track deleted'); }}
        volume={volume}
        onVolumeChange={(v) => { setVolume(v); bt.setMasterVolume(v); }}
      />

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto">
        {(['piano', 'bass', 'drums'] as TrackId[]).map(id => (
          <TrackLane
            key={id}
            track={bt.tracks[id]}
            measures={measures}
            currentBeat={bt.currentBeat}
            isPlaying={bt.isPlaying}
            bpm={bpm}
            genre={genre}
            chords={chords}
            onParamChange={(k, v) => bt.setTrackParam(id, k, v)}
            onRegenerate={() => bt.regenerateTrack(id, chords, measures, genre)}
            onAINotes={(notes) => bt.setTrackNotes(id, notes)}
            onOpenEditor={() => setOpenEditor(id)}
          />
        ))}
        {chords.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] font-mono text-muted-foreground">
            Add chords to the progression at the top to generate a backing track
          </div>
        )}
      </div>

      {/* Piano roll — separate floating window */}
      {openEditor && (
        <PianoRoll
          trackId={openEditor}
          notes={bt.tracks[openEditor].notes}
          measures={measures}
          currentBeat={bt.currentBeat}
          isPlaying={bt.isPlaying}
          onChange={(notes) => bt.setTrackNotes(openEditor, notes)}
          onClose={() => setOpenEditor(null)}
        />
      )}
    </div>
  );
}
