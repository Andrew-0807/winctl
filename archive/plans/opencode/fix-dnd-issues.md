# Fix Drag and Drop Issues

## Issue 1: Duplicate drag handle on status dot

**File:** `src/styles/global.css` (lines 725-746)

**Problem:** The `.svc-status-dot` element shows `cursor: grab` and a `⋮` symbol on hover, creating a visual second drag handle. Only the `.drag-handle` element should be the drag trigger.

**Fix:** Remove these CSS rules entirely:
```css
.svc-header:hover .svc-status-dot {
  cursor: grab;
  transform: scale(1.15);
}

.svc-header:hover .svc-status-dot::before {
  opacity: 1;
}

.svc-header:hover .svc-status-dot::after {
  color: var(--text);
}

.svc-card.dragging .svc-status-dot {
  cursor: grabbing;
  transform: scale(1.25);
}
```

Keep only the `.svc-card.dragging .drag-handle` rule (cursor: grabbing, color: var(--accent)).

---

## Issue 2 + 3: Card disappears over folders + folder drop target

**File:** `src/components/FolderCard.tsx`

**Problem:** `useDroppable` is attached only to `.folder-body-inner` (line 168) and the gallery grid (line 226). When the folder is collapsed, the body is not in DOM, so there's no drop target. The card disappears because `over` becomes null.

**Fix:** Attach `useDroppable` to the root `.folder-card` element so the entire folder card is always droppable, regardless of expanded/collapsed state.

### Changes to FolderCard.tsx:

1. Move `setDropNodeRef` from the inner body div to the root `.folder-card` div (line ~123)
2. Add `drag-over` class to `.folder-card` when `isOver` is true
3. Keep the existing `isOver` inline outline styling for the body inner as additional visual feedback when expanded

```tsx
// Line 123-127: Add drag-over class and droppable ref to root
<div
  className={`folder-card ${isExpanded && currentView !== 'gallery' ? 'expanded' : ''} ${isOver ? 'drag-over' : ''}`}
  id={`folder-${folder.id}`}
  data-folder-id={folder.id}
  ref={setDropNodeRef}  // <-- move ref here
>
```

Then remove `ref={setDropNodeRef}` from:
- Line 168 (`.folder-body-inner`)
- Line 226 (gallery grid div)

Keep the `isOver` inline outline styling on those elements for additional visual feedback.

---

## Issue 3: Drag-over visual feedback

**File:** `src/styles/global.css`

**Problem:** The `.folder-card.drag-over` CSS class exists (line 1844, 2027) but was never applied in React code.

**Fix:** The class is now applied via the FolderCard change above. Update the CSS to target the folder card directly:

```css
.folder-card.drag-over {
  border-color: var(--accent);
  background: var(--accent-glow);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
```

This gives clear visual feedback when dragging a service over a folder, whether collapsed or expanded.
