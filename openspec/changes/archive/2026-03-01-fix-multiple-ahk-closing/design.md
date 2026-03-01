## Context

Currently, `winctl` spawns AutoHotkey scripts using the generic runner (`AutoHotkey.exe` or `AutoHotkey64.exe`). The `process-manager.ts` tracks process status and handles termination. For process termination, if a dedicated port isn't used, `killApplicationProcesses` falls back to killing by the image name (`exeName`). For AHK scripts, this means executing `taskkill /IM AutoHotkey64.exe /F`, which indiscriminately kills **all** running AHK scripts on the system, not just the one managed by the specific service. Additionally, PID tracking for detached AHK processes can lose sync if the process restarts or the PID isn't captured accurately.

## Goals / Non-Goals

**Goals:**
- Uniquely identify AutoHotkey script processes started by `winctl`.
- Reliably terminate only the specific AutoHotkey script associated with a `winctl` service when the `stop` command is issued.
- Improve PID tracking for AHK scripts in `process-manager.ts`.

**Non-Goals:**
- Modifying the underlying `AutoHotkey` runner itself.
- Changing how other non-AHK services are fundamentally managed, unless a unified PID tracking approach benefits them seamlessly.

## Decisions

1. **Strict PID-Based Termination for AHK**: Instead of relying on image name (`AutoHotkey64.exe`), we will rely strictly on the Process ID (PID) for stopping AHK scripts.
2. **Command-Line Argument Matching via WMI**: To find the correct PID of an AHK script (if it gets lost or during startup verification), we will use WMI (`wmic process where "name='AutoHotkey64.exe' and commandline like '%<ScriptName>%'" get processid`). This allows us to differentiate between multiple AHK processes by looking at the script path passed to them.
3. **Update `killApplicationProcesses`**: 
   - Modify the signature or logic to prioritize terminating by `PID` if known.
   - For AHK scripts, if PID is unknown, use the WMI method to find the matching PID before issuing `taskkill /PID <PID> /F`.

*Alternatives Considered*: 
- Creating a wrapper `.bat` or `.exe` for each AHK script. *Discarded* because it adds unnecessary filesystem clutter and complexity.
- Modifying AHK scripts to communicate their PID back to `winctl` via IPC. *Discarded* because it requires altering user scripts, violating the goal of seamless management.

## Risks / Trade-offs

- **[Risk] WMI Query Performance**: WMI queries (`wmic`) can be slightly slower than simple `tasklist` or `taskkill` commands. 
  - **Mitigation**: We will only perform the WMI query when necessary (e.g., when the PID is unknown or during specific periodic checks) and cache the PID in the service registry (`actualPid`).
- **[Risk] Path matching edge cases**: If two services run the exact same script path but with different arguments, matching might be tricky.
  - **Mitigation**: Match the entire `service.command` and `args` string safely in the WMI query to ensure exactness.
