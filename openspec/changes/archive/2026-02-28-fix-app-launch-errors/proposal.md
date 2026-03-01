## Why

Currently, when pressing "start" for certain items in the application, such as AutoHotkey scripts, the items fail to start. In other cases, an `ENOENT` error is thrown. This prevents users from properly launching applications or scripts through the UI, which is a core function of the system. This change is needed to ensure all configured apps and scripts can be launched reliably without errors.

## What Changes

- Implement robust robust error handling and execution strategies for launching external applications and scripts.
- Ensure that different file types (like `.ahk` scripts or raw executables) are launched correctly using the appropriate shell or runner.
- Fix issues where missing working directories or misconfigured paths result in `ENOENT` errors.
- Ensure the failure of a single app launch does not crash the main application workflow.

## Capabilities

### New Capabilities

- `app-launcher`: Defines how different types of applications, scripts, and processes are started, managed, and monitored by the system.

### Modified Capabilities

## Impact

- **App Launching Logic**: Modifies the backend code responsible for spawning child processes or using `shell: true` execution in Node.js.
- **Error Handling**: Affects how start errors are logged and bubbled up to the UI.
