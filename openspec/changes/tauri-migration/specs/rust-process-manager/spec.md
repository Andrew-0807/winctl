## ADDED Requirements

### Requirement: Spawn managed processes
The system SHALL spawn configured services as child processes of `winctl.exe` using the Rust async runtime, capturing stdout and stderr.

#### Scenario: Start a service
- **WHEN** a start request is issued for a configured service
- **THEN** the process is spawned, its PID is recorded, and its stdout/stderr are captured into the log buffer

### Requirement: In-memory log ring buffer
The system SHALL maintain a per-service in-memory log buffer of at least 500 lines, dropping the oldest entries when the limit is reached.

#### Scenario: Log buffer wraps at limit
- **WHEN** a service produces more than 500 log lines
- **THEN** only the 500 most recent lines are retained and older lines are discarded

### Requirement: Auto-restart with exponential backoff
The system SHALL automatically restart a service that exits unexpectedly, using exponential backoff starting at 1 second and capping at 30 seconds, up to a configurable maximum retry count.

#### Scenario: Service crashes and restarts
- **WHEN** a running service process exits with a non-zero code
- **THEN** the system waits the backoff interval and restarts the service, logging each attempt

#### Scenario: Max retries exceeded
- **WHEN** a service has restarted the maximum configured number of times without staying up
- **THEN** the system marks the service as errored and stops attempting restarts

### Requirement: Graceful stop
The system SHALL stop a managed service by sending a termination signal, waiting up to 5 seconds for graceful exit, then forcefully killing the process if it has not exited.

#### Scenario: Clean stop
- **WHEN** a stop request is issued for a running service
- **THEN** the process receives a termination signal and the system waits up to 5 seconds before force-killing

### Requirement: Process status broadcast
The system SHALL emit a status update event to all connected clients whenever a service changes state (started, stopped, errored, restarting).

#### Scenario: Status change propagates to UI
- **WHEN** a service transitions to any new state
- **THEN** a status broadcast is sent within 100 ms of the transition
