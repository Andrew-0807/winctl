## 1. Core Executable Handling

- [x] 1.1 Create utility function to determine execution strategy (`shell: true` vs runner) based on file extension
- [x] 1.2 Implement runner mapping for known types (e.g., `.ahk` -> `AutoHotkey.exe`, `.bat` -> `cmd.exe`)

## 2. Working Directory Resolution

- [x] 2.1 Update spawn logic to extract directory path from target executable if `cwd` is omitted
- [x] 2.2 Ensure the resolved `cwd` is properly formatted for the OS (Windows) and passed to `spawn`

## 3. Error Handling and Resiliency

- [x] 3.1 Wrap spawn/exec logic in try-catch to handle synchronous errors
- [x] 3.2 Add `error` event listener to child process to catch asynchronous launch failures (like ENOENT)
- [x] 3.3 Ensure the UI receives a standardized error response instead of crashing the backend

## 4. Testing

- [x] 4.1 Test launching a standard `.exe` without providing `cwd`
- [x] 4.2 Test launching an `.ahk` script
- [x] 4.3 Test launching a non-existent file to verify error handling behavior
