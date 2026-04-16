import type { MidiNote, TrackId } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, DRUM_PITCHES } from '@/lib/backingTrackTypes';

interface ClipPreviewProps {
  trackId: TrackId;
  notes: MidiNote[];
  measures: number;
  currentBeat: number;
  isPlaying: boolean;
  onOpenEditor: () => void;
}

export default function ClipPreview({ trackId, notes, measures, currentBeat, isPlaying, onOpenEditor }: ClipPreviewProps) {
  const totalBeats = measures * 4;
  const color = TRACK_COLORS[trackId];

  // Calc pitch range for vertical scaling
  let minPitch = 127, maxPitch = 0;
  if (trackId === 'drums') {
    minPitch = 30; maxPitch = 55;
  } else {
    for (const n of notes) {
      if (n.pitch < minPitch) minPitch = n.pitch;
      if (n.pitch > maxPitch) maxPitch = n.pitch;
    }
    if (notes.length === 0) { minPitch = 48; maxPitch = 72; }
    const span = maxPitch - minPitch;
    if (span < 12) {
      const pad = (12 - span) / 2;
      minPitch -= Math.ceil(pad);
      maxPitch += Math.floor(pad);
    }
  }
  const pitchRange = maxPitch - minPitch || 1;
  const playPct = (currentBeat / totalBeats) * 100;

  return (
    <div
      className="relative w-full h-full rounded-md overflow-hidden cursor-pointer group"
      style={{
        backgroundColor: `hsl(${color} / 0.15)`,
        border: `1px solid hsl(${color} / 0.4)`,
      }}
      onDoubleClick={onOpenEditor}
      title="Double-click to open piano roll"
    >
      {/* Measure markers */}
      {Array.from({ length: measures }, (_, m) => (
        <div
          key={m}
          className="absolute top-0 bottom-0"
          style={{
            left: `${(m / measures) * 100}%`,
            borderLeft: m === 0 ? 'none' : '1px solid hsl(220, 15%, 25%)',
          }}
        />
      ))}
      {/* Notes */}
      {notes.map(n => {
        const left = (n.startBeat / totalBeats) * 100;
        const width = Math.max(0.4, (n.duration / totalBeats) * 100);
        const top = (1 - (n.pitch - minPitch) / pitchRange) * 100;
        const heightPct = trackId === 'drums' ? 12 : Math.max(4, 100 / pitchRange);
        return (
          <div
            key={n.id}
            className="absolute rounded-sm"
            style={{
              left: `${left}%`,
              top: `${Math.max(0, Math.min(95, top))}%`,
              width: `${width}%`,
              height: `${heightPct}%`,
              backgroundColor: `hsl(${color} / ${0.4 + (n.velocity / 127) * 0.5})`,
              boxShadow: `0 0 2px hsl(${color} / 0.5)`,
            }}
          />
        );
      })}
      {/* Playhead */}
      {(isPlaying || currentBeat > 0) && (
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
          style={{
            left: `${playPct}%`,
            backgroundColor: 'hsl(var(--primary))',
            boxShadow: '0 0 4px hsl(var(--primary))',
          }}
        />
      )}
      {/* Empty hint */}
      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-muted-foreground/60 pointer-events-none">
          Empty — adjust intensity & regenerate
        </div>
      )}
      {/* Edit hint */}
      <div className="absolute top-1 right-2 text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity text-foreground/70 pointer-events-none">
        DBL-CLICK TO EDIT
      </div>
    </div>
  );
}
