# Findings & Decisions: Dragoriano Workout Tracker

## Requirements

- Setup Antigravity IDE using `planning-with-files` skill.
- Support "Dragoriano workout tracker" development.
- Adhere to Manus-style file-based planning (task_plan.md, findings.md, progress.md).

## Research Findings

- The skill `planning-with-files` is successfully installed in the workspace at `.agent/skills/planning-with-files`.
- Project uses Firebase (Firestore, Functions, possibly Hosting) and Supabase.
- Core stack: React 19, Vite 6, Tailwind CSS v4, Motion, Zustand.
- Already has `vite-plugin-pwa` configured.
- User request: Full-fledged Android APK, "no wrapper or similar."
- Technological Assessment:
  - **Capacitor**: Best balance of speed and "native feel." Provides APK, splash screen, icons, and native API access. Technically uses a WebView but is the modern standard for "premium" web-to-native transitions.
  - **React Native**: Truly native components (no WebView). Requires a complete UI rewrite (switching `div`/`span` to `View`/`Text`). Not recommended for keeping current design.
  - **PWA**: Current state. Not an APK, lacks deep native integration (e.g., proper splash screen, app store potential).
- **Decision**: Propose Capacitor as the "Premium Hybrid" solution to meet the "full-fledged" requirement.

## Technical Decisions

| Decision               | Rationale                                                                        |
|------------------------|----------------------------------------------------------------------------------|
| Workspace Installation | Method 1 from user prompt. Better for team collaboration.                         |
| Use PowerShell         | Metadata confirms OS is Windows.                                                 |
| Use Capacitor for APK | Industry standard for high-performance React-to-Android transitions.             |
| Relative Asset Paths   | Required for APKs to resolve assets correctly on the device filesystem.           |

## Issues Encountered

| Issue                       | Resolution                                                              |
|-----------------------------|-------------------------------------------------------------------------|
| Bash commands (`rm -rf`)      | Switched to `Remove-Item` for Windows.                                  |
| Unix `cp -r` pathing        | Used `Copy-Item` with full quoted paths.                                |
| Android Build Requirements  | Installed `@capacitor/status-bar` and `@capacitor/app` for native flow. |

## Resources

- Skill repo: `https://github.com/OthmanAdi/planning-with-files.git`
- Project root: `d:\Antigravity_Dev\Dragoriano workout tracker`
- AI Studio app: `https://ai.studio/apps/deb5a424-6ae4-4f4e-88b5-d8cc9bc3bc33`

## Visual/Browser Findings

- Found that previously registered service workers on `localhost:3000` intercept dynamic development requests (like `main.tsx` and HMR endpoints) under Vite dev server, causing `TypeError: Failed to fetch` and browser crash.
- Resolved this by adding an auto-cleanup block in `src/main.tsx` that triggers on `import.meta.env.DEV` to clear registrations and refresh the page automatically.
- Discovered an auto-sync race condition: launching the app with an empty local database (due to clearing site data or reinstalling the WebAPK) caused the app to automatically call `pushToSupabase()`, overwriting the user's remote backup with empty data.
- Fixed this by modifying `src/App.tsx` to check for local store data before pushing, and if empty, automatically triggers a recovery `pullFromSupabase()` instead.

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
