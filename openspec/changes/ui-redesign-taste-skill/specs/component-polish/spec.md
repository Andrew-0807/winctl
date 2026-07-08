## ADDED Requirements

### Requirement: Service card hover state
The system SHALL apply a hover state to `.svc-card` that subtly lifts the card: `border-color` transitions to `var(--border2)` and `box-shadow` transitions to `var(--shadow-card)`. The `.svc-header` background SHALL shift to a slightly lighter surface on hover. No scale transform SHALL be applied to the full card (only to buttons on press).

#### Scenario: Card hover feedback
- **WHEN** a user hovers over a service card
- **THEN** the card border brightens and a subtle shadow appears, giving a "lift" effect

#### Scenario: Card hover is smooth
- **WHEN** a user's cursor enters or exits a service card
- **THEN** the hover state transitions smoothly using `var(--transition-base)`, not instantly

### Requirement: Status badge visual weight reduction
The system SHALL reduce the visual weight of status badges. The badge background SHALL have reduced opacity for the "stopped" state (using a dimmer variant of `--red-dim`). The badge SHALL use `font-size: 0.6875rem` and `font-weight: 500`. The badge border-radius SHALL be `4px` (square, not pill) to distinguish it from pill-style "tag" badges used elsewhere.

#### Scenario: Running badge appearance
- **WHEN** a service has status "running"
- **THEN** the badge renders with the green background (`--green-dim`), sentence-case text "Running", at reduced font size, with squared corners

#### Scenario: Stopped badge is visually subdued
- **WHEN** a service has status "stopped"
- **THEN** the stopped badge is noticeably less visually heavy than a running badge — dimmer background, same reduced size

### Requirement: Sidebar nav item hover and active states
The system SHALL apply a `background: var(--surface2)` hover state and `color: var(--text)` to `.nav-item` elements on hover, with a smooth transition. There SHALL be no instant color flash. The cursor SHALL be `pointer` on nav items.

#### Scenario: Nav item hover
- **WHEN** a user hovers over a sidebar nav item (Start All, Stop All, System Info, Settings)
- **THEN** the item highlights with a background fill and text brightens, both animated smoothly

### Requirement: Control button hover states
The system SHALL apply distinct hover backgrounds to `.ctrl-btn` variants: start button hover uses a subtle green tint (`var(--green-dim)`), stop button hover uses a subtle red tint (`var(--red-dim)`), edit button hover uses `var(--surface2)`. All buttons SHALL have `border-radius: 6px` and consistent `padding: 5px 7px`.

#### Scenario: Start button hover
- **WHEN** a user hovers over the start button on a stopped service
- **THEN** the button background tints green subtly, signaling the action's outcome

#### Scenario: Stop button hover
- **WHEN** a user hovers over the stop button on a running service
- **THEN** the button background tints red subtly, signaling the action's outcome

### Requirement: Service card information hierarchy
The system SHALL enforce a visual hierarchy within `.svc-card` where the service name is the most visually dominant element. Specifically: service name SHALL be `font-size: 0.9375rem` (15px), `font-weight: 600`, using `var(--font-sans)` (Geist). Meta text (PID, uptime, restarts) SHALL be `font-size: 0.75rem` (12px), `font-weight: 400`, `color: var(--text3)`, using `var(--font-mono)`.

#### Scenario: Service name dominance
- **WHEN** a user scans the service list
- **THEN** the service name is immediately visually distinct from and more prominent than the meta information below it

#### Scenario: Meta text is clearly secondary
- **WHEN** a user looks at PID and uptime values on a card
- **THEN** the meta text is visually subordinate (smaller, dimmer) than the service name
