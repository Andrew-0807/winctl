## Why

Code review uncovered several bugs and code quality issues in the server and CLI layers — including duplicate error handlers, duplicate PID-resolution functions with inconsistent regex, an operator precedence bug in port verification, misleading CLI success messages when the daemon fails to start, a race condition in `stopService`, dead code paths, and ineffective process-kill logic for shortcut-launched services. These are correctness and reliability issues that affect real behavior and should be fixed together.

## What Changes

- **Remove duplicate `error` handler on spawned processes** — the regular command branch registers two `error` handlers (lines 804 and 814); consolidate into one and remove the dead `spawnError` variable
- **Merge duplicate `getPidOnPort` / `getPidFromPort` functions** — two nearly identical functions use different regex patterns to find PIDs on a port, leading to inconsistent results; merge into a single `getPidOnPort` with reliable regex
- **Fix operator precedence in `verifyPortAndCapturePid`** — add explicit parentheses to `(exitCode !== null && exitCode !== undefined) || killed` to match intent
- **Fix CLI false-success messages when daemon fails to start** — `daemonStart` and `startDaemonSilently` print "started" even when the API check fails; show a warning instead
- **Fix shortcut `.lnk/.url` mock kill to actually terminate the process** — the current `mockKill` only clears registry state without killing the actual application
- **Fix race condition in `stopService`** — state is set to `stopped` and entry deleted before the process actually dies, which can confuse the exit handler and auto-restart logic
- **Remove dead `WINCTL_DAEMON` env var check** — `killProcessOnPort` checks `WINCTL_DAEMON === '1'` but this is never set anywhere; remove dead code
- **Remove `loadavg` from Windows system info response** — always returns `[0, 0, 0]` on Windows; replace with CPU usage or omit

## Capabilities

### New Capabilities
- `codebase-bug-fixes`: Consolidated correctness fixes for process management, CLI reliability, and dead code removal

### Modified Capabilities
- *(none — no spec-level behavior changes, only correctness fixes)*

## Impact

- `server/process-manager.ts`: merge duplicate PID functions, remove duplicate error handler + dead spawnError variable, fix operator precedence, fix stopService race condition, fix shortcut mockKill, remove dead WINCTL_DAEMON check
- `server/routes.ts`: remove `loadavg` from `/api/system` response on Windows (or keep but document)
- `cli/index.ts`: fix false-success messages in `daemonStart` and `startDaemonSilently`
