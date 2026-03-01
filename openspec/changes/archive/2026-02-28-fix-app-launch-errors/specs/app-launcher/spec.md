## ADDED Requirements

### Requirement: App Launcher File Type Handling
The system SHALL use the appropriate runner based on the file extension of the configured item.

#### Scenario: Launching an AutoHotkey script
- **WHEN** the item to launch is an `.ahk` file and the user presses start
- **THEN** the system executes the file with the AutoHotkey executable or default system association

#### Scenario: Launching a generic executable
- **WHEN** the item to launch is an `.exe` file
- **THEN** the system spawns the executable directly

### Requirement: App Launcher Working Directory Resolution
The system SHALL resolve the working directory to the target executable's directory if not explicitly provided, to prevent `ENOENT` errors.

#### Scenario: Launching an app with no explicit working directory
- **WHEN** the app configuration does not specify a `cwd`
- **THEN** the system determines the `cwd` from the target file path and uses it for the spawned process

### Requirement: App Launcher Error Handling
The system SHALL catch spawn errors and prevent the main application from crashing.

#### Scenario: Launching a non-existent file
- **WHEN** the target file does not exist
- **THEN** the system catches the `ENOENT` error and logs a clear error message instead of crashing
