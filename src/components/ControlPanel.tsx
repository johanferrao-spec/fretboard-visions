import { NOTE_NAMES, SCALE_FORMULAS, ARPEGGIO_FORMULAS, NoteName } from '@/lib/music';
import type { ScaleSelection, ScaleMode, DisplayMode } from '@/hooks/useFretboard';

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
  displayMode: DisplayMode;
  setDisplayMode: (v: DisplayMode) => void;
  maxFrets: number;
  setMaxFrets: (v: number) => void;
}

const scaleNames = Object.keys(SCALE_FORMULAS);
const arpeggioNames = Object.keys(ARPEGGIO_FORMULAS);

export default function ControlPanel({
  primaryScale, setPrimaryScale,
  secondaryScale, setSecondaryScale,
  secondaryEnabled, setSecondaryEnabled,
  activePrimary, setActivePrimary,
  secondaryOpacity, setSecondaryOpacity,
  secondaryColor, setSecondaryColor,
  primaryColor, setPrimaryColor,
  displayMode, setDisplayMode,
  maxFrets, setMaxFrets,
}: ControlPanelProps) {
  return (
    <div className="space-y-4">
      {/* Fret count */}
      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Frets: {maxFrets}
        </label>
        <input
          type="range" min={12} max={22} value={maxFrets}
          onChange={e => setMaxFrets(Number(e.target.value))}
          className="w-full mt-1 accent-primary"
        />
      </div>

      {/* Display mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setDisplayMode('notes')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
            displayMode === 'notes' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Note Names
        </button>
        <button
          onClick={() => setDisplayMode('degrees')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors ${
            displayMode === 'degrees' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Scale Degrees
        </button>
      </div>

      {/* Primary Scale/Arpeggio */}
      <ModeSelector
        label="Primary"
        value={primaryScale}
        onChange={setPrimaryScale}
        active={activePrimary}
        color={primaryColor}
        onColorChange={setPrimaryColor}
        defaultColorLabel="Amber (default)"
      />

      {/* Secondary Toggle */}
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
            defaultColorLabel="Blue (default)"
          />

          {/* Opacity slider */}
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

          {/* Active scale toggle */}
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
  label, value, onChange, active, color, onColorChange, defaultColorLabel,
}: {
  label: string;
  value: ScaleSelection;
  onChange: (s: ScaleSelection) => void;
  active: boolean;
  color: string;
  onColorChange: (c: string) => void;
  defaultColorLabel: string;
}) {
  const names = value.mode === 'scale' ? scaleNames : arpeggioNames;

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

      {/* Mode: Scale or Arpeggio */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => onChange({ ...value, mode: 'scale', scale: scaleNames[0] })}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            value.mode === 'scale' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >Scale</button>
        <button
          onClick={() => onChange({ ...value, mode: 'arpeggio', scale: arpeggioNames[0] })}
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

      {/* Scale/Arpeggio name */}
      <select
        value={value.scale}
        onChange={e => onChange({ ...value, scale: e.target.value })}
        className="w-full bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono"
      >
        {names.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
