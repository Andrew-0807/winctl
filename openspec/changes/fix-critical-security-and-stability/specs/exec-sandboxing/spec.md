## ADDED Requirements

### Requirement: Exec endpoint is disabled by default
The exec endpoint (`POST /api/exec`) SHALL be disabled by default. When disabled, the endpoint SHALL return 403 Forbidden with error message "Exec endpoint is disabled". Users MUST explicitly enable it via `settings.json` field `exec_enabled: true` or through the settings API.

#### Scenario: Exec disabled by default on fresh install
- **WHEN** the server starts with default settings
- **THEN** `POST /api/exec` returns 403 Forbidden with body `{"error": "Exec endpoint is disabled"}`

#### Scenario: Exec enabled via settings
- **WHEN** `settings.exec_enabled` is `true`
- **AND** a valid authenticated request is sent to `POST /api/exec`
- **THEN** the endpoint processes the command

### Requirement: Command allowlist validation
When the exec endpoint is enabled, it SHALL validate the command against a configurable allowlist stored in `settings.exec_allowlist` (array of strings). Only the command basename (the portion before the first space or the entire string if no spaces) SHALL be matched against the allowlist. The match MUST be case-insensitive.

#### Scenario: Command in allowlist
- **WHEN** `exec_enabled` is true and `exec_allowlist` contains `["node", "python"]`
- **AND** a request is sent with command `node server.js`
- **THEN** the command is executed

#### Scenario: Command not in allowlist
- **WHEN** `exec_enabled` is true and `exec_allowlist` contains `["node", "python"]`
- **AND** a request is sent with command `cmd /c del *`
- **THEN** the endpoint returns 403 Forbidden with body `{"error": "Command not in allowlist"}`

#### Scenario: Empty allowlist blocks all commands
- **WHEN** `exec_enabled` is true and `exec_allowlist` is empty `[]`
- **THEN** all commands are rejected with 403 Forbidden

### Requirement: Working directory validation
The `cwd` field in exec requests SHALL be validated. If provided, it MUST be an absolute path that exists on the filesystem. Relative paths and non-existent paths SHALL be rejected with 400 Bad Request.

#### Scenario: Valid absolute cwd
- **WHEN** a request is sent with `cwd: "C:\\Users\\me\\project"`
- **AND** that path exists
- **THEN** the command runs in that directory

#### Scenario: Relative cwd rejected
- **WHEN** a request is sent with `cwd: "../../etc"`
- **THEN** the endpoint returns 400 Bad Request with body `{"error": "cwd must be an absolute path"}`

#### Scenario: Non-existent cwd rejected
- **WHEN** a request is sent with `cwd: "C:\\nonexistent\\path"`
- **AND** that path does not exist
- **THEN** the endpoint returns 400 Bad Request with body `{"error": "cwd path does not exist"}`
