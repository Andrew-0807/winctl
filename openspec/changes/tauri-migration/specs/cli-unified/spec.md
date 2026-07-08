## ADDED Requirements

### Requirement: CLI subcommand detection
The system SHALL detect CLI mode at startup when the first argument is a known subcommand name and SHALL execute the subcommand instead of starting the GUI or server.

#### Scenario: CLI mode detected
- **WHEN** `winctl.exe start redis` is executed
- **THEN** no window or tray is created; the app sends an HTTP request to the running instance and exits after printing the result

### Requirement: CLI subcommand parity
The system SHALL support all subcommands previously provided by the separate CLI binary: `start`, `stop`, `restart`, `status`, `services`, `start-svc`, `stop-svc`, `restart-svc`, `logs`, `open`, `setup-firewall`, `init`.

#### Scenario: All subcommands available
- **WHEN** `winctl.exe --help` is executed
- **THEN** the help output lists all previously-supported subcommands

### Requirement: CLI communicates over HTTP
The system SHALL implement all CLI subcommands by sending HTTP requests to `localhost:WINCTL_PORT`, using the same REST API that browser clients use.

#### Scenario: CLI delegates to running instance
- **WHEN** `winctl.exe logs myservice` is executed while a WinCTL instance is already running
- **THEN** the CLI fetches logs from the running instance and prints them to stdout, then exits

### Requirement: CLI error on no running instance
The system SHALL print a clear error message and exit with a non-zero code when a CLI subcommand is invoked but no WinCTL instance is running on WINCTL_PORT.

#### Scenario: No running instance
- **WHEN** a CLI subcommand is invoked with no WinCTL instance running
- **THEN** the output contains "WinCTL is not running" (or equivalent) and the exit code is non-zero
