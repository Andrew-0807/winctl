## 1. Backend Process Log Routing

- [x] 1.1 Trace the current application launching logic to identify where `stdout` and `stderr` streams are captured.
- [x] 1.2 Modify the backend application/process runner to accurately map and dispatch stdout/stderr lines to the frontend web sockets or event stream.
- [x] 1.3 Ensure that emitted log events include correct identifiers (like item ID or process ID) so the frontend can filter logs per app.

## 2. Frontend Component Subscription

- [x] 2.1 Examine `FolderCard.tsx` or the main gallery log panel component.
- [x] 2.2 Rebind or fix the subscription in the terminal component so it listens to the precise log event channel corresponding to the started item's process.
- [x] 2.3 Ensure incoming log strings are successfully appended and rendered in the log box.

## 3. UI Verification and Clean Up

- [x] 3.1 Start a test application (script or folder item) via the frontend gallery that outputs text continuously.
- [x] 3.2 Verify that the log view side-panel successfully shows real-time standard output.
- [x] 3.3 Stop the app and ensure log streams are appropriately severed or cleaned up without memory leaks.
