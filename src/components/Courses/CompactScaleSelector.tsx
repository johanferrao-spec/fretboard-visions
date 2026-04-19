import { useState, useRef, useEffect } from 'react';
import { NOTE_NAMES, type NoteName } from '@/lib/music';
import { KEY_QUALITY_SCALE, type KeyQuality } from '@/lib/courseTypes';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';

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

const NATURAL_NOTES: NoteName[] = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];

interface Props {
  root: NoteName;
  setRoot: (n: NoteName) => void;
  scale: string;
  setScale: (s: string) => void;
  setKeyQuality: (q: KeyQuality) => void;
}

export function CompactScaleSelector({ root, setRoot, scale, setScale, setKeyQuality }: Props) {
  const [scaleOpen, setScaleOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setScaleOpen(false);
    };
    if (scaleOpen) window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [scaleOpen]);

  const handleScaleChange = (v: string) => {
    setScale(v);
    const opt = SCALE_OPTIONS.find(o => o.value === v);
    if (opt) setKeyQuality(opt.quality);
    else if (v === KEY_QUALITY_SCALE.Major) setKeyQuality('Major');
    else if (v === KEY_QUALITY_SCALE.Minor) setKeyQuality('Minor');
    setScaleOpen(false);
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Key centre</Label>
        <div className="mt-1">
          <KeyRootSelector selectedRoot={root} onSelect={setRoot} />
        </div>
      </div>
      <div ref={popRef} className="relative">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Scale</Label>
        <button
          type="button"
          onClick={() => setScaleOpen(o => !o)}
          className="w-full mt-1 flex items-center justify-between bg-card border border-border rounded-md px-2 py-1.5 text-sm font-mono text-foreground hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        >
          <span className="truncate">{scale}</span>
          <ChevronDown className={`size-3 text-muted-foreground transition-transform ${scaleOpen ? 'rotate-180' : ''}`} />
        </button>
        {scaleOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md py-1 max-h-72 overflow-y-auto shadow-lg">
            {SCALE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => handleScaleChange(o.value)}
                className={`block w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                  scale === o.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dashboard-style root picker: 7 natural notes (E F G A B C D) with ♭ / ♯
 * accidental buttons appearing under the currently-selected note.
 * E♯, F♭, B♯ and C♭ are ENHARMONIC duplicates and are disabled
 * (so the user can't pick them anywhere in the app).
 */
function KeyRootSelector({ selectedRoot, onSelect }: { selectedRoot: NoteName; onSelect: (n: NoteName) => void }) {
  const [baseNote, setBaseNote] = useState<NoteName>(() => {
    if (NATURAL_NOTES.includes(selectedRoot)) return selectedRoot;
    const idx = NOTE_NAMES.indexOf(selectedRoot);
    const flatBase = NOTE_NAMES[(idx + 1) % 12];
    if (NATURAL_NOTES.includes(flatBase as NoteName)) return flatBase as NoteName;
    return 'E';
  });
  const [accidental, setAccidental] = useState<'natural' | 'sharp' | 'flat'>(() => {
    if (NATURAL_NOTES.includes(selectedRoot)) return 'natural';
    const idx = NOTE_NAMES.indexOf(selectedRoot);
    for (const n of NATURAL_NOTES) {
      const ni = NOTE_NAMES.indexOf(n);
      if ((ni + 1) % 12 === idx) return 'sharp';
    }
    return 'flat';
  });

  const resolveNote = (base: NoteName, acc: 'natural' | 'sharp' | 'flat'): NoteName => {
    const idx = NOTE_NAMES.indexOf(base);
    if (acc === 'sharp') return NOTE_NAMES[(idx + 1) % 12];
    if (acc === 'flat') return NOTE_NAMES[(idx + 11) % 12];
    return base;
  };

  // E♯/B♯ and F♭/C♭ are enharmonic duplicates of natural notes — disable them.
  const sharpDisabled = baseNote === 'E' || baseNote === 'B';
  const flatDisabled = baseNote === 'F' || baseNote === 'C';

  const handleNoteClick = (n: NoteName) => {
    setBaseNote(n);
    setAccidental('natural');
    onSelect(n);
  };

  const handleAccidental = (acc: 'sharp' | 'flat') => {
    if (acc === 'sharp' && sharpDisabled) return;
    if (acc === 'flat' && flatDisabled) return;
    const newAcc = accidental === acc ? 'natural' : acc;
    setAccidental(newAcc);
    onSelect(resolveNote(baseNote, newAcc));
  };

  return (
    <div className="flex flex-wrap gap-0.5 items-end">
      {NATURAL_NOTES.map(n => {
        const isBase = n === baseNote;
        return (
          <div key={n} className="flex flex-col items-center">
            <button
              onClick={() => handleNoteClick(n)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                isBase ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >{n}</button>
            {isBase && (
              <div className="mt-0.5 flex gap-px">
                <button
                  onClick={() => handleAccidental('flat')}
                  disabled={flatDisabled}
                  className={`w-5 h-4 rounded-l border text-[9px] font-mono font-bold transition-colors ${
                    flatDisabled
                      ? 'bg-muted/20 border-border/30 text-muted-foreground/30 cursor-not-allowed'
                      : accidental === 'flat'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                  }`}
                >♭</button>
                <button
                  onClick={() => handleAccidental('sharp')}
                  disabled={sharpDisabled}
                  className={`w-5 h-4 rounded-r border border-l-0 text-[9px] font-mono font-bold transition-colors ${
                    sharpDisabled
                      ? 'bg-muted/20 border-border/30 text-muted-foreground/30 cursor-not-allowed'
                      : accidental === 'sharp'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                  }`}
                >♯</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
