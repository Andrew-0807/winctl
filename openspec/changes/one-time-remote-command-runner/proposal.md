## Why

WinCTL manages long-running services well, but there's no way to run a one-off command on the PC from the dashboard. Common use cases: trigger a backup script, run a build, flush a cache, restart a router, check disk space — things you'd normally need to RDP or SSH in to do. A "Run Command" panel fills this gap without requiring a full persistent service to be configured.

The daemon already exposes a REST API and Socket.IO infrastructure used for service log streaming. The same plumbing can be reused to spawn an ad-hoc process and stream its stdout/stderr to the browser in real time.

## What Changes

- New `POST /api/exec` endpoint on the daemon that accepts a command string (and optional cwd/env), spawns it, and streams stdout/stderr line-by-line via a Socket.IO event channel
- New "Run Command" panel in the dashboard UI with a command input, a Run button, and a live output terminal
- Each execution gets a unique `execId` so multiple concurrent runs don't interleave output
- The process is fire-and-forget: no persistence, no history, no restart. When the process exits, the channel closes
- The UI shows exit code on completion (green for 0, red for non-zero)

## Capabilities

### New Capabilities
- `ad-hoc-exec`: Run a one-time command on the host machine and stream live stdout/stderr to the dashboard

### Modified Capabilities
- `app-log-streaming`: Existing Socket.IO log infrastructure is extended to carry exec output alongside service logs

## Impact

- **Server**: `server/routes.ts` — add `POST /api/exec` route
- **Server**: `server/process-manager.ts` — add `runExec()` helper for one-shot spawning with streaming
- **Server**: `server/types.ts` — add `ExecRequest`, `ExecResult` types
- **Frontend**: `src/components/` — new `RunCommandPanel.tsx` component
- **Frontend**: `src/stores/socket.ts` — handle `exec:output` and `exec:done` Socket.IO events
- **Frontend**: `src/stores/ui.ts` — state for active exec sessions (input value, output lines, running flag)
