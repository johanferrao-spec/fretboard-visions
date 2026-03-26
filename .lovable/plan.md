

## Plan: Multi-Feature Refinement

### 1. Swap Position Focus and Degrees Active buttons
**File:** `src/components/Fretboard.tsx` (lines ~620-654)
Swap the render order so "Degrees Active" appears first (left), then "Position focus" appears to its right.

### 2. Default arpeggio to Major triad
**File:** `src/components/ChordReference.tsx` (ArpeggioPositionsPanel)
Initialize `selectedArp` to `'Major'` instead of `null`, and trigger initial position generation on mount via `useEffect`.

### 3. Add standard mode selector to timeline panel
**File:** `src/components/SongTimeline.tsx`
Replace the `major`/`minor` toggle with a dropdown/button group for all 7 standard modes: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian.

**File:** `src/lib/music.ts`
Extend `KeyMode` type to include all 7 modes. Update `getDiatonicChords()` to compute correct diatonic chord qualities per mode (e.g., Dorian IV = Major, Dorian i = Minor, etc.). Each mode rotates the major scale's chord qualities accordingly.

**File:** `src/hooks/useFretboard.ts`, `src/pages/Index.tsx`
Update `keyMode` state type and pass-through.

### 4. Move path toggle and overlay slider to left of root notes
**File:** `src/components/ChordReference.tsx` (ArpeggioPositionsPanel, lines ~1045-1070)
Reorder layout so the overlay slider and Path button render inline with the root selector row, positioned to the right of the root notes but before any right-aligned content. Currently they're in `ml-auto` position — move them between root selector and the `ml-auto` area.

### 5. Bigger arpeggio diagrams with 6-per-page pagination + prev/next cycling
**File:** `src/components/ChordReference.tsx` (ArpeggioPositionsPanel, lines ~1130-1185)
- Change `VOICINGS_PER_PAGE` to 6 for arpeggios
- Make `MiniArpDiagram` larger (increase `w`/`h` constants)
- Add page-based navigation with `◀`/`▶` arrows
- Add two large "prev/next position" buttons that cycle individual voicings (rendered below the main fretboard area, passed up via callback or rendered in the panel)

**File:** `src/pages/Index.tsx`
Add two large prev/next arpeggio position cycling buttons between the fretboard and the chord panel.

### 6. Fix arpeggio note ordering — all degrees must be played in sequence
**File:** `src/lib/music.ts` (generateArpeggioPositions, buildStaticNotes, buildLinearNotes)
The current approach picks notes by position proximity. Update to enforce that EVERY interval degree in the formula is represented (no skipping). For a Major 9 (`[0, 4, 7, 11, 14]`), the arpeggio must play R, 3, 5, 7, 9 in ascending order in each octave. Validate generated positions by checking all unique interval classes are present and reject positions that skip degrees.

### 7. Add/delete custom voicings for chords and arpeggios with localStorage persistence
**Files:** `src/components/ChordReference.tsx`, `src/lib/music.ts`

- Add an "Add" button (similar to "What's This?" mode) that enters a mode where the user clicks frets on the fretboard to define a new voicing
- Add a "Save" button to commit the custom voicing
- Add a delete button (×) on each custom voicing
- Store custom voicings in `localStorage` under keys like `custom-chord-voicings` and `custom-arp-voicings`
- On load, merge custom voicings with curated ones
- Custom voicings persist across sessions (localStorage survives between prompts)

**State management:** Add `customChordVoicings` and `customArpVoicings` state in `useFretboard.ts` or `ChordReference.tsx`, initialized from localStorage, and saved back on change.

### Technical Details

**Mode-aware diatonic chords (task 3):**
Each mode rotates the chord quality pattern. For standard modes built from the major scale:
- Ionian: Maj, min, min, Maj, Maj(dom), min, dim
- Dorian: min, min, Maj, Maj(dom), min, dim, Maj
- Phrygian: min, Maj, Maj(dom), min, dim, Maj, min
- etc.

This is equivalent to rotating `DIATONIC_QUALITIES_MAJOR` by the mode degree offset.

**Arpeggio degree validation (task 6):**
After generating positions, filter out any position where `Set(notes.map(n => midiToIntervalIdx))` doesn't cover all formula intervals (mod 12). This ensures no degree is skipped.

**Custom voicing persistence (task 7):**
```
localStorage key: 'mf-custom-chord-voicings' → Record<root, Record<chordType, ChordVoicing[]>>
localStorage key: 'mf-custom-arp-positions' → Record<root, Record<arpType, ArpeggioPosition[]>>
```
Merged at render time with curated voicings. "Add" mode reuses the identify/click-on-fretboard pattern already built for "What's This?".

