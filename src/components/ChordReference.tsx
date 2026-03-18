import { useState, useMemo } from 'react';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STRING_NAMES, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName, CHORD_GROUPS,
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

export default function ChordReference({ activeChord, setActiveChord, showCAGED, setShowCAGED, cagedShape, setCagedShape, cagedRoot }: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [expandedChord, setExpandedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
  const [activeTab, setActiveTab] = useState<'chords' | 'caged'>('chords');

  const handleSelectChord = (root: NoteName, chordType: string, voicingIndex: number, source: VoicingTab) => {
    if (activeChord?.root === root && activeChord?.chordType === chordType && activeChord?.voicingIndex === voicingIndex && activeChord?.voicingSource === source) {
      setActiveChord(null);
    } else {
      setActiveChord({ root, chordType, voicingIndex, voicingSource: source });
    }
  };

  const cycleVoicing = (direction: 1 | -1) => {
    if (!activeChord) return;
    const voicings = getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource);
    if (voicings.length === 0) return;
    const newIdx = (activeChord.voicingIndex + direction + voicings.length) % voicings.length;
    setActiveChord({ ...activeChord, voicingIndex: newIdx });
  };

  const tabInfo: Record<VoicingTab, { label: string; desc: string }> = {
    full: { label: 'Full', desc: 'Standard curated voicings' },
    triads: { label: 'Triads', desc: '3 adjacent strings, no gaps' },
    shell: { label: 'Shell', desc: 'Root, 3rd, 7th — jazz comping' },
    drop2: { label: 'Drop 2', desc: 'Open voicings, jazz staple' },
    drop3: { label: 'Drop 3', desc: 'Wide spread voicings' },
  };

  const cagedPositions = useMemo(() => getCAGEDPositions(cagedRoot), [cagedRoot]);
  const group = CHORD_GROUPS[selectedGroup];

  // Get current voicing info for display
  const currentVoicings = activeChord ? getVoicingsForChord(activeChord.root, activeChord.chordType, activeChord.voicingSource) : [];
  const currentVoicing = activeChord && currentVoicings[activeChord.voicingIndex];

  return (
    <div className="p-3">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setActiveTab('chords')}
          className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === 'chords' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >Chords</button>
        <button
          onClick={() => { setActiveTab('caged'); setShowCAGED(true); }}
          className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === 'caged' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >CAGED</button>
        {activeChord && (
          <button
            onClick={() => setActiveChord(null)}
            className="ml-auto text-[10px] font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >Clear</button>
        )}
      </div>

      {activeTab === 'caged' ? (
        <CAGEDPanel
          positions={cagedPositions}
          cagedShape={cagedShape}
          setCagedShape={setCagedShape}
          root={cagedRoot}
        />
      ) : (
        <>
          {/* Root selector */}
          <div className="flex flex-wrap gap-1 mb-2">
            {NOTE_NAMES.map(n => (
              <button
                key={n}
                onClick={() => { setSelectedRoot(n); setExpandedChord(null); setActiveChord(null); }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  n === selectedRoot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >{n}</button>
            ))}
          </div>

          {/* Chord group tabs */}
          <div className="flex gap-1 mb-2">
            {CHORD_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => { setSelectedGroup(i); setExpandedChord(null); }}
                className={`flex-1 px-1 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                  i === selectedGroup ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >{g.label}</button>
            ))}
          </div>

          {/* Voicing type tabs */}
          <div className="flex gap-1 mb-2">
            {(['full', 'triads', 'shell', 'drop2', 'drop3'] as VoicingTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setVoicingTab(tab); setExpandedChord(null); }}
                className={`flex-1 px-1 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider transition-colors ${
                  voicingTab === tab ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >{tabInfo[tab].label}</button>
            ))}
          </div>

          <div className="text-[8px] font-mono text-muted-foreground mb-2">{tabInfo[voicingTab].desc}</div>

          {/* Chord list */}
          <div className="flex flex-wrap gap-1 max-h-[20vh] overflow-y-auto pr-1">
            {group.types.map(chordType => {
              if (!CHORD_FORMULAS[chordType]) return null;
              const formula = CHORD_FORMULAS[chordType];
              const needsFour = voicingTab === 'drop2' || voicingTab === 'drop3';
              if (needsFour && formula && formula.length < 4) return null;
              const isExpanded = expandedChord === chordType;
              return (
                <button
                  key={chordType}
                  onClick={() => {
                    setExpandedChord(isExpanded ? null : chordType);
                    if (!isExpanded) {
                      // Auto-select first voicing
                      const voicings = getVoicingsForChord(selectedRoot, chordType, voicingTab);
                      if (voicings.length > 0) {
                        setActiveChord({ root: selectedRoot, chordType, voicingIndex: 0, voicingSource: voicingTab });
                      }
                    }
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                    isExpanded ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >{selectedRoot} {chordType}</button>
              );
            })}
          </div>

          {/* Active voicing display with cycling arrows */}
          {activeChord && currentVoicing && (
            <div className="mt-3 bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => cycleVoicing(-1)}
                  className="px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-mono"
                >◀</button>
                <div className="text-center">
                  <div className="text-xs font-mono font-bold text-foreground">{activeChord.root} {activeChord.chordType}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">
                    {activeChord.voicingIndex + 1} / {currentVoicings.length}
                  </div>
                </div>
                <button
                  onClick={() => cycleVoicing(1)}
                  className="px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-mono"
                >▶</button>
              </div>

              <ChordDiagram voicing={currentVoicing} root={activeChord.root} />

              {/* Fret numbers */}
              <div className="flex justify-center gap-1 mt-1">
                {STRING_NAMES.map((s, i) => (
                  <span key={i} className="w-5 text-center text-[8px] font-mono text-muted-foreground">
                    {currentVoicing.frets[i] === -1 ? '×' : currentVoicing.frets[i]}
                  </span>
                ))}
              </div>

              {/* Fingering info */}
              {currentVoicing.fingers && (
                <div className="flex justify-center gap-1 mt-0.5">
                  {STRING_NAMES.map((s, i) => (
                    <span key={i} className="w-5 text-center text-[8px] font-mono text-muted-foreground/70">
                      {currentVoicing.frets[i] === -1 ? '' : currentVoicing.fingers![i] === 0 ? 'O' : currentVoicing.fingers![i]}
                    </span>
                  ))}
                </div>
              )}

              {/* Structure description */}
              <div className="text-[8px] font-mono text-muted-foreground mt-2 text-center">
                {getChordStructureDescription(activeChord.chordType, activeChord.voicingSource)}
              </div>
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
  if (source === 'shell') desc += ' [Shell: root, 3rd, 7th only]';
  if (source === 'drop2') desc += ' [Drop 2: 2nd voice dropped an octave]';
  if (source === 'drop3') desc += ' [Drop 3: 3rd voice dropped an octave]';
  if (source === 'triads') desc += ' [Triad: 3 adjacent strings]';
  return desc;
}

function ChordDiagram({ voicing, root }: { voicing: ChordVoicing; root: NoteName }) {
  const positiveFrets = voicing.frets.filter(f => f > 0);
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 80;
  const h = 90;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <div className="flex justify-center">
      <svg width={w} height={h + 10} className="shrink-0">
        {startFret > 1 && (
          <text x={3} y={fretSpacing + 12} fontSize={8} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
        )}
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
        {/* Barre indicator */}
        {voicing.barreFrom != null && voicing.barreTo != null && voicing.barreFret != null && (
          <rect
            x={(voicing.barreFrom + 1) * stringSpacing - 3}
            y={8 + (voicing.barreFret - startFret + 0.25) * fretSpacing}
            width={(voicing.barreTo - voicing.barreFrom) * stringSpacing + 6}
            height={fretSpacing * 0.5}
            rx={fretSpacing * 0.25}
            fill="hsl(var(--foreground))"
            opacity={0.6}
          />
        )}
        {/* Notes */}
        {voicing.frets.map((fret, i) => {
          const x = (i + 1) * stringSpacing;
          if (fret === -1) return <text key={i} x={x} y={5} fontSize={8} textAnchor="middle" fill="hsl(var(--destructive))" fontFamily="monospace">×</text>;
          if (fret === 0) return <circle key={i} cx={x} cy={5} r={2.5} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1} />;
          const y = 8 + (fret - startFret + 0.5) * fretSpacing;
          const note = noteAtFret(i, fret);
          const interval = getExtendedIntervalName(root, note);
          const degColor = DEGREE_COLORS[interval];
          const fillColor = degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
          return <circle key={i} cx={x} cy={y} r={4} fill={fillColor} />;
        })}
      </svg>
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
