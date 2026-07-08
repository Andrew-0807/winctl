## ADDED Requirements

### Requirement: CSRF protection via Origin validation for localhost
The auth middleware SHALL validate the `Origin` header on localhost connections. If the `Origin` header is present and does not match an allowed origin, the request SHALL be rejected with 403 Forbidden. Allowed origins: `http://localhost:{port}`, `http://127.0.0.1:{port}`, `https://tauri.localhost`, `tauri://localhost`. If no `Origin` header is present (non-browser clients like CLI or curl), the request SHALL be allowed through for localhost connections.

#### Scenario: Browser request from WinCTL dashboard
- **WHEN** a localhost request has `Origin: http://localhost:8888`
- **AND** the server is running on port 8888
- **THEN** the request is allowed through without a token

#### Scenario: CSRF attack from foreign origin
- **WHEN** a localhost request has `Origin: http://evil.com`
- **THEN** the request is rejected with 403 Forbidden

#### Scenario: CLI request with no Origin header
- **WHEN** a localhost request has no `Origin` header
- **THEN** the request is allowed through without a token

#### Scenario: Tauri app request
- **WHEN** a localhost request has `Origin: tauri://localhost`
- **THEN** the request is allowed through without a token

### Requirement: Password hashing with argon2
The `api_secret` field in `settings.json` SHALL be stored as an argon2 hash, not plaintext. The `login` handler SHALL verify the submitted password against the hash using argon2 verify. The comparison MUST be constant-time (inherent in argon2 verify).

#### Scenario: Login with correct password against hashed secret
- **WHEN** a login request is sent with the correct password
- **AND** `api_secret` contains an argon2 hash
- **THEN** the server returns a valid auth token

#### Scenario: Login with incorrect password
- **WHEN** a login request is sent with an incorrect password
- **THEN** the server returns 401 Unauthorized

### Requirement: Automatic plaintext-to-hash migration
On startup, if `api_secret` is set and does NOT start with `$argon2`, the server SHALL hash it with argon2 and write the hash back to `settings.json`. This provides seamless upgrade for existing installs.

#### Scenario: Legacy plaintext secret migrated on startup
- **WHEN** the server starts with `api_secret: "mypassword"` in settings.json
- **THEN** the server replaces it with `api_secret: "$argon2id$..."` and writes to disk
- **AND** login with "mypassword" succeeds

### Requirement: WebSocket authentication
After WebSocket upgrade on the `/api/ws` endpoint, the server SHALL wait up to 5 seconds for an authentication message with format `{"type":"auth","token":"<token>"}`. If no valid auth message arrives within the timeout, the server SHALL close the connection with WebSocket close code 4001. Localhost connections with a valid Origin (per CSRF rules) SHALL be exempt from this requirement.

#### Scenario: Remote client authenticates WebSocket
- **WHEN** a remote client connects to `/api/ws`
- **AND** sends `{"type":"auth","token":"valid-token"}` within 5 seconds
- **THEN** the connection is established and status updates are received

#### Scenario: Remote client fails to authenticate
- **WHEN** a remote client connects to `/api/ws`
- **AND** sends no auth message within 5 seconds
- **THEN** the connection is closed with code 4001

#### Scenario: Localhost client with valid Origin skips auth
- **WHEN** a localhost client connects to `/api/ws`
- **AND** the WebSocket upgrade request had `Origin: http://localhost:8888`
- **THEN** the connection is established without needing an auth message

### Requirement: Setup endpoint idempotency guard
The `POST /api/setup/complete` endpoint SHALL reject requests with 409 Conflict when `settings.onboarding_complete` is already `true`. This prevents a setup race attack where a network attacker completes setup before the legitimate user.

#### Scenario: First-time setup succeeds
- **WHEN** `onboarding_complete` is false
- **AND** a valid setup request is sent
- **THEN** setup completes and `onboarding_complete` is set to true

#### Scenario: Duplicate setup rejected
- **WHEN** `onboarding_complete` is already true
- **AND** a setup request is sent
- **THEN** the server returns 409 Conflict with body `{"error": "Setup already completed"}`

### Requirement: Settings update preserves trusted_devices
The `PUT /api/settings` handler SHALL preserve the `trusted_devices` array from the current settings when merging updates, in addition to the already-preserved `api_secret` and `signing_key` fields.

#### Scenario: Settings update does not wipe trusted devices
- **WHEN** a settings update is sent without a `trusted_devices` field
- **THEN** the existing `trusted_devices` array is preserved unchanged
