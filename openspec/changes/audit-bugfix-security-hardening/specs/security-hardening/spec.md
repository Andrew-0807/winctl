## ADDED Requirements

### Requirement: Timing-safe token validation
The system SHALL compare authentication tokens using a constant-time byte comparison to prevent timing side-channel attacks.

#### Scenario: Valid token accepted without timing leak
- **WHEN** a request is received with a valid bearer token
- **THEN** the system SHALL validate the token using constant-time comparison and grant access

#### Scenario: Invalid token rejected without timing leak
- **WHEN** a request is received with an invalid bearer token
- **THEN** the system SHALL reject the request with 401, taking the same wall-clock time regardless of how many bytes match

---

### Requirement: PowerShell command injection prevention
The system SHALL sanitize all user-supplied strings before interpolating them into PowerShell command strings.

#### Scenario: Service name with single quotes
- **WHEN** a service's command or args contains a single-quote character
- **THEN** the system SHALL escape it (doubling: `'` → `''`) before inserting into any PowerShell string
- **THEN** the resulting PowerShell SHALL execute the intended filter without command injection

#### Scenario: Service name with pipeline/brace characters
- **WHEN** a service's command contains `|`, `}`, `;`, or other PowerShell metacharacters
- **THEN** the system SHALL escape them appropriately so no unintended code executes

---

### Requirement: Fetch tool allowlist
The system SHALL restrict the `fetchTool` setting to a fixed allowlist of known tools.

#### Scenario: Valid fetch tool configured
- **WHEN** `fetchTool` is set to `fastfetch`, `neofetch`, or `winfetch`
- **THEN** the system SHALL execute that tool when the fetch endpoint is called

#### Scenario: Invalid fetch tool rejected
- **WHEN** `fetchTool` is set to any value not on the allowlist
- **THEN** the system SHALL return an error and SHALL NOT execute the value as a shell command

---

### Requirement: Reasonable token TTL
The system SHALL issue tokens with a maximum lifetime of 30 days.

#### Scenario: Token expires after 30 days
- **WHEN** a token was issued more than 30 days ago
- **THEN** the system SHALL reject it with 401 and the client SHALL re-authenticate

---

### Requirement: Token revocation on credential rotation
The system SHALL invalidate all existing tokens when `complete_setup` is called with a new `api_secret`.

#### Scenario: Re-setup invalidates old tokens
- **WHEN** `complete_setup` is called (even if a signing key already exists)
- **THEN** the system SHALL generate a new signing key
- **THEN** all previously issued tokens SHALL become invalid immediately
- **THEN** clients presenting old tokens SHALL receive 401

---

### Requirement: open_access runtime sync
The system SHALL apply `openAccess` setting changes immediately without requiring a daemon restart.

#### Scenario: openAccess toggled via settings API
- **WHEN** the settings API receives an updated `openAccess` value
- **THEN** the in-memory auth state SHALL be updated atomically within the same request
- **THEN** subsequent requests SHALL enforce the new policy without a restart

---

### Requirement: Clipboard auto-copy default off
The system SHALL default `clipboard_auto_copy` to `false` for new installations.

#### Scenario: Fresh install does not copy secret to clipboard
- **WHEN** WinCTL starts for the first time with no existing settings
- **THEN** the API secret SHALL NOT be automatically copied to the clipboard
- **THEN** the user must explicitly request the secret be copied
