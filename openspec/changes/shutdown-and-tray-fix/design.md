## Context

`SettingsModal.tsx` currently has four form sections (Theme, Folder Default State, Show Folder Count, Auto-start) plus a keyboard shortcuts cheatsheet, and a footer with "Create Theme" / "Close". There is no shutdown control.

`server/types.ts` defines the `Settings` interface: `theme?`, `folderStatePreference`, `showFolderCount`, `autoStart`. The `defaultSettings` in `config.ts` sets `autoStart: false`.

`server/index.ts` exports `shutdownDaemon(force: boolean)`. The graceful path (`force = false`) always stops all running managed services. `server/routes.ts` exposes `POST /api/shutdown` (graceful) and `POST /api/shutdown/force` — neither accepts a body payload.

`initTray()` constructs the systray instance without `copyDir`, which causes the tray helper binary to fail to spawn from inside the pkg virtual snapshot.

`stores/socket.ts` has no `shutdownDaemon` API wrapper. The `Settings` interface in `socket.ts` mirrors the server type.

## Goals / Non-Goals

**Goals:**
- Add `keepServicesOnExit` as a **persistent setting** stored in `settings.json` — a toggle in the Settings modal the user sets once.
- Add a shutdown button + simple confirmation (no mode picker in the dialog — mode comes from the setting).
- Support `keepServices` flag so the daemon exits without stopping managed processes.
- Fix tray icon by passing `copyDir: true` to the SysTray constructor.

**Non-Goals:**
- Do not add a force-kill button to the UI (the `/api/shutdown/force` route stays server-only).
- Do not add a per-shutdown mode override in the confirmation dialog.
- Do not redesign the Settings modal layout.
- Do not add a tray menu item for the new shutdown mode.
- Do not change how `shutdownDaemon(true)` (force) behaves.

## Decisions

### 1. `keepServicesOnExit` as a persistent setting

Add to `types.ts`:
```typescript
export interface Settings {
  theme?: string;
  folderStatePreference: 'remember' | 'open' | 'closed';
  showFolderCount: boolean;
  autoStart: boolean;
  keepServicesOnExit: boolean;  // ← new, default false
}
```

Add to `defaultSettings` in `config.ts`:
```typescript
const defaultSettings: Settings = {
  folderStatePreference: 'remember',
  showFolderCount: true,
  autoStart: false,
  keepServicesOnExit: false,   // ← new
};
```

Add to the `Settings` interface in `socket.ts`:
```typescript
interface Settings {
  ...
  keepServicesOnExit: boolean;
}
```

### 2. Toggle in Settings modal

Add a new `toggle-row` after the Auto-start row (same pattern as existing toggles):

```
Keep services on exit
When WinCTL stops, leave managed services running
[toggle]
```

Signal: `const [keepServicesOnExit, setKeepServicesOnExit] = createSignal(settings.keepServicesOnExit || false);`

On toggle: `updateSettings({ keepServicesOnExit: newValue })`.

### 3. Shutdown button + simple confirmation

Below the keyboard shortcuts block, add:

```
────────────────────────────
⚠ Danger Zone
[Stop WinCTL]                    ← red ghost button, full width

// after click (inline confirmation):
Stop WinCTL?
Services will [stop / keep running] when WinCTL exits.
                   [Cancel]  [Confirm Stop]
```

The mode description comes from `settings.keepServicesOnExit` — no choice is presented in the dialog. This keeps the confirmation simple and fast.

State: `showShutdownConfirm` signal (`boolean`) controls visibility of the inline panel. Reset to `false` when modal closes.

### 4. `keepServices` parameter on `shutdownDaemon`

```typescript
// index.ts
async function shutdownDaemon(force: boolean, keepServices = false): Promise<void>
```

In the graceful path, wrap the service-stop loop in `if (!keepServices)`.

Route change (`routes.ts`):
```typescript
const { keepServices = false } = req.body as { keepServices?: boolean };
setTimeout(() => onShutdown(false, keepServices), 200);
```

### 5. API wrapper in socket.ts

```typescript
async function shutdownDaemon(keepServices = false): Promise<void> {
  return apiFetch<void>('/api/shutdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepServices }),
  });
}
```

Export alongside existing functions.

### 6. Tray fix: `copyDir: true`

```typescript
trayInstance = new SysTrayClass({ menu: getTrayMenuDef(iconBase64), copyDir: true });
```

`copyDir: true` tells systray to copy its Go helper binary to the OS temp directory before spawning it — required when it lives inside a pkg virtual snapshot.

### 7. Shutdown button wiring

In the confirmation handler, call: `shutdownDaemon(settings.keepServicesOnExit)` — reads the stored setting at the moment the user confirms.

## Risks / Trade-offs

- **Risk:** `keepServicesOnExit: true` leaves processes running without WinCTL managing them. This is intentional and communicated in the toggle's subtitle and the confirmation message.
- **Risk:** After `copyDir: true`, systray extracts a small binary (~2MB) to `%TEMP%` on every startup. Standard practice; no user action needed.
- **Backward compat:** `keepServicesOnExit` is not in existing `settings.json` files. The `|| false` fallback in the component and the server's `req.body` default handle this transparently.
