## 1. Server — Remove Duplicate Error Handler + Dead Variable

- [ ] 1.1 In `server/process-manager.ts`, delete the `let spawnError: Error | null = null;` declaration at line 792
- [ ] 1.2 Remove the first `proc.on('error', ...)` handler inside the regular command branch (lines 803–807) that sets `spawnError`
- [ ] 1.3 Keep only the general `proc.on('error', ...)` handler at lines 812–821 that sets `entry.state = 'stopped'`

## 2. Server — Merge Duplicate PID Functions

- [ ] 2.1 In `server/process-manager.ts`, delete the `getPidFromPort` function (lines 146–154)
- [ ] 2.2 In `detectRunningProcesses`, replace the call to `getPidFromPort(service.port)` at line 1036 with `getPidOnPort(service.port)`

## 3. Server — Fix Operator Precedence in Port Verifier

- [ ] 3.1 In `server/process-manager.ts`, at line 384, wrap the condition in explicit parentheses: `if ((proc?.exitCode !== null && proc?.exitCode !== undefined) || proc?.killed)`

## 4. CLI — Fix False-Success Messages

- [ ] 4.1 In `cli/index.ts`, in `daemonStart` (line 159–161), change the catch block to print a yellow warning: `"⚠ WinCTL daemon may still be starting. Check 'winctl status' in a few seconds."`
- [ ] 4.2 In `cli/index.ts`, in `startDaemonSilently` (line 611–613), change the catch block to the same yellow warning

## 5. Server — Fix Shortcut MockKill

- [ ] 5.1 In `server/process-manager.ts`, in the `.lnk/.url` shortcut branch's `mockKill` function (line 757–763), add `killApplicationProcesses(service.command)` call before clearing the registry
- [ ] 5.2 If the service has a port, also call `killProcessOnPort(service.port)` inside the mockKill

## 6. Server — Fix stopService Race Condition

- [ ] 6.1 In `server/process-manager.ts`, in `stopService`, add a 500ms `await new Promise(r => setTimeout(r, 500))` after the kill commands (after line 995) before setting stopped state
- [ ] 6.2 Remove the `registry.delete(id)` call at line 1013 — let the exit handler or periodic check clean it up
- [ ] 6.3 Keep `entry.state = 'stopped'` and `broadcastStatus()` but only after the wait

## 7. Server — Remove Dead WINCTL_DAEMON Check

- [ ] 7.1 In `server/process-manager.ts`, remove the `if (process.env.WINCTL_DAEMON === '1')` block (lines 164–168) from `killProcessOnPort`

## 8. Server — Remove Useless loadavg

- [ ] 8.1 In `server/routes.ts`, remove `loadavg: os.loadavg()` from the `/api/system` response (line 396)
- [ ] 8.2 In `server/types.ts`, remove `loadavg: number[]` from the `SystemInfo` interface (line 110)
