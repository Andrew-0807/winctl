## ADDED Requirements

### Requirement: Global transition default
The system SHALL define a `--transition-base: 200ms cubic-bezier(0.16, 1, 0.3, 1)` CSS token and apply `transition: background var(--transition-base), border-color var(--transition-base), opacity var(--transition-base), box-shadow var(--transition-base)` to all interactive elements (buttons, nav items, cards). No interactive element SHALL have instant (0ms) visual state changes.

#### Scenario: Button hover transition
- **WHEN** a user hovers over any button (ctrl-btn, nav-item)
- **THEN** the background and border color change smoothly over ~200ms, not instantly

#### Scenario: Reduced motion preference
- **WHEN** the user's OS has `prefers-reduced-motion: reduce` set
- **THEN** all transitions and animations SHALL be disabled via a `@media (prefers-reduced-motion: reduce)` rule that sets `transition-duration: 0.01ms` and removes animation keyframes

### Requirement: Panel expand/collapse transition
The system SHALL animate the `.svc-panel` element's open/close state using a CSS `max-height` transition from `0` to a fixed maximum (`600px`) combined with `opacity` from `0` to `1`. The transition SHALL use `var(--transition-base)` timing. The panel MUST NOT appear/disappear instantly.

#### Scenario: Panel open animation
- **WHEN** a user clicks a service card header to expand the log panel
- **THEN** the panel slides down smoothly with a height and fade-in animation (~200ms)

#### Scenario: Panel close animation
- **WHEN** a user clicks a service card header to collapse the log panel
- **THEN** the panel slides up smoothly with a height and fade-out animation (~200ms)

### Requirement: Status dot pulse animation for running services
The system SHALL apply a continuous, low-key pulse `@keyframes` animation to the `.svc-status-dot` element when the service status is "running". The animation SHALL pulse the dot's box-shadow (using `--green` tinted glow) on a 2-second infinite loop with `ease-in-out` easing. The animation MUST be hardware-accelerated (using `transform` or `opacity` only, not `width`/`height`).

#### Scenario: Running service dot pulses
- **WHEN** a service has status "running"
- **THEN** the status dot has a continuous, subtle breathing pulse animation using a green glow

#### Scenario: Non-running service dot is static
- **WHEN** a service has status "stopped", "starting", or "stopping"
- **THEN** the status dot has no animation — it is static

### Requirement: Button press feedback
All control buttons (`.ctrl-btn`, `.nav-item`, sidebar buttons) SHALL apply `transform: scale(0.97)` on `:active` state to simulate physical press tactile feedback. The `:active` state SHALL also reduce opacity slightly (`opacity: 0.85`).

#### Scenario: Button press visual
- **WHEN** a user clicks and holds a start/stop/edit button
- **THEN** the button visibly scales down slightly (scale ~0.97) giving tactile press feedback

### Requirement: Card entrance stagger
The system SHALL apply a CSS entrance animation to service cards on initial render. Cards SHALL fade in and translate up from `translateY(8px)` to `translateY(0)` with staggered `animation-delay` based on their index (`calc(var(--card-index, 0) * 60ms)`). The animation SHALL run once on mount (no loop).

#### Scenario: Service list initial load
- **WHEN** the service list renders for the first time after page load
- **THEN** cards appear sequentially with a short stagger delay between each card (not all simultaneously)
