# Changelog

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
