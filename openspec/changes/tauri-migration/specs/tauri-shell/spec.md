## ADDED Requirements

### Requirement: Single binary application
The system SHALL be distributed as a single `winctl.exe` file containing the Rust backend, embedded React SPA assets, and CLI entry points with no external Node.js runtime dependency.

#### Scenario: Clean install runs without Node
- **WHEN** a user double-clicks `winctl.exe` on a machine with no Node.js installed
- **THEN** the application starts successfully and the dashboard is accessible

### Requirement: GUI mode
The system SHALL open a native window hosting the React dashboard when launched without flags, in addition to the system tray icon.

#### Scenario: Default launch shows window and tray
- **WHEN** `winctl.exe` is executed with no arguments
- **THEN** a WebView2 window opens with the dashboard AND a tray icon appears in the notification area

### Requirement: Headless mode
The system SHALL support a `--headless` flag that starts the HTTP server and tray icon without opening a window.

#### Scenario: Headless startup
- **WHEN** `winctl.exe --headless` is executed
- **THEN** no window opens, the tray icon appears, and the HTTP API responds on WINCTL_PORT

### Requirement: Service mode
The system SHALL support a `--service` flag that runs the HTTP server with no window and no tray icon, suitable for Windows Service hosting.

#### Scenario: Service mode startup
- **WHEN** `winctl.exe --service` is executed
- **THEN** no window and no tray icon are created, the HTTP API responds on WINCTL_PORT, and the process runs until terminated

### Requirement: Task Manager identity
The application process SHALL appear as `winctl.exe` (or the app display name "WinCTL") in Windows Task Manager with no sibling `node.exe` processes.

#### Scenario: Task Manager shows single process
- **WHEN** `winctl.exe` is running in any mode
- **THEN** Task Manager shows exactly one `winctl.exe` entry and zero `node.exe` entries attributable to WinCTL
