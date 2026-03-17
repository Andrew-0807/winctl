## 1. Confirm Views Removal in Sidebar.tsx

- [x] 1.1 Open `SolidJS/src/components/Sidebar.tsx` and verify there is no "VIEWS" label div, no All Services / Running / Stopped nav items, and no `handleFilterClick` function.
- [x] 1.2 Verify that `Sidebar.tsx` does not import `currentFilter`, `setCurrentFilter`, `runningCount`, or `stoppedCount` from the stores.
- [x] 1.3 If any Views-related code is still present, remove it now.

## 2. Fix Mobile Duplicate Button

- [x] 2.1 Open `SolidJS/src/styles/global.css` and locate the `@media (max-width: 768px)` block.
- [x] 2.2 Add the following rule inside that block:
  ```css
  .sidebar-collapse-btn {
    display: none;
  }
  ```
  This hides the ChevronLeft collapse button on mobile so only the header hamburger controls the sidebar overlay.

## 3. Verify and Rebuild

- [ ] 3.1 Run `npm run dev` inside `SolidJS/` and open the app on desktop — confirm the sidebar shows only Actions (Start All, Stop All, System Info) and Settings. No Views section visible.
- [ ] 3.2 In the browser devtools, toggle the viewport to mobile (≤768px) — confirm only ONE button opens/closes the sidebar (the header hamburger). The ChevronLeft should not be visible inside the sidebar.
- [ ] 3.3 On desktop, confirm the ChevronLeft collapse button still collapses and expands the sidebar correctly.
- [ ] 3.4 Run `npm run build` inside `SolidJS/` — confirm it completes with no TypeScript errors.
