import { useState, useRef, useEffect } from 'react';
import { NOTE_NAMES, ARPEGGIO_FORMULAS, SCALE_DESCRIPTIONS, NoteName } from '@/lib/music';
import type { ScaleSelection } from '@/hooks/useFretboard';

interface ControlPanelProps {
  primaryScale: ScaleSelection;
  setPrimaryScale: (s: ScaleSelection) => void;
  secondaryScale: ScaleSelection;
  setSecondaryScale: (s: ScaleSelection) => void;
  secondaryEnabled: boolean;
  setSecondaryEnabled: (v: boolean) => void;
  activePrimary: boolean;
  setActivePrimary: (v: boolean) => void;
  secondaryOpacity: number;
  setSecondaryOpacity: (v: number) => void;
  secondaryColor: string;
  setSecondaryColor: (v: string) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  condensed?: boolean;
}

const arpeggioNames = Object.keys(ARPEGGIO_FORMULAS);

const NATURAL_NOTES: NoteName[] = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];

const ARPEGGIO_CATEGORIES: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Other', types: ['Sus2', 'Sus4', '7sus4'] },
];

interface ScaleCategory {
  label: string;
  scales?: string[];
  isModesGroup?: boolean;
}

const SCALE_CATEGORIES: ScaleCategory[] = [
  { label: 'Major', scales: ['Major (Ionian)'] },
  { label: 'Minor', scales: ['Natural Minor (Aeolian)'] },
  {
    label: 'Pentatonics',
    scales: ['Pentatonic Major', 'Pentatonic Minor', 'Blues', 'Blues Major', 'Hirajoshi', 'In Sen', 'Kumoi'],
  },
  {
    label: 'Standard Modes',
    scales: ['Major (Ionian)', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Natural Minor (Aeolian)', 'Locrian'],
    isModesGroup: true,
  },
  {
    label: 'Harmonic Minor Modes',
    scales: ['Harmonic Minor', 'Locrian ♮6', 'Ionian #5', 'Dorian #4', 'Phrygian Dominant', 'Lydian #2', 'Superlocrian ♭♭7'],
    isModesGroup: true,
  },
  {
    label: 'Melodic Minor Modes',
    scales: ['Melodic Minor', 'Dorian ♭2', 'Lydian Augmented', 'Lydian Dominant', 'Mixolydian ♭6', 'Locrian ♮2', 'Superlocrian (Altered)'],
    isModesGroup: true,
  },
  {
    label: 'Exotic',
    scales: ['Hungarian Minor', 'Neapolitan Minor', 'Neapolitan Major', 'Double Harmonic Major', 'Enigmatic', 'Whole Tone', 'Diminished (HW)', 'Diminished (WH)', 'Chromatic', 'Bebop Dominant', 'Bebop Major'],
  },
];

export default function ControlPanel({
  primaryScale, setPrimaryScale,
  secondaryScale, setSecondaryScale,
  secondaryEnabled, setSecondaryEnabled,
  activePrimary, setActivePrimary,
  secondaryOpacity, setSecondaryOpacity,
  secondaryColor, setSecondaryColor,
  primaryColor, setPrimaryColor,
  condensed,
}: ControlPanelProps) {
  return (
    <div className="space-y-4">
      <ModeSelector
        label="Primary"
        value={primaryScale}
        onChange={setPrimaryScale}
        active={activePrimary}
        color={primaryColor}
        onColorChange={setPrimaryColor}
        condensed={!!condensed}
      />

      {/* Dual Scale Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSecondaryEnabled(!secondaryEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            secondaryEnabled ? 'bg-primary' : 'bg-secondary'
          }`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-foreground transition-transform ${
            secondaryEnabled ? 'translate-x-5' : ''
          }`} />
        </button>
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Dual Scale</span>
      </div>

      {secondaryEnabled && (
        <>
          <ModeSelector
            label="Secondary"
            value={secondaryScale}
            onChange={setSecondaryScale}
            active={!activePrimary}
            color={secondaryColor}
            onColorChange={setSecondaryColor}
            condensed={false}
            hideDescription
          />
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Secondary Opacity: {Math.round(secondaryOpacity * 100)}%
            </label>
            <input
              type="range" min={10} max={100} value={secondaryOpacity * 100}
              onChange={e => setSecondaryOpacity(Number(e.target.value) / 100)}
              className="w-full mt-1 accent-primary"
            />
          </div>
          {/* Single toggle button for active layer */}
          <button
            onClick={() => setActivePrimary(!activePrimary)}
            className="w-full px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors bg-secondary text-secondary-foreground hover:bg-muted"
          >
            Active: {activePrimary ? 'Primary' : 'Secondary'}
          </button>
        </>
      )}
    </div>
  );
}

function ScaleRootSelector({ selectedRoot, onSelect }: { selectedRoot: NoteName; onSelect: (n: NoteName) => void }) {
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

  const handleNoteClick = (n: NoteName) => {
    setBaseNote(n);
    setAccidental('natural');
    onSelect(n);
  };

  const handleAccidental = (acc: 'sharp' | 'flat') => {
    const newAcc = accidental === acc ? 'natural' : acc;
    setAccidental(newAcc);
    onSelect(resolveNote(baseNote, newAcc));
  };

  return (
    <div className="mb-2">
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
                    className={`w-5 h-4 rounded-l border text-[9px] font-mono font-bold transition-colors ${
                      accidental === 'flat'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >♭</button>
                  <button
                    onClick={() => handleAccidental('sharp')}
                    className={`w-5 h-4 rounded-r border border-l-0 text-[9px] font-mono font-bold transition-colors ${
                      accidental === 'sharp'
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
    </div>
  );
}

const COLOR_OPTIONS = [
  'hsl(38, 90%, 55%)',   // gold
  'hsl(270, 70%, 60%)',  // purple
  'hsl(160, 70%, 50%)',  // teal
  'hsl(350, 80%, 55%)',  // rose
  'hsl(200, 85%, 55%)',  // sky
  'hsl(30, 85%, 55%)',   // amber
  'hsl(90, 65%, 45%)',   // lime
  'hsl(320, 75%, 55%)',  // magenta
  'hsl(180, 70%, 50%)',  // cyan
  'hsl(15, 90%, 55%)',   // vermilion
  'hsl(55, 85%, 50%)',   // yellow
  'hsl(240, 60%, 60%)',  // indigo
];

function ColorDropdown({ color, onColorChange }: { color: string; onColorChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const displayColor = color || 'hsl(var(--primary))';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full border-2 border-border/60 transition-all hover:scale-110 hover:border-foreground/40"
        style={{
          backgroundColor: displayColor,
          boxShadow: `0 0 8px ${displayColor}`,
        }}
        title="Scale colour"
      />
      {open && (
        <div
          className="absolute z-50 right-0 top-7 rounded-xl p-2 border shadow-xl"
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.5)',
          }}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => { onColorChange(c); setOpen(false); }}
                className="w-5 h-5 rounded-full border-2 transition-all hover:scale-125"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'hsl(var(--foreground))' : 'transparent',
                  boxShadow: color === c ? `0 0 8px ${c}, 0 0 2px hsl(var(--foreground))` : `0 0 4px ${c}`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeSelector({
  label, value, onChange, active, color, onColorChange, condensed, hideDescription,
}: {
  label: string;
  value: ScaleSelection;
  onChange: (s: ScaleSelection) => void;
  active: boolean;
  color: string;
  onColorChange: (c: string) => void;
  condensed: boolean;
  hideDescription?: boolean;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [hoveredScale, setHoveredScale] = useState<string | null>(null);

  const displayDescription = !hideDescription && value.mode === 'scale'
    ? SCALE_DESCRIPTIONS[hoveredScale || value.scale]
    : undefined;

  const handleSelectScale = (scaleName: string) => {
    onChange({ ...value, mode: 'scale', scale: scaleName });
    setOpenCategory(null);
    setHoveredScale(null);
  };

  // Condensed mode: just show selected scale/arp compactly
  if (condensed) {
    return (
      <div className={`p-3 rounded-lg border transition-colors ${active ? 'border-primary bg-secondary/50' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
          <div className="flex items-center gap-1.5">
            <ColorDropdown color={color} onColorChange={onColorChange} />
          </div>
        </div>
      <div className="mt-1.5 text-[10px] font-mono font-bold rounded px-2 py-1 border" style={{ color: 'hsl(270, 80%, 65%)', backgroundColor: 'hsl(270, 80%, 65%, 0.1)', borderColor: 'hsl(270, 80%, 65%, 0.4)', boxShadow: '0 0 12px hsl(270, 80%, 65%, 0.4), 0 0 24px hsl(270, 80%, 65%, 0.15)' }}>
          ♪ {value.root} {value.mode === 'arpeggio' ? `${value.scale} (Arp)` : value.scale}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border transition-colors ${active ? 'border-primary bg-secondary/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
          <div className="flex items-center gap-1.5">
            <ColorDropdown color={color} onColorChange={onColorChange} />
          </div>
      </div>

      {/* Scale / Arpeggio toggle */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => { onChange({ ...value, mode: 'scale', scale: 'Major (Ionian)' }); setOpenCategory(null); }}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            value.mode === 'scale' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >Scale</button>
        <button
          onClick={() => { onChange({ ...value, mode: 'arpeggio', scale: 'Major' }); setOpenCategory(null); }}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            value.mode === 'arpeggio' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >Arpeggio</button>
      </div>

      {/* Root note selector — E-starting with sharp/flat */}
      <ScaleRootSelector selectedRoot={value.root} onSelect={(n) => onChange({ ...value, root: n })} />

      {/* Selected scale display — glowing */}
      <div className="text-[10px] font-mono font-bold rounded px-2 py-1 mb-2 border" style={{ color: 'hsl(270, 80%, 65%)', backgroundColor: 'hsl(270, 80%, 65%, 0.1)', borderColor: 'hsl(270, 80%, 65%, 0.4)', boxShadow: '0 0 12px hsl(270, 80%, 65%, 0.4), 0 0 24px hsl(270, 80%, 65%, 0.15)' }}>
        ♪ {value.mode === 'arpeggio' ? value.scale : value.scale}
      </div>

      {/* Scale categories or arpeggio dropdown */}
      {value.mode === 'arpeggio' ? (
        <div className="space-y-1">
          {openCategory === null ? (
            <div className="grid grid-cols-1 gap-1">
              {ARPEGGIO_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => setOpenCategory(cat.label)}
                  className="w-full text-left px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all border border-transparent bg-muted text-foreground/80 hover:bg-muted/80"
                >
                  {cat.label} →
                </button>
              ))}
            </div>
          ) : (
            <div className="animate-fade-in">
              <button
                onClick={() => setOpenCategory(null)}
                className="text-[9px] font-mono text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <div className="grid grid-cols-1 gap-0.5">
                {ARPEGGIO_CATEGORIES.find(c => c.label === openCategory)?.types
                  ?.filter(t => ARPEGGIO_FORMULAS[t])
                  .map(s => (
                  <button
                    key={s}
                    onClick={() => { onChange({ ...value, scale: s }); setOpenCategory(null); }}
                    className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                      value.scale === s
                        ? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_8px_hsl(var(--primary)/0.3)] font-bold'
                        : 'bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground border-transparent'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {openCategory === null ? (
            <div className="grid grid-cols-1 gap-1">
              {SCALE_CATEGORIES.map(cat => {
                const isDirect = cat.label === 'Major' || cat.label === 'Minor';
                return (
                  <button
                    key={cat.label}
                    onClick={() => {
                      if (isDirect && cat.scales) {
                        handleSelectScale(cat.scales[0]);
                      } else {
                        setOpenCategory(cat.label);
                      }
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all border border-transparent ${
                      cat.isModesGroup
                        ? 'bg-accent/15 text-foreground/50 hover:bg-accent/30'
                        : 'bg-muted text-foreground/80 hover:bg-muted/80'
                    }`}
                  >
                    {cat.label} {!isDirect && '→'}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="animate-fade-in">
              <button
                onClick={() => setOpenCategory(null)}
                className="text-[9px] font-mono text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <div className="grid grid-cols-1 gap-0.5">
                {SCALE_CATEGORIES.find(c => c.label === openCategory)?.scales?.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSelectScale(s)}
                    onMouseEnter={() => setHoveredScale(s)}
                    onMouseLeave={() => setHoveredScale(null)}
                    className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                      value.scale === s
                        ? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_8px_hsl(var(--primary)/0.3)] font-bold'
                        : 'bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground border-transparent'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scale description — shows for hovered or selected scale */}
      {displayDescription && (
        <div className="mt-2 text-[9px] font-mono text-muted-foreground leading-relaxed bg-muted/50 rounded p-2">
          {displayDescription}
        </div>
      )}
    </div>
  );
}
