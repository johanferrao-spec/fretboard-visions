import { useFretboard } from '@/hooks/useFretboard';
import type { ChordSelection } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import ControlPanel from '@/components/ControlPanel';
import NoteInfoPanel from '@/components/NoteInfoPanel';
import ChordReference from '@/components/ChordReference';
import type { NoteName } from '@/lib/music';

const Index = () => {
  const fb = useFretboard();

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
              maxFrets={fb.maxFrets}
              setMaxFrets={fb.setMaxFrets}
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
              displayMode={fb.displayMode}
              setDisplayMode={fb.setDisplayMode}
              orientation={fb.orientation}
              setOrientation={fb.setOrientation}
              degreeColors={fb.degreeColors}
              setDegreeColors={fb.setDegreeColors}
              clearFretboard={fb.clearFretboard}
            />
          </div>
        </aside>

        {/* Main area */}
        <main className={`flex-1 flex ${isVertical ? 'flex-row' : 'flex-col'} min-w-0 overflow-auto`}>
          {/* Fretboard */}
          <div className={`${isVertical ? 'flex-1' : ''} p-4 flex items-center justify-center`}>
            <Fretboard
              maxFrets={fb.maxFrets}
              primaryScale={fb.primaryScale}
              secondaryScale={fb.secondaryScale}
              secondaryEnabled={fb.secondaryEnabled}
              activePrimary={fb.activePrimary}
              noteColors={fb.noteColors}
              onNoteClick={fb.setSelectedNote}
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
              noteMarkerSize={fb.noteMarkerSize}
              degreeColors={fb.degreeColors}
              disabledDegrees={fb.disabledDegrees}
              toggleDegree={fb.toggleDegree}
              setShowFretBox={fb.setShowFretBox}
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
