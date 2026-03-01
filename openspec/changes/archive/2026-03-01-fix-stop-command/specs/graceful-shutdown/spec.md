## ADDED Requirements

### Requirement: Graceful shutdown on signal
The daemon SHALL handle `SIGTERM` and `SIGINT` signals by initiating a graceful shutdown sequence: stop all managed services, close the HTTP server, and exit with code 0.

#### Scenario: OS sends SIGTERM via service control
- **WHEN** the Windows Service Manager sends a stop signal (`sc stop WinCTL`)
- **THEN** the daemon SHALL stop all running managed services, close the HTTP server, and exit with code 0 within 5 seconds

#### Scenario: User presses Ctrl+C
- **WHEN** the daemon receives `SIGINT` (e.g., Ctrl+C in a terminal)
- **THEN** the daemon SHALL perform the same graceful shutdown as for `SIGTERM`

### Requirement: API graceful shutdown endpoint
The `/api/shutdown` endpoint SHALL stop all managed services before exiting the daemon process.

#### Scenario: CLI calls shutdown API
- **WHEN** a POST request is made to `/api/shutdown`
- **THEN** the daemon SHALL respond with `{ ok: true }`, stop all running managed services, close the HTTP server, and exit with code 0

### Requirement: API force shutdown endpoint
The `/api/shutdown/force` endpoint SHALL immediately terminate the daemon without waiting for managed services to stop.

#### Scenario: CLI calls force shutdown API
- **WHEN** a POST request is made to `/api/shutdown/force`
- **THEN** the daemon SHALL respond with `{ ok: true }` and exit with code 1 within 500ms, without waiting for managed services

### Requirement: Force stop always terminates
`winctl stop -f` SHALL terminate the daemon process regardless of its current state, using progressively aggressive methods.

#### Scenario: Force stop when daemon is responsive
- **WHEN** the user runs `winctl stop -f` and the daemon API is reachable
- **THEN** the CLI SHALL call `/api/shutdown/force` and the daemon SHALL exit

#### Scenario: Force stop when daemon is unresponsive
- **WHEN** the user runs `winctl stop -f` and the daemon API is not reachable
- **THEN** the CLI SHALL use `taskkill` to kill the `winctl-daemon.exe` process by image name

### Requirement: Daemon PID in status API
The `/api/status` endpoint SHALL include the daemon's own process ID.

#### Scenario: Status returns daemon PID
- **WHEN** a GET request is made to `/api/status`
- **THEN** the response SHALL include a `pid` field with the daemon's process ID as a number

### Requirement: Shutdown timeout
The graceful shutdown sequence SHALL have a hard timeout to guarantee the process exits even if service cleanup hangs.

#### Scenario: Shutdown cleanup takes too long
- **WHEN** a graceful shutdown is initiated and managed services do not stop within 5 seconds
- **THEN** the daemon SHALL force-exit with code 1
