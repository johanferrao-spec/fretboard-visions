---
name: Courses Mode
description: Educator-built guitar lessons; courses contain many tabs/lessons with full Fretboard reuse, bar-window editor, global tracks, and shared Cloud library
type: feature
---
# Courses Mode

Top-level "🎓 Courses" tab opens a full-screen module that slides in from the right (300ms ease-out). Back arrow reverses the animation.

## Data model
- `courses` — collection metadata: title, description, default key/tempo/time-sig.
- `course_tabs` — many lessons per course: title, position, key, time_sig, tempo, `phrase` (notes), `chord_track`, `key_track`, `tempo_track` (Logic-style global lanes).
- RLS: anyone signed in reads any course/tab; only owners can write.

## Routes
- `/courses` — library (course cards, plus button creates course)
- `/courses/:courseId` — lesson list inside a course
- `/courses/:courseId/lessons/:tabId/edit` — Creator (lesson editor)
- `/courses/:courseId/lessons/:tabId` — Player (mic-listening fretboard chase)

## Creator
- Full **identical Fretboard** (reused from main page) on top, used both for visualization AND note input via Fretboard's `arpAddMode` mechanism (multi-select frets across strings = chord).
- **Insert** button below fretboard commits staged frets to the next available beat slot on the tab timeline.
- **Bar window**: 4 bars visible (1 before + 2 main + 1 after for anacrusis); cycle arrows jump ±1 bar. Cells outside the main 2-bar region are tinted.
- **Global tracks** above tab: chords, key changes, tempo changes — click empty cell to add, click entry to edit/delete.
- **Scale selector**: same UX as main page ControlPanel but single-scale (no dual). `CourseScaleSelector` component.
- **Playback**: `useCourseGuitarPlayer` (Tone.js PolySynth) plays `phrase.notes` at current tempo; playhead drawn on `TabEditor`.

## Player
- Uses the real `<Fretboard />` (not bespoke) with `tabVisNotes` showing only current target + upcoming preview.
- `usePitchDetector` autocorrelation for single notes (±25¢) and FFT for ≥2 chord-tone match.

## Key files
- `src/lib/courseTypes.ts`
- `src/hooks/useCourses.ts` — `useCourses` (collections) + `useCourseTabs` (lessons)
- `src/hooks/useCourseGuitarPlayer.ts` — Tone.js tab playback
- `src/hooks/usePitchDetector.ts`
- `src/components/Courses/TabEditor.tsx` — bar-window aware, playhead support
- `src/components/Courses/GlobalTracksEditor.tsx` — chord/key/tempo lanes
- `src/components/Courses/CourseScaleSelector.tsx` — single-scale selector
- `src/pages/Courses.tsx`, `CourseDetail.tsx`, `CourseCreator.tsx`, `CoursePlayer.tsx`, `Auth.tsx`

## Slide-in animation
All Courses pages mount with `translateX(100%)` then animate to `0` after a double `requestAnimationFrame`, so the slide-in mirrors the slide-out direction.
