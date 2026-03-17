## 1. UI Positioning & Layout

- [x] 1.1 Analyze `index.html` and `index.css` to understand the current grid/flex layout for gallery items.
- [x] 1.2 Modify `index.css` to apply overlay styling (e.g., `position: absolute`, `z-index`, `left: -...`) for the log terminal container of folder items.
- [x] 1.3 Update `index.js` to ensure toggling the terminal for folders adds the correct classes without expanding the grid item inline.

## 2. Non-Folder Terminal Fix

- [x] 2.1 Investigate why non-folder terminal toggles expand the height but fail to show the console.
- [x] 2.2 Replicate the working folder-terminal initialization logic for non-folder items in `index.js`.
- [x] 2.3 Ensure both folder and non-folder items use a unified or compatible structural approach for the terminal DOM nodes.

## 3. Verification & Polish

- [x] 3.1 Test toggling log terminals on folder items to ensure they appear as a left-aligned overlay without layout shifts.
- [x] 3.2 Test toggling log terminals on non-folder items to verify the console appears and streams data.
- [x] 3.3 Verify edge-case sizing (e.g., ensuring popups don't overflow the viewport).
