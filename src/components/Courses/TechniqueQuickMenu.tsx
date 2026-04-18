import type { Technique } from '@/lib/courseTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TECHS: { value: Technique; label: string; symbol: string }[] = [
  { value: 'hammer', label: 'Hammer-on', symbol: 'h' },
  { value: 'pull', label: 'Pull-off', symbol: 'p' },
  { value: 'slide-up', label: 'Slide up', symbol: '/' },
  { value: 'slide-down', label: 'Slide down', symbol: '\\' },
  { value: 'bend', label: 'Bend', symbol: 'b' },
  { value: 'release', label: 'Release', symbol: 'r' },
  { value: 'vibrato', label: 'Vibrato', symbol: '~' },
  { value: 'palm-mute', label: 'Palm mute', symbol: 'PM' },
  { value: 'tap', label: 'Tap', symbol: 't' },
  { value: 'harmonic', label: 'Harmonic', symbol: '◆' },
  { value: 'mute', label: 'Mute', symbol: '✕' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (t: Technique | 'none') => void;
  hasSelection: boolean;
}

export function TechniqueQuickMenu({ open, onOpenChange, onPick, hasSelection }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Apply technique</DialogTitle>
        </DialogHeader>
        {!hasSelection ? (
          <p className="text-xs text-muted-foreground">Select a note first, then press E to apply a technique.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { onPick('none'); onOpenChange(false); }}
              className="px-2 py-2 rounded-md bg-muted/40 border border-border text-[11px] font-mono hover:bg-muted text-foreground"
            >— none —</button>
            {TECHS.map(t => (
              <button key={t.value}
                onClick={() => { onPick(t.value); onOpenChange(false); }}
                className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-md bg-muted/40 border border-border hover:bg-primary/10 hover:border-primary transition-colors"
              >
                <span className="text-base font-bold text-foreground">{t.symbol}</span>
                <span className="text-[9px] text-muted-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
