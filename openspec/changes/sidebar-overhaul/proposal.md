## Why

The sidebar has two problems that hurt usability on both phone and PC:

1. **Duplicate Views controls** — The sidebar shows "All Services / Running / Stopped" filter items, but identical filter buttons already exist in the Toolbar on the main page. This creates confusion about which control is authoritative and clutters the sidebar with redundant UI.

2. **Two conflicting close buttons on mobile** — On phones, the sidebar overlay can be toggled via the header hamburger (`menu-toggle`), but the `sidebar-collapse-btn` (ChevronLeft) inside the sidebar is also visible. Clicking it calls `toggleSidebarCollapse()` — the desktop collapse function — which does not close the mobile overlay. This leaves users with one button that closes and one that does nothing useful, both visible at the same time.

## What Changes

- **Remove Views section from Sidebar** — The "VIEWS" label and All Services / Running / Stopped nav items are removed. The Toolbar filter buttons remain as the sole filter controls.
- **Fix mobile sidebar close** — The `sidebar-collapse-btn` is hidden on mobile viewports via CSS. The header hamburger becomes the single, consistent way to open and close the sidebar on mobile.
- **Clean up orphaned sidebar state** — Any unused imports or signal references in `Sidebar.tsx` left over from the Views removal are cleaned up.

## Capabilities

### New Capabilities

- `sidebar-overhaul`: Delivers a clean sidebar with no duplicate controls and correct mobile close behaviour.

### Modified Capabilities

- `Sidebar.tsx`: Views section removed; import list trimmed.
- `global.css`: `sidebar-collapse-btn` hidden on mobile breakpoint.

## Impact

- **SolidJS/src/components/Sidebar.tsx** — Views section and related code removed.
- **SolidJS/src/styles/global.css** — One CSS rule added to mobile media query.
- No server changes. No store changes (filter state in `ui.ts` is still used by Toolbar).
