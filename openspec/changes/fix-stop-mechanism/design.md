## Context

WinCTL's `process-manager.ts` is the only file responsible for starting and stopping managed services. It maintains a `registry: Map<string, ServiceEntry>` keyed by service ID. Stop logic lives entirely in `stopService(id)`.

The fundamental problem with batch files that use `start`:

```
cmd.exe /c batch.bat  (PID 1234) ← WinCTL tracks this
  └─ start app1.exe  (PID 5678) ← fully detached, WinCTL has no reference
  └─ start app2.exe  (PID 9012) ← fully detached, WinCTL has no reference
  └─ cmd.exe exits immediately

taskkill /PID 1234 → kills a dead process, no-op
app1.exe and app2.exe keep running
```

## Goals / Non-Goals

**Goals:**
- Services started via batch `start` commands are fully stopped when user presses Stop
- All `taskkill` calls kill the entire process tree (children included)
- Stop is only considered complete after the process is confirmed gone
- State does not bounce back to running after a stop

**Non-Goals:**
- AHK script fix (tracked separately)
- Stopping processes the user never started through WinCTL
- Handling services that intentionally resist being killed

## Decisions

### 1. Pre/Post PID snapshot for batch files

Before spawning a batch file, snapshot all currently running PIDs using `tasklist`. After a short wait (3 seconds — enough for the batch to run and spawn its children), snapshot again. The diff is the set of processes this service launched.

```ts
// Before spawn
const prePids = await getAllRunningPids();  // tasklist /FO CSV /NH

// spawn cmd.exe /c batch.bat ...

// After 3s
await sleep(3000);
const postPids = await getAllRunningPids();
entry.spawnedPids = [...postPids].filter(pid => !prePids.has(pid));
```

**Why 3 seconds:** Most batch launchers finish running `start` commands in under a second. 3s is conservative enough to capture all spawned processes without being noticeable.

**False positive risk:** If another unrelated process starts in that 3s window, it gets added to `spawnedPids`. On stop, `taskkill /PID <unrelated>` will fail with "process not found" or succeed but kill something unrelated. This is a known trade-off — acceptable because: (a) it only applies to batch files, (b) the window is short, (c) the user explicitly configured this batch to be managed by WinCTL.

**Alternative considered:** WMI parent PID traversal (`wmic process where ParentProcessId=X`). Rejected because Windows reparents orphaned processes to PID 4 (System) when the parent exits, so the query returns nothing by the time we'd use it.

### 2. Add `spawnedPids` to `ServiceEntry`

```ts
interface ServiceEntry {
  // ... existing fields ...
  spawnedPids?: number[];   // PIDs of processes launched by this service's batch file
}
```

### 3. Stop strategy — ordered, with tree kill

```
stopService(id):
  1. Set state = 'stopping', broadcast

  2. Collect all PIDs to kill:
     - entry.spawnedPids  (batch-launched processes)
     - entry.actualPid    (port-detected or name-detected PID)
     - proc.pid           (the spawn handle PID)
     - [if port] getPidOnPort(port)
     - [if AHK] getAhkPidByScript(...)

  3. Kill all collected PIDs with: taskkill /PID <n> /F /T
     (run in parallel, ignore "not found" errors)

  4. Kill proc handle: proc.kill('SIGKILL')

  5. Verify: poll every 500ms up to 5s
     - For port services: checkPort(port) === false
     - For PID services: checkPidRunning(pid) === false
     - If not confirmed after 5s: log warning, proceed anyway

  6. Set state = 'stopped', delete registry entry, broadcast
```

The key change: step 6 (state update + registry delete) only happens AFTER step 5 (verification). Today this is reversed.

### 4. Fix port kill to use known PID first

Today's port kill runs a raw shell `for /f` command that kills by port without regard to what PID we already know. The new approach:

- If `entry.actualPid` is set → use it directly with `/T`
- If not → look up port PID with `getPidOnPort`, store it, then kill with `/T`
- The port lookup is a fallback, not the primary path

### 5. Add `/T` to all taskkill calls

Every `exec('taskkill /PID <n> /F', ...)` in `stopService` becomes `exec('taskkill /PID <n> /F /T', ...)`. This ensures any process that spawned children (but isn't a batch `start` case) still gets its whole tree killed.

## Risks / Trade-offs

- **3s snapshot delay on batch start**: Service status shows "starting" for 3 extra seconds while we wait to capture spawned PIDs. This is a UX trade-off — the service is actually running by then, so we could set state to `running` immediately and do the snapshot async, updating `spawnedPids` in the background.
- **False positive PIDs in snapshot**: Documented above — acceptable trade-off for batch files.
- **Verification timeout (5s)**: If a process resists being killed (e.g., hung waiting for cleanup), the stop appears to complete but the process is still running. This is an edge case; most processes on Windows die immediately on `taskkill /F`.
