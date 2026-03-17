## Context

The `fix-gallery-log-terminal` change introduced a log terminal that appears as a separate overlay popup (`z-index: 300`), effectively on a "third plane" above the main canvas and the folder popup (`z-index: 200`). The user's sketch showed the intended UI: folder content on the left, log panel on the right, both within a single unified container at the folder popup's z-level.

Current architecture (before this change):

- `FolderCard.tsx`: renders a `Portal` with backdrop `z-index: 200` containing the folder content grid
- `ServiceCard.tsx` (gallery mode): renders a **second** `Portal` at `z-index: 300` for the log — a separate floating popup

Target architecture (implemented):

- `FolderCard.tsx`: renders a single `Portal` with a `gallery-folder-overlay` flex-row container holding both folder panel and (conditionally) the log panel at `z-index: 200`
- `ServiceCard.tsx` (in-folder, gallery mode): calls `props.onLogToggle(service)` → sets reactive state in `FolderCard` → `<Show>` renders the log panel inline

## Goals / Non-Goals

**Goals:**

- Merge the log panel into the same overlay container as the folder popup (single stacking context)
- Implement a flex-row layout: folder content | log panel
- Log panel appears/disappears reactively via SolidJS signal (no class toggling or DOM mutation needed)
- Overlay scales with the viewport: responsive width, enforced min/max height
- Non-folder items use a standalone z-200 Portal for their log (no folder container available)

**Non-Goals:**

- Resizing/dragging the log panel
- Changing the terminal emulator or log streaming logic
- Altering the folder popup trigger behavior

## Decisions

### Decision 1: Merge into a single overlay container

**Choice**: `FolderCard.tsx` owns one `Portal` with a `div.gallery-folder-overlay` (flex row) containing `div.gallery-folder-panel` (left, `flex: 1`) and `div.gallery-log-panel` (right, fixed 340px). The log panel is conditionally rendered inline via SolidJS `<Show when={activeLogService()}>`.

**Rationale**: Single container avoids z-index conflicts and matches the sketch. SolidJS `<Show>` is more idiomatic than CSS class toggling — the log panel DOM is created/destroyed reactively.

**Alternative considered**: CSS `.show-log` class to toggle `display: none/flex`. Rejected for final implementation in favour of the SolidJS reactive `<Show>` pattern which is cleaner and avoids hidden DOM.

### Decision 2: Folder panel takes `flex: 1`, log panel fixed at `340px`

**Choice**: Folder panel uses `flex: 1; min-width: 0` to fill all remaining horizontal space. Log panel has `width: 340px; min-width: 280px; max-width: 400px`.

**Rationale**: The folder grid reflows to fill whatever space is available without jarring when the log panel appears. The log panel stays at a comfortable reading width.

### Decision 3: Overlay sizing — viewport-responsive

**Choice**: `gallery-folder-overlay` uses `width: min(90vw, 1400px)`, `min-height: 50vh`, `max-height: 85vh`.

**Rationale**: The overlay fills 90% of the viewport width on large screens (caps at 1400px), always shows at least half the screen height for sparse folders, and never overflows vertically.

### Decision 4: Prop-based log toggle delegation

**Choice**: `FolderCard` passes `onLogToggle` and `activeLogServiceId` props to each `ServiceCard` inside the folder overlay. `ServiceCard.handleTogglePanel` checks `inFolder && gallery && onLogToggle`, calls the callback instead of `togglePanel`.

**Rationale**: Keeps the log state co-located with the element that renders it (`FolderCard`), avoiding cross-component store pollution just for this UI interaction.

### Decision 5: Escape key UX

**Choice**: First `Escape` closes the log panel (if open); second `Escape` closes the folder overlay.

**Rationale**: Progressive dismissal — users can peek at logs and close them without losing the folder context.

## Risks / Trade-offs

- **Viewport overflow**: Addressed by `max-width: 100vw; overflow: hidden` on the overlay container.
- **Existing CSS conflicts**: Previous `fix-gallery-log-terminal` CSS was audited; the separate z-300 log Portal was removed from `ServiceCard.tsx`.

## Migration Plan (as executed)

1. **`FolderCard.tsx`**: Added `logService` signal; `handleLogToggle` callback; `gallery-folder-overlay` flex container with `gallery-folder-panel` (left) and `gallery-log-panel` with `<LogViewer>` (right); Escape key closes log first.
2. **`ServiceCard.tsx`**: Added `onLogToggle` / `activeLogServiceId` props; `handleTogglePanel` delegates to parent when `inFolder && gallery`; removed `z-index: 300` Portal for in-folder gallery items; standalone gallery Portal kept at `z-index: 200`.
3. **`global.css`**: Added `.gallery-folder-overlay`, `.gallery-folder-panel`, `.gallery-log-panel`, `.gallery-log-header`, `.gallery-log-title`, `.gallery-log-body` styles with slide-in animation.
4. **Full `npm run package`** required (not just `pkg:daemon`) so the new Vite build is copied to `dist/` before packaging.
