## Context

WinCTL is a self-hosted Windows service manager with a SolidJS frontend and an Express + Socket.IO backend. During the conversion from a Tauri app to a Node.js daemon, several bugs were introduced or left unfixed. These are not feature gaps — they are silent correctness failures that cause broken behavior during normal use (service reordering never persists, themes reset after reopening settings, services start twice on boot, and minimized-row visibility can desync from the actual command value).

## Goals / Non-Goals

**Goals:**
- Fix all identified bugs with targeted, minimal changes
- Preserve existing UX and API contracts exactly
- No new dependencies required

**Non-Goals:**
- Refactoring beyond what is needed to fix each bug
- UI redesign or new features
- Adding a test suite (out of scope for this change)

## Decisions

### 1. Route ordering fix (routes.ts)
Move `PUT /api/services/reorder` to be registered **before** `PUT /api/services/:id`. Express matches routes in registration order, so `"reorder"` was being captured as an `:id` param and returning 404. No API contract changes — the endpoint URL and payload stay identical.

### 2. PATH delimiter fix (process-manager.ts)
Change `pathEnv.split(path.sep)` → `pathEnv.split(path.delimiter)`. On Windows, `path.sep` is `\` (the directory separator) while `path.delimiter` is `;` (the PATH separator). This caused every PATH entry to be mangled, making executable resolution always fail and falling back to `shell: true`.

### 3. Remove duplicate auto-start in main() (index.ts)
`detectRunningProcesses()` already runs auto-start internally (lines 1086–1096 of process-manager.ts). The `main()` body runs another `.filter(s => s.autoStart)` loop after `detectRunningProcesses()` resolves, causing services to attempt starting twice. Remove the redundant loop from `main()`.

### 4. Fix partial setSettings in updateSettings (services.ts)
`updateSettings` merges `{ ...settings, ...newSettings }` into `updated` but then calls `setSettings(newSettings)` — passing only the partial update. This silently discards all other settings fields (e.g., calling `updateSettings({ theme: 'dracula' })` would wipe `folderStatePreference`, `showFolderCount`, etc.). Fix: call `setSettings(updated)` with the full merged object.

### 5. Remove stub checkPort in socket.ts
The client-side `checkPort` function always returns `true` regardless of input. It was never hooked to a real API endpoint. It is not called from any component (confirmed by grep), so the safe fix is to remove it from the exported API to avoid confusion. If a real client-side port check is needed in the future it should call an actual API route.

### 6. Fix onCleanup scope in App.tsx
`onCleanup` must be called synchronously inside a reactive scope (component body or `createEffect`). Calling it inside an `async () => { ... }` block passed to `onMount` means it runs after an `await`, outside the reactive tracking context, and is silently ignored. The keyboard listener is never removed and the interval never cleared. Fix: call `onCleanup` at the top level of the component (outside `onMount`), capturing the interval ID via a variable scoped to the component.

### 7. Replace DOM mutation with reactive signal in ServiceModal.tsx
Two places use `document.getElementById('minimized-row').style.display` to show/hide the row. This fights SolidJS's virtual DOM and can desync when the modal opens a second time. Fix: add a `createMemo` derived from `command()` that checks `.endsWith('.exe')`, and wrap the minimized toggle row with `<Show when={showMinimizedRow()}>`.

### 8. Fix tray:refresh listener scope (index.ts)
`io.on('tray:refresh', handler)` listens for a "tray:refresh" event on the `io` namespace object. This is the event for new *client connections*, not for socket messages named `tray:refresh`. The correct approach is to handle the refresh directly in the `/api/tray/refresh` route handler (which already exists and calls `io.emit('tray:refresh')`). Move the tray menu update logic into that route, so the refresh happens immediately when the API is called rather than waiting for a phantom socket event.

### 9. Fix tray icon path resolution in pkg builds (index.ts)
`pkg` bundles assets into a virtual snapshot filesystem at a path like `C:\snapshot\winctl\...`. `__dirname` inside a pkg binary points into this snapshot, so `path.join(__dirname, '..', 'public', 'icons', 'icon-16.png')` resolves to a snapshot path that `fs.existsSync()` never finds on disk. Fix: resolve the icon path relative to `process.execPath` (the actual `.exe` file), e.g., `path.join(path.dirname(process.execPath), 'public', 'icons', 'icon-16.png')`. This requires the icons to be packaged alongside the daemon exe (which is already handled by the `pkg.assets` config). In dev mode, fall back to `__dirname`-relative paths.

### 10. Remove noisy startup log and fix PORT resolution (index.ts)
The daemon prints a startup message that includes `process.argv` and `env.PORT: undefined`. The `env.PORT: undefined` comes from the fact that `process.env.PORT` is not set by Windows Service Manager — only `WINCTL_PORT` is used. Remove the argv dump entirely (it leaks internal runtime paths). Simplify the PORT constant to `parseInt(process.env.WINCTL_PORT || '8080', 10)`, dropping the ambiguous `process.env.PORT` prefix that causes the undefined report.

## Risks / Trade-offs

- [Route reorder fix] → Changing route order could affect any middleware that depends on order, but there's no middleware in between — risk is negligible.
- [Duplicate auto-start removal] → If `detectRunningProcesses` is ever refactored to not auto-start, the safety net in `main()` would be gone. Mitigated by adding a comment.
- [onCleanup fix] → Interval ID must be captured before the `await` — straightforward but easy to misplace the variable declaration.
- [Tray icon pkg path] → If the user doesn't have `public/icons/` next to the exe, the tray still silently skips — same behavior as now, but the fix makes the happy path work.
- [PORT simplification] → If any deployment was relying on `PORT` env var (non-standard for this app), it will stop working. `WINCTL_PORT` is the documented variable; dropping `PORT` is a safe cleanup.
