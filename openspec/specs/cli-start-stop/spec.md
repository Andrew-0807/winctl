## ADDED Requirements

### Requirement: State-Aware Start
The `start` command must verify that no daemon is currently running on the target port before attempting to start it.

#### Scenario: Starting on an occupied port
- **WHEN** a user runs `winctl start` and a daemon is already running (or the port is occupied)
- **THEN** it should output a message indicating the daemon is already running on that port, and NOT attempt to start a new sequence.

### Requirement: State-Aware Stop
The `stop` command must verify that a daemon is actually running before attempting the stop sequence.

#### Scenario: Stopping when nothing is running
- **WHEN** a user runs `winctl stop` and no daemon is running
- **THEN** it should output a message indicating that nothing is running, and NOT attempt to execute the stop sequence.
