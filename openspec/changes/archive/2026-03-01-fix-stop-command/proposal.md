## Why

`winctl stop` does not reliably shut down the WinCTL daemon. The `sc stop WinCTL` command sends a service stop signal, but the daemon's Node.js process has no handler for `SIGTERM`/`SIGINT` or Windows service control events, so it ignores the stop request. Even `winctl stop -f` (force) fails because the `taskkill` filter `IMAGENAME eq winctl-daemon.exe` may not match the actual process name, and the fallback API shutdown endpoints have their own issues (the force endpoint kills itself before sending the response).

## What Changes

- Add proper signal handlers (`SIGTERM`, `SIGINT`) in the daemon's `server/index.ts` so `sc stop WinCTL` triggers a graceful shutdown
- Fix the shutdown API endpoints to properly stop all managed child services before exiting
- Fix the force stop flow in `cli/index.ts` — use a more reliable process kill strategy (e.g., also try `taskkill /F /IM node.exe` filtered by port, or kill by PID via `/api/status`)
- Add a `/api/status` response field with the daemon's own PID so the CLI can kill it directly as a last resort
- Ensure `process.exit()` is called reliably after cleanup, with a timeout fallback

## Capabilities

### New Capabilities
- `graceful-shutdown`: Daemon handles stop signals and shuts down cleanly — stops all managed services, closes HTTP server, then exits

### Modified Capabilities
_None — no existing spec-level requirements are changing._

## Impact

- **Server**: `server/index.ts` — add signal handlers and graceful shutdown logic
- **Server**: `server/routes.ts` — fix `/api/shutdown` and `/api/shutdown/force` to stop child services before exit
- **CLI**: `cli/index.ts` — fix `daemonStop()` force-kill reliability, add PID-based kill fallback
- **API**: `/api/status` gains a `pid` field for the daemon process
