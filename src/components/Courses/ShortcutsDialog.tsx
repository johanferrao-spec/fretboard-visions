import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: Array<{ keys: string[]; label: string; hint?: string }> = [
  { keys: ['Space'], label: 'Play / Stop' },
  { keys: ['Enter'], label: 'Insert staged note at cursor' },
  { keys: ['⌘', 'Hold'], label: 'Delete tool (click to remove)', hint: 'Ctrl on Windows' },
  { keys: ['Z', '+', 'Scroll'], label: 'Zoom the tab grid', hint: 'or ⌘ + scroll' },
  { keys: ['A'], label: 'Select previous tab note' },
  { keys: ['S'], label: 'Select next tab note' },
  { keys: ['⌥', 'Hold + Drag'], label: 'Drag-and-copy selected notes' },
  { keys: ['E'], label: 'Open techniques menu at the cursor' },
  { keys: ['Delete'], label: 'Delete selected notes' },
  { keys: ['Esc'], label: 'Clear selection' },
];

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/60 text-[10px] font-mono uppercase tracking-wider text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Keyboard className="size-4 text-primary" /> Lesson editor shortcuts
          </DialogTitle>
          <DialogDescription>Speed up editing with the keyboard.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 mt-2">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground/90">
                {s.label}
                {s.hint && <span className="ml-2 text-[10px] text-muted-foreground italic">({s.hint})</span>}
              </span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  k === '+' ? <span key={ki} className="text-muted-foreground text-xs">+</span>
                    : <KeyCap key={ki}>{k}</KeyCap>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
