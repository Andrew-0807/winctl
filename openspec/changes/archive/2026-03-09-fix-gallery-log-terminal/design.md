## Context

In the Web UI's gallery view, each item can display a log terminal to show its console output or related logs. Currently, toggling the log terminal expands it inline within the item's grid/flex container. For folders, this expands the container and inadvertently increases the line height for adjacent items in the same row, breaking the visual rhythm of the gallery layout. For non-folder items, clicking the log terminal button expands the container height but the terminal console itself fails to appear.

## Goals / Non-Goals

**Goals:**

- Render the log terminal for folder items in a separate popup/overlay positioned to the left of the related folder, avoiding inline layout disruption.
- Ensure the log terminal correctly renders its content for regular, non-folder items.
- Maintain the existing state management for toggling log terminals on and off.

**Non-Goals:**

- Redesigning the entire gallery view or changing how items are grouped.
- Modifying the underlying log streaming backend logic; changes are purely frontend/UI layout adjustments.

## Decisions

**Decision 1: Use an absolute-positioned overlay for folder log terminals**

- *Rationale:* Expanding inline within a CSS grid/flex layout affects the dimensions of sibling elements. Using an absolute-positioned overlay (anchored to the folder element) allows the terminal to appear floating to the left, without taking up structural space in the DOM flow.
- *Alternatives Considered:* Placing the log terminal full-width below the grid row. This was rejected because it separates the terminal too far from its relevant item and still disrupts the grid flow.

**Decision 2: Standardize initialization for non-folder terminals**

- *Rationale:* The bug where non-folder items expand but don't show the terminal is likely due to missing structural HTML or initialization logic that is currently only applied to folders. We will reuse the same terminal component setup for both, only differing in their layout strategy (overlay vs potentially inline if it fits, though overlay is preferred to be consistent). For this design, we'll ensure both item types use the same terminal visibility toggle and rendering flow.
- *Alternatives Considered:* Creating a separate component for non-folder terminals. Rejected to avoid code duplication.

## Risks / Trade-offs

- **Risk: Overlay overlapping other important UI elements**
  - *Mitigation:* Ensure the popup has a defined `z-index`, a close button, and click-outside-to-close behavior so the user can easily dismiss it if it obstructs their view. Ensure it bounds within the viewport.
- **Risk: Viewport edge collisions**
  - *Mitigation:* Add simple collision detection or CSS max-width/height logic to ensure the left-positioned overlay doesn't render off-screen on smaller windows.
