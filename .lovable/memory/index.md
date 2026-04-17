# Project Memory

## Core
- Dark theme (Shreddage 3 inspired), Fredoka font, realistic logarithmic fret spacing.
- Scale degree colors: 1=green, 2=grey, 3=red, 4=pink, 5=blue, 6=turquoise, 7=magenta (syncs to root).
- Voicings: max 4-fret span. Shell/Drop2/Drop3 voicings strictly forbid open strings. Normalize to lowest neck position.
- Barres: z-[2] rounded rects, endpoint markers only. Created strictly via vertical drag.
- Master opacity slider universally controls arpOverlay, ghostNote, and secondary scale opacities.
- Persistence: Store custom voicings/arpeggios in localStorage (v2 relative templates).
- MIDI Audio Engine: Tone.js drives synchronized songwriting timeline looping playback.
- Position Focus acts as an absolute filter across all modes.
- Backing Track mode expands the bottom area smoothly to reveal a Logic-Pro DAW; piano roll is a separate floating window.
- Courses tab opens a separate full-screen page (slides in from right). Educators create interactive tab lessons with mic-based pitch detection. Auth required.

## Memories
- [Aesthetic & Styling](mem://style/aesthetic) — Visual theme, Fredoka font, glowing indicators, element sizes
- [Coloring System](mem://theory/coloring-system) — Specific scale degree color mapping and legend interactions
- [Dual Scale Behavior](mem://features/dual-scale) — Automatic fallback to primary scale
- [Chord Identification](mem://features/chord-identification) — 'What's This' mode logic, 12-pitch class iteration, vertical barres
- [Voicing Constraints](mem://theory/voicing-constraints) — 4-fret limits, no open strings on specific voicings, deduplication
- [Note Interaction Menu](mem://features/note-interaction-menu) — Context menu for chords/arpeggios on note click
- [Tuning Engine](mem://features/tunings) — 12 alternate presets and dynamic fretboard recalculation
- [MIDI Audio Engine](mem://features/midi-engine) — Tone.js synthesis, playback looping, synced accents
- [Backing Track DAW](mem://features/backing-track) — Logic-Pro layout, AI session players, separate piano roll, save/load
- [Courses Mode](mem://features/courses) — Educator interactive lessons, mic pitch detection (autocorrelation), Cloud-shared library
- [Layout Structure](mem://ui/layout-structure) — h-screen overflow-hidden, constrained heights for scrollability
- [Root Selector](mem://ui/root-selector) — E-to-D natural note ordering and accidental placement
- [Toolbar Layout](mem://ui/toolbar-layout) — Global UI controls and master slider functionality
- [Songwriting Timeline](mem://features/songwriting-timeline) — Draggable playhead, diatonic coloring, interactions
- [Progression Analyser](mem://features/progression-analyser) — Split-view harmonic analysis and context explanations
- [Scale Organization](mem://theory/scale-organization) — Thematic groupings and hover preview logic
- [Volume Control](mem://ui/volume-control) — Dynamic physical slider with decibel mapping
- [Custom Persistence](mem://features/custom-persistence) — LocalStorage keys, v2 relative templates for arpeggios
- [Project Defaults](mem://project/defaults) — Default keys, beginner mode, and default toggle states
- [Arpeggio Logic](mem://features/arpeggio-logic) — 4-col diagram grid, Static/Transit categories, relative shapes
- [Fretboard Interaction](mem://features/fretboard-interaction) — Position focus filtering, barre preservation, string label toggles
- [Beginner Mode](mem://features/beginner-mode) — 3x2 preset grid, open chords layout, fret 0 marker removal
- [Barre Rendering](mem://ui/barre-rendering) — Visual specs and constraints for barre chords on the fretboard
- [Scale Selector](mem://ui/scale-selector) — Minor category Aeolian shortcut
- [Tab Visualiser](mem://features/tab-visualiser) — Gemini OCR integration and Digital Tab Timeline layout
- [Color Selection](mem://style/color-selection) — 3-column grid UI for scale colors
- [Chord Library](mem://features/chord-library) — Stretch sorting, normalization, strict naming conventions
- [Voicing Normalization](mem://theory/voicing-normalization) — Logic for octave shifting shapes closer to the nut
- [Harmonization Logic](mem://theory/harmonization-logic) — Dynamic 3rd stacking and mode-aware chord qualities
- [Diatonic Harmony](mem://features/diatonic-harmony) — 7 modes, Drop 2/3 string roots, 6-string diagrams
