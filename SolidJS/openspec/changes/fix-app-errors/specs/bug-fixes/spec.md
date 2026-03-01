## ADDED Requirements

### Requirement: Express routes must be registered in specificity order
The server SHALL register all literal-path Express routes before parameterized routes on the same HTTP method and path prefix, such that `PUT /api/services/reorder` is registered before `PUT /api/services/:id`.

#### Scenario: Reorder request is routed to the correct handler
- **WHEN** the client sends `PUT /api/services/reorder` with a JSON array of service IDs
- **THEN** the server SHALL respond with `{ ok: true }` and persist the new sort order

#### Scenario: Service update still works after route reorder
- **WHEN** the client sends `PUT /api/services/<valid-id>` with updated service fields
- **THEN** the server SHALL respond with the updated service object

---

### Requirement: PATH environment variable is split with the correct delimiter
The server's `resolveFromPath` function SHALL split the PATH environment variable using the OS path delimiter (`;` on Windows, `:` on Unix), NOT the path segment separator.

#### Scenario: Executable found in PATH-listed directory
- **WHEN** a service command (e.g., `node`) exists in a directory listed in the PATH
- **THEN** the server SHALL resolve the full path to that executable before spawning

---

### Requirement: Auto-start services start exactly once at boot
The server SHALL auto-start services with `autoStart: true` exactly once per daemon startup, with no duplicate invocations.

#### Scenario: Services auto-start once on daemon boot
- **WHEN** the daemon starts and `detectRunningProcesses` completes
- **THEN** each service with `autoStart: true` that is not already running SHALL be started exactly once

---

### Requirement: Settings store is updated with the full merged object
The `updateSettings` function SHALL merge the incoming partial settings with the current settings store and persist the full merged object, not only the partial input.

#### Scenario: Theme change preserves other settings
- **WHEN** the user changes only the theme
- **THEN** `folderStatePreference`, `showFolderCount`, and `autoStart` SHALL remain unchanged

---

### Requirement: App component cleanup runs reliably on unmount
The `App` component's cleanup function (clearing intervals and removing event listeners) SHALL be registered in a synchronous reactive context so SolidJS can call it on component unmount.

#### Scenario: Keyboard listener and polling interval are cleaned up
- **WHEN** the App component unmounts
- **THEN** the `keydown` listener SHALL be removed from `document` and the system-info interval SHALL be cleared

---

### Requirement: Modal minimized-row visibility is driven by reactive state
The Service Modal's "Start minimized" row SHALL be shown or hidden using SolidJS's `<Show>` component based on a reactive memo of the command field, not imperative DOM manipulation.

#### Scenario: Minimized row appears when command ends with .exe
- **WHEN** the user types a command ending with `.exe`
- **THEN** the "Start minimized" toggle row SHALL become visible without requiring a re-open of the modal

#### Scenario: Minimized row hidden for non-exe commands
- **WHEN** the command field does not end with `.exe`
- **THEN** the "Start minimized" toggle row SHALL not be visible

---

### Requirement: Tray menu refresh is triggered by the API route directly
The system tray menu SHALL be refreshed when `POST /api/tray/refresh` is called, with no dependency on a socket-level event named `tray:refresh` being emitted to `io`.

#### Scenario: Tray refreshes on API call
- **WHEN** `POST /api/tray/refresh` receives a request
- **THEN** the tray menu SHALL update to reflect current service state

---

### Requirement: System tray icon loads correctly in packaged builds
The `initTray()` function SHALL resolve the tray icon path relative to `process.execPath`, not `__dirname`, so that the icon is found when running as a packaged `pkg` executable.

#### Scenario: Tray icon found when running packaged daemon
- **WHEN** the daemon runs as `winctl-daemon.exe` in a directory that contains `public/icons/icon-16.png`
- **THEN** the tray icon SHALL load and the system tray SHALL initialize without skipping

#### Scenario: Tray still works in dev mode
- **WHEN** the daemon is started via `tsx watch server/index.ts` in development
- **THEN** the `__dirname`-relative fallback path SHALL be used and the tray SHALL still initialize

---

### Requirement: Daemon startup output does not expose process internals
The daemon SHALL NOT print `process.argv` or raw environment variable values on startup. The startup log SHALL only show the resolved port number.

#### Scenario: Clean startup log
- **WHEN** the daemon starts as a Windows Service with no `PORT` env var set
- **THEN** the startup log SHALL show the listening port without printing `env.PORT: undefined` or argv contents

#### Scenario: PORT uses only WINCTL_PORT
- **WHEN** `WINCTL_PORT` is not set
- **THEN** the daemon SHALL default to port `8080` without attempting to read `process.env.PORT`
