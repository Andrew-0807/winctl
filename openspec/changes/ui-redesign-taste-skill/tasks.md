## 1. Font System

- [x] 1.1 Add Geist Sans Google Fonts `@import` at the top of `variables.css`
- [x] 1.2 Update `--font-sans` to `'Geist', system-ui, sans-serif` in `variables.css`
- [x] 1.3 Add `--font-weight-regular: 400`, `--font-weight-medium: 500`, `--font-weight-semibold: 600` tokens to `variables.css`
- [x] 1.4 Apply `font-family: var(--font-sans)` to UI chrome selectors in `global.css`: `header`, `aside`, `.nav-item`, `.sidebar-label`, `.modal-header`, `.modal-title`, `.svc-badge`, `.panel-tab`, `.stat-chip`
- [x] 1.5 Ensure `font-family: var(--font-mono)` is explicitly set on `.svc-name`, `.svc-meta`, `.panel-body`, `pre`, `code`, `.log-line`

## 2. Color System

- [x] 2.1 Update `--accent` from `#5e72e4` to `#3b82f6` in `variables.css`
- [x] 2.2 Update `--accent-glow` from `rgba(94,114,228,0.3)` to `rgba(59, 130, 246, 0.25)` in `variables.css`
- [x] 2.3 Add `--shadow-card: 0 2px 8px rgba(13, 15, 20, 0.6)` token to `variables.css`
- [x] 2.4 Add `--shadow-modal: 0 10px 40px rgba(13, 15, 20, 0.8)` token to `variables.css`
- [x] 2.5 Update modal `box-shadow` in `global.css` to use `var(--shadow-modal)`
- [x] 2.6 Update the default theme accent token in `SolidJS/server/config.ts` (built-in theme JSON) to `#3b82f6`

## 3. Motion Tokens & Globals

- [x] 3.1 Add `--transition-base: 200ms cubic-bezier(0.16, 1, 0.3, 1)` to `variables.css`
- [x] 3.2 Add global transition rule in `global.css` for interactive elements: buttons, `.nav-item`, `.svc-card`, `.svc-header`, `.svc-badge`, `.ctrl-btn`
- [x] 3.3 Add `@media (prefers-reduced-motion: reduce)` block in `global.css` that sets `transition-duration: 0.01ms !important` and removes animation keyframes
- [x] 3.4 Add `@keyframes svc-card-enter` (translateY 8px → 0, opacity 0 → 1) to `global.css`
- [x] 3.5 Add `@keyframes status-pulse` (box-shadow green glow breath) to `global.css`

## 4. Service Card Polish

- [x] 4.1 Update `.svc-name` in `global.css`: `font-size: 0.9375rem`, `font-weight: var(--font-weight-semibold)`, `font-family: var(--font-mono)`, `letter-spacing: -0.01em`
- [x] 4.2 Update `.svc-meta` in `global.css`: `font-size: 0.75rem`, `font-weight: var(--font-weight-regular)`, `color: var(--text3)`, `font-family: var(--font-mono)`
- [x] 4.3 Add `.svc-card:hover` rule: `border-color: var(--border2)`, `box-shadow: var(--shadow-card)` with transition
- [x] 4.4 Add `.svc-card.stopped .svc-name` opacity reduction to `0.65` in `global.css`
- [x] 4.5 Add `.svc-status-dot.running` pulse animation class: apply `animation: status-pulse 2s ease-in-out infinite`
- [x] 4.6 Update `.svc-badge` in `global.css`: `font-size: 0.6875rem`, `font-weight: var(--font-weight-medium)`, `border-radius: 4px`, `font-family: var(--font-sans)`, `letter-spacing: 0.06em`
- [x] 4.7 Update `statusLabels` in `ServiceCard.tsx` to sentence-case: `running: 'Running'`, `stopped: 'Stopped'`, `starting: 'Starting…'`, `stopping: 'Stopping…'`
- [x] 4.8 Add `style={{ '--card-index': index() }}` prop to service card `<For>` loop in `ServiceGrid.tsx` (or wherever cards are rendered) to enable stagger delay
- [x] 4.9 Apply `.svc-card` entrance animation in `global.css`: `animation: svc-card-enter 300ms var(--transition-base) calc(var(--card-index, 0) * 60ms) both`

## 5. Control Buttons

- [x] 5.1 Add `.ctrl-btn:active` rule: `transform: scale(0.97)`, `opacity: 0.85`
- [x] 5.2 Add `.ctrl-btn.start:hover` rule: `background: var(--green-dim)`
- [x] 5.3 Add `.ctrl-btn.stop:hover` rule: `background: var(--red-dim)`
- [x] 5.4 Add `.ctrl-btn.edit:hover` rule: `background: var(--surface2)`
- [x] 5.5 Ensure all `.ctrl-btn` have `border-radius: 6px` and `cursor: pointer`

## 6. Sidebar Polish

- [x] 6.1 Add `.nav-item:hover` rule in `global.css`: `background: var(--surface2)`, `color: var(--text)`, smooth transition
- [x] 6.2 Add `.nav-item:active` rule: `transform: scale(0.98)`, `opacity: 0.85`
- [x] 6.3 Add `cursor: pointer` to `.nav-item`
- [x] 6.4 Apply `font-family: var(--font-sans)` to `.nav-item` and `.sidebar-label`

## 7. Panel Transitions

- [x] 7.1 Add transition to `.svc-panel` in `global.css`: `max-height 220ms var(--transition-base), opacity 180ms ease`
- [x] 7.2 Ensure `.svc-panel` closed state is `max-height: 0; opacity: 0; overflow: hidden`
- [x] 7.3 Ensure `.svc-panel.open` state is `max-height: 600px; opacity: 1`

## 8. Verification

- [ ] 8.1 Visually verify Geist loads in browser devtools (Network → Fonts)
- [ ] 8.2 Smoke test: start and stop a service, confirm badges show sentence-case and transitions are smooth
- [ ] 8.3 Smoke test: open and close log panel, confirm slide animation works
- [ ] 8.4 Verify accent color is blue (not purple) across all interactive elements
- [x] 8.5 Run `npm run build` from `SolidJS/` and confirm no TypeScript errors
- [ ] 8.6 Test with `prefers-reduced-motion: reduce` in browser devtools to confirm animations disabled
