## Context

The Rust backend uses `#[serde(rename_all = "camelCase")]` on `SystemInfoResponse`, causing JSON responses to use camelCase field names (e.g., `totalMem`, `cpuCount`). The TypeScript frontend's `SystemInfo` interface uses snake_case, causing undefined values and NaN display.

## Goals / Non-Goals

**Goals:**
- Fix SystemStats to display correct memory and uptime values

**Non-Goals:**
- Change Rust backend serialization (it's correct per Rust conventions)
- Add new functionality

## Decisions

**Update TypeScript interface to match API** - Align frontend types with backend camelCase response.

Alternative considered: Remove `#[serde(rename_all = "camelCase")]` from Rust - rejected because camelCase is idiomatic Rust JSON serialization.

## Changes

```typescript
// Before (socket.ts line 36-42)
export interface SystemInfo {
  platform: string;
  hostname: string;
  cpu_count: number;    // ❌ mismatch
  total_mem: number;    // ❌ mismatch
  free_mem: number;     // ❌ mismatch
  uptime: number;
}

// After
export interface SystemInfo {
  platform: string;
  hostname: string;
  cpuCount: number;     // ✓ matches API
  totalMem: number;     // ✓ matches API
  freeMem: number;      // ✓ matches API
  uptime: number;
}
```

## Risks / Trade-offs

None - this is a straightforward type alignment.