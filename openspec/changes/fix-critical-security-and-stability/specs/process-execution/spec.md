## MODIFIED Requirements

### Requirement: Service restart is serialized per service
The service restart operation (kill then spawn) SHALL be serialized per service using a per-service mutex. Both the explicit restart handler (`POST /api/services/{id}/restart`) and the supervision loop MUST acquire this lock. The supervision loop SHALL use a non-blocking `try_lock` and skip the service if the lock is currently held by an explicit restart.

#### Scenario: Explicit restart blocks supervision loop
- **WHEN** a user sends `POST /api/services/abc/restart`
- **AND** the supervision loop detects service "abc" is dead at the same moment
- **THEN** only one restart occurs (the explicit one holds the lock)
- **AND** the supervision loop skips "abc" for this cycle

#### Scenario: Supervision restart completes without conflict
- **WHEN** service "abc" dies with `auto_restart: true`
- **AND** no explicit restart is in progress
- **THEN** the supervision loop acquires the lock and restarts the service

### Requirement: Single Tokio runtime
The application SHALL use a single Tokio runtime for the HTTP server, auto-start, and supervision loop. The auto-start and supervision tasks SHALL be spawned as `tokio::spawn` tasks on the HTTP server's runtime, not on separate `Runtime::new()` instances. This ensures `tokio::process::Child` handles are valid across all tasks.

#### Scenario: Auto-started process can be stopped from HTTP handler
- **WHEN** a service is auto-started on boot
- **AND** a user sends `POST /api/services/{id}/stop`
- **THEN** the process is killed successfully (same runtime owns the Child handle)

#### Scenario: Supervision loop restarts process on same runtime
- **WHEN** a supervised service dies
- **THEN** the supervision loop spawns the replacement on the same Tokio runtime
- **AND** the new Child handle is accessible from HTTP handlers
