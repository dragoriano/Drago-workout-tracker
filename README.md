# Dragoriano Workout Tracker

Offline-first gym workout tracker built with React 19, TypeScript, Vite 6, Tailwind CSS v4, Zustand, and IndexedDB (`idb`), with optional Supabase cloud backup and Capacitor Android packaging.

## Features

- **Offline-first local storage**: Programs, workout sessions, personal records, goals, and body measurements stored locally in IndexedDB.
- **Smart Coach progression**: Automatic progression (`+2.5`), failure retries, auto-deloads (`10–15%`), scheduled deload days (`60%`), and volume-spike warnings (`>20%`).
- **495-exercise database & split wizard**: Preset splits, AI-guided split recommendations, superset linking, drag-and-drop reordering, and mid-session exercise swaps.
- **Rest timer & feedback**: Timestamp-based rest countdown, audio chime, optional 5-second voice countdown, and haptic vibration.
- **Analytics & sharing**: Activity heatmap, streaks, 7-day volume & muscle-group charts, 9:16 PNG workout summary cards, JSON export/import, and gzipped QR program transfer.
- **Cloud sync**: Optional Google OAuth + `user_backups` sync via Supabase with empty-database recovery protection.

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
