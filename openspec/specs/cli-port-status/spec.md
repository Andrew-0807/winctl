## ADDED Requirements

### Requirement: Check Specific Port Status
The WinCTL CLI must allow users to query the status of a daemon instance running on a specific port.

#### Scenario: User queries status of a running port
- **WHEN** the user runs `winctl status -p 8081` and a daemon is running on port 8081
- **THEN** the CLI should output that the daemon is running on port 8081.

#### Scenario: User queries status of an unoccupied port
- **WHEN** the user runs `winctl status -p 8081` and no daemon is running on port 8081
- **THEN** the CLI should output that no daemon is running on port 8081.
