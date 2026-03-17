## Why

WinCTL's UI has several small but compounding visual inconsistencies that reduce perceived quality and information density without requiring any logic changes:

1. **Stopped services are invisible** — the left-border indicator for stopped services uses `var(--border)`, which is indistinguishable from the card's own border. The running state glows green; the stopped state is invisible.

2. **Status dot disappears on hover** — `svc-header:hover .svc-status-dot::before { opacity: 0.4 }` dims the status indicator exactly when the user is looking at the card. This hides critical status information on interaction.

3. **Action buttons have no transition** — hover state color changes on `.ctrl-btn` snap instantly. The green/red/neutral states are implemented correctly but feel abrupt without a transition.

4. **Gallery cards are information-blind** — in gallery view, `.svc-badge { display: none }` removes the only text status indicator. Cards communicate status only via a 3px left border, which is too subtle at card density.

5. **Stat cards look like service rows** — `.sys-card` and `.svc-card` share identical visual treatment (surface bg, border, radius). The stat strip reads as another list of items, not a summary header.

6. **FAB has no affordance** — the floating `+` button has no label or tooltip. First-time users have no hint it opens an add menu.

7. **Sidebar animation is broken** — the collapse transition has three compounding defects: a 20px width mismatch between the `aside` element (220px) and the grid column (240px); a CSS variable transition on `grid-template-columns` that does not reliably animate; and the Lucide chevron transition targeting `i` tags that no longer exist after icon replacement.

## What Changes

- **Stopped border** — `.svc-card.stopped` uses `var(--red-dim)` instead of `var(--border)`.
- **Status dot hover** — remove `opacity: 0.4` on hover; dot stays at full opacity.
- **Button transitions** — add `transition: background 0.15s, color 0.15s, border-color 0.15s` to `.ctrl-btn`. Change `.ctrl-btn.edit:hover` from blue to neutral.
- **Gallery badge** — restore `.svc-badge` visibility in gallery view; reduce font-size slightly for card density.
- **Stat card distinction** — add `border-top: 2px solid var(--accent)` and `background: var(--surface2)` to `.sys-card`. Add a divider below `.sysbar`.
- **FAB label** — add a CSS `::after` tooltip that appears on hover showing "Add".
- **Sidebar animation** — fix the 20px mismatch, switch grid to `auto 1fr`, add `overflow: hidden` to aside, and fix the chevron CSS target from `i` to `svg`.

## Capabilities

### Modified Capabilities

- `global.css`: All 7 changes are CSS-only in this file.
- `Sidebar.tsx`: No change (CSS-side fix only — the `i → svg` target fix is in CSS).

## Impact

- **SolidJS/src/styles/global.css** — sole file changed.
- No server changes. No store changes. No component logic changes.
- Zero risk of breaking functionality — all changes are visual only.
- Theme system unaffected: all values use existing CSS custom properties.
