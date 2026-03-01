## Why

WinCTL users are experiencing three critical bugs:
1. Applications fail to start with spawn ENOENT errors, especially GUI apps like Radmin VPN
2. Services lose folder assignment when edited
3. No way to reorder services

## What Changes

### Bug Fixes
- Fix spawn ENOENT: Handle paths with spaces in process-manager.ts
- Fix folderId reset: Preserve folderId in ServiceModal.tsx
- Add service reordering: Add drag-and-drop in ServiceGrid.tsx

## Capabilities

### New Capabilities
- spawn-path-resolution
- service-folder-preservation
- service-reordering

### Modified Capabilities
- None

## Impact

### Backend
- server/process-manager.ts
- server/routes.ts
- server/types.ts

### Frontend
- src/components/ServiceModal.tsx
- src/components/ServiceGrid.tsx
