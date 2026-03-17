## Why

Two unrelated but high-priority gaps affect daily usability:

**1. No in-app shutdown control**
The only ways to stop WinCTL today are `winctl stop` in a terminal or killing the process. Neither is available from a phone. This means if you're away from the PC and want to restart WinCTL for testing, you can't do it from the web UI. A shutdown button in the Settings modal would close this gap.

Equally important: the current graceful shutdown always stops all managed services. If you just want to restart WinCTL without disrupting running apps, there is no way to do that — a "keep services running" option is needed.

**2. System tray icon not appearing**
The systray integration is silently failing in pkg-built executables. The `systray` npm package ships a compiled Go helper binary that it spawns as a child process. Inside a `pkg` bundle, binaries stored in the virtual snapshot cannot be executed by the OS — they need to be extracted to the real filesystem first. The `copyDir: true` option in the SysTray constructor enables this extraction, but it is currently omitted. Additionally, the icon file resolution logic may miss the snapshot path when running in a pkg build.

## What Changes

- **Shutdown button in Settings modal** — A "Stop WinCTL" button at the bottom of the Settings modal triggers an inline confirmation step with a mode choice: "Stop all services" (default) or "Keep services running". Confirms via a single action.
- **Backend: shutdown with keep-services option** — `/api/shutdown` accepts an optional `keepServices: true` body flag. `shutdownDaemon()` gains a third parameter so it can skip the service-stop loop when requested.
- **Tray fix: `copyDir: true`** — Pass `copyDir: true` to the `SysTrayClass` constructor so pkg builds extract the helper binary to a temp directory before spawning it.
- **Tray fix: icon snapshot path** — Ensure the icon resolution list includes the correct virtual snapshot path for pkg builds so the icon is reliably found.

## Capabilities

### New Capabilities

- `shutdown-from-ui`: Stop WinCTL from any browser, including mobile, without needing the CLI.
- `shutdown-keep-services`: Shut down WinCTL daemon without killing the processes it manages — useful for restarting the daemon during testing.

### Modified Capabilities

- `system-tray`: Fixed — tray icon now appears in pkg builds by enabling `copyDir` and improving icon path resolution.

## Impact

- **SolidJS/src/components/SettingsModal.tsx** — Shutdown section added.
- **SolidJS/src/stores/socket.ts** — `shutdownDaemon(keepServices?)` API wrapper added.
- **SolidJS/server/index.ts** — `shutdownDaemon` signature updated; `initTray` gets `copyDir: true`.
- **SolidJS/server/routes.ts** — `/api/shutdown` reads `keepServices` from body.
- No config changes. No new dependencies.
