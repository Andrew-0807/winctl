## ADDED Requirements

### Requirement: API base URL resolution
The frontend SHALL construct API URLs using an absolute base URL when running inside a Tauri webview context, and SHALL use relative URLs when running in a browser context.

#### Scenario: Tauri webview API call
- **WHEN** `isTauri()` returns true
- **THEN** all `apiFetch()` calls MUST prefix the URL with `http://localhost:{port}` where `{port}` is the configured HTTP server port

#### Scenario: Browser API call
- **WHEN** `isTauri()` returns false
- **THEN** all `apiFetch()` calls MUST use relative URLs (e.g., `/api/services`)

### Requirement: WebSocket URL resolution
The WebSocket connection SHALL use an absolute URL when running inside a Tauri webview context.

#### Scenario: Tauri webview WebSocket connection
- **WHEN** `isTauri()` returns true AND the socket layer falls back to WebSocket mode
- **THEN** the WebSocket URL MUST be `ws://localhost:{port}/api/ws`

#### Scenario: Browser WebSocket connection
- **WHEN** `isTauri()` returns false
- **THEN** the WebSocket URL MUST be the relative path `/api/ws` (resolved by the browser against the current origin)

### Requirement: Backend port configuration
The HTTP server SHALL read its port from settings first, then environment variable, then default.

#### Scenario: Port from settings
- **WHEN** `settings.port` is set to a non-zero value
- **THEN** the HTTP server MUST bind to `settings.port`

#### Scenario: Port from environment
- **WHEN** `settings.port` is 0 (default) AND `WINCTL_PORT` environment variable is set
- **THEN** the HTTP server MUST bind to the port specified in `WINCTL_PORT`

#### Scenario: Default port
- **WHEN** neither `settings.port` nor `WINCTL_PORT` are configured
- **THEN** the HTTP server MUST bind to port 8080 (DEFAULT_PORT)

### Requirement: CSP allows Google Fonts
The Tauri CSP configuration SHALL permit loading fonts and stylesheets from Google Fonts CDN.

#### Scenario: Google Fonts loaded in build mode
- **WHEN** the app is running in Tauri webview build mode
- **THEN** stylesheets from `https://fonts.googleapis.com` MUST be loadable
- **AND** font files from `https://fonts.gstatic.com` MUST be loadable

### Requirement: Settings open_access propagation
The `update_settings` handler SHALL propagate the merged open_access value to the runtime atomic, not the pre-merge value.

#### Scenario: Toggling open_access via settings API
- **WHEN** a PUT request to `/api/settings` includes `open_access: true`
- **THEN** the runtime `open_access` atomic MUST be updated to `true`
- **AND** subsequent non-local requests without tokens MUST be allowed through

### Requirement: Auto-start in GUI mode
The application SHALL auto-start services with `auto_start: true` when launched in GUI mode (not just `--service` mode).

#### Scenario: GUI mode launch with auto-start services
- **WHEN** the app launches in GUI mode (no `--service` flag)
- **AND** `settings.auto_start` is true
- **AND** services have `auto_start: true`
- **THEN** those services MUST be spawned automatically

### Requirement: Process supervision in GUI mode
The application SHALL run the supervision loop for services with `auto_restart: true` in GUI mode.

#### Scenario: Service crash in GUI mode
- **WHEN** the app is running in GUI mode
- **AND** a service with `auto_restart: true` terminates unexpectedly
- **THEN** the supervision loop MUST attempt to restart the service with exponential backoff
