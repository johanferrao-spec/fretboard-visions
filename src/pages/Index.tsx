import { useFretboard } from '@/hooks/useFretboard';
import Fretboard from '@/components/Fretboard';
import ControlPanel from '@/components/ControlPanel';
import NoteInfoPanel from '@/components/NoteInfoPanel';

const Index = () => {
  const fb = useFretboard();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground tracking-tight">
          <span className="text-primary">Fret</span>Flow
        </h1>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Guitar Fretboard Visualizer
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Side panel */}
        <aside className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border p-4 overflow-y-auto">
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
            noteColors={fb.noteColors}
            updateNoteColor={fb.updateNoteColor}
          />
        </aside>

        {/* Fretboard area */}
        <main className="flex-1 p-4 flex items-center">
          <Fretboard
            maxFrets={fb.maxFrets}
            primaryScale={fb.primaryScale}
            secondaryScale={fb.secondaryScale}
            secondaryEnabled={fb.secondaryEnabled}
            activePrimary={fb.activePrimary}
            noteColors={fb.noteColors}
            onNoteClick={fb.setSelectedNote}
          />
        </main>
      </div>

      {/* Note info modal */}
      <NoteInfoPanel
        note={fb.selectedNote}
        noteColors={fb.noteColors}
        onClose={() => fb.setSelectedNote(null)}
      />
    </div>
  );
};

export default Index;
