## Why

The stop mechanism in WinCTL has several bugs that prevent services from being reliably terminated:

1. **Batch files using `start` are never stopped.** When a `.bat`/`.cmd` uses the `start` command to launch apps, those child processes are fully detached from the parent `cmd.exe`. The parent exits immediately after launching them, so WinCTL's `taskkill /PID <cmd.exe pid>` kills a dead process and the real apps keep running.

2. **Process trees are not killed.** All `taskkill` calls use `/F` without `/T` (terminate tree). If a process spawns its own children, only the parent is killed — the children stay alive.

3. **State is marked stopped before kill is confirmed.** `registry.delete(id)` is called immediately after issuing the kill, before verifying the process is actually gone. If the kill silently failed, the 15-second `periodicStatusCheck` re-detects the process as running and creates a ghost registry entry. The service appears to stop, then bounces back to running after ~15 seconds.

4. **Port-based kill is too aggressive and kills before PID.** When a service has a port, `stopService` runs a `for /f netstat` command to blindly kill whatever process is on that port — ignoring `entry.actualPid`. If another process briefly shares that port range, the wrong process gets killed.

## What Changes

- Add pre/post launch PID snapshot for batch files to track processes spawned via `start`
- Store spawned PIDs in `ServiceEntry` as `spawnedPids`
- On stop: kill `spawnedPids` first (with `/T`), then fall through to port/PID/proc kill
- Add `/T` flag to all `taskkill` calls in `stopService`
- Verify kill succeeded (poll until process is gone) before updating state
- Only delete registry entry and broadcast after confirmation, not optimistically

## Capabilities

### Modified Capabilities
- `process-execution`: Stop now reliably terminates all processes spawned by a service, including those launched via batch `start` commands

## Impact

- **Server**: `server/process-manager.ts` — all stop/start changes live here
- **Server**: `server/types.ts` — add `spawnedPids` field to `ServiceEntry`
