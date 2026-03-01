## ADDED Requirements

### Requirement: Spawn executables with spaces in path
The system SHALL successfully start executables whose paths contain spaces without returning ENOENT error.

#### Scenario: Start Radmin VPN
- **WHEN** user starts a service with command "C:\\Program Files (x86)\\Radmin VPN\\RvRvpnGui.exe"
- **THEN** the application launches successfully
- **AND** no ENOENT error is logged

#### Scenario: Start app in Program Files
- **WHEN** user starts a service with command "C:\\Program Files\\MyApp\\app.exe"
- **THEN** the application launches successfully

#### Scenario: Start app with spaces in folder name
- **WHEN** user starts a service with command "C:\\My Apps\\Test App\\app.exe"
- **THEN** the application launches successfully

### Requirement: Fallback spawn for paths with spaces
The system SHALL use shell-based spawning as fallback when direct spawn fails for paths with spaces.

#### Scenario: Retry with shell on ENOENT
- **WHEN** direct spawn fails with ENOENT for a path containing spaces
- **THEN** system retries spawn with shell: true
- **AND** the application launches successfully

### Requirement: Search common Windows directories
The system SHALL search common Windows installation directories when resolving executable paths.

#### Scenario: Find exe in Program Files
- **WHEN** user provides command "RvRvpnGui.exe" without full path
- **AND** the executable exists in "C:\\Program Files (x86)\\Radmin VPN\"
- **THEN** system finds and launches the executable
