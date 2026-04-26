import { Volume2, VolumeX } from 'lucide-react';
import type { TrackState } from '@/lib/backingTrackTypes';
import { TRACK_COLORS, TRACK_LABELS } from '@/lib/backingTrackTypes';

interface TrackHeaderProps {
  track: TrackState;
  onChange: <K extends keyof TrackState>(key: K, value: TrackState[K]) => void;
  /** Kept in the type so parents don't need to change, but unused now. */
  onRegenerate?: () => void;
  onAIRegenerate?: () => void;
  isAILoading?: boolean;
}

/**
 * A single 0–100 slider drives both the engine's `intensity` and `complexity`.
 * Centre (50) corresponds to the previous defaults; sliding left makes the
 * part sparser/softer ("Less"), sliding right makes it busier/louder ("More").
 */
export default function TrackHeader({ track, onChange }: TrackHeaderProps) {
  const color = TRACK_COLORS[track.id];

  // Average the two existing values so any prior state still maps sensibly.
  const sliderValue = Math.round(((track.intensity + track.complexity) / 2) * 100);

  const handleChange = (v: number) => {
    const norm = v / 100;
    onChange('intensity', norm);
    onChange('complexity', norm);
  };

  return (
    <div
      className="flex flex-col gap-2 p-2 border-r border-border h-full"
      style={{
        backgroundColor: `hsl(${color} / 0.08)`,
        width: 200,
        minWidth: 200,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground">
            {TRACK_LABELS[track.id]}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => onChange('muted', !track.muted)}
            className={`w-5 h-5 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-colors ${
              track.muted ? 'bg-destructive/30 text-destructive' : 'bg-secondary text-muted-foreground hover:bg-muted'
            }`}
            title="Mute"
          >
            {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          <button
            onClick={() => onChange('solo', !track.solo)}
            className={`w-5 h-5 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-colors ${
              track.solo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'
            }`}
            title="Solo"
          >
            S
          </button>
        </div>
      </div>

      {/* Single More / Less slider */}
      <div className="flex flex-col gap-1 mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">Less</span>
          <span className="text-[8px] font-mono text-foreground">{sliderValue}</span>
          <span className="text-[8px] font-mono uppercase text-muted-foreground tracking-wider">More</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-1 accent-primary cursor-pointer"
          title="Drag to make this part busier or sparser"
        />
      </div>

      {track.manuallyEdited && (
        <div className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'hsl(40, 90%, 60%)' }}>● edited</div>
      )}
    </div>
  );
}
