## Context

The `winctl` UI currently features a Sidebar navigation component that includes a "Views" section, allowing users to filter services (All, Running, Stopped). However, this functionality is already available and more prominently placed near the search bar on the main page. This duplication of UI elements for the same functionality causes unnecessary clutter in the Sidebar.

## Goals / Non-Goals

**Goals:**

- Remove the "Views" section (and its associated filtering options) from the `Sidebar` component.
- Simplify the `Sidebar` component's code by removing unused state imports after the removal.

**Non-Goals:**

- Do not modify or remove the view/filter functionality from the main page area; it should continue to work as intended.
- Do not change any other sections in the Sidebar (e.g., "Actions", "Settings").

## Decisions

**1. Complete Removal from Sidebar:**
The decision is to completely remove the "Views" label and the corresponding navigation items (`handleFilterClick`, `All Services`, `Running`, `Stopped`) from `Sidebar.tsx`.
*Rationale:* The duplicate controls on the main page are sufficient and arguably better positioned for context-aware filtering.

## Risks / Trade-offs

- **Risk:** Users who are accustomed to using the Sidebar to filter views might initially look for it there. -> **Mitigation:** The primary view controls remain highly visible near the search bar, ensuring a quick transition for users.
- **Risk:** Possible styling layout shifts within the sidebar. -> **Mitigation:** Ensure the `sidebar-content` continues to flex or position items correctly after the topmost elements are removed.
