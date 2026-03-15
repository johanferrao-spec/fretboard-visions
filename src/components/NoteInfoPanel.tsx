import { getChordsForNote, getArpeggiosForNote, NoteName, NOTE_CSS_KEYS, CHORD_FORMULAS, ARPEGGIO_FORMULAS } from '@/lib/music';
import type { ChordSelection, ScaleSelection } from '@/hooks/useFretboard';

interface NoteInfoPanelProps {
  note: NoteName | null;
  noteColors: Record<string, string>;
  onClose: () => void;
  onApplyChord?: (chord: ChordSelection) => void;
  onApplyArpeggio?: (root: NoteName, arpeggioName: string) => void;
}

export default function NoteInfoPanel({ note, noteColors, onClose, onApplyChord, onApplyArpeggio }: NoteInfoPanelProps) {
  if (!note) return null;

  const chords = getChordsForNote(note);
  const arpeggios = getArpeggiosForNote(note);
  const cssVar = NOTE_CSS_KEYS[note];
  const color = noteColors[note] || `hsl(var(${cssVar}))`;

  const handleChordClick = (chordName: string) => {
    // Extract chord type from name (e.g., "C Major 7" → "Major 7")
    const chordType = chordName.replace(`${note} `, '');
    if (onApplyChord && CHORD_FORMULAS[chordType]) {
      onApplyChord({ root: note, chordType, voicingIndex: 0, voicingSource: 'full' });
      onClose();
    }
  };

  const handleArpeggioClick = (arpName: string) => {
    const arpeggioType = arpName.replace(`${note} `, '');
    if (onApplyArpeggio && ARPEGGIO_FORMULAS[arpeggioType]) {
      onApplyArpeggio(note, arpeggioType);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-bold"
              style={{ backgroundColor: color, color: 'hsl(220, 20%, 8%)' }}
            >
              {note}
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground">
              {note} Note Info
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Chords */}
        <div className="mb-4">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Chords <span className="text-[9px] normal-case">(click to apply)</span>
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {chords.map(chord => (
              <button
                key={chord.name}
                onClick={() => handleChordClick(chord.name)}
                className="bg-secondary rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
              >
                <div className="text-xs font-mono font-semibold text-foreground">{chord.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {chord.notes.join(' – ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Arpeggios */}
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Arpeggios <span className="text-[9px] normal-case">(click to apply)</span>
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {arpeggios.map(arp => (
              <button
                key={arp.name}
                onClick={() => handleArpeggioClick(arp.name)}
                className="bg-secondary rounded-lg px-3 py-2 text-left hover:bg-primary/20 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
              >
                <div className="text-xs font-mono font-semibold text-foreground">{arp.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {arp.notes.join(' – ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
