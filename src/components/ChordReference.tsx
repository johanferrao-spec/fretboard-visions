import { useState, useMemo } from 'react';
import {
  NOTE_NAMES, NoteName, CHORD_FORMULAS, STRING_NAMES, STANDARD_TUNING,
  getVoicingsForChord, noteAtFret, getExtendedIntervalName, DEGREE_COLORS,
  getCAGEDPositions, getIntervalName,
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

type VoicingTab = 'full' | 'shell' | 'drop2' | 'drop3';

const PAGE_SIZE = 9;

export default function ChordReference({ activeChord, setActiveChord, showCAGED, setShowCAGED, cagedShape, setCagedShape, cagedRoot }: ChordReferenceProps) {
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [expandedChord, setExpandedChord] = useState<string | null>(null);
  const [voicingTab, setVoicingTab] = useState<VoicingTab>('full');
  const [activeTab, setActiveTab] = useState<'chords' | 'caged'>('chords');

  const chordNames = Object.keys(CHORD_FORMULAS);

  const handleSelectChord = (root: NoteName, chordType: string, voicingIndex: number, source: VoicingTab) => {
    if (activeChord?.root === root && activeChord?.chordType === chordType && activeChord?.voicingIndex === voicingIndex && activeChord?.voicingSource === source) {
      setActiveChord(null);
    } else {
      setActiveChord({ root, chordType, voicingIndex, voicingSource: source });
    }
  };

  const tabInfo: Record<VoicingTab, { label: string; description: string }> = {
    full: { label: 'Full', description: 'Standard voicings — curated common shapes shown first, with algorithmic fallbacks.' },
    shell: { label: 'Shell', description: 'Minimal 3-note voicings: Root, 3rd, and 7th. Essential for jazz comping.' },
    drop2: { label: 'Drop 2', description: 'Drop the 2nd highest voice down an octave. Creates open voicings on adjacent strings — a jazz guitar staple. Extensions MUST contain their altered note.' },
    drop3: { label: 'Drop 3', description: 'Drop the 3rd highest voice down an octave. Wide voicings that skip a string — orchestral, spread sound.' },
  };

  const cagedPositions = useMemo(() => getCAGEDPositions(cagedRoot), [cagedRoot]);

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

          {/* Voicing type tabs */}
          <div className="flex gap-1 mb-1">
            {(['full', 'shell', 'drop2', 'drop3'] as VoicingTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setVoicingTab(tab); setExpandedChord(null); }}
                className={`flex-1 px-1 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                  voicingTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >{tabInfo[tab].label}</button>
            ))}
          </div>

          <div className="text-[9px] font-mono text-muted-foreground mb-2 leading-relaxed">{tabInfo[voicingTab].description}</div>

          {/* Chord list */}
          <div className="flex flex-wrap gap-1 max-h-[25vh] overflow-y-auto pr-1">
            {chordNames.map(chordType => {
              const formula = CHORD_FORMULAS[chordType];
              const needsFour = voicingTab === 'drop2' || voicingTab === 'drop3';
              if (needsFour && formula && formula.length < 4) return null;
              const isExpanded = expandedChord === chordType;
              return (
                <div key={chordType} className={isExpanded ? 'w-full' : ''}>
                  <button
                    onClick={() => setExpandedChord(isExpanded ? null : chordType)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      isExpanded ? 'bg-primary text-primary-foreground w-full text-left' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >{selectedRoot} {chordType}</button>
                  {isExpanded && (
                    <ExpandedVoicings
                      root={selectedRoot}
                      chordType={chordType}
                      voicingTab={voicingTab}
                      activeChord={activeChord}
                      onSelect={handleSelectChord}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandedVoicings({
  root, chordType, voicingTab, activeChord, onSelect,
}: {
  root: NoteName;
  chordType: string;
  voicingTab: VoicingTab;
  activeChord: ChordSelection | null;
  onSelect: (root: NoteName, chordType: string, vi: number, source: VoicingTab) => void;
}) {
  const [page, setPage] = useState(0);
  const voicings = useMemo(() => getVoicingsForChord(root, chordType, voicingTab), [root, chordType, voicingTab]);

  if (!voicings || voicings.length === 0) {
    return (
      <div className="py-2 px-1">
        <div className="text-[10px] font-mono text-muted-foreground italic">No voicings found.</div>
      </div>
    );
  }

  const totalPages = Math.ceil(voicings.length / PAGE_SIZE);
  const pageVoicings = voicings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] font-mono text-muted-foreground">
          {voicings.length} voicing{voicings.length !== 1 ? 's' : ''} — page {page + 1}/{totalPages}
        </div>
        {totalPages > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-secondary text-secondary-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >◀</button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-secondary text-secondary-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >▶</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {pageVoicings.map((voicing, vi) => {
          const realIdx = page * PAGE_SIZE + vi;
          const isActive = activeChord?.root === root && activeChord?.chordType === chordType && activeChord?.voicingIndex === realIdx && activeChord?.voicingSource === voicingTab;
          return (
            <button
              key={realIdx}
              onClick={() => onSelect(root, chordType, realIdx, voicingTab)}
              className={`flex flex-col items-center p-1 rounded-md transition-colors ${
                isActive ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-secondary/80'
              }`}
            >
              <ChordDiagram voicing={voicing} root={root} />
              <div className="text-[8px] font-mono text-muted-foreground mt-0.5 flex gap-0.5">
                {STRING_NAMES.map((s, i) => (
                  <span key={i} className="w-3 text-center">{voicing[i] === -1 ? '×' : voicing[i]}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChordDiagram({ voicing, root }: { voicing: number[]; root: NoteName }) {
  const positiveFrets = voicing.filter(f => f > 0);
  const maxFret = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const minFret = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const startFret = minFret <= 4 ? 1 : minFret;
  const numFrets = Math.max(4, maxFret - startFret + 1);
  const w = 50;
  const h = 60;
  const stringSpacing = w / 7;
  const fretSpacing = h / (numFrets + 1);

  return (
    <svg width={w} height={h + 8} className="shrink-0">
      {startFret > 1 && (
        <text x={2} y={fretSpacing + 10} fontSize={6} fill="hsl(var(--muted-foreground))" fontFamily="monospace">{startFret}</text>
      )}
      {startFret === 1 && (
        <line x1={stringSpacing} y1={6} x2={stringSpacing * 6} y2={6} stroke="hsl(var(--fretboard-nut))" strokeWidth={3} />
      )}
      {Array.from({ length: numFrets + 1 }, (_, i) => (
        <line key={i} x1={stringSpacing} y1={6 + i * fretSpacing} x2={stringSpacing * 6} y2={6 + i * fretSpacing} stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
      {[1, 2, 3, 4, 5, 6].map(s => (
        <line key={s} x1={s * stringSpacing} y1={6} x2={s * stringSpacing} y2={6 + numFrets * fretSpacing} stroke="hsl(var(--fretboard-string))" strokeWidth={1} opacity={0.6} />
      ))}
      {voicing.map((fret, i) => {
        const x = (i + 1) * stringSpacing;
        if (fret === -1) return <text key={i} x={x} y={4} fontSize={7} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontFamily="monospace">×</text>;
        if (fret === 0) return <circle key={i} cx={x} cy={4} r={2} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1} />;
        const y = 6 + (fret - startFret + 0.5) * fretSpacing;
        const note = noteAtFret(i, fret);
        const interval = getExtendedIntervalName(root, note);
        const degColor = DEGREE_COLORS[interval];
        const fillColor = degColor ? `hsl(${degColor})` : 'hsl(var(--primary))';
        return <circle key={i} cx={x} cy={y} r={3} fill={fillColor} />;
      })}
    </svg>
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
        The <strong className="text-foreground">CAGED system</strong> divides the fretboard into 5 overlapping positions based on open chord shapes.
        Each shape connects to the next, covering the entire neck. Navigate between them to see how they link up.
      </div>

      <div className="flex gap-1 mb-3">
        {shapes.map((s, i) => (
          <button
            key={s}
            onClick={() => setCagedShape(s)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-mono font-bold transition-colors ${
              s === cagedShape ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {currentPos && (
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-xs font-mono font-bold text-foreground mb-1">{cagedShape} Shape — Frets {currentPos.startFret}–{currentPos.endFret}</div>
          <div className="text-[9px] font-mono text-muted-foreground mb-2">
            {cagedShape === 'E' && 'Root on the low E string. The most common barre chord position.'}
            {cagedShape === 'D' && 'Root on the D string. Higher register, great for melodies and lead work.'}
            {cagedShape === 'C' && 'Root on the A string (higher position). Connects the A and G shapes.'}
            {cagedShape === 'A' && 'Root on the A string. Second most common barre chord position.'}
            {cagedShape === 'G' && 'Root on the low E string (lower position). Wide stretch connecting E and A.'}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground">
            {currentPos.notes.length} notes in this position. 
            {' '}Navigate: {shapes.map((s, i) => (
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
