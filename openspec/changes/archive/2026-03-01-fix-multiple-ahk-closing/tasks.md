## 1. PID Tracking Enhancements

- [x] 1.1 Modify `capturePidByName` or the startup logic in `process-manager.ts` to use WMI command-line matching for `.ahk` scripts, accurately capturing the PID of the newly started script.
- [x] 1.2 Ensure `periodicStatusCheck` uses the specific cached `actualPid` for AHK scripts instead of falling back to a generic name match against `AutoHotkey.exe` or `AutoHotkey64.exe`.

## 2. Process Termination Refactor

- [x] 2.1 Refactor AHK script termination logic in `killApplicationProcesses`/`stopService` to prioritize termination by `PID`.
- [x] 2.2 If the exact PID is known for an AHK script, execute `taskkill /PID <pid> /F` rather than killing by image name.
- [x] 2.3 Implement a fallback WMI query to find the specific PID (by matching the script path in the `commandline`) if the PID is lost or unknown at termination time.

## 3. Verification

- [x] 3.1 Start multiple different AHK scripts via `winctl start <script1>` and `winctl start <script2>`.
- [x] 3.2 Verify `winctl status` correctly distinguishes them and tracks their distinct PIDs.
- [x] 3.3 Stop one AHK script (`winctl stop <script1>`) and verify only that script is terminated, leaving the other script running.
- [x] 3.4 Stop all remaining AHK scripts individually to ensure clean termination without orphaned processes.
