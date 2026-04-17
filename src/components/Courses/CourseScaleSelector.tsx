import { useState } from 'react';
import { NOTE_NAMES, SCALE_DESCRIPTIONS, type NoteName } from '@/lib/music';
import type { KeyQuality } from '@/lib/courseTypes';
import { KEY_QUALITY_SCALE } from '@/lib/courseTypes';

interface ScaleCategory {
  label: string;
  scales?: string[];
  isModesGroup?: boolean;
}

const SCALE_CATEGORIES: ScaleCategory[] = [
  { label: 'Major', scales: ['Major (Ionian)'] },
  { label: 'Minor', scales: ['Natural Minor (Aeolian)'] },
  { label: 'Pentatonics', scales: ['Pentatonic Major', 'Pentatonic Minor', 'Blues', 'Blues Major', 'Hirajoshi', 'In Sen', 'Kumoi'] },
  { label: 'Standard Modes', scales: ['Major (Ionian)', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Natural Minor (Aeolian)', 'Locrian'], isModesGroup: true },
  { label: 'Harmonic Minor Modes', scales: ['Harmonic Minor', 'Locrian ♮6', 'Ionian #5', 'Dorian #4', 'Phrygian Dominant', 'Lydian #2', 'Superlocrian ♭♭7'], isModesGroup: true },
  { label: 'Melodic Minor Modes', scales: ['Melodic Minor', 'Dorian ♭2', 'Lydian Augmented', 'Lydian Dominant', 'Mixolydian ♭6', 'Locrian ♮2', 'Superlocrian (Altered)'], isModesGroup: true },
  { label: 'Exotic', scales: ['Hungarian Minor', 'Neapolitan Minor', 'Neapolitan Major', 'Double Harmonic Major', 'Enigmatic', 'Whole Tone', 'Diminished (HW)', 'Diminished (WH)', 'Chromatic', 'Bebop Dominant', 'Bebop Major'] },
];

const NATURAL_NOTES: NoteName[] = ['E', 'F', 'G', 'A', 'B', 'C', 'D'];

interface Props {
  root: NoteName;
  setRoot: (n: NoteName) => void;
  scale: string;
  setScale: (s: string) => void;
  /** Optional helper: also keep a course-level KeyQuality in sync when picking Major/Minor categories */
  setKeyQuality?: (q: KeyQuality) => void;
}

export function CourseScaleSelector({ root, setRoot, scale, setScale, setKeyQuality }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [hoveredScale, setHoveredScale] = useState<string | null>(null);

  const handleSelectScale = (scaleName: string) => {
    setScale(scaleName);
    if (setKeyQuality) {
      if (scaleName === KEY_QUALITY_SCALE.Major) setKeyQuality('Major');
      else if (scaleName === KEY_QUALITY_SCALE.Minor) setKeyQuality('Minor');
    }
    setOpenCategory(null);
    setHoveredScale(null);
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-card/40">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Key & Scale</label>

      {/* Root selector */}
      <div className="mt-2 mb-2">
        <ScaleRootSelector selectedRoot={root} onSelect={setRoot} />
      </div>

      {/* Selected scale display */}
      <div className="text-[10px] font-mono font-bold rounded px-2 py-1 mb-2 border" style={{ color: 'hsl(270, 80%, 65%)', backgroundColor: 'hsl(270, 80%, 65%, 0.1)', borderColor: 'hsl(270, 80%, 65%, 0.4)', boxShadow: '0 0 12px hsl(270, 80%, 65%, 0.4)' }}>
        ♪ {root} {scale}
      </div>

      {/* Categories */}
      <div className="space-y-1">
        {openCategory === null ? (
          <div className="grid grid-cols-1 gap-1">
            {SCALE_CATEGORIES.map(cat => {
              const isDirect = cat.label === 'Major' || cat.label === 'Minor';
              return (
                <button
                  key={cat.label}
                  onClick={() => {
                    if (isDirect && cat.scales) handleSelectScale(cat.scales[0]);
                    else setOpenCategory(cat.label);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all border border-transparent ${
                    cat.isModesGroup ? 'bg-accent/15 text-foreground/50 hover:bg-accent/30' : 'bg-muted text-foreground/80 hover:bg-muted/80'
                  }`}
                >
                  {cat.label} {!isDirect && '→'}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="animate-fade-in">
            <button onClick={() => setOpenCategory(null)} className="text-[9px] font-mono text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1">← Back</button>
            <div className="grid grid-cols-1 gap-0.5">
              {SCALE_CATEGORIES.find(c => c.label === openCategory)?.scales?.map(s => (
                <button
                  key={s}
                  onClick={() => handleSelectScale(s)}
                  onMouseEnter={() => setHoveredScale(s)}
                  onMouseLeave={() => setHoveredScale(null)}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                    scale === s ? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_8px_hsl(var(--primary)/0.3)] font-bold' : 'bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground border-transparent'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(hoveredScale || scale) && SCALE_DESCRIPTIONS[hoveredScale || scale] && (
        <div className="mt-2 text-[9px] font-mono text-muted-foreground leading-relaxed bg-muted/50 rounded p-2">
          {SCALE_DESCRIPTIONS[hoveredScale || scale]}
        </div>
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
                <button onClick={() => handleAccidental('flat')}
                  className={`w-5 h-4 rounded-l border text-[9px] font-mono font-bold transition-colors ${
                    accidental === 'flat' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                  }`}>♭</button>
                <button onClick={() => handleAccidental('sharp')}
                  className={`w-5 h-4 rounded-r border border-l-0 text-[9px] font-mono font-bold transition-colors ${
                    accidental === 'sharp' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted'
                  }`}>♯</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
