## ADDED Requirements

### Requirement: start-svc CLI subcommand
The CLI SHALL implement `winctl start-svc <id>` as an alias for `winctl start <id>`.

#### Scenario: start-svc starts a service
- **WHEN** the user runs `winctl start-svc <service-id>`
- **THEN** the CLI SHALL send a start request to the daemon for that service
- **THEN** the CLI SHALL print a success confirmation or error message

---

### Requirement: stop-svc CLI subcommand
The CLI SHALL implement `winctl stop-svc <id>` as an alias for `winctl stop <id>`.

#### Scenario: stop-svc stops a service
- **WHEN** the user runs `winctl stop-svc <service-id>`
- **THEN** the CLI SHALL send a stop request to the daemon for that service
- **THEN** the CLI SHALL print a success confirmation or error message

---

### Requirement: restart-svc CLI subcommand
The CLI SHALL implement `winctl restart-svc <id>` as an alias for `winctl restart <id>`.

#### Scenario: restart-svc restarts a service
- **WHEN** the user runs `winctl restart-svc <service-id>`
- **THEN** the CLI SHALL send a restart request to the daemon for that service
- **THEN** the CLI SHALL print a success confirmation or error message

#### Scenario: Unknown command still prints error
- **WHEN** the user runs `winctl <unknown-command>`
- **THEN** the CLI SHALL print "Unknown command: <unknown-command>" and exit with a non-zero code
