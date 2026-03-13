import { useState } from 'react';
import { NOTE_NAMES, NoteName, CHORD_FORMULAS, CHORD_VOICINGS, STRING_NAMES } from '@/lib/music';

export default function ChordReference() {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [expandedChord, setExpandedChord] = useState<string | null>(null);

  const chords = Object.entries(CHORD_FORMULAS).map(([name, formula]) => {
    const rootIdx = NOTE_NAMES.indexOf(selectedRoot);
    const notes = formula.map(i => NOTE_NAMES[(rootIdx + i) % 12]);
    return { name, fullName: `${selectedRoot} ${name}`, notes };
  });

  const voicings = CHORD_VOICINGS[selectedRoot] || {};

  return (
    <div className="border-t border-border p-4">
      <h2 className="text-sm font-display font-semibold text-foreground mb-3">Chord Reference</h2>

      {/* Root selector */}
      <div className="flex flex-wrap gap-1 mb-3">
        {NOTE_NAMES.map(n => (
          <button
            key={n}
            onClick={() => { setSelectedRoot(n); setExpandedChord(null); }}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
              n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Chord list */}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
        {chords.map(chord => {
          const isExpanded = expandedChord === chord.name;
          const chordVoicings = voicings[chord.name];

          return (
            <div key={chord.name} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setExpandedChord(isExpanded ? null : chord.name)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
              >
                <span className="text-xs font-mono font-semibold text-foreground">{chord.fullName}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{chord.notes.join(' – ')}</span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/30">
                  {/* Formula */}
                  <div className="text-[10px] font-mono text-muted-foreground mb-2">
                    Formula: {CHORD_FORMULAS[chord.name].join(' – ')}
                  </div>

                  {/* Voicings */}
                  {chordVoicings && chordVoicings.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-muted-foreground">Voicings:</div>
                      {chordVoicings.map((voicing, vi) => (
                        <div key={vi} className="flex items-center gap-2">
                          <ChordDiagram voicing={voicing} />
                          <div className="text-[9px] font-mono text-muted-foreground">
                            {STRING_NAMES.map((s, i) => (
                              <span key={i} className="inline-block w-5 text-center">
                                {voicing[i] === -1 ? 'x' : voicing[i]}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-muted-foreground italic">
                      No standard voicings stored — use the fretboard to find positions.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChordDiagram({ voicing }: { voicing: number[] }) {
  const maxFret = Math.max(...voicing.filter(f => f > 0));
  const minFret = Math.min(...voicing.filter(f => f > 0));
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 60;
  const h = 70;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <svg width={w} height={h + 10} className="shrink-0">
      {/* Fret number */}
      {startFret > 1 && (
        <text x={2} y={fretSpacing + 12} fontSize={7} fill="hsl(var(--muted-foreground))" fontFamily="monospace">
          {startFret}
        </text>
      )}

      {/* Nut */}
      {startFret === 1 && (
        <line x1={stringSpacing} y1={8} x2={stringSpacing * 6} y2={8} stroke="hsl(var(--fretboard-nut))" strokeWidth={3} />
      )}

      {/* Frets */}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line key={i} x1={stringSpacing} y1={8 + i * fretSpacing} x2={stringSpacing * 6} y2={8 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={1} />
      ))}

      {/* Strings */}
      {[1, 2, 3, 4, 5, 6].map(s => (
        <line key={s} x1={s * stringSpacing} y1={8} x2={s * stringSpacing} y2={8 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={1} opacity={0.6} />
      ))}

      {/* Dots */}
      {voicing.map((fret, i) => {
        const x = (i + 1) * stringSpacing;
        if (fret === -1) {
          return <text key={i} x={x} y={5} fontSize={8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontFamily="monospace">×</text>;
        }
        if (fret === 0) {
          return <circle key={i} cx={x} cy={5} r={2.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1} />;
        }
        const y = 8 + (fret - startFret + 0.5) * fretSpacing;
        return <circle key={i} cx={x} cy={y} r={3} fill="hsl(var(--primary))" />;
      })}
    </svg>
  );
}
