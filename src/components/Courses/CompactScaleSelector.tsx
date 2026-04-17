import { NOTE_NAMES, type NoteName } from '@/lib/music';
import { KEY_QUALITY_SCALE, type KeyQuality } from '@/lib/courseTypes';
import { Label } from '@/components/ui/label';

const SCALE_OPTIONS: { value: string; label: string; quality: KeyQuality }[] = [
  // Major modes
  { value: 'Major (Ionian)', label: 'Major (Ionian)', quality: 'Major' },
  { value: 'Dorian', label: 'Dorian', quality: 'Minor' },
  { value: 'Phrygian', label: 'Phrygian', quality: 'Minor' },
  { value: 'Lydian', label: 'Lydian', quality: 'Major' },
  { value: 'Mixolydian', label: 'Mixolydian', quality: 'Major' },
  { value: 'Natural Minor (Aeolian)', label: 'Natural Minor (Aeolian)', quality: 'Minor' },
  { value: 'Locrian', label: 'Locrian', quality: 'Minor' },
  // Harmonic / Melodic
  { value: 'Harmonic Minor', label: 'Harmonic Minor', quality: 'Minor' },
  { value: 'Melodic Minor', label: 'Melodic Minor', quality: 'Minor' },
];

interface Props {
  root: NoteName;
  setRoot: (n: NoteName) => void;
  scale: string;
  setScale: (s: string) => void;
  setKeyQuality: (q: KeyQuality) => void;
}

export function CompactScaleSelector({ root, setRoot, scale, setScale, setKeyQuality }: Props) {
  const handleScaleChange = (v: string) => {
    setScale(v);
    const opt = SCALE_OPTIONS.find(o => o.value === v);
    if (opt) setKeyQuality(opt.quality);
    else if (v === KEY_QUALITY_SCALE.Major) setKeyQuality('Major');
    else if (v === KEY_QUALITY_SCALE.Minor) setKeyQuality('Minor');
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Key centre</Label>
        <select
          value={root}
          onChange={e => setRoot(e.target.value as NoteName)}
          className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
        >
          {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div>
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Scale</Label>
        <select
          value={scale}
          onChange={e => handleScaleChange(e.target.value)}
          className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
        >
          {SCALE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
