## MODIFIED Requirements

### Requirement: Onboarding port selection takes effect
The system SHALL bind the HTTP server to the port selected during onboarding setup.

#### Scenario: User selects a custom port in onboarding
- **WHEN** the user completes the onboarding flow with a specific LAN port selected
- **THEN** the `complete_setup` request SHALL include the selected port
- **THEN** the daemon SHALL persist the port in settings
- **THEN** the daemon SHALL use that port for HTTP binding (or log a restart-required warning if already bound)

#### Scenario: User skips port selection
- **WHEN** the user completes onboarding without specifying a port
- **THEN** the daemon SHALL use the default port (8080)

---

### Requirement: Onboarding errors shown to user
The system SHALL display a visible error message when setup completion fails.

#### Scenario: Network error during setup
- **WHEN** the `complete_setup` API call fails due to a network or server error
- **THEN** the onboarding UI SHALL display a human-readable error message
- **THEN** the loading spinner SHALL stop
- **THEN** the user SHALL be able to retry the setup step

#### Scenario: Successful setup completes normally
- **WHEN** the `complete_setup` API call succeeds
- **THEN** the onboarding UI SHALL call `onComplete` and advance to the main UI
- **THEN** no error message SHALL be displayed
