## Context

WinCTL is a Windows service management application that allows users to define and manage services/applications they want to run. The current implementation has three critical bugs:

1. **Spawn ENOENT**: When starting GUI applications like Radmin VPN (C:\Program Files (x86)\Radmin VPN\RvRvpnGui.exe), the spawn fails with ENOENT because the path contains spaces and the executable resolution logic does not properly handle quoted paths.

2. **Folder Reset**: When editing a service via ServiceModal, the folderId is hardcoded to null, causing the service to lose its folder assignment.

3. **No Reordering**: Services are stored in an array with no sortOrder field, and there is no UI or API to reorder services.

## Goals / Non-Goals

**Goals:**
1. Fix spawn ENOENT errors for executables with paths containing spaces
2. Preserve folderId when editing services
3. Add drag-and-drop service reordering within folders and at root

**Non-Goals:**
- Adding cloud sync or multi-device support
- Changing the service status polling mechanism
- Adding complex service dependencies

## Decisions

### 1. Spawn Path Resolution

**Decision:** Use shell: true fallback for paths with spaces

**Alternative Considered:**
- Keep shell: false and properly escape paths - Complex and error-prone
- Use cmd.exe /c wrapper - Works but adds overhead
- Use PowerShell Start-Process - Different semantics

**Selected Approach:**
- First attempt: spawn with shell: false and proper argument handling
- If spawn fails with ENOENT for paths with spaces, retry with shell: true
- Expand PATH search to include Program Files directories

### 2. Folder Preservation

**Decision:** Load existing folderId from service being edited

**Implementation:**
- In ServiceModal, load service.folderId into a signal
- On save, use the loaded folderId instead of hardcoding null

### 3. Service Reordering

**Decision:** Add sortOrder field to Service type

**Alternative Considered:**
- Use array index - Fragile when items are deleted
- Use timestamp - Limited granularity
- Use fractional ordering - Complex to implement

**Selected Approach:**
- Add optional sortOrder number field to Service (default: creation timestamp)
- Services sort by sortOrder, then by name
- UI provides drag-and-drop to update sortOrder
- API accepts reorder array of service IDs

## Risks / Trade-offs

[R1] Shell spawn may cause CMD flash on Windows
→ Mitigation: Use windowsHide: true option to suppress window

[R2] sortOrder conflicts when services created simultaneously
→ Mitigation: Use timestamp + random offset for defaults

[R3] Drag-drop may not work on all browsers
→ Mitigation: Provide keyboard-based reordering as fallback

## Migration Plan

1. Add sortOrder field to new services (default: Date.now())
2. Existing services without sortOrder sort by creation order
3. Config file version: None needed (optional field)
4. No rollback needed - changes are additive

## Open Questions

- Should we add animation for drag-drop reordering?
- Do we need to persist folder collapsed state per service?
