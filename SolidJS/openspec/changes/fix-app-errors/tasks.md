## 1. Server — Route Ordering Fix

- [x] 1.1 In `server/routes.ts`, move the `app.put('/api/services/reorder', ...)` handler to appear **before** `app.put('/api/services/:id', ...)` in the file

## 2. Server — PATH Delimiter Fix

- [x] 2.1 In `server/process-manager.ts`, in `resolveFromPath`, change `pathEnv.split(path.sep)` to `pathEnv.split(path.delimiter)`

## 3. Server — Remove Duplicate Auto-Start Loop

- [x] 3.1 In `server/index.ts`, in the `httpServer.listen` callback, remove the `.then()` block that calls `config.services.filter(s => s.autoStart).forEach(...)` after `detectRunningProcesses()` (auto-start is already handled inside `detectRunningProcesses`)
- [x] 3.2 Add a comment explaining that `detectRunningProcesses()` handles both detection and auto-start

## 4. Server — Fix Tray Refresh Handler

- [x] 4.1 In `server/index.ts`, remove `io.on('tray:refresh', ...)` (wrong usage — not a socket event)
- [x] 4.2 In `server/routes.ts`, in the `POST /api/tray/refresh` handler, call the tray menu update logic directly (pass a `getTrayMenu` callback or update trayInstance inline) instead of emitting a socket event that nothing consumes

## 5. Frontend — Fix Partial Settings Update

- [x] 5.1 In `src/stores/services.ts`, in `updateSettings`, change `setSettings(newSettings)` to `setSettings(updated)` so the full merged settings object is written to the store

## 6. Frontend — Fix onCleanup Scope in App.tsx

- [x] 6.1 In `src/components/App.tsx`, declare `let systemInterval: ReturnType<typeof setInterval>` at the component scope (outside `onMount`)
- [x] 6.2 Move `onCleanup(() => { document.removeEventListener('keydown', handleKeyDown); clearInterval(systemInterval); })` to the top level of the component, outside the `onMount` callback
- [x] 6.3 Remove the old `onCleanup` call inside the async `onMount` body

## 7. Frontend — Reactive Minimized Row in ServiceModal

- [x] 7.1 In `src/components/ServiceModal.tsx`, add `const showMinimizedRow = createMemo(() => command().toLowerCase().endsWith('.exe'))`
- [x] 7.2 Remove the two `document.getElementById('minimized-row').style.display` calls (one in the `createEffect` and one in `handleCommandChange`)
- [x] 7.3 Wrap the minimized toggle `<div class="toggle-row" id="minimized-row">` with `<Show when={showMinimizedRow()}>` and remove the `style="display: none;"` from the element

## 8. Cleanup

- [x] 8.1 Remove the unused stub `checkPort` and `killPort` functions from `src/stores/socket.ts` and their exports

## 9. Server — Fix Tray Icon Path in pkg Builds

- [x] 9.1 In `server/index.ts`, in `initTray()`, replace the `iconPaths` array with paths resolved relative to `process.execPath` (e.g., `path.join(path.dirname(process.execPath), 'public', 'icons', 'icon-16.png')`) as the primary candidates
- [x] 9.2 Keep `__dirname`-relative paths as fallback candidates so dev mode still works without a rebuild
- [x] 9.3 Verify that the `pkg.assets` config in `package.json` already includes `public/**/*` — no change needed there, just confirm

## 10. Server — Fix Startup Log and PORT Resolution

- [x] 10.1 In `server/index.ts`, change the PORT constant from `parseInt(process.env.PORT || process.env.WINCTL_PORT || '8080', 10)` to `parseInt(process.env.WINCTL_PORT || '8080', 10)` to eliminate the `env.PORT: undefined` report
- [x] 10.2 Remove any `console.log` that prints `process.argv` or `env.PORT` from the startup sequence (these were debug logs that expose internal runtime information)
