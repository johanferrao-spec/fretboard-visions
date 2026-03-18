import { useState } from 'react';
import { NoteName, NOTE_NAMES, NOTE_CSS_KEYS, CHORD_FORMULAS, ARPEGGIO_FORMULAS, CHORD_CATEGORIES, getDiatonicChord, getScaleNotes } from '@/lib/music';
import type { ChordSelection, ScaleSelection } from '@/hooks/useFretboard';

interface NoteInfoPanelProps {
  note: NoteName | null;
  noteColors: Record<string, string>;
  onClose: () => void;
  onApplyChord?: (chord: ChordSelection) => void;
  onApplyArpeggio?: (root: NoteName, arpeggioName: string) => void;
  onApplySecondaryArpeggio?: (root: NoteName, arpeggioName: string) => void;
  activeScale?: ScaleSelection;
}

export default function NoteInfoPanel({ note, noteColors, onClose, onApplyChord, onApplyArpeggio, onApplySecondaryArpeggio, activeScale }: NoteInfoPanelProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [showArpeggios, setShowArpeggios] = useState(false);

  if (!note) return null;

  const cssVar = NOTE_CSS_KEYS[note];
  const color = noteColors[note] || `hsl(var(${cssVar}))`;

  // Determine diatonic chord quality for this note in the active scale
  const diatonicInfo = activeScale && activeScale.mode === 'scale'
    ? getDiatonicChord(activeScale.root, activeScale.scale, note)
    : null;

  const handleChordClick = (chordType: string) => {
    if (onApplyChord && CHORD_FORMULAS[chordType]) {
      onApplyChord({ root: note, chordType, voicingIndex: 0, voicingSource: 'full' });
      onClose(); // Close menu after selection
    }
  };

  const handleArpeggioClick = (arpeggioType: string) => {
    if (onApplyArpeggio && ARPEGGIO_FORMULAS[arpeggioType]) {
      onApplyArpeggio(note, arpeggioType);
      onClose(); // Close menu after selection
    }
  };

  const handleDragToSecondary = (type: string) => {
    if (onApplySecondaryArpeggio && ARPEGGIO_FORMULAS[type]) {
      onApplySecondaryArpeggio(note, type);
    }
  };

  // Filter arpeggios to diatonic ones if we have scale context
  const diatonicArpeggios = activeScale && activeScale.mode === 'scale'
    ? (() => {
        const scaleNotes = getScaleNotes(activeScale.root, activeScale.scale);
        if (scaleNotes.length < 7 || !scaleNotes.includes(note)) return null;
        const chord = getDiatonicChord(activeScale.root, activeScale.scale, note);
        if (!chord.name) return null;
        // Map quality to arpeggio types
        const q = chord.name.replace(note, '');
        const types: string[] = [];
        if (q.includes('maj7')) types.push('Major 7', 'Major');
        else if (q.includes('min7')) types.push('Minor 7', 'Minor');
        else if (q.includes('7')) types.push('Dominant 7', 'Major');
        else if (q.includes('ø7')) types.push('Half-Dim 7', 'Diminished');
        else if (q.includes('°7')) types.push('Dim 7', 'Diminished');
        else types.push('Major', 'Minor');
        return types.filter(t => ARPEGGIO_FORMULAS[t]);
      })()
    : null;

  const category = CHORD_CATEGORIES[activeCategory];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[60vh] overflow-hidden flex flex-col p-4"
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
            <div>
              <h2 className="text-base font-display font-semibold text-foreground">{note}</h2>
              {diatonicInfo && diatonicInfo.name && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  Diatonic: {diatonicInfo.name} ({diatonicInfo.notes.join('-')})
                </div>
              )}
            </div>
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
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[35vh] pr-1">
              {category.types.map(chordType => {
                if (!CHORD_FORMULAS[chordType]) return null;
                const rootIndex = NOTE_NAMES.indexOf(note);
                const formula = CHORD_FORMULAS[chordType];
                const notes = formula.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
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
          /* Arpeggios — show diatonic first if available */
          <div className="overflow-y-auto max-h-[35vh] pr-1 space-y-2">
            {diatonicArpeggios && (
              <div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Diatonic to current scale</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {diatonicArpeggios.map(arpType => {
                    const rootIndex = NOTE_NAMES.indexOf(note);
                    const formula = ARPEGGIO_FORMULAS[arpType];
                    const notes = formula.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
                    return (
                      <button
                        key={arpType}
                        onClick={() => handleArpeggioClick(arpType)}
                        draggable
                        onDragEnd={() => handleDragToSecondary(arpType)}
                        className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
                        title="Click to apply, drag to secondary"
                      >
                        <div className="text-xs font-mono font-semibold text-foreground">{note} {arpType}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{notes.join(' – ')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">All arpeggios</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(ARPEGGIO_FORMULAS).map(([arpType, formula]) => {
                  const rootIndex = NOTE_NAMES.indexOf(note);
                  const notes = formula.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
                  return (
                    <button
                      key={arpType}
                      onClick={() => handleArpeggioClick(arpType)}
                      draggable
                      onDragEnd={() => handleDragToSecondary(arpType)}
                      className="bg-secondary rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
                      title="Click to apply, drag to secondary"
                    >
                      <div className="text-xs font-mono font-semibold text-foreground">{note} {arpType}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{notes.join(' – ')}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
