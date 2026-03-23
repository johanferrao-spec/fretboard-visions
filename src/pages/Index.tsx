import { useState } from 'react';
import { useFretboard } from '@/hooks/useFretboard';
import type { ChordSelection } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import ControlPanel from '@/components/ControlPanel';
import NoteInfoPanel from '@/components/NoteInfoPanel';
import ChordReference from '@/components/ChordReference';
import type { NoteName } from '@/lib/music';
import { TUNING_PRESETS, NOTE_NAMES, type TuningPreset } from '@/lib/music';

const Index = () => {
  const fb = useFretboard();
  const [showCustomTuning, setShowCustomTuning] = useState(false);
  const [customTuningName, setCustomTuningName] = useState('');
  const [customTuningNotes, setCustomTuningNotes] = useState<number[]>([4, 9, 2, 7, 11, 4]);

  const handleApplyChord = (chord: ChordSelection) => {
    fb.setActiveChord(chord);
  };

  const handleApplyArpeggio = (root: NoteName, arpeggioName: string) => {
    fb.setPrimaryScale({ mode: 'arpeggio', root, scale: arpeggioName });
    fb.setActiveChord(null);
  };

  const handleApplySecondaryArpeggio = (root: NoteName, arpeggioName: string) => {
    fb.setSecondaryEnabled(true);
    fb.setSecondaryScale({ mode: 'arpeggio', root, scale: arpeggioName });
  };

  const isVertical = fb.orientation === 'vertical';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-display font-bold text-foreground tracking-tight">
          <span className="text-primary">Fret</span>Flow
        </h1>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Guitar Fretboard Visualizer
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Side panel — controls */}
        <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto">
          <div className="p-3">
            <ControlPanel
              primaryScale={fb.primaryScale}
              setPrimaryScale={fb.setPrimaryScale}
              secondaryScale={fb.secondaryScale}
              setSecondaryScale={fb.setSecondaryScale}
              secondaryEnabled={fb.secondaryEnabled}
              setSecondaryEnabled={fb.setSecondaryEnabled}
              activePrimary={fb.activePrimary}
              setActivePrimary={fb.setActivePrimary}
              secondaryOpacity={fb.secondaryOpacity}
              setSecondaryOpacity={fb.setSecondaryOpacity}
              secondaryColor={fb.secondaryColor}
              setSecondaryColor={fb.setSecondaryColor}
              primaryColor={fb.primaryColor}
              setPrimaryColor={fb.setPrimaryColor}
            />
          </div>
        </aside>

        {/* Main area */}
        <main className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} min-w-0 overflow-auto`}>
          {/* Toolbar above fretboard */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap shrink-0">
            {/* Orientation toggle */}
            <button
              onClick={() => fb.setOrientation(fb.orientation === 'horizontal' ? 'vertical' : 'horizontal')}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {fb.orientation === 'horizontal' ? '⬇ Vertical' : '➡ Horizontal'}
            </button>

            {/* Display mode toggle */}
            <button
              onClick={() => fb.setDisplayMode(fb.displayMode === 'notes' ? 'degrees' : fb.displayMode === 'degrees' ? 'fingers' : 'notes')}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {fb.displayMode === 'notes' ? '♪ Notes' : fb.displayMode === 'degrees' ? '° Degrees' : '✋ Fingers'}
            </button>

            {/* Degrees active toggle removed — now lives in fretboard key legend */}

            {/* Fret count */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Frets:</span>
              <input
                type="range" min={12} max={24} value={fb.maxFrets}
                onChange={e => fb.setMaxFrets(Number(e.target.value))}
                className="w-20 accent-primary"
              />
              <span className="text-[10px] font-mono text-muted-foreground w-5">{fb.maxFrets}</span>
            </div>

            {/* Reset */}
            <button
              onClick={fb.clearFretboard}
              className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Fretboard */}
          <div className={`${isVertical ? 'flex-1' : ''} p-4 flex items-center justify-center`}>
            <Fretboard
              maxFrets={fb.maxFrets}
              primaryScale={fb.primaryScale}
              secondaryScale={fb.secondaryScale}
              secondaryEnabled={fb.secondaryEnabled}
              activePrimary={fb.activePrimary}
              noteColors={fb.noteColors}
              onNoteClick={fb.identifyMode ? (note) => {} : fb.setSelectedNote}
              displayMode={fb.displayMode}
              disabledStrings={fb.disabledStrings}
              onToggleString={fb.toggleStringDisabled}
              secondaryOpacity={fb.secondaryOpacity}
              secondaryColor={fb.secondaryColor}
              primaryColor={fb.primaryColor}
              activeChord={fb.activeChord}
              orientation={fb.orientation}
              showFretBox={fb.showFretBox}
              fretBoxStart={fb.fretBoxStart}
              fretBoxSize={fb.fretBoxSize}
              setFretBoxStart={fb.setFretBoxStart}
              setFretBoxSize={fb.setFretBoxSize}
              fretBoxStringStart={fb.fretBoxStringStart}
              fretBoxStringSize={fb.fretBoxStringSize}
              setFretBoxStringStart={fb.setFretBoxStringStart}
              setFretBoxStringSize={fb.setFretBoxStringSize}
              noteMarkerSize={fb.noteMarkerSize}
              degreeColors={fb.degreeColors}
              setDegreeColors={fb.setDegreeColors}
              disabledDegrees={fb.disabledDegrees}
              toggleDegree={fb.toggleDegree}
              setShowFretBox={fb.setShowFretBox}
              identifyMode={fb.identifyMode}
              identifyFrets={fb.identifyFrets}
              setIdentifyFrets={fb.setIdentifyFrets}
              identifyRoot={fb.identifyRoot}
            />
          </div>

          {/* Chords panel — below (horizontal) or right side (vertical) */}
          <div className={`border-${isVertical ? 'l' : 't'} border-border shrink-0 ${isVertical ? 'w-72 overflow-y-auto' : ''}`}>
            <ChordReference
              activeChord={fb.activeChord}
              setActiveChord={fb.setActiveChord}
              showCAGED={fb.showCAGED}
              setShowCAGED={fb.setShowCAGED}
              cagedShape={fb.cagedShape}
              setCagedShape={fb.setCagedShape}
              cagedRoot={fb.primaryScale.root}
              identifyMode={fb.identifyMode}
              setIdentifyMode={fb.setIdentifyMode}
              identifyFrets={fb.identifyFrets}
              setIdentifyFrets={fb.setIdentifyFrets}
              degreeColors={fb.degreeColors}
              identifyRoot={fb.identifyRoot}
              setIdentifyRoot={fb.setIdentifyRoot}
            />
          </div>
        </main>
      </div>

      <NoteInfoPanel
        note={fb.selectedNote}
        noteColors={fb.noteColors}
        onClose={() => fb.setSelectedNote(null)}
        onApplyChord={handleApplyChord}
        onApplyArpeggio={handleApplyArpeggio}
        onApplySecondaryArpeggio={handleApplySecondaryArpeggio}
        activeScale={fb.primaryScale}
      />
    </div>
  );
};

export default Index;
