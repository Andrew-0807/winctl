## 1. Fix Tray Icon (index.ts)

- [x] 1.1 Open `SolidJS/server/index.ts` and locate the `trayInstance = new SysTrayClass(...)` call inside `initTray()`.
- [x] 1.2 Add `copyDir: true` to the constructor: `new SysTrayClass({ menu: getTrayMenuDef(iconBase64), copyDir: true })`.

## 2. Add keepServicesOnExit to Settings type and default (types.ts + config.ts)

- [x] 2.1 Open `SolidJS/server/types.ts` and add `keepServicesOnExit: boolean;` to the `Settings` interface.
- [x] 2.2 Open `SolidJS/server/config.ts` and add `keepServicesOnExit: false` to the `defaultSettings` object inside `loadSettings()`.

## 3. Update shutdownDaemon signature (index.ts)

- [x] 3.1 Change `async function shutdownDaemon(force: boolean)` to `async function shutdownDaemon(force: boolean, keepServices = false)`.
- [x] 3.2 In the graceful path, wrap the service-stop loop (`const registry = getRegistry()` … `await Promise.all(stopPromises)`) inside `if (!keepServices) { ... }`.

## 4. Update /api/shutdown route (routes.ts)

- [x] 4.1 Open `SolidJS/server/routes.ts`, locate `app.post('/api/shutdown', ...)`.
- [x] 4.2 Before the `setTimeout`, add: `const { keepServices = false } = req.body as { keepServices?: boolean };`
- [x] 4.3 Change the `setTimeout` callback to: `onShutdown(false, keepServices)`.

## 5. Update frontend Settings type and add API wrapper (socket.ts)

- [x] 5.1 Open `SolidJS/src/stores/socket.ts` and add `keepServicesOnExit: boolean;` to the `Settings` interface.
- [x] 5.2 Add a `shutdownDaemon` async function after `saveSettings`:
  ```typescript
  async function shutdownDaemon(keepServices = false): Promise<void> {
    return apiFetch<void>('/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepServices }),
    });
  }
  ```
- [x] 5.3 Add `shutdownDaemon` to the named export list at the bottom of the file.

## 6. Add keepServicesOnExit toggle and shutdown UI (SettingsModal.tsx)

- [x] 6.1 Open `SolidJS/src/components/SettingsModal.tsx`.
- [x] 6.2 Import `shutdownDaemon` from `../stores/socket`.
- [x] 6.3 Add two new signals at the top of the component:
  - `const [keepServicesOnExit, setKeepServicesOnExit] = createSignal(settings.keepServicesOnExit || false);`
  - `const [showShutdownConfirm, setShowShutdownConfirm] = createSignal(false);`
- [x] 6.4 Add `setKeepServicesOnExit(settings.keepServicesOnExit || false)` inside the existing `createEffect` that syncs settings signals.
- [x] 6.5 Add a `toggleKeepServicesOnExit` function that flips the signal and calls `updateSettings({ keepServicesOnExit: newValue })`.
- [x] 6.6 After the Auto-start `toggle-row` block, add a new `toggle-row` for "Keep services on exit" with subtitle "When WinCTL stops, leave managed services running", wired to `keepServicesOnExit()` and `toggleKeepServicesOnExit`.
- [x] 6.7 After the keyboard shortcuts block (before closing `</div>` of `modal-body`), add a danger zone section:
  - Divider with "Danger Zone" label (same style as keyboard shortcuts divider).
  - "Stop WinCTL" button (red, full width) with `onClick={() => setShowShutdownConfirm(true)}`.
  - A `Show` conditional block (`showShutdownConfirm()`) with:
    - Text: "Stop WinCTL?" + one-line description based on `keepServicesOnExit()` ("Services will stop." or "Services will keep running.").
    - A "Confirm Stop" red button that calls `shutdownDaemon(keepServicesOnExit())`.
    - A "Cancel" link that calls `setShowShutdownConfirm(false)`.
- [x] 6.8 Reset `showShutdownConfirm` to `false` on modal close: add `setShowShutdownConfirm(false)` to the backdrop click handler and to the Close button's `onClick`.

## 7. Verify and Rebuild

- [ ] 7.1 Run `npm run dev` — open Settings modal, confirm "Keep services on exit" toggle appears after Auto-start and persists across reloads.
- [ ] 7.2 Click "Stop WinCTL" — confirm inline confirmation appears; description reflects the current toggle state.
- [ ] 7.3 Test "Stop all services" mode (toggle off) — all managed services stop, then WinCTL exits.
- [ ] 7.4 Test "Keep services running" mode (toggle on) — WinCTL exits but processes continue.
- [ ] 7.5 Build pkg executable (`npm run package`) and launch `winctl-daemon.exe` — confirm tray icon appears in the Windows system tray.
- [ ] 7.6 Run `npm run build` — confirm no TypeScript errors.
