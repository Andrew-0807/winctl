## 1. Audit & Cleanup Previous Log Terminal Code

- [x] 1.1 Identify and review all CSS rules in `index.css` added by `fix-gallery-log-terminal` that position the log terminal as a separate/absolute popup
- [x] 1.2 Identify all JS logic in `index.js` that creates, positions, or toggles the log terminal as a standalone overlay element
- [x] 1.3 Remove or override CSS rules that elevate the log terminal to a third z-plane (separate stacking context above the folder popup)

## 2. HTML Structure Update

- [x] 2.1 Update `FolderCard.tsx` so the log panel `div` is a sibling of the folder content panel **inside** the same overlay container
- [x] 2.2 Ensure the unified overlay container uses `display: flex; flex-direction: row` to lay out folder content | log panel side by side

## 3. CSS Layout for Inline Log Panel

- [x] 3.1 Style the unified overlay container as a flex row at the same z-index as the previous folder popup (no new stacking context)
- [x] 3.2 Give the log panel a fixed width (`340px`) and ensure it is hidden by default
- [x] 3.3 Log panel is conditionally rendered via SolidJS `<Show>` on a reactive signal — toggled via `logService()` state in FolderCard
- [x] 3.4 Add `max-width: 100vw; overflow: hidden` to the overlay container to prevent viewport overflow
- [x] 3.5 Make overlay viewport-responsive: `width: min(90vw, 1400px)`, `min-height: 50vh`, `max-height: 85vh`

## 4. JavaScript Toggle Logic Update

- [x] 4.1 Update the log terminal toggle handler for **folder items** — `ServiceCard` calls `props.onLogToggle(service)` which sets `logService()` in FolderCard; no separate Portal created
- [x] 4.2 Update the log terminal toggle handler for **non-folder items** — standalone gallery items keep their own Portal at `z-index: 200`
- [x] 4.3 `LogViewer` is rendered directly inside the `.gallery-log-panel` div within the unified container
- [x] 4.4 `Escape` key closes the log panel first, then the folder overlay on a second press

## 5. Verification & Polish

- [x] 5.1 Verified: log panel appears to the right of the folder content inside the same overlay (user confirmed working)
- [x] 5.2 Verified: console output streams correctly inside the log side-panel
- [x] 5.3 Overlay constrained to viewport width (`max-width: 100vw`) preventing horizontal scroll
- [x] 5.4 Closing the log panel via X hides the panel; overlay returns to folder-only width cleanly
