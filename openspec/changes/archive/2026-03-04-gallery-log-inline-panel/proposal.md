## Why

After the previous fix (`fix-gallery-log-terminal`), the log terminal appeared as a separate overlay popup on a "third plane" — floating independently above both the gallery grid and the folder overlay. The desired layout (as sketched by the user) shows the log panel side-by-side with the folder popup at the same z-plane: folder contents on the left, log panel on the right, within a single unified container.

## What Changes

- Replaced the separate/floating log overlay (`z-index: 300`) with an inline side-panel rendered **within the same overlay container** as the folder popup.
- The folder popup and the log panel form a **unified horizontal flex layout**: folder contents on the left, log panel on the right.
- When the log terminal is toggled on a service inside a folder, the existing folder overlay simply expands horizontally to include the log panel — no new stacking context or z-index escalation.
- The overlay scales with the viewport: `width: min(90vw, 1400px)`, `min-height: 50vh`, `max-height: 85vh`.
- For non-folder items in gallery view, the log panel appears as a standalone `z-index: 200` modal (same plane as the folder overlay).
- Keyboard shortcut: pressing `Escape` when the log panel is open closes the log first; pressing again closes the folder overlay.

## Capabilities

### New Capabilities

- `gallery-log-inline-panel`: Defines the visual and functional behavior of the log panel as a side-by-side element within the folder/item overlay in the gallery view.

### Modified Capabilities

## Impact

- `SolidJS/src/components/FolderCard.tsx` — hosts the unified overlay; tracks which service's log is open; passes `onLogToggle` and `activeLogServiceId` props to child `ServiceCard` components.
- `SolidJS/src/components/ServiceCard.tsx` — delegates log toggle to parent `FolderCard` when `inFolder && gallery` (no Portal created); keeps standalone Portal for non-folder gallery items.
- `SolidJS/src/styles/global.css` — added `.gallery-folder-overlay`, `.gallery-folder-panel`, `.gallery-log-panel`, `.gallery-log-header`, `.gallery-log-title`, `.gallery-log-body` styles.
