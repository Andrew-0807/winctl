## Context

Currently, the WinCTL CLI commands (`start` and `stop`) are "fire-and-forget" in terms of their console output. They assume the operation will succeed and don't check the current state of the system before printing their confirmation messages.
- `winctl start` prints "Started" even if the server is already running on the given port.
- `winctl stop` prints "Stopped" even if there was no server running to begin with.
Additionally, the `status` command doesn't allow checking a specific port, making it hard to verify if a particular instance is running.

## Goals / Non-Goals

**Goals:**
- Make `winctl start` check if a daemon is already running on the target port before attempting to start it.
- If it is already running, print a helpful message (e.g., "Daemon is already running on port XXXX") instead of "Started".
- Make `winctl stop` check if a daemon is actually running before stopping.
- If nothing is running, print a helpful message (e.g., "No daemon is currently running on port XXXX") instead of "Stopped".
- Add a `-p <port>` flag to `winctl status` to check the status of a specific port.

**Non-Goals:**
- Restructuring the entire CLI application.
- Changing the underlying daemon start/stop mechanisms, only the CLI feedback is changing.

## Decisions

1. **State Checking in CLI:** Before executing the core start/stop logic in `cli/index.ts`, the CLI will perform a health check or process check (e.g., by attempting a basic HTTP GET to the daemon's status endpoint or checking the PID file if one exists).
2. **`status -p` Implementation:** The `status` command in `cli/index.ts` will parse the `-p` (or `--port`) argument. If provided, it will check only that specific port; otherwise, it will perform the default status check.
3. **Feedback Messages:** Use clear, user-friendly language for the new state-aware feedback messages.

## Risks / Trade-offs

- **Slight Delay:** Checking the state before starting or stopping might introduce a very small delay (a few milliseconds) as it needs to verify the process status or ping the server. This is an acceptable trade-off for much better user feedback.
- **Race Conditions:** It's theoretically possible (though unlikely in standard use) for the state to change between the check and the action. The underlying commands should still handle errors gracefully if this happens.
