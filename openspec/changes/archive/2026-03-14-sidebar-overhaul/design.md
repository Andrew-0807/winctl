## Context

`Sidebar.tsx` currently renders three sections: Views (All / Running / Stopped), Actions (Start All, Stop All, System Info), and Settings. The Views items duplicate the `currentFilter` buttons in `Toolbar.tsx`. On mobile (`max-width: 768px`) the layout switches to a fixed overlay controlled by `sidebarOpen` (toggled by `toggleSidebarMobile()` in the header). However, the `sidebar-collapse-btn` inside the sidebar calls `toggleSidebarCollapse()` — the desktop shrink/expand function — making it non-functional as a close button on mobile, and creating the appearance of two close affordances.

## Goals / Non-Goals

**Goals:**
- Remove the Views section (label + 3 nav items) from `Sidebar.tsx` and any imports/signals only used by it.
- Hide `sidebar-collapse-btn` on mobile so only the header hamburger controls the mobile overlay.
- Add slide-in animation for the mobile sidebar overlay.
- Make sidebar full-width on small phones (≤480px).
- Increase nav item font size and center text on mobile.

**Non-Goals:**
- Do not change `Toolbar.tsx` or the filter buttons on the main page.
- Do not change the desktop collapse behaviour (ChevronLeft still collapses/expands on desktop).
- Do not redesign sidebar layout, icons, or add new sections.
- Do not touch server code.

## Decisions

**1. Remove Views from Sidebar.tsx entirely**
The `currentFilter` / `setCurrentFilter` signals exist in `ui.ts` and are used by `Toolbar.tsx`. They stay. Only the sidebar's consumption of them is removed.

**2. Hide `sidebar-collapse-btn` on mobile with a single CSS rule**
Inside the existing `@media (max-width: 768px)` block in `global.css`:
```css
.sidebar-collapse-btn {
  display: none;
}
```

**3. Slide-in animation via CSS transform**
Replace `display: none/block` toggle with `transform: translateX(-100%) → translateX(0)` and `transition: transform 0.28s ease`. This allows a smooth slide-in from the left without JavaScript changes.

**4. Full-screen on small phones**
Inside `@media (max-width: 480px)`: `aside { width: 100%; }`

**5. Larger centered text on mobile**
Inside `@media (max-width: 768px)`:
- `.nav-item { font-size: 15px; justify-content: center; padding: 10px 16px; }`
- `.sidebar-label { font-size: 11px; text-align: center; padding-left: 0; }`

## Risks / Trade-offs

- **Risk:** Users on desktop who use the sidebar collapse button won't be affected — CSS rules are scoped to mobile breakpoints.
- **Risk:** Removing `display: none` means the sidebar element is always in the DOM on mobile but off-screen. This is standard practice and has no performance impact.
