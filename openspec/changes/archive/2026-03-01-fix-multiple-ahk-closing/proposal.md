## Why

When multiple AutoHotkey (AHK) scripts are running via winctl, attempting to stop one script either closes the wrong script or fails to close all processes correctly. This happens because winctl currently relies on generic process image names (like `AutoHotkey.exe`) or struggles to track the exact PID of the script, leading to unreliable process management when multiple scripts share the same runner.

## What Changes

- Improve process termination logic to target specific AHK script instances (e.g., by matching the script path in the command line arguments via WMI) instead of just the generic executable name.
- Enhance PID tracking for AHK scripts so `winctl` knows exactly which `AutoHotkey.exe` process belongs to which service.
- Ensure that stopping an AHK service cleanly terminates only that specific script (and gracefully handles multiple AHK scripts running simultaneously).

## Capabilities

### New Capabilities
- `managed-ahk-termination`: Reliable tracking and precise termination of individual AutoHotkey script instances based on command-line arguments and PID.

### Modified Capabilities
- None

## Impact

- `SolidJS/server/process-manager.ts`: The process spawning, PID tracking, and `killApplicationProcesses` functions will be modified to support advanced tracking for AHK scripts.
- General stability of `winctl` when used to manage multiple background scripts simultaneously.
