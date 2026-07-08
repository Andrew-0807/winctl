## ADDED Requirements

### Requirement: Cooperative shutdown replaces process::exit
The shutdown and restart handlers SHALL NOT call `std::process::exit(0)`. Instead, they SHALL send a signal via a shutdown channel (`tokio::sync::watch`). The main server loop SHALL receive this signal and initiate an orderly shutdown: (1) stop accepting new HTTP connections, (2) kill managed processes if `keep_services_on_exit` is false, (3) await pending config writes, (4) drop all resources.

#### Scenario: Graceful shutdown completes without data loss
- **WHEN** `POST /api/shutdown` is called
- **AND** a config write is in progress
- **THEN** the server waits for the write to complete before exiting
- **AND** no config files are left in a corrupted state

#### Scenario: Shutdown kills managed processes
- **WHEN** `POST /api/shutdown` is called
- **AND** `keep_services_on_exit` is false
- **AND** there are running managed processes
- **THEN** all managed processes are killed before the server exits

#### Scenario: Shutdown preserves processes when configured
- **WHEN** `POST /api/shutdown` is called
- **AND** `keep_services_on_exit` is true
- **THEN** managed processes are left running

### Requirement: Child process kill timeout
When killing managed processes during shutdown, the server SHALL wait up to 5 seconds for each process to exit after sending the kill signal. If a process does not exit within 5 seconds, the server SHALL force-kill it using `taskkill /F /PID`.

#### Scenario: Process exits within timeout
- **WHEN** a managed process is killed during shutdown
- **AND** the process exits within 5 seconds
- **THEN** no force-kill is needed

#### Scenario: Hung process is force-killed
- **WHEN** a managed process is killed during shutdown
- **AND** the process does not exit within 5 seconds
- **THEN** `taskkill /F /PID` is invoked to force-terminate it

### Requirement: Restart spawns new process before exit
The restart handler SHALL spawn the new WinCTL process BEFORE initiating shutdown of the current process. This ensures continuity of service.

#### Scenario: Restart launches new instance
- **WHEN** `POST /api/restart` is called
- **THEN** a new WinCTL process is spawned
- **AND** the current process performs graceful shutdown

### Requirement: Port unification
The default port SHALL be 8888 everywhere: `DEFAULT_PORT` constant in `lib.rs`, `Settings::default()`, CLI default, and Tauri frontend. The Tauri frontend SHALL read the port from settings at startup via a Tauri command rather than hardcoding it.

#### Scenario: Fresh install uses consistent port
- **WHEN** WinCTL is installed fresh
- **AND** no `WINCTL_PORT` env var is set
- **THEN** the server listens on port 8888
- **AND** the CLI connects to port 8888
- **AND** the frontend connects to port 8888

#### Scenario: Custom port is respected everywhere
- **WHEN** `settings.port` is set to 9000
- **THEN** the server listens on port 9000
- **AND** the frontend connects to port 9000
