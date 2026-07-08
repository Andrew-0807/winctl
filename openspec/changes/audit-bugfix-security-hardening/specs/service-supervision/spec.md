## MODIFIED Requirements

### Requirement: Externally-owned process liveness check uses OS PID
The system SHALL determine liveness of externally-owned services by querying the OS for the stored PID's exit status, not by checking the child handle.

#### Scenario: Externally-owned service is running
- **WHEN** an externally-owned service has a stored PID and the OS reports it as still alive
- **THEN** `is_process_alive` SHALL return true
- **THEN** the supervisor SHALL NOT attempt to respawn it

#### Scenario: Externally-owned service has exited
- **WHEN** an externally-owned service has a stored PID and the OS reports it has exited
- **THEN** `is_process_alive` SHALL return false
- **THEN** if `auto_restart` is set, the supervisor SHALL attempt to respawn it

#### Scenario: Externally-owned service has no stored PID
- **WHEN** an externally-owned service has no PID recorded
- **THEN** `is_process_alive` SHALL return false

---

### Requirement: RwLock poison handled gracefully in enrich_services
The system SHALL not panic when the process map RwLock is poisoned during a status broadcast.

#### Scenario: Poisoned RwLock encountered
- **WHEN** `enrich_services` attempts to acquire the process map read lock and it is poisoned
- **THEN** the function SHALL log an error and return the services list unenriched
- **THEN** the daemon SHALL continue running and NOT panic

---

### Requirement: Initial status broadcast uses enriched data
The system SHALL enrich service data before emitting the initial status event on startup.

#### Scenario: First connected client receives enriched status
- **WHEN** a WebSocket client connects immediately after daemon start
- **THEN** the first `status` event received SHALL include `status`, `pid`, and `restartCount` for each service
- **THEN** fields SHALL NOT be `undefined` for services that are already running
