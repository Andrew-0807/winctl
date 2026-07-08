## ADDED Requirements

### Requirement: Non-purple accent color
The system SHALL replace the `--accent` CSS variable value of `#5e72e4` (generic AI-purple) with `#3b82f6` (electric blue). The `--accent-glow` token SHALL be updated to `rgba(59, 130, 246, 0.25)`. All existing usages of `var(--accent)` in the codebase SHALL automatically adopt the new value via the token.

#### Scenario: Accent button/control uses blue
- **WHEN** a user views any element using `var(--accent)` (focused elements, active states, accent highlights)
- **THEN** the element renders in electric blue (#3b82f6), not purple

#### Scenario: Built-in themes use new accent
- **WHEN** the daemon writes built-in theme files to `~/.config/winctl/themes/` on startup
- **THEN** the default theme's accent token SHALL be `#3b82f6`

### Requirement: Tinted shadows
The system SHALL use shadows tinted to the background hue rather than neutral black shadows. The `--shadow-card` token SHALL be `0 2px 8px rgba(13, 15, 20, 0.6)` (tinted to `--bg`). The `--shadow-modal` token SHALL be `0 10px 40px rgba(13, 15, 20, 0.8)`. No shadow SHALL use pure `rgba(0,0,0,...)` form.

#### Scenario: Card shadow tinting
- **WHEN** a service card renders with a shadow
- **THEN** the shadow color has the dark blue-black hue of the app background, not neutral black

### Requirement: Stopped state visual de-emphasis
The system SHALL visually de-emphasize stopped services by reducing the service name opacity to `0.65` and the status dot border to `var(--border2)` when status is "stopped". Running services SHALL render at full opacity. This creates a clear visual hierarchy between active and inactive services.

#### Scenario: Stopped service appearance
- **WHEN** a service has status "stopped"
- **THEN** the service name and meta text render at reduced opacity (≤ 0.7), clearly dimmer than running services

#### Scenario: Running service appearance
- **WHEN** a service has status "running"
- **THEN** the service name and card render at full opacity (1.0)

### Requirement: Accent glow de-saturation
The system SHALL use the `--accent-glow` token at a maximum alpha of `0.25` for all glow/halo effects. No element SHALL use a glow with alpha higher than `0.3`. This prevents neon/garish glow aesthetics.

#### Scenario: Focused element glow
- **WHEN** an interactive element receives focus or is in an active accent state
- **THEN** any glow effect uses `var(--accent-glow)` (alpha ≤ 0.25), not a full-opacity accent color
