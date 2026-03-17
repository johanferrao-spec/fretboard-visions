import { useState } from 'react';
import { NoteName, NOTE_CSS_KEYS, CHORD_FORMULAS, ARPEGGIO_FORMULAS, CHORD_CATEGORIES } from '@/lib/music';
import type { ChordSelection, ScaleSelection } from '@/hooks/useFretboard';

interface NoteInfoPanelProps {
  note: NoteName | null;
  noteColors: Record<string, string>;
  onClose: () => void;
  onApplyChord?: (chord: ChordSelection) => void;
  onApplyArpeggio?: (root: NoteName, arpeggioName: string) => void;
  onApplySecondaryArpeggio?: (root: NoteName, arpeggioName: string) => void;
}

export default function NoteInfoPanel({ note, noteColors, onClose, onApplyChord, onApplyArpeggio, onApplySecondaryArpeggio }: NoteInfoPanelProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [showArpeggios, setShowArpeggios] = useState(false);
  const [dragItem, setDragItem] = useState<string | null>(null);

  if (!note) return null;

  const cssVar = NOTE_CSS_KEYS[note];
  const color = noteColors[note] || `hsl(var(${cssVar}))`;

  const handleChordClick = (chordType: string) => {
    if (onApplyChord && CHORD_FORMULAS[chordType]) {
      onApplyChord({ root: note, chordType, voicingIndex: 0, voicingSource: 'full' });
    }
  };

  const handleArpeggioClick = (arpeggioType: string) => {
    if (onApplyArpeggio && ARPEGGIO_FORMULAS[arpeggioType]) {
      onApplyArpeggio(note, arpeggioType);
    }
  };

  const handleDragStart = (type: string) => {
    setDragItem(type);
  };

  const handleDragToSecondary = (type: string) => {
    if (onApplySecondaryArpeggio && ARPEGGIO_FORMULAS[type]) {
      onApplySecondaryArpeggio(note, type);
    }
  };

  const category = CHORD_CATEGORIES[activeCategory];
  // Note index computed inline where needed

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[70vh] overflow-hidden flex flex-col p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-mono font-bold"
              style={{ backgroundColor: color, color: 'hsl(220, 20%, 8%)' }}
            >
              {note}
            </div>
            <h2 className="text-base font-display font-semibold text-foreground">{note} Note</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
        </div>

        {/* Chord/Arpeggio toggle */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setShowArpeggios(false)}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              !showArpeggios ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >Chords</button>
          <button
            onClick={() => setShowArpeggios(true)}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              showArpeggios ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >Arpeggios</button>
        </div>

        {!showArpeggios ? (
          <>
            {/* Category tabs */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {CHORD_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(i)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                    i === activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Chord buttons */}
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[40vh] pr-1">
              {category.types.map(chordType => {
                if (!CHORD_FORMULAS[chordType]) return null;
                const rootIndex = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).indexOf(note);
                const formula = CHORD_FORMULAS[chordType];
                const notes = formula.map(i => (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const)[(rootIndex + i) % 12]);
                return (
                  <button
                    key={chordType}
                    onClick={() => handleChordClick(chordType)}
                    className="bg-secondary rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
                  >
                    <div className="text-xs font-mono font-semibold text-foreground">{note} {chordType}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{notes.join(' – ')}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* Arpeggios */
          <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[40vh] pr-1">
            {Object.entries(ARPEGGIO_FORMULAS).map(([arpType, formula]) => {
              const rootIndex = (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).indexOf(note);
              const notes = formula.map(i => (['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const)[(rootIndex + i) % 12]);
              return (
                <button
                  key={arpType}
                  onClick={() => handleArpeggioClick(arpType)}
                  draggable
                  onDragStart={() => handleDragStart(arpType)}
                  onDragEnd={() => { if (dragItem) handleDragToSecondary(dragItem); setDragItem(null); }}
                  className="bg-secondary rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
                  title="Click to apply, drag to secondary"
                >
                  <div className="text-xs font-mono font-semibold text-foreground">{note} {arpType}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{notes.join(' – ')}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
