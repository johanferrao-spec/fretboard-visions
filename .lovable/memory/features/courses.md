---
name: Courses Mode
description: Educator-built interactive guitar lessons with mic listening, fretboard chase, and shared Cloud library
type: feature
---
# Courses Mode

Top-level tab right of Tab Visualiser. Clicking it navigates to `/courses` (a separate page that slides in from the right with a 300ms ease-out translate-x animation, covering the entire screen). Back arrow on the top-left reverses the animation.

## Pages
- `/auth` — sign-in / sign-up (email + password, Google OAuth via `lovable.auth.signInWithOAuth`). Auto-confirm email is ON. HIBP password check ON.
- `/courses` — library grid of saved courses + plus icon (top right) → Creator. Empty state shown when no courses.
- `/courses/new` — Creator: title, key root, key quality (Major/Minor), time signature, tempo, then the **TabEditor** component (6-string × 16th-note grid). Click any cell to add a note; double-click to edit fret. Right edge of duration bar is draggable to resize.
- `/courses/:id` — Player: shows ONLY the next expected note(s) on a compact fretboard with glowing pulse. Listens via mic (autocorrelation pitch detection, `usePitchDetector`) and advances on match. Chords advance when ≥2 expected pitch classes are detected via FFT peaks.

## Data
- Tables: `profiles` (display_name, avatar_url), `user_roles` (admin/user), `courses` (title, key_root, key_quality, time_signature, tempo, phrase jsonb).
- RLS: anyone signed in can read all courses (shared library); only owners can edit/delete.
- Auto-trigger creates profile + default `user` role on signup.

## Duration bar colors
- Green = diatonic note in selected key
- Blue = chord (≥2 notes at same beatIndex)
- Orange = non-diatonic note
- Defined in `NOTE_KIND_COLOR` (`src/lib/courseTypes.ts`)

## Key files
- `src/lib/courseTypes.ts` — types, `GRID_PER_BEAT = 4`, color constants
- `src/hooks/useCourses.ts` — CRUD against Cloud
- `src/hooks/usePitchDetector.ts` — autocorrelation (audio.js style) + FFT chord-tone detection
- `src/components/Courses/TabEditor.tsx` — 6-string grid + duration bars
- `src/pages/Auth.tsx`, `Courses.tsx`, `CourseCreator.tsx`, `CoursePlayer.tsx`
