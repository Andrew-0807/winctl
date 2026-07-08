## ADDED Requirements

### Requirement: REST API compatibility
The system SHALL expose all existing REST endpoints under `/api/` with identical request/response schemas so that existing browser clients and the CLI require no changes.

#### Scenario: Existing API call succeeds
- **WHEN** a client sends a request to any `/api/*` endpoint that was supported by Express
- **THEN** the axum handler returns the same HTTP status and JSON body structure

### Requirement: WebSocket status broadcast
The system SHALL accept WebSocket connections at `/ws` and push a JSON status payload to all connected clients whenever service state changes, replacing the Socket.IO `status` event.

#### Scenario: Client receives status update
- **WHEN** a service changes state and a client is connected via WebSocket
- **THEN** the client receives a JSON message with the full service list within 100 ms

### Requirement: Static file serving
The system SHALL serve the compiled React SPA assets from `dist/` (embedded in the binary for production builds) on all non-API, non-WebSocket routes.

#### Scenario: SPA loads from binary
- **WHEN** a browser navigates to `http://localhost:WINCTL_PORT/`
- **THEN** the React SPA HTML is returned without any external file reads

### Requirement: Port configuration
The system SHALL read the `WINCTL_PORT` environment variable and fall back to port `8080` when the variable is not set.

#### Scenario: Custom port
- **WHEN** `WINCTL_PORT=9000` is set in the environment
- **THEN** the HTTP server listens on port 9000

### Requirement: Route ordering for service ID disambiguation
The system SHALL register `/api/services/reorder` before `/api/services/:id` so that the literal string `reorder` is never treated as a service ID.

#### Scenario: Reorder endpoint is reachable
- **WHEN** a POST request is sent to `/api/services/reorder`
- **THEN** the reorder handler is invoked, not the service-by-ID handler
