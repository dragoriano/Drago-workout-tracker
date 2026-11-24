# Changelog

## [1.8.0] - 2026-11-24

### Added
- **Supersets & Giant Sets Workflow (`A1` / `A2` / `A3`)**: Group header bar showing round progress (`Round X/Y`) and shared round rest timer (`45s–180s`), clean split-on-unlink for 3+ giant sets, automatic round advance (`A1 -> A2 -> ... -> shared rest`) with jump banner, and superset-aware duration estimation.
- **Timed, Bodyweight & Assisted Tracking Modes**: Support for Timed Holds (`duration` seconds, inline hold stopwatch with `Start Hold` / `Stop & Log`, `-5s/+5s` steppers, `+5s` coach progression, and `duration` PRs), Bodyweight reps (weighted/unweighted with `+1 rep` overload), and Assisted lifts (`-weight` display and `-2.5` reduced assistance overload), across Active Workout, Program Editor, Quick Add, Custom Exercises, History, Session Editor, CSV export (`Tracking Mode`, `Duration (s)`), and Summary cards.
- **Program Sharing & Upgraded Summary Cards**: Individual program sharing via lazy-loaded `ProgramShareModal` (QR code, copyable `DRG2:` share code, JSON export, plain-text summary) and `ImportProgramModal` (QR camera scan, code/JSON paste with live preview, JSON file import, safe UUID remapping); upgraded `WorkoutSummaryPage` with `9:16` / `4:5` / `1:1` aspect ratio switcher, 4 card studio gradients (`Obsidian`, `Ember`, `Emerald`, `Steel`), mode/superset formatting, and inline feedback toasts.
- **GitHub Actions CI & Android Debug APK Release**: Added `.github/workflows/ci.yml` (`lint`, `test`, `build`, `build:android` asset check) and `.github/workflows/android-release.yml` (automated Java 21 + Android SDK debug APK build + GitHub Release attachment on `v*` tags), plus optional Supabase env guards so zero-secret CI builds boot cleanly offline.

### Changed
- **Release Metadata**: Bumped `package.json`, `package-lock.json`, Workbox `cacheId` (`dragotracker-v1.8.0`), `SettingsPage`, and Android (`versionCode 4`, `versionName "1.8.0"`).

## [1.7.0] - 2026-11-24

### Added
- **Estimated 1RM & Barbell Plate Calculator**: Live Epley `e1RM` tracking, training percentage strips in progress charts, Strength Benchmarks leaderboard, and a customizable kg/lbs barbell plate calculator.
- **Set Types & Effort Logging**: Per-set Working, Warmup (`W`), Drop (`D`), and Failure (`F`) tags plus `RPE` (`6–10`) / `RIR` (`0–4`) logging integrated into Smart Coach, PRs, 1RM math, Analytics, and History.
- **Muscle Recovery & Weekly Volume Tracker**: 7-group weekly effective set targets and recovery readiness `%` surfaced across Home, Analytics, and Active Workout.
- **Custom Exercise Library & Quick Freestyle Workout**: IndexedDB v4 `customExercises` store, JSON/Supabase backup support, unified search/swap integration, `/quick-workout` freestyle sessions, and saving freestyle sessions as programs.
- **Smart Auto-Syncing Goals & Body Trends**: Auto-updating goals linked to exercise e1RM/weight, monthly workouts, weekly volume, streaks, and body weight, plus 7-day moving averages and weekly rate-of-change trends.
- **Session Comparison & PR Progression Timeline**: Side-by-side session diffs (`Volume`, `Sets`, `Duration`, per-exercise deltas) and a filterable chronological PR milestone timeline.
- **Warm-Up Set Ramp Generator & One-Handed Gym Controls**: Plate-rounded 40%/60%/80% warm-up generator, `±` quick weight/rep steppers, and live per-exercise rest timer presets (`45s–180s`).
- **Workout History Editor & CSV Export**: Past-session editor with automatic volume & PR recalculation and RFC-4180 CSV export across History, Analytics, and Settings.

### Changed
- **Light/Dark Theme Polish**: Improved light-mode muted text contrast (`--text-muted`), theme-aware card borders and chart bars (`MuscleGroupChart`, `ProgressRing`), responsive calendar cards, and dark-only calendar icon scheme scoping.
- **Release Metadata**: Bumped `package.json`, `package-lock.json`, Workbox `cacheId` (`dragotracker-v1.7.0`), `SettingsPage`, and Android (`versionCode 3`, `versionName "1.7.0"`).

## [1.6.0] - 2026-11-23

### Added
- Granular Vite code splitting, CSS ambient backdrop (replacing 10 MB bundled MP4s), route-level lazy loading, strict TypeScript null checks, timestamp-based rest timer, voice countdown setting, extracted analytics/coach/session components, and unit test suite.
