## 1. Types

- [x] 1.1 Add `spawnedPids?: number[]` field to `ServiceEntry` interface in `server/types.ts`

## 2. PID snapshot utility

- [x] 2.1 Add `getAllRunningPids(): Promise<Set<number>>` function in `server/process-manager.ts` — runs `tasklist /FO CSV /NH`, parses all PIDs, returns as a Set

## 3. Batch file start — snapshot spawned PIDs

- [x] 3.1 In `startService`, before the `isBatchFile` spawn block, call `getAllRunningPids()` and store as `preLaunchPids`
- [x] 3.2 After the batch is spawned and entry state is set to `running`, schedule an async callback at +3s that calls `getAllRunningPids()` again, diffs against `preLaunchPids`, and stores the result as `entry.spawnedPids`

## 4. Stop — add /T to all taskkill calls

- [x] 4.1 In `stopService`, change all `taskkill /PID <n> /F` to `taskkill /PID <n> /F /T`
- [x] 4.2 In `killApplicationProcesses`, change all `taskkill /PID <n> /F` to `taskkill /PID <n> /F /T`
- [x] 4.3 In the minimized process mock kill handler, change `taskkill /IM "${exeBaseName}" /F` to `taskkill /IM "${exeBaseName}" /F /T`

## 5. Stop — kill spawnedPids

- [x] 5.1 In `stopService`, after collecting the main PID, also collect `entry.spawnedPids` (if any)
- [x] 5.2 Kill all `spawnedPids` with `taskkill /PID <n> /F /T` in parallel before killing the main PID

## 6. Stop — fix port kill to use known PID

- [x] 6.1 In `stopService`, replace the raw `for /f netstat ... taskkill` shell command with: if `entry.actualPid` is set, use it directly; otherwise call `getPidOnPort(service.port)` and kill that PID with `/T`

## 7. Stop — verify before clearing state

- [x] 7.1 Add `waitUntilGone(service, entry): Promise<void>` function that polls every 500ms for up to 5s:
  - For port services: waits until `checkPort(port)` returns false
  - For PID services: waits until `checkPidRunning(pid)` returns false
  - Times out and logs a warning after 5s regardless
- [x] 7.2 In `stopService`, move `entry.state = 'stopped'`, `registry.delete(id)`, and `broadcastStatus()` to run only AFTER `waitUntilGone()` completes (i.e., after kill confirmation, not before)

## 8. Verification

- [ ] 8.1 Build server: `cd SolidJS && npm run build:server` ← run manually
- [ ] 8.2 Test: start a batch file service that uses `start` to launch an app, then stop it — verify the launched app actually closes
- [ ] 8.3 Test: stop a port-based service — verify status stays stopped and doesn't bounce back to running after 15s
- [ ] 8.4 Test: stop a regular `.exe` service — verify existing behavior is unchanged
