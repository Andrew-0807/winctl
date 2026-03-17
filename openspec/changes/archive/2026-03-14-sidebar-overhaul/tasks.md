## 1. Confirm Views Removal in Sidebar.tsx

- [x] 1.1 Open `SolidJS/src/components/Sidebar.tsx` and verify there is no "VIEWS" label div, no All Services / Running / Stopped nav items, and no `handleFilterClick` function.
- [x] 1.2 Verify that `Sidebar.tsx` does not import `currentFilter`, `setCurrentFilter`, `runningCount`, or `stoppedCount` from the stores.
- [x] 1.3 If any Views-related code is still present, remove it now.

## 2. Fix Mobile Duplicate Button & Animations

- [x] 2.1 Open `SolidJS/src/styles/global.css` and locate the `@media (max-width: 768px)` block.
- [x] 2.2 Add `.sidebar-collapse-btn { display: none; }` inside mobile breakpoint.
- [x] 2.3 Replace `display: none/block` on mobile `aside` with `transform: translateX(-100%)` + `transition: transform 0.28s ease` / `transform: translateX(0)` on `.open`.
- [x] 2.4 Add `.nav-item { font-size: 15px; justify-content: center; }` and `.sidebar-label { text-align: center; }` inside mobile breakpoint.
- [x] 2.5 Add `aside { width: 100%; }` inside `@media (max-width: 480px)` block.

## 3. Verify and Rebuild

- [ ] 3.1 Run `npm run dev` inside `SolidJS/` and open the app on desktop — confirm the sidebar shows only Actions and Settings. No Views section visible.
- [ ] 3.2 In the browser devtools, toggle the viewport to mobile (≤768px) — confirm slide-in animation, only ONE close button (header hamburger), larger centered text.
- [ ] 3.3 At ≤480px viewport — confirm sidebar fills full width.
- [ ] 3.4 On desktop, confirm the ChevronLeft collapse button still collapses and expands the sidebar correctly.
- [ ] 3.5 Run `npm run build` inside `SolidJS/` — confirm it completes with no TypeScript errors.
