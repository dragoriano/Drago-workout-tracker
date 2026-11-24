# Dragoriano Workout Tracker (`v1.7.0`)

Offline-first gym workout tracker built with React 19, TypeScript, Vite 6, Tailwind CSS v4, Zustand, and IndexedDB (`idb`), with optional Supabase cloud backup and Capacitor 8 Android packaging.

## Features

- **Offline-first IndexedDB v4 storage**: Programs, sessions, PRs, custom exercises, goals, and body measurements persisted locally with JSON backup import/export, RFC-4180 CSV history export, gzipped QR program sharing, and optional Supabase cloud sync.
- **Smart Coach progression**: Automatic `+2.5` progressive overload, RPE-aware consolidation holds (`RPE >= 9.5`), failure retries, auto-deloads (`10–15%`), scheduled deload days (`60%`), and volume-spike warnings (`>20%`).
- **Set types & effort logging**: Tag sets as Working, Warmup (`W`), Drop (`D`), or Failure (`F`) with per-set RPE (`6–10`) or RIR (`0–4`) logging; warmups automatically exclude from PRs, estimated 1RM, and progressive overload.
- **Strength tools & one-handed gym controls**: Live Epley Estimated 1RM tracking, training percentage tables, customizable barbell plate calculator, one-tap plate-rounded Warm-Up Set Ramp Generator, `±` weight/rep steppers, and live per-exercise rest timer presets (`45s–180s`).
- **495-exercise database, Custom Library & Quick Freestyle**: Built-in catalog + custom exercise creator/editor synced to IndexedDB/backups, AI-guided split wizard, supersets, drag-and-drop reordering, mid-session swaps, and ad-hoc `/quick-workout` mode with one-tap "Save as Program".
- **Muscle recovery & weekly volume tracker**: 7-group weekly effective set tracking against hypertrophy ranges and recovery readiness `%` surfaced across Home, Analytics, and Active Workout.
- **Smart auto-syncing goals & body trends**: Link goals directly to exercise e1RM, max weight, monthly workouts, 7-day volume, streaks, or body weight (gain & loss) alongside trailing 7-day moving averages and weekly body-weight rates.
- **Analytics, session comparison & history editing**: Activity heatmap, streaks, side-by-side Session Comparison diffs, chronological PR Progression Timeline, 9:16 PNG workout summary cards, and full past-session editing with automatic volume and PR recalculation.

## Setup

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   ```env
   VITE_BASE_PATH="/"
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```
   > **Supabase Security Note:** Ensure Row-Level Security (RLS) is enabled on the `user_backups` table so authenticated users can only read and write rows where `auth.uid() = user_id`.

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start Vite dev server on port `3000` |
| `npm run lint` | Run TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run unit tests via `tsx --test` |
| `npm run build` | Build production web PWA bundle into `dist/` |
| `npm run build:android` | Build Android web assets (`--mode android`) and run `npx cap sync` |
| `npm run preview` | Preview the built `dist/` bundle locally |
