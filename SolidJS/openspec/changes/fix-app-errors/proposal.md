## Why

The app has several bugs introduced during the service-to-daemon conversion — including a critical route conflict that makes reordering services fail silently, a wrong PATH delimiter that prevents executable resolution on Windows, double auto-start of services on boot, a partial settings update bug that causes theme resets, a tray icon that never loads due to bad pkg snapshot path resolution, and a debug startup log that exposes internal argv and reports `env.PORT: undefined`. These cause real failures during normal use and should be fixed before the app is used in production.

## What Changes

- **Fix `PUT /api/services/reorder` route conflict** — move it before `PUT /api/services/:id` in Express so Express doesn't try to look up `"reorder"` as a service ID
- **Fix `resolveFromPath` PATH delimiter bug** — change `path.sep` (`\`) to `path.delimiter` (`;`) when splitting the PATH environment variable on Windows
- **Fix double auto-start on boot** — `detectRunningProcesses` already auto-starts services internally; `main()` runs another auto-start loop after it, causing duplicates. Remove the redundant loop in `main()`
- **Fix partial `setSettings` call in `updateSettings`** — `setSettings(newSettings)` replaces the full settings store with only the partial update; change to `setSettings(updated)` (the already-merged object)
- **Remove stub `checkPort` in `socket.ts`** — the client-side `checkPort` always returns `true` (never implemented); remove or implement it properly
- **Fix `onCleanup` inside `onMount`** — in `App.tsx`, `onCleanup` is nested inside `onMount`'s async callback, which is out of reactive scope and will never fire. Move it to the component's top-level scope
- **Fix `minimized-row` visibility via DOM** — `ServiceModal.tsx` uses `document.getElementById` to toggle visibility instead of a reactive SolidJS signal; replace with a `createMemo`/`Show` pattern
- **Fix `tray:refresh` listener scope** — `io.on('tray:refresh', …)` in `index.ts` registers on the server's `io` namespace (which handles _new client connections_), not on socket events. Move it inside `io.on('connection', socket => socket.on('tray:refresh', …))` or convert the API route to call the handler directly
- **Fix tray icon path resolution in pkg builds** — `initTray()` uses `path.join(__dirname, '..', 'public', 'icons', 'icon-16.png')` which resolves correctly in dev but fails inside a `pkg` snapshot. The icon must be located relative to `process.execPath` (the actual `.exe` location on disk), not `__dirname`
- **Fix daemon startup log exposing argv and `env.PORT: undefined`** — on daemon startup, a debug log prints `argv` (including any CLI arguments like `stop`) and `env.PORT: undefined` because `process.env.PORT` is not set when running as a Windows Service. Remove the argv dump; the port should be resolved using only `WINCTL_PORT` with an `8080` default, removing the ambiguous `process.env.PORT` fallback

## Capabilities

### New Capabilities
- `bug-fixes`: A consolidated set of correctness fixes for server routing, PATH resolution, boot sequencing, store updates, tray icon loading in packaged builds, and reactive UI patterns

### Modified Capabilities
- *(none — no spec-level behavior changes, only correctness fixes)*

## Impact

- `server/routes.ts`: route registration order change
- `server/process-manager.ts`: `resolveFromPath` delimiter fix
- `server/index.ts`: remove duplicate auto-start loop; fix `tray:refresh` listener scope; fix tray icon path resolution; remove PORT ambiguity and noisy startup log
- `src/stores/services.ts`: `updateSettings` — pass merged object to `setSettings`
- `src/stores/socket.ts`: remove stub `checkPort`
- `src/components/App.tsx`: move `onCleanup` outside async callback
- `src/components/ServiceModal.tsx`: replace DOM mutation with reactive `createMemo`/`Show`
