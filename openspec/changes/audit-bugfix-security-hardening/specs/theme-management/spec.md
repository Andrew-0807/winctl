## MODIFIED Requirements

### Requirement: Theme creation prevents silent overwrites
The system SHALL return a conflict error when a new theme's derived ID collides with an existing theme, rather than silently overwriting it.

#### Scenario: Theme name collision detected
- **WHEN** a new theme is submitted with a name that derives to an existing theme ID
- **THEN** the server SHALL return HTTP 409 Conflict
- **THEN** the existing theme SHALL NOT be modified

#### Scenario: Theme creation with unique name
- **WHEN** a new theme is submitted with a name that derives to a unique ID
- **THEN** the server SHALL create and persist the theme
- **THEN** the server SHALL return the new theme ID in the response

#### Scenario: Frontend handles 409 with suffix retry
- **WHEN** the frontend receives a 409 on theme creation
- **THEN** it SHALL append a numeric suffix to the theme name and retry (e.g., "My Theme" → "My Theme 2")
- **THEN** it SHALL retry up to 5 times before surfacing an error to the user

---

### Requirement: addAlpha produces correct hex for all inputs
The alpha-blending utility SHALL produce valid 2-character hex alpha strings for any 1- or 2-character input.

#### Scenario: 1-character alpha input
- **WHEN** `addAlpha` is called with a 1-character alpha string (e.g., `'3'`)
- **THEN** the result SHALL pad to 2 characters (e.g., `'03'`), not double the character (`'33'`)

#### Scenario: 2-character alpha input
- **WHEN** `addAlpha` is called with a 2-character alpha string (e.g., `'4d'`)
- **THEN** the result SHALL append that string unchanged, producing a valid 8-character hex color
