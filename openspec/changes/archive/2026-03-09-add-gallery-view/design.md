## Context

The application currently features a list view for displaying items and folders. While functional, a list view is not always optimal for browsing visual content or when users want to see more items at a glance. We need to introduce a gallery view to provide an alternative, more visual way to browse the content. The existing list view supports expandable folders, which must also be supported in the new gallery view.

## Goals / Non-Goals

**Goals:**
- Implement a grid-based gallery view for items and folders.
- Provide a UI control (e.g., a toggle button) to switch between list and gallery modes.
- Ensure folders remain expandable within the gallery view, showing their contents inline or in a visually cohesive manner within the grid.
- Persist the user's view preference across sessions (if applicable to the current state mechanism).

**Non-Goals:**
- Complex sorting or filtering within the gallery view beyond what the list view already provides.
- Virtualization of the grid (unless immediately necessary for performance, it will be deferred to a future optimization).

## Decisions

- **Layout Mechanism**: Use CSS Grid for the gallery view. Grid provides robust two-dimensional layout capabilities, making it ideal for responsive galleries where items flow into columns and rows.
- **State Management**: Introduce a reactive state variable (e.g., using SolidJS `createSignal` given the project's tech stack) to track the active view mode (`'list'` or `'gallery'`).
- **Expandable Folders in Grid**: When a folder is expanded in gallery view, its contents should ideally flow into the grid immediately following the folder icon, or the folder could expand its bounds to encompass its children. We will manage this by conditionally rendering child items right after the parent in the flat list provided to the grid container, utilizing CSS subsetting or nested grids if needed for visual hierarchy.
- **Component Reusability**: The core data fetching and item management logic will remain unchanged. We will update the presentation layer to conditionally apply CSS classes (`.view-list` vs `.view-gallery`) or render different container components based on the selected mode.

## Risks / Trade-offs

- **Risk**: Expandable folders in a grid format can cause disruptive layout shifts when opened, pushing surrounding items awkwardly.
  - **Mitigation**: Carefully design the expanded folder state. It may be better to have an expanded folder take up a full row in the grid, or use smooth height transitions, to make the layout shift less jarring.
- **Risk**: Performance degradation if rendering a very large number of items in a DOM-heavy grid.
  - **Mitigation**: Defer virtualization for now, but design the CSS and component structure cleanly so virtualization tools can be integrated later if necessary.
