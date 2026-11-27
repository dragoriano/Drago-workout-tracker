# Dragoriano Workout Tracker (`v1.9.0`)

Offline-first gym workout tracker built with React 19, TypeScript, Vite 6, Tailwind CSS v4, Three.js, Framer Motion, Zustand, and IndexedDB (`idb`), with optional Supabase cloud backup and Capacitor 8 Android packaging.

## Features

- **Three.js 3D Studio Splash Screen**: Real-time extruded 3D title with studio PBR lighting, bloom, theme-synced accents from Settings, responsive mobile/desktop framing, 5-second auto-dismiss with tap-anywhere-to-skip, and automatic fallback when WebGL is unavailable or `prefers-reduced-motion` is enabled.
- **Interactive Anatomical Muscle Recovery Map**: Interactive front/back body silhouette across Home, Analytics, and Quick-Add with a **Readiness** vs. **Weekly Volume Heatmap** toggle, tap-to-inspect muscle recovery countdown & recent exercises drawer, and one-tap **Start Recommended Freestyle**.
- **Live In-Session PR Celebrations & History Peek**: Instant mid-session Weight, Est. 1RM, and Duration PR detection with animated celebration banners, confetti bursts, sound/haptics, and a collapsible **Last-3-Sessions History Peek** inside every exercise card.
- **Pro Rest Timer & Web Audio / Haptic Engine**: Timestamp-accurate background countdown with Web Audio `3-2-1` chimes and PR fanfares, haptic feedback, optional speech countdown, `-15s / +15s / +30s` and preset adjustments, pause/resume, and a docked mini-pill mode.
- **Strength Standards, Training Balance & Milestones Trophy Case**: Big 5 bodyweight-relative classifications (`Untrained → Novice → Intermediate → Advanced → Elite`) with automatic `kg`/`lbs` unit normalization, **SBD Total**, inline bodyweight quick-logging, 30-day **Push vs Pull** and **Upper vs Lower** symmetry ratios, and 12 local-first Consistency, Volume, and Strength achievement badges in Goals.
- **Offline-first IndexedDB v4 storage**: Programs, sessions, PRs, custom exercises, goals, and body measurements persisted locally with JSON backup import/export, RFC-4180 CSV history export, gzipped QR/share-code program sharing, and optional Supabase cloud sync.
- **Supersets & Giant Sets (`A1` / `A2` / `A3`)**: Link 2+ exercises into contiguous Superset or Giant Set blocks with round progress counters, automatic advance across exercises without prematurely starting rest, and a shared round rest timer (`45s–180s`).
- **Timed, Bodyweight & Assisted Set Modes**: Track Timed Holds (`45s` targets with an in-card stopwatch + `-5s/+5s` steppers and duration PRs), Bodyweight reps (with optional `+added` weight and `+1 rep` progression), and Assisted machine/band lifts (less assistance = overload), alongside standard Weighted exercises.
- **Smart Coach progression**: Mode-aware progressive overload (`+2.5` load, `+1 rep` for bodyweight, `-2.5` reduced assistance, `+5s` timed holds), RPE-aware consolidation holds (`RPE >= 9.5`), failure retries, auto-deloads (`10–15%`), scheduled deload days (`60%`), and volume-spike warnings (`>20%`).
- **Set types & effort logging**: Tag sets as Working, Warmup (`W`), Drop (`D`), or Failure (`F`) with per-set RPE (`6–10`) or RIR (`0–4`) logging; warmups automatically exclude from PRs, estimated 1RM, and progressive overload.
- **Strength tools & one-handed gym controls**: Live Epley Estimated 1RM tracking, training percentage tables, customizable barbell plate calculator, one-tap plate-rounded Warm-Up Set Ramp Generator, `±` weight/rep/duration steppers, and live per-exercise rest timer presets (`45s–180s`).
- **495-exercise database, Custom Library & Quick Freestyle**: Built-in catalog + custom exercise creator/editor synced to IndexedDB/backups, AI-guided split wizard, drag-and-drop reordering, mid-session swaps, and ad-hoc `/quick-workout` mode with one-tap "Save as Program".
- **Program Sharing & Summary Cards**: Share or import individual programs via gzipped `DRG2:` QR codes, copyable share codes, or `.json` files (with live preview and safe UUID remapping), and export PNG workout summary cards in `9:16`, `4:5`, or `1:1` ratios with studio theme presets (`Obsidian`, `Ember`, `Emerald`, `Steel`).
- **Smart auto-syncing goals & body trends**: Link goals directly to exercise e1RM, max weight, monthly workouts, 7-day volume, streaks, or body weight (gain & loss) alongside trailing 7-day moving averages and weekly body-weight rates.
- **Analytics, session comparison & history editing**: Activity heatmap, streaks, side-by-side Session Comparison diffs, chronological PR Progression Timeline, and full past-session editing with automatic volume and PR recalculation.

## Setup

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Optional for Cloud Sync — copy `.env.example` to `.env` and fill in your Supabase credentials (local offline IndexedDB mode works even when omitted):
   ```env
   VITE_BASE_PATH="/"
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```
   > **Supabase Security Note:** Ensure Row-Level Security (RLS) is enabled on the `user_backups` table so authenticated users can only read and write rows where `auth.uid() = user_id`.

## GitHub Actions CI & Android APK Releases

- **CI Verification (`.github/workflows/ci.yml`)**: Runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm run build:android` on pushes/PRs to `main` and verifies Android assets exclude `sw.js` and `.mp4` files.
- **Android Debug APK Release (`.github/workflows/android-release.yml`)**: On `v*` tag pushes or manual dispatch, builds `app-debug.apk` cleanly on Ubuntu with Java 21 + Android SDK, uploads the APK artifact, and attaches it to the corresponding GitHub Release.
  - To enable Supabase Cloud Sync inside CI-built APKs, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **GitHub Repository Settings → Secrets and variables → Actions** (both are optional; offline tracking works without them).

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start Vite dev server on port `3000` |
| `npm run lint` | Run TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run unit tests via `tsx --test` (126 tests across 55 suites) |
| `npm run build` | Build production web PWA bundle into `dist/` |
| `npm run build:android` | Build Android web assets (`--mode android`) and run `npx cap sync` |
| `npm run preview` | Preview the built `dist/` bundle locally |
