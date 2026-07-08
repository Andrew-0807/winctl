## Why

SystemStats shows "0.0 GB", "0.0 GB free", and "-" for uptime instead of actual values. Need to add debugging to understand why.

## What Changes

- Add debug logging to SystemStats to log the raw systemInfo received from store
- Add network request logging to see what API actually returns
- Verify field names match between backend and frontend

## Capabilities

### New Capabilities
- `system-stats-debug`: Temporary debugging capability to diagnose the display issue

### Modified Capabilities
None

## Impact

- **Files to modify**: SystemStats.tsx, socket.ts
- **Risk**: Low - debugging only, will be removed after diagnosis