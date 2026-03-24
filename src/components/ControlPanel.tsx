import { useState } from 'react';
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

// Scale categories with sub-pages
interface ScaleCategory {
  label: string;
  scales?: string[]; // direct select (no sub-page)
  isModesGroup?: boolean; // different color for mode groups
}

const SCALE_CATEGORIES: ScaleCategory[] = [
  { label: 'Major', scales: ['Major (Ionian)'] },
  { label: 'Minor', scales: ['Natural Minor (Aeolian)', 'Harmonic Minor', 'Melodic Minor'] },
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
          <div className="flex gap-2">
            <button
              onClick={() => setActivePrimary(true)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
                activePrimary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >Primary Active</button>
            <button
              onClick={() => setActivePrimary(false)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
                !activePrimary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >Secondary Active</button>
          </div>
        </>
      )}
    </div>
  );
}

function ModeSelector({
  label, value, onChange, active, color, onColorChange,
}: {
  label: string;
  value: ScaleSelection;
  onChange: (s: ScaleSelection) => void;
  active: boolean;
  color: string;
  onColorChange: (c: string) => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const description = value.mode === 'scale' ? SCALE_DESCRIPTIONS[value.scale] : undefined;

  const handleSelectScale = (scaleName: string) => {
    onChange({ ...value, mode: 'scale', scale: scaleName });
    setOpenCategory(null);
  };

  return (
    <div className={`p-3 rounded-lg border transition-colors ${active ? 'border-primary bg-secondary/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input
              type="color"
              value={color || '#e6a817'}
              onChange={e => onColorChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5"
            />
            <div
              className="w-5 h-5 rounded-full border border-border cursor-pointer"
              style={{ backgroundColor: color || 'hsl(var(--primary))' }}
            />
          </div>
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
          onClick={() => { onChange({ ...value, mode: 'arpeggio', scale: arpeggioNames[0] }); setOpenCategory(null); }}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            value.mode === 'arpeggio' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >Arpeggio</button>
      </div>

      {/* Root note */}
      <select
        value={value.root}
        onChange={e => onChange({ ...value, root: e.target.value as NoteName })}
        className="w-full bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono mb-2"
      >
        {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
      </select>

      {/* Scale categories or arpeggio dropdown */}
      {value.mode === 'arpeggio' ? (
        <select
          value={value.scale}
          onChange={e => onChange({ ...value, scale: e.target.value })}
          className="w-full bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono"
        >
          {arpeggioNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <div className="space-y-1">
          {/* Current selection display */}
          <div className="text-[10px] font-mono text-foreground bg-muted/50 rounded px-2 py-1 mb-1">
            ♪ {value.scale}
          </div>

          {openCategory === null ? (
            /* Category buttons */
            <div className="grid grid-cols-1 gap-1">
              {SCALE_CATEGORIES.map(cat => {
                // Major and Minor with single scale → direct select
                const isDirect = cat.label === 'Major';
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
                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                      cat.scales?.includes(value.scale)
                        ? 'bg-primary/20 text-primary border border-primary/60 shadow-[0_0_8px_hsl(var(--primary)/0.3)]'
                        : cat.isModesGroup
                          ? 'bg-accent/40 text-foreground/80 hover:bg-accent/60 border border-transparent'
                          : 'bg-muted text-foreground/80 hover:bg-muted/80 border border-transparent'
                    }`}
                  >
                    {cat.label} {!isDirect && '→'}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Sub-page: show scales in selected category */
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

      {/* Scale description */}
      {description && (
        <div className="mt-2 text-[9px] font-mono text-muted-foreground leading-relaxed bg-muted/50 rounded p-2">
          {description}
        </div>
      )}
    </div>
  );
}
