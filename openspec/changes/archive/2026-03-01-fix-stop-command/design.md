## Context

WinCTL is a Windows daemon that manages user-defined services (apps/scripts). It runs as a Windows Service (`sc create WinCTL ...`) or as a standalone process. The CLI (`winctl stop`) attempts to stop it via `sc stop WinCTL`, falling back to the HTTP shutdown API. Neither path reliably terminates the daemon because:

1. The daemon has no `SIGTERM`/`SIGINT` handlers, so `sc stop` is ignored
2. The force flag (`-f`) uses `taskkill /F /T /FI "IMAGENAME eq winctl-daemon.exe"` but the process name may not match when running in dev or via `node`
3. The `/api/shutdown` endpoint calls `process.exit(0)` without stopping managed child services
4. The `/api/shutdown/force` endpoint tries `taskkill /F /T /PID <self>` then `process.exit(1)` — a race condition that may prevent either from completing

## Goals / Non-Goals

**Goals:**
- `winctl stop` gracefully stops all managed services then exits the daemon
- `winctl stop -f` always terminates the daemon regardless of its state
- The daemon responds to OS service stop signals (`SIGTERM`, `SIGINT`)
- The CLI exits cleanly after issuing the stop command

**Non-Goals:**
- Changing Windows Service registration (stays as `sc create`)
- Adding graceful-close timeouts for individual managed services (kill immediately is fine for now)
- Supporting Unix service managers (systemd, etc.)

## Decisions

### 1. Add `SIGTERM` / `SIGINT` handlers to the daemon

The daemon (`server/index.ts`) will register handlers for `SIGTERM` and `SIGINT` that trigger the same graceful shutdown sequence (stop all services → close HTTP server → exit). This makes `sc stop WinCTL` work because Windows SCM sends `SIGTERM` equivalent to the process.

**Alternative considered**: Using `node-windows` service wrapper — rejected because it adds a dependency and the daemon already runs fine with `sc create`.

### 2. Centralize shutdown logic into a `shutdownDaemon()` function

A single `shutdownDaemon(force: boolean)` function in `server/index.ts` or a new module will:
1. Stop all running managed services (iterate registry, call `stopService`)
2. Close the HTTP server
3. Kill the tray icon
4. Call `process.exit(0)`
5. If force: skip service stopping, just `process.exit(1)`

Both the API routes and signal handlers will call this function.

### 3. Fix the CLI force-kill strategy

The CLI `daemonStop()` force path will:
1. Try the `/api/shutdown/force` endpoint first
2. If that fails, try `taskkill /F /T /FI "IMAGENAME eq winctl-daemon.exe"`
3. As final fallback, query `/api/status` to get the daemon PID and run `taskkill /F /PID <pid>`

### 4. Expose daemon PID in `/api/status`

Add `pid: process.pid` to the `/api/status` response so the CLI can kill the daemon by PID as an absolute last resort.

## Risks / Trade-offs

- **Child services may be orphaned on force kill** → Acceptable for `-f` flag; users expect force to be destructive
- **200ms shutdown delay on API path** → Keep the small delay so the HTTP response is sent before exit, but add a hard 3-second timeout to guarantee exit
