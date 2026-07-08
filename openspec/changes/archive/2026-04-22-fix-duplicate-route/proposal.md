# Proposal: Fix Duplicate Route for /api/sysinfo/tools

## Why

The Rust backend panics at startup because the `/api/sysinfo/tools` endpoint is registered in both the public and protected route groups. Axum does not allow overlapping method routes when merging routers, causing the application to crash immediately.

## What Changes

- Remove duplicate `GET /api/sysinfo/tools` route registration from one of the route groups
- Keep the endpoint in `protected_routes` since it should require authentication

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (implementation-only fix, no behavior change)

## Impact

- **File**: `src-tauri/src/lib.rs`
- **Location**: `create_router()` function (lines ~969 and ~1007)
- **Behavior**: Removes route conflict, allows app to start correctly