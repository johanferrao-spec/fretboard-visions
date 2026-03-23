import { useState, useMemo } from 'react';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STRING_NAMES, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName, CHORD_GROUPS, identifyChord,
  type ChordVoicing,
} from '@/lib/music';
import type { ChordSelection } from '@/hooks/useFretboard';

interface ChordReferenceProps {
  activeChord: ChordSelection | null;
  setActiveChord: (c: ChordSelection | null) => void;
  showCAGED: boolean;
  setShowCAGED: (v: boolean) => void;
  cagedShape: string;
  setCagedShape: (v: string) => void;
  cagedRoot: NoteName;
}

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3' | 'triads';
type MainTab = 'chords' | 'caged' | 'identify';

// Chord columns: major-third, minor-third, suspended
const CHORD_COLUMNS: { label: string; types: string[] }[] = [
  { label: 'Major', types: ['Major', 'Major 7', 'Dominant 7', 'Augmented', 'Aug 7', 'Add9', 'Major 9', 'Dominant 9', 'Major 6', '7#9', '7♭9', '7#5', '7♭5', '11', '13'] },
  { label: 'Minor', types: ['Minor', 'Minor 7', 'Diminished', 'Dim 7', 'Half-Dim 7', 'Min/Maj 7', 'Minor 9', 'Minor 6', 'Minor 11', 'Minor 13'] },
  { label: 'Sus', types: ['Sus2', 'Sus4', '7sus4', 'Power (5)'] },
];

export default function ChordReference({ activeChord, setActiveChord, showCAGED, setShowCAGED, cagedShape, setCagedShape, cagedRoot }: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
  const [activeTab, setActiveTab] = useState<MainTab>('chords');
  const [voicingPage, setVoicingPage] = useState(0);

  // "What chord is this" state
  const [identifyFrets, setIdentifyFrets] = useState<(number | -1)[]>([-1, -1, -1, -1, -1, -1]);

  const VOICINGS_PER_PAGE = 4;

  const currentVoicings = useMemo(() => {
    if (!selectedChord) return [];
    return getVoicingsForChord(selectedRoot, selectedChord, voicingTab);
  }, [selectedRoot, selectedChord, voicingTab]);

  const totalPages = Math.ceil(currentVoicings.length / VOICINGS_PER_PAGE);
  const pagedVoicings = currentVoicings.slice(voicingPage * VOICINGS_PER_PAGE, (voicingPage + 1) * VOICINGS_PER_PAGE);

  const handleSelectChord = (chordType: string) => {
    if (selectedChord === chordType) {
      setSelectedChord(null);
      setActiveChord(null);
    } else {
      setSelectedChord(chordType);
      setVoicingPage(0);
      const voicings = getVoicingsForChord(selectedRoot, chordType, voicingTab);
      if (voicings.length > 0) {
        setActiveChord({ root: selectedRoot, chordType, voicingIndex: 0, voicingSource: voicingTab });
      }
    }
  };

  const handleSelectVoicing = (idx: number) => {
    const globalIdx = voicingPage * VOICINGS_PER_PAGE + idx;
    if (selectedChord) {
      setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: globalIdx, voicingSource: voicingTab });
    }
  };

  const handleVoicingTabChange = (tab: VoicingTab) => {
    setVoicingTab(tab);
    setVoicingPage(0);
    if (selectedChord) {
      const voicings = getVoicingsForChord(selectedRoot, selectedChord, tab);
      if (voicings.length > 0) {
        setActiveChord({ root: selectedRoot, chordType: selectedChord, voicingIndex: 0, voicingSource: tab });
      }
    }
  };

  const cagedPositions = useMemo(() => getCAGEDPositions(cagedRoot), [cagedRoot]);

  // Chord identification
  const identifiedChords = useMemo(() => {
    const hasInput = identifyFrets.some(f => f >= 0);
    if (!hasInput) return [];
    return identifyChord(identifyFrets);
  }, [identifyFrets]);

  const updateIdentifyFret = (stringIdx: number, value: string) => {
    const newFrets = [...identifyFrets];
    if (value === '' || value === 'x' || value === 'X') {
      newFrets[stringIdx] = -1;
    } else {
      const n = parseInt(value);
      if (!isNaN(n) && n >= 0 && n <= 24) newFrets[stringIdx] = n;
    }
    setIdentifyFrets(newFrets);
  };

  return (
    <div className="p-3">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-2">
        {(['chords', 'caged', 'identify'] as MainTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'caged') setShowCAGED(true);
            }}
            className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {tab === 'chords' ? 'Chords' : tab === 'caged' ? 'CAGED' : 'What Chord?'}
          </button>
        ))}
        {activeChord && (
          <button
            onClick={() => { setActiveChord(null); setSelectedChord(null); }}
            className="ml-auto text-[9px] font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >Clear</button>
        )}
      </div>

      {activeTab === 'caged' ? (
        <CAGEDPanel positions={cagedPositions} cagedShape={cagedShape} setCagedShape={setCagedShape} root={cagedRoot} />
      ) : activeTab === 'identify' ? (
        <IdentifyPanel
          frets={identifyFrets}
          onUpdate={updateIdentifyFret}
          results={identifiedChords}
        />
      ) : (
        <>
          {/* Root selector - compact */}
          <div className="flex flex-wrap gap-0.5 mb-2">
            {NOTE_NAMES.map(n => (
              <button
                key={n}
                onClick={() => { setSelectedRoot(n); setSelectedChord(null); setActiveChord(null); setVoicingPage(0); }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                  n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >{n}</button>
            ))}
          </div>

          {/* 3 chord columns + 4 voicing type columns */}
          <div className="flex gap-1 mb-2">
            {/* Chord quality columns */}
            <div className="flex-1 flex gap-px">
              {CHORD_COLUMNS.map(col => (
                <div key={col.label} className="flex-1 min-w-0">
                  <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-0.5 truncate">{col.label}</div>
                  <div className="space-y-px max-h-[18vh] overflow-y-auto pr-0.5">
                    {col.types.map(ct => {
                      if (!CHORD_FORMULAS[ct]) return null;
                      const isSelected = selectedChord === ct;
                      return (
                        <button
                          key={ct}
                          onClick={() => handleSelectChord(ct)}
                          className={`w-full text-left px-1 py-0.5 rounded text-[8px] font-mono transition-colors truncate ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                          title={ct}
                        >{ct}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Voicing type column */}
            <div className="w-12 shrink-0">
              <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider text-center mb-0.5">Type</div>
              <div className="space-y-px">
                {(['full', 'shell', 'drop2', 'drop3', 'triads'] as VoicingTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleVoicingTabChange(tab)}
                    className={`w-full px-1 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider transition-colors ${
                      voicingTab === tab ? 'bg-accent text-accent-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                    }`}
                  >{tab === 'drop2' ? 'D2' : tab === 'drop3' ? 'D3' : tab.charAt(0).toUpperCase() + tab.slice(1, 4)}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Voicing type description */}
          <div className="text-[7px] font-mono text-muted-foreground mb-1">
            {voicingTab === 'full' && 'Standard curated voicings'}
            {voicingTab === 'shell' && 'Shell: Root, 3rd, 7th — jazz comping essentials'}
            {voicingTab === 'drop2' && 'Drop 2: 2nd voice dropped an octave — open jazz voicings'}
            {voicingTab === 'drop3' && 'Drop 3: 3rd voice dropped an octave — wide spread'}
            {voicingTab === 'triads' && 'Triads: 3 adjacent strings, no gaps'}
          </div>

          {/* Voicing diagrams - 4 at a time */}
          {selectedChord && (
            <div className="bg-secondary/30 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-mono font-bold text-foreground">{selectedRoot} {selectedChord}</div>
                <div className="text-[8px] font-mono text-muted-foreground">
                  {currentVoicings.length > 0 ? `${voicingPage * VOICINGS_PER_PAGE + 1}-${Math.min((voicingPage + 1) * VOICINGS_PER_PAGE, currentVoicings.length)} of ${currentVoicings.length}` : 'No voicings'}
                </div>
              </div>

              {currentVoicings.length > 0 ? (
                <>
                  <div className="flex gap-1">
                    {pagedVoicings.map((v, i) => {
                      const globalIdx = voicingPage * VOICINGS_PER_PAGE + i;
                      const isActive = activeChord?.voicingIndex === globalIdx && activeChord?.voicingSource === voicingTab;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSelectVoicing(i)}
                          className={`flex-1 rounded-md p-1 transition-all border ${
                            isActive ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                          }`}
                        >
                          <MiniChordDiagram voicing={v} root={selectedRoot} />
                          <div className="text-[7px] font-mono text-muted-foreground text-center mt-0.5">
                            {v.frets.map(f => f === -1 ? 'x' : f).join('')}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <button
                        onClick={() => setVoicingPage(p => Math.max(0, p - 1))}
                        disabled={voicingPage === 0}
                        className="px-2 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors"
                      >◀</button>
                      <span className="text-[8px] font-mono text-muted-foreground">{voicingPage + 1}/{totalPages}</span>
                      <button
                        onClick={() => setVoicingPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={voicingPage >= totalPages - 1}
                        className="px-2 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 transition-colors"
                      >▶</button>
                    </div>
                  )}

                  {/* Structure description */}
                  <div className="text-[7px] font-mono text-muted-foreground mt-1 text-center">
                    {getChordStructureDescription(selectedChord, voicingTab)}
                  </div>
                </>
              ) : (
                <div className="text-[8px] font-mono text-muted-foreground text-center py-2">No voicings available for this type</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getChordStructureDescription(chordType: string, source: string): string {
  const descriptions: Record<string, string> = {
    'Major': 'R-3-5 — Bright, stable, resolved',
    'Minor': 'R-♭3-5 — Dark, melancholic',
    'Diminished': 'R-♭3-♭5 — Tense, unstable',
    'Augmented': 'R-3-#5 — Bright, unresolved',
    'Sus2': 'R-2-5 — Open, ambiguous',
    'Sus4': 'R-4-5 — Suspended, wants to resolve',
    'Major 7': 'R-3-5-7 — Lush, jazzy',
    'Minor 7': 'R-♭3-5-♭7 — Smooth, mellow',
    'Dominant 7': 'R-3-5-♭7 — Bluesy, wants to resolve',
    'Dim 7': 'R-♭3-♭5-♭♭7 — Symmetric, passing chord',
    'Half-Dim 7': 'R-♭3-♭5-♭7 — Jazz ii in minor keys',
    'Min/Maj 7': 'R-♭3-5-7 — Dark yet luminous',
    'Aug 7': 'R-3-#5-♭7 — Altered dominant',
    'Add9': 'R-3-5-9 — Major with color',
    'Major 9': 'R-3-5-7-9 — Rich, sophisticated',
    'Minor 9': 'R-♭3-5-♭7-9 — Smooth jazz staple',
    'Dominant 9': 'R-3-5-♭7-9 — Funky, soulful',
    '7sus4': 'R-4-5-♭7 — Suspended dominant',
    '7#9': 'R-3-5-♭7-#9 — "Hendrix chord"',
    '7♭9': 'R-3-5-♭7-♭9 — Altered dominant',
    'Power (5)': 'R-5 — Raw, distortion-friendly',
  };
  let desc = descriptions[chordType] || `${chordType} voicing`;
  if (source === 'shell') desc += ' [Shell]';
  if (source === 'drop2') desc += ' [Drop 2]';
  if (source === 'drop3') desc += ' [Drop 3]';
  if (source === 'triads') desc += ' [Triad]';
  return desc;
}

function MiniChordDiagram({ voicing, root }: { voicing: ChordVoicing; root: NoteName }) {
  const positiveFrets = voicing.frets.filter(f => f > 0);
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 48;
  const h = 60;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <div className="flex justify-center">
      <svg width={w} height={h + 8} className="shrink-0">
        {startFret > 1 && (
          <text x={2} y={fretSpacing + 8} fontSize={6} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        )}
        {startFret === 1 && (
          <line x1={stringSpacing} y1={6} x2={stringSpacing * 6} y2={6} stroke="hsl(var(--fretboard-nut))" strokeWidth={2} />
        )}
        {Array.from({ length: numFrets + 1 }, (_, i) => (
          <line key={i} x1={stringSpacing} y1={6 + i * fretSpacing} x2={stringSpacing * 6} y2={6 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={0.5} />
        ))}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <line key={s} x1={s * stringSpacing} y1={6} x2={s * stringSpacing} y2={6 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={0.5} opacity={0.5} />
        ))}
        {voicing.barreFrom != null && voicing.barreTo != null && voicing.barreFret != null && (
          <rect
            x={(voicing.barreFrom + 1) * stringSpacing - 2}
            y={6 + (voicing.barreFret - startFret + 0.3) * fretSpacing}
            width={(voicing.barreTo - voicing.barreFrom) * stringSpacing + 4}
            height={fretSpacing * 0.4}
            rx={fretSpacing * 0.2}
            fill="hsl(var(--foreground))"
            opacity={0.5}
          />
        )}
        {voicing.frets.map((fret, i) => {
          const x = (i + 1) * stringSpacing;
          if (fret === -1) return <text key={i} x={x} y={4} fontSize={5} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">×</text>;
          if (fret === 0) return <circle key={i} cx={x} cy={4} r={1.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.5} />;
          const y = 6 + (fret - startFret + 0.5) * fretSpacing;
          const note = noteAtFret(i, fret);
          const interval = getExtendedIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={3} fill={fillColor} />;
        })}
      </svg>
    </div>
  );
}

function IdentifyPanel({ frets, onUpdate, results }: {
  frets: (number | -1)[];
  onUpdate: (stringIdx: number, value: string) => void;
  results: ReturnType<typeof identifyChord>;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground mb-2">
        Enter fret numbers for each string. Use <strong className="text-foreground">x</strong> for muted strings.
      </div>

      <div className="flex gap-1 mb-3">
        {STRING_NAMES.map((name, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-[8px] font-mono text-muted-foreground mb-0.5">{name}</div>
            <input
              type="text"
              value={frets[i] === -1 ? 'x' : String(frets[i])}
              onChange={e => onUpdate(i, e.target.value)}
              className="w-full bg-muted text-foreground text-center text-[10px] font-mono rounded px-0.5 py-1 border border-border focus:border-primary focus:outline-none"
              maxLength={2}
            />
          </div>
        ))}
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="bg-secondary/50 rounded-lg p-2">
              <div className="text-xs font-mono font-bold text-foreground">
                {r.names.join(' / ')}
              </div>
              {r.explanations.map((exp, j) => (
                <div key={j} className="text-[8px] font-mono text-muted-foreground mt-0.5">{exp}</div>
              ))}
              <div className="text-[8px] font-mono text-muted-foreground mt-1">
                Notes: {[...new Set(r.notes)].join(' – ')}
              </div>
            </div>
          ))}
        </div>
      ) : frets.some(f => f >= 0) ? (
        <div className="text-[9px] font-mono text-muted-foreground text-center py-2">
          No matching chord found. Try adding more notes.
        </div>
      ) : null}
    </div>
  );
}

function CAGEDPanel({
  positions, cagedShape, setCagedShape, root,
}: {
  positions: ReturnType<typeof getCAGEDPositions>;
  cagedShape: string;
  setCagedShape: (v: string) => void;
  root: NoteName;
}) {
  const shapes = ['C', 'A', 'G', 'E', 'D'];
  const currentPos = positions.find(p => p.shape === cagedShape);

  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground mb-2 leading-relaxed">
        The <strong className="text-foreground">CAGED system</strong> divides the fretboard into 5 overlapping positions.
      </div>
      <div className="flex gap-1 mb-3">
        {shapes.map(s => (
          <button
            key={s}
            onClick={() => setCagedShape(s)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
              s === cagedShape ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >{s}</button>
        ))}
      </div>
      {currentPos && (
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-xs font-mono font-bold text-foreground mb-1">{cagedShape} Shape — Frets {currentPos.startFret}–{currentPos.endFret}</div>
          <div className="text-[9px] font-mono text-muted-foreground mb-2">
            {cagedShape === 'E' && 'Root on the low E string. The most common barre chord position.'}
            {cagedShape === 'D' && 'Root on the D string. Higher register, great for melodies.'}
            {cagedShape === 'C' && 'Root on the A string (higher position). Connects A and G shapes.'}
            {cagedShape === 'A' && 'Root on the A string. Second most common barre chord position.'}
            {cagedShape === 'G' && 'Root on the low E string (lower). Connects E and A shapes.'}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground">
            Navigate: {shapes.map((s, i) => (
              <span key={s}>
                {i > 0 && ' → '}
                <span className={s === cagedShape ? 'text-primary font-bold' : ''}>{s}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
