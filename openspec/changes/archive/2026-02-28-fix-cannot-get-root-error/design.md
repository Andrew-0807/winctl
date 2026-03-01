## Context

The WinCTL application currently fails to serve its frontend client when users navigate to the root route (`/`), returning a "cannot get /" error from the backend instead. The root path must be appropriately configured in the backend's static file serving or routing logic to return the `index.html` of the compiled application.

## Goals / Non-Goals

**Goals:**
- Fix the backend routing so that the `GET /` request correctly serves the frontend application.
- Ensure all other existing routes (like APIs) are unaffected.

**Non-Goals:**
- Refactoring the entire backend routing structure.
- Changing the frontend application framework or build process.

## Decisions

- **Decision: Configure exact or catch-all route for frontend delivery**
  - **Rationale**: Backend frameworks need explicit instructions to serve an `index.html` file for paths not matching static file routes or API routes. We will configure the static middleware properly and/or add a route handler for `/` (and optionally `*` for SPA routing) to serve the client app's `index.html`.
  - **Alternatives**: Expecting users to navigate to a specific `.html` file directly, which is poor UX.

## Risks / Trade-offs

- **Risk: Breaking existing API routes** → **Mitigation**: Ensure the root route or catch-all route is placed *after* all API routing middleware in the backend configuration.
