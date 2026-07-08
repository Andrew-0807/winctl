## Why

The SystemStats component displays "NaN GB NaN GB free" and "0m" for memory and uptime respectively. This is caused by a field name mismatch between the Rust backend (camelCase) and TypeScript frontend (snake_case).

## What Changes

- Update `SystemInfo` interface in `socket.ts` to use camelCase field names to match Rust backend
- No backend changes required - Rust serialization is correct

## Capabilities

### New Capabilities
None - this is a bug fix.

### Modified Capabilities
- `system-stats-display`: Update interface to fix field name mismatch

## Impact

- **File**: `src/stores/socket.ts` - SystemInfo interface
- **Backend**: No changes (serialization is correct)
- **Frontend**: TypeScript types will now match API response