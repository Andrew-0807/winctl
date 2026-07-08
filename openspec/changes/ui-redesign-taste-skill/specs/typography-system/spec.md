## ADDED Requirements

### Requirement: Dual-font hierarchy
The system SHALL use two distinct font families: Geist Sans for all UI chrome (navigation, labels, modal headers, button text, metadata, settings), and 0xProto for all terminal/data content (service names, log output, PID values, command strings, port numbers, uptime, restart counts). The `--font-sans` CSS variable SHALL resolve to `'Geist', system-ui, sans-serif`. The `--font-mono` CSS variable SHALL remain `'0xProto', monospace`.

#### Scenario: UI chrome uses sans-serif
- **WHEN** a user views the sidebar navigation, modal headers, or status badge text
- **THEN** the text renders in Geist Sans (or system-ui fallback), not a monospace font

#### Scenario: Terminal data uses monospace
- **WHEN** a user views log output, PID numbers, service command strings, or uptime values
- **THEN** the text renders in 0xProto monospace

#### Scenario: Font fallback on no network
- **WHEN** Geist Sans fails to load (no internet, CDN blocked)
- **THEN** the UI degrades gracefully to `system-ui` sans-serif with no layout breakage

### Requirement: Font weight scale
The system SHALL use a consistent weight scale: Regular (400) for body/meta text, Medium (500) for labels and badge text, SemiBold (600) for service names, modal titles, and section headings. No weight outside 400–600 SHALL be used.

#### Scenario: Service name weight
- **WHEN** a user views a service card
- **THEN** the service name renders at font-weight 600 (SemiBold), visually dominant over meta text

#### Scenario: Meta text weight
- **WHEN** a user views PID, uptime, and restart count on a service card
- **THEN** the meta text renders at font-weight 400 and reduced opacity (~60%), clearly subordinate to the service name

### Requirement: Letter-spacing per context
The system SHALL apply `letter-spacing: -0.01em` to service names and headings (tighter, premium feel), and `letter-spacing: 0.06em` to uppercase labels and badge text (wider, readable at small size). Body text and meta SHALL use default `letter-spacing: normal`.

#### Scenario: Badge letter-spacing
- **WHEN** a status badge displays "Running" or "Stopped"
- **THEN** the text has positive letter-spacing (≥ 0.05em) for legibility at small size

#### Scenario: Service name letter-spacing
- **WHEN** a service name renders in a card
- **THEN** the name has slight negative letter-spacing (≤ -0.01em) for a premium, tight feel

### Requirement: Status badge sentence case
The system SHALL display status badge text in sentence case (e.g., "Running", "Stopped", "Starting…", "Stopping…") rather than all-caps (e.g., "RUNNING"). The badge SHALL render at `font-size: 0.6875rem` (11px) with `font-weight: 500`.

#### Scenario: Running badge text
- **WHEN** a service has status "running"
- **THEN** the badge displays "Running" (sentence case), not "RUNNING"

#### Scenario: Stopped badge text
- **WHEN** a service has status "stopped"
- **THEN** the badge displays "Stopped" (sentence case), not "STOPPED"
