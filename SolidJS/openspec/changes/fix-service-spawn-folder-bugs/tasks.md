## 1. Backend - Spawn Path Resolution Fix

- [x] 1.1 Update resolveFromPath in process-manager.ts to search Program Files directories
- [x] 1.2 Add spawn retry logic with shell: true for paths containing spaces
- [x] 1.3 Add proper path quoting for spawn arguments
- [ ] 1.4 Test spawn with Radmin VPN path

## 2. Backend - SortOrder Support

- [x] 2.1 Add sortOrder field to Service type in server/types.ts
- [x] 2.2 Update routes.ts to include sortOrder in service responses
- [x] 2.3 Add PUT /api/services/reorder endpoint in routes.ts
- [x] 2.4 Generate default sortOrder (timestamp) for new services

## 3. Frontend - Folder Preservation Fix

- [x] 3.1 Add folderId signal to ServiceModal.tsx
- [x] 3.2 Load existing folderId when editing service
- [x] 3.3 Use loaded folderId in save instead of hardcoded null
- [ ] 3.4 Test editing service preserves folder

## 4. Frontend - Service Reordering

- [x] 4.1 Add reorderService API method in socket.ts
- [x] 4.2 Add drag-and-drop to ServiceGrid.tsx
- [x] 4.3 Update services store to handle reorder
- [x] 4.4 Call API on drag-drop completion
- [ ] 4.5 Test drag-drop reordering in folder and at root

## 5. Testing & Polish

- [ ] 5.1 Test all three bug fixes manually
- [ ] 5.2 Verify no console errors
- [x] 5.3 Build and verify
