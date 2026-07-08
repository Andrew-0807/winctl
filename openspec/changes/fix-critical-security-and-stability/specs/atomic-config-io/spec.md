## ADDED Requirements

### Requirement: Atomic config file writes
The `write_services` and `write_settings` functions SHALL use an atomic write pattern: (1) serialize content to a temporary file (`.tmp` suffix in the same directory), (2) rename the temporary file over the target file. If the rename fails, the function SHALL fall back to a direct write with explicit flush. The function MUST NOT leave a corrupted target file on crash or power failure.

#### Scenario: Normal write succeeds atomically
- **WHEN** `write_services` is called with valid config
- **THEN** a `.tmp` file is written first
- **AND** it is renamed over `services.json`
- **AND** the cache is updated

#### Scenario: Crash during write does not corrupt config
- **WHEN** the process crashes after writing the `.tmp` file but before rename
- **THEN** `services.json` still contains the previous valid content
- **AND** the orphaned `.tmp` file remains (harmless)

### Requirement: Config write errors propagated to callers
All call sites that currently discard config write results with `let _ = config::write_services(...)` or `let _ = config::write_settings(...)` SHALL propagate the error to the HTTP response. Write failures MUST result in HTTP 500 Internal Server Error with a descriptive error message.

#### Scenario: Disk full during service creation
- **WHEN** a `POST /api/services` request is processed
- **AND** `write_services` fails due to disk full
- **THEN** the endpoint returns 500 Internal Server Error with body `{"error": "Failed to save configuration"}`
- **AND** the in-memory state is NOT updated (rolled back)

#### Scenario: Write failure on service delete
- **WHEN** a `DELETE /api/services/{id}` request is processed
- **AND** `write_services` fails
- **THEN** the endpoint returns 500 Internal Server Error
- **AND** the service is NOT removed from in-memory state

### Requirement: Rollback in-memory state on write failure
When a config write fails, the in-memory state (behind the `RwLock`) MUST be reverted to the state before the mutation. The caller SHALL clone the previous state before mutating, and restore it if the write fails.

#### Scenario: Failed write rolls back in-memory services
- **WHEN** a service is added to the in-memory list
- **AND** `write_services` fails
- **THEN** the in-memory services list does not contain the new service
- **AND** subsequent `GET /api/services` does not include the new service
