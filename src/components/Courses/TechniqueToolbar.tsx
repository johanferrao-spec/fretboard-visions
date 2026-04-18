import type { Technique } from '@/lib/courseTypes';

const TECHNIQUES: { value: Technique; label: string; symbol: string; hint: string }[] = [
  { value: 'hammer', label: 'Hammer-on', symbol: 'h', hint: 'h' },
  { value: 'pull', label: 'Pull-off', symbol: 'p', hint: 'p' },
  { value: 'slide-up', label: 'Slide up', symbol: '/', hint: '/' },
  { value: 'slide-down', label: 'Slide down', symbol: '\\', hint: '\\' },
  { value: 'bend', label: 'Bend', symbol: 'b', hint: 'b' },
  { value: 'release', label: 'Release', symbol: 'r', hint: 'r' },
  { value: 'vibrato', label: 'Vibrato', symbol: '~', hint: '~' },
  { value: 'palm-mute', label: 'Palm mute', symbol: 'PM', hint: 'PM' },
  { value: 'tap', label: 'Tap', symbol: 't', hint: 't' },
  { value: 'harmonic', label: 'Harmonic', symbol: '◆', hint: '◆' },
  { value: 'mute', label: 'Mute', symbol: '✕', hint: 'x' },
];

interface Props {
  selectedTechnique: Technique | 'none';
  onApply: (t: Technique | 'none') => void;
  hasSelection: boolean;
}

export function TechniqueToolbar({ selectedTechnique, onApply, hasSelection }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Techniques</p>
      <p className="text-[9px] text-muted-foreground italic">
        {hasSelection ? 'Click to apply to the selected note' : 'Select a note on the tab first'}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={() => onApply('none')}
          disabled={!hasSelection}
          className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
            selectedTechnique === 'none'
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-muted/50 border-border text-foreground hover:bg-muted disabled:opacity-40'
          }`}
        >— none —</button>
        {TECHNIQUES.map(t => (
          <button
            key={t.value}
            onClick={() => onApply(t.value)}
            disabled={!hasSelection}
            title={t.label}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors flex items-center justify-between gap-1 ${
              selectedTechnique === t.value
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-muted/50 border-border text-foreground hover:bg-muted disabled:opacity-40'
            }`}
          >
            <span className="font-bold">{t.symbol}</span>
            <span className="truncate text-[9px] text-muted-foreground">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
