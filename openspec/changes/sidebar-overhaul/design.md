## Context

`Sidebar.tsx` currently renders three sections: Views (All / Running / Stopped), Actions (Start All, Stop All, System Info), and Settings. The Views items duplicate the `currentFilter` buttons in `Toolbar.tsx`. On mobile (`max-width: 768px`) the layout switches to a fixed overlay controlled by `sidebarOpen` (toggled by `toggleSidebarMobile()` in the header). However, the `sidebar-collapse-btn` inside the sidebar calls `toggleSidebarCollapse()` — the desktop shrink/expand function — making it non-functional as a close button on mobile, and creating the appearance of two close affordances.

## Goals / Non-Goals

**Goals:**
- Remove the Views section (label + 3 nav items) from `Sidebar.tsx` and any imports/signals only used by it.
- Hide `sidebar-collapse-btn` on mobile so only the header hamburger controls the mobile overlay.
- Result: sidebar renders correctly in both the dev server and any rebuilt package.

**Non-Goals:**
- Do not change `Toolbar.tsx` or the filter buttons on the main page.
- Do not change the desktop collapse behaviour (ChevronLeft still collapses/expands on desktop).
- Do not redesign sidebar layout, icons, or add new sections.
- Do not touch server code.

## Decisions

**1. Remove Views from Sidebar.tsx entirely**
The `currentFilter` / `setCurrentFilter` signals exist in `ui.ts` and are used by `Toolbar.tsx`. They stay. Only the sidebar's consumption of them is removed. If `Sidebar.tsx` currently imports `currentFilter`, `setCurrentFilter`, `runningCount`, `stoppedCount`, or a `handleFilterClick` function, those are removed. Looking at the current source, `Sidebar.tsx` already does not import these — the "remove-sidebar-views" change was applied to the file but never committed/built. The task is to confirm the file is clean and rebuild.

**2. Hide `sidebar-collapse-btn` on mobile with a single CSS rule**
Inside the existing `@media (max-width: 768px)` block in `global.css`, add:
```css
.sidebar-collapse-btn {
  display: none;
}
```
This keeps the desktop collapse behaviour intact and removes the confusing second button on mobile without any JavaScript changes.

**3. No changes to `toggleSidebarMobile` or `toggleSidebarCollapse`**
The two functions serve different purposes (overlay toggle vs. width collapse). The fix is purely presentational — hiding the wrong button on the wrong breakpoint.

## Risks / Trade-offs

- **Risk:** Users on desktop who use the sidebar collapse button won't be affected — CSS rule is scoped to `@media (max-width: 768px)`.
- **Risk:** If the Views section has already been removed in source but is still showing in a running exe, the user needs to rebuild (`npm run build` in `SolidJS/`) and repackage. The tasks include a verification step for this.
