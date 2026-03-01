### Requirement: Serve frontend client on root route
The system SHALL properly serve the client application at the root path (`/`), instead of failing with a "cannot get /" error.

#### Scenario: Requesting the root path
- **WHEN** a client makes a GET request to `/`
- **THEN** the system returns the compiled SolidJS frontend application
