## Why

The "System Info" button in the sidebar calls `loadSystem()` which fetches basic OS stats from `GET /api/system` but never displays anything — the result sits unused in the `systemInfo` signal with no UI to show it. The button is a dead click.

Meanwhile, Windows power users commonly have tools like **fastfetch**, **neofetch**, or **winfetch** installed to see a richer, visually formatted system overview. This feature makes the System Info button actually useful by running whichever fetch tool the user has installed and showing its output in a popup.

## What Changes

- **System Info button opens a modal** — clicking it shows a popup instead of silently calling `loadSystem()`.
- **Tool detection on demand** — the server checks which of `fastfetch`, `neofetch`, `winfetch` are on PATH and returns the list.
- **First-run picker** — if no tool is configured yet, the modal shows a radio-button selector for all detected tools (with a "None found" message if none are installed).
- **ANSI output display** — once a tool is selected, the modal runs it and renders its colorized output in a terminal-style `<pre>` block using a grid-based terminal emulator that supports cursor positioning, 256-color, and true-color sequences.
- **Preference persisted** — the chosen tool is saved to `settings.json` as `fetchTool` so the picker only appears once.
- **Re-configure from modal** — a small "Change tool" link inside the modal lets the user switch tools without going to Settings.

## Capabilities

### New Capabilities

- `system-info-popup`: System Info button opens a modal that runs the configured fetch tool and displays its output with full color and two-column layout support.

### Modified Capabilities

- `GET /api/sysinfo/tools`: New endpoint — returns list of fetch tools found on PATH.
- `GET /api/sysinfo/run`: New endpoint — runs the configured fetch tool and returns stdout.
- `Settings` type: New optional field `fetchTool?: string | null`.
- `Sidebar.tsx`: System Info click opens modal instead of calling `loadSystem()`.
- `ui.ts`: New `systemInfoModalOpen` signal + open/close helpers.
- `App.tsx`: New `<SystemInfoModal />` added to render tree.

## Impact

- **SolidJS/server/routes.ts** — two new routes added (`/api/sysinfo/tools`, `/api/sysinfo/run`).
- **SolidJS/server/types.ts** — `fetchTool` field added to `Settings` interface.
- **SolidJS/src/stores/socket.ts** — `fetchTool` added to Settings type; two new API helper functions.
- **SolidJS/src/stores/ui.ts** — `systemInfoModalOpen` signal + helpers added.
- **SolidJS/src/components/SystemInfoModal.tsx** — new component (tool picker + grid-based terminal renderer).
- **SolidJS/src/components/Sidebar.tsx** — System Info click handler updated.
- **SolidJS/src/App.tsx** — `<SystemInfoModal />` mounted.
- No changes to `config.ts`, `process-manager.ts`, or the CLI.
