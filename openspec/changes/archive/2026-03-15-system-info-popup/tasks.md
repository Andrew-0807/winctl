## 1. Server — Add `fetchTool` to Settings type

- [x] 1.1 Open `SolidJS/server/types.ts` and add `fetchTool?: string | null;` to the `Settings` interface.

## 2. Server — Add sysinfo routes

- [x] 2.1 Open `SolidJS/server/routes.ts`. At the top with the other imports, confirm `exec` from `child_process` is already imported (it is — used by autostart helpers).
- [x] 2.2 Add a `checkOnPath(tool: string): Promise<boolean>` helper function above `setupRoutes`. It runs `where <tool>` via `exec` and resolves `true` if the exit code is 0, `false` otherwise.
- [x] 2.3 Inside `setupRoutes`, add `GET /api/sysinfo/tools`:
  - Checks `['fastfetch', 'neofetch', 'winfetch']` via `checkOnPath` in parallel.
  - Returns `{ tools: string[] }` with only the found tool names.
- [x] 2.4 Add `GET /api/sysinfo/run`:
  - Reads `settings.fetchTool` from `loadSettings()`.
  - If not set, returns `400 { error: 'No fetch tool configured' }`.
  - Runs the tool via `exec(tool, { timeout: 10000 })` with `COLORTERM=truecolor` env and `--pipe false` for fastfetch.
  - On success, returns `{ output: stdout }`.
  - On error, returns `500 { error: stderr or err.message }`.
- [x] 2.5 Place both new routes in the `// ── System ──` section of `routes.ts`.

## 3. Client — Update Settings type and API helpers

- [x] 3.1 Open `SolidJS/src/stores/socket.ts`. Find the `Settings` interface/type and add `fetchTool?: string | null`.
- [x] 3.2 Add two new API helper functions in `socket.ts`:
  - `getAvailableTools(): Promise<{ tools: string[] }>` — calls `GET /api/sysinfo/tools`.
  - `runFetchTool(): Promise<{ output: string }>` — calls `GET /api/sysinfo/run`.
- [x] 3.3 Open `SolidJS/src/stores/services.ts`. In the default settings store object, add `fetchTool: null`.

## 4. Client — Add modal state to `ui.ts`

- [x] 4.1 Open `SolidJS/src/stores/ui.ts`.
- [x] 4.2 In the `// ── Modal State ──` section, add `systemInfoModalOpen` signal.
- [x] 4.3 Add `openSystemInfoModal` / `closeSystemInfoModal` helper functions.
- [x] 4.4 Export `systemInfoModalOpen` and `setSystemInfoModalOpen`.
- [x] 4.5 In `handleKeyDown`, add `closeSystemInfoModal()` inside the Escape branch.

## 5. Create `SystemInfoModal.tsx`

- [x] 5.1 Create `SolidJS/src/components/SystemInfoModal.tsx`.
- [x] 5.2 Implement local signals: `showPicker`, `availableTools`, `selectedTool`, `output`, `loading`, `errorMsg`.
- [x] 5.3 `createEffect` triggers on modal open: load tools if no fetchTool set, else run tool.
- [x] 5.4 Picker view: radio buttons for detected tools, "Confirm" button, "no tool found" fallback.
- [x] 5.5 Output view: loading state, error state, `<pre>` with rendered output, "Change tool" button.
- [x] 5.6 Implement `renderTerminalOutput()` — grid-based terminal emulator supporting cursor positioning, 256-color, and true-color RGB. Makes fastfetch two-column layout render correctly.
- [x] 5.7 Modal uses always-in-DOM + `.open` class pattern (same as `SettingsModal.tsx`).
- [x] 5.8 `.sysinfo-output` pre block styled in `global.css`.

## 6. Wire up Sidebar

- [x] 6.1 Open `SolidJS/src/components/Sidebar.tsx`.
- [x] 6.2 Add `openSystemInfoModal` to imports from `'../stores/ui'`.
- [x] 6.3 Change System Info nav item onClick to `openSystemInfoModal()`.
- [x] 6.4 Remove dead `loadSystemInfo()` helper and unused `loadSystem` import.

## 7. Mount modal in `App.tsx`

- [x] 7.1 Import `SystemInfoModal` from `'./components/SystemInfoModal'`.
- [x] 7.2 Add `<SystemInfoModal />` alongside other modals.

## 8. Verify and build

- [x] 8.1 Feature confirmed working by user — modal opens, tool picker works, output displays with colors and two-column layout.
- [x] 8.2 Escape key closes modal (implemented in handleKeyDown).
- [x] 8.3 Run `npm run build` — confirm no TypeScript errors.
