# Proposal: Fix System Stats Cards (CPU, Memory, Uptime)

## Why

The CPU Cores, Memory, and Uptime cards in the system bar are not displaying correct values. The backend sends memory in bytes, but the frontend's `formatMem()` function assumes KB input, causing values to be ~1000x too large. Uptime may also be failing silently.

## What Changes

- Fix `formatMem()` function in `SystemStats.tsx` to handle bytes directly (remove incorrect `* 1024` multiplication)
- Add error handling for failed `loadSystem()` calls
- Consider improving uptime PowerShell command reliability

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (implementation-only fix)

## Impact

- **File**: `src/components/SystemStats.tsx`
- **Functions**: `formatMem`, `handleFlushMemory` (has same bug)
- **Behavior**: Memory values will display correctly