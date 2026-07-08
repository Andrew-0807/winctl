## MODIFIED Requirements

### Requirement: Serve frontend client on root route
The system SHALL properly serve the client application at the root path (`/`), instead of failing with a "cannot get /" error. When running inside a Tauri webview, the system SHALL auto-authenticate the user without requiring manual login.

#### Scenario: Requesting the root path
- **WHEN** a client makes a GET request to `/`
- **THEN** the system returns the compiled React frontend application

#### Scenario: Tauri webview auto-login
- **WHEN** the frontend detects it is running inside a Tauri webview (`__TAURI_INTERNALS__` is present)
- **AND** onboarding has been completed
- **THEN** the user MUST be automatically logged in without seeing the login screen
- **AND** the main application view MUST be displayed immediately

#### Scenario: Browser remote access still requires login
- **WHEN** the frontend detects it is running in a browser (not Tauri webview)
- **AND** open_access is false
- **AND** no valid token is stored
- **THEN** the user MUST be shown the login screen
