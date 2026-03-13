import { NOTE_NAMES, SCALE_FORMULAS, NoteName, NOTE_CSS_KEYS } from '@/lib/music';
import type { ScaleSelection, NoteColors } from '@/hooks/useFretboard';

interface ControlPanelProps {
  maxFrets: number;
  setMaxFrets: (v: number) => void;
  primaryScale: ScaleSelection;
  setPrimaryScale: (s: ScaleSelection) => void;
  secondaryScale: ScaleSelection;
  setSecondaryScale: (s: ScaleSelection) => void;
  secondaryEnabled: boolean;
  setSecondaryEnabled: (v: boolean) => void;
  activePrimary: boolean;
  setActivePrimary: (v: boolean) => void;
  noteColors: NoteColors;
  updateNoteColor: (note: NoteName, color: string) => void;
}

const scaleNames = Object.keys(SCALE_FORMULAS);

export default function ControlPanel({
  maxFrets, setMaxFrets,
  primaryScale, setPrimaryScale,
  secondaryScale, setSecondaryScale,
  secondaryEnabled, setSecondaryEnabled,
  activePrimary, setActivePrimary,
  noteColors, updateNoteColor,
}: ControlPanelProps) {
  return (
    <div className="space-y-5">
      {/* Fret count slider */}
      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Frets: {maxFrets}
        </label>
        <input
          type="range"
          min={12}
          max={22}
          value={maxFrets}
          onChange={e => setMaxFrets(Number(e.target.value))}
          className="w-full mt-1 accent-primary"
        />
      </div>

      {/* Primary Scale */}
      <ScaleSelector
        label="Primary Scale"
        value={primaryScale}
        onChange={setPrimaryScale}
        active={activePrimary}
      />

      {/* Secondary Scale Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSecondaryEnabled(!secondaryEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            secondaryEnabled ? 'bg-primary' : 'bg-secondary'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-foreground transition-transform ${
              secondaryEnabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Dual Scale
        </span>
      </div>

      {secondaryEnabled && (
        <>
          <ScaleSelector
            label="Secondary Scale"
            value={secondaryScale}
            onChange={setSecondaryScale}
            active={!activePrimary}
          />

          {/* Active scale toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setActivePrimary(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors ${
                activePrimary
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Primary
            </button>
            <button
              onClick={() => setActivePrimary(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors ${
                !activePrimary
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Secondary
            </button>
          </div>
        </>
      )}

      {/* Note Colors */}
      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
          Note Colors
        </label>
        <div className="grid grid-cols-4 gap-2">
          {NOTE_NAMES.map(note => {
            const cssVar = NOTE_CSS_KEYS[note];
            const customColor = noteColors[note];
            return (
              <div key={note} className="flex items-center gap-1.5">
                <div className="relative">
                  <input
                    type="color"
                    value={customColor || hslCssVarToHex(cssVar)}
                    onChange={e => updateNoteColor(note, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-border cursor-pointer"
                    style={{ backgroundColor: customColor || `hsl(var(${cssVar}))` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{note}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScaleSelector({
  label, value, onChange, active,
}: {
  label: string;
  value: ScaleSelection;
  onChange: (s: ScaleSelection) => void;
  active: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${active ? 'border-primary bg-secondary/50' : 'border-border'}`}>
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={value.root}
          onChange={e => onChange({ ...value, root: e.target.value as NoteName })}
          className="flex-1 bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono"
        >
          {NOTE_NAMES.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={value.scale}
          onChange={e => onChange({ ...value, scale: e.target.value })}
          className="flex-[2] bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border font-mono"
        >
          {scaleNames.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function hslCssVarToHex(cssVar: string): string {
  // Fallback hex values for color picker default
  const map: Record<string, string> = {
    '--note-c': '#e63946', '--note-cs': '#e06830', '--note-d': '#e6b422',
    '--note-ds': '#b3cc33', '--note-e': '#2d8c45', '--note-f': '#1a8c6e',
    '--note-fs': '#22a7bf', '--note-g': '#3b82f6', '--note-gs': '#6366f1',
    '--note-a': '#8b5cf6', '--note-as': '#d946a8', '--note-b': '#e6426e',
  };
  return map[cssVar] || '#888888';
}
