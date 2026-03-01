## Context

WinCTL is a self-hosted Windows service manager with a SolidJS web UI, Express + Socket.IO backend, and a standalone CLI. A code review uncovered 8 bugs and code quality issues in the server (`process-manager.ts`, `routes.ts`, `index.ts`) and CLI (`cli/index.ts`) layers. These are correctness fixes — no feature additions, no new dependencies, no API contract changes.

## Goals / Non-Goals

**Goals:**
- Fix all 8 identified bugs with targeted, minimal changes
- Preserve existing API contracts and UX exactly
- Remove dead code paths that add confusion

**Non-Goals:**
- Refactoring beyond what is needed to fix each bug
- UI or frontend changes (all bugs are in server/CLI layers)
- Adding a test suite

## Decisions

### 1. Remove duplicate error handler on spawned processes (process-manager.ts)

The regular command branch (line 794–810) registers an `error` handler on the proc at line 804 that sets a local `spawnError` variable. Then after the `if/else` chain at line 814, a second `error` handler is registered for **all** proc types. For regular commands, both fire. The `spawnError` variable at line 792 is never read.

**Fix:** Remove the first error handler inside the regular command branch (lines 803–807) and delete the `spawnError` variable declaration at line 792.

### 2. Merge duplicate getPidOnPort / getPidFromPort (process-manager.ts)

Two nearly identical functions:
- `getPidOnPort` (line 133): uses `/\s+(\d+)\s*$/m`
- `getPidFromPort` (line 146): uses `/LISTENING\s+(\d+)/`

Both parse `netstat -ano` output, but with different regex. `getPidFromPort` is only used by `detectRunningProcesses`.

**Fix:** Remove `getPidFromPort` entirely. Replace its single call site in `detectRunningProcesses` (line 1036) with `getPidOnPort`. The `getPidOnPort` regex is more robust (matches PID at end of any matching line, irrespective of output format variating).

### 3. Fix operator precedence in verifyPortAndCapturePid (process-manager.ts)

Line 384:
```ts
if (proc?.exitCode !== null && proc?.exitCode !== undefined || proc?.killed)
```
Due to `&&` binding tighter than `||`, this parses as intended — but the intent is not obvious to readers. 

**Fix:** Add explicit parentheses: `if ((proc?.exitCode !== null && proc?.exitCode !== undefined) || proc?.killed)`. This is a readability fix with no behavior change.

### 4. Fix CLI false-success messages (cli/index.ts)

In `daemonStart` (line 156–161) and `startDaemonSilently` (line 606–613), the catch block still prints the "started" success message when the API status check fails.

**Fix:** In the catch block, print a yellow warning instead: `"⚠ WinCTL daemon may still be starting. Check 'winctl status' in a few seconds."`.

### 5. Fix shortcut mockKill to kill the actual process (process-manager.ts)

For `.lnk/.url` services (line 757–763), `mockKill` just clears registry state and broadcasts — it doesn't actually kill the launched application process. Users clicking "stop" on a shortcut-launched service see it go to "stopped" while the application keeps running.

**Fix:** Add `killApplicationProcesses` call inside the shortcut `mockKill` for the service command. If the service has a port, also call `killProcessOnPort`. The mockKill already exists for `.exe` minimized processes (line 694–711) and correctly uses `taskkill` — mirror that pattern.

### 6. Fix race condition in stopService (process-manager.ts)

Lines 1009–1014 immediately set `entry.state = 'stopped'` and `registry.delete(id)` after dispatching the kill commands — without waiting for the process `exit` event. The `exit` handler (line 868) then fires on a stale reference and may trigger auto-restart on a service that was manually stopped.

**Fix:** After kill commands, wait a brief period (500ms) for the process to die, then set state. Also skip the `registry.delete(id)` here — let the exit handler clean up when the process actually exits. Add `manuallyStoppedServices.add(id)` (already present at line 959) to prevent auto-restart.

### 7. Remove dead WINCTL_DAEMON env var check (process-manager.ts)

Line 164: `if (process.env.WINCTL_DAEMON === '1')` — this env var is never set anywhere in the codebase. The check is dead code that exits `killProcessOnPort` early, making it a no-op.

**Fix:** Remove the dead check (lines 164–168). If daemon self-protection is truly needed in the future, it should be implemented by checking the daemon's own PID against the port PID, not an env var that's never set.

### 8. Remove useless loadavg from system info (routes.ts)

Line 396: `loadavg: os.loadavg()` always returns `[0, 0, 0]` on Windows per the Node.js docs. It provides no value to the web UI.

**Fix:** Remove `loadavg` from the `/api/system` response. If the frontend references it, remove that reference too (a quick grep shows the `SystemInfo` type in `types.ts` includes it, but it's never consumed meaningfully in the UI).

## Risks / Trade-offs

- [Merge getPidFromPort into getPidOnPort] → The regex in `getPidOnPort` (`/\s+(\d+)\s*$/m`) is slightly different from `getPidFromPort`'s (`/LISTENING\s+(\d+)/`). Both work for the `netstat -ano | findstr LISTENING` pipeline, but `getPidOnPort`'s regex is more general. Low risk.
- [stopService wait] → Adding a 500ms delay before setting stopped state will make the stop API slightly slower. Acceptable for correctness.
- [Shortcut mockKill] → `killApplicationProcesses` uses `taskkill /IM` which kills all instances of the exe. If user has multiple independent instances, all will be killed. This matches the existing pattern used for `.exe` services. Medium risk.
- [loadavg removal] → Breaking change if any consumer depends on the `loadavg` field in `/api/system` response. Low risk since it's always `[0,0,0]` on Windows.
