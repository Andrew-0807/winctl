## Context

`Sidebar.tsx` has a "System Info" nav item that calls `loadSystemInfo()` which calls `loadSystem()` from `stores/services.ts`. `loadSystem()` fetches `GET /api/system` (basic OS stats via the `os` module) and stores the result in a `systemInfo` signal — but nothing in the UI reads that signal. The button is a no-op from the user's perspective.

The goal is to wire this button to a new modal that runs a user-chosen fetch tool (fastfetch / neofetch / winfetch) and displays its output. The tool preference is stored in `settings.json` as `fetchTool`.

## Goals / Non-Goals

**Goals:**
- Add `GET /api/sysinfo/tools` — detect which fetch tools are on PATH.
- Add `GET /api/sysinfo/run` — run the configured `fetchTool` from settings and return stdout.
- Add `fetchTool?: string | null` to the `Settings` type (server and client).
- Add `systemInfoModalOpen` signal to `ui.ts` with `openSystemInfoModal` / `closeSystemInfoModal`.
- Create `SystemInfoModal.tsx` — first-run picker if no tool set, output display once configured.
- Update `Sidebar.tsx` to call `openSystemInfoModal()` instead of `loadSystem()`.
- Mount `<SystemInfoModal />` in `App.tsx`.
- Render ANSI color output with full cursor-positioning support for two-column layouts.

**Non-Goals:**
- Do not add Settings UI for `fetchTool` in `SettingsModal.tsx` — the modal itself handles configuration.
- Do not touch the existing `GET /api/system` route or `loadSystem()` function — they can coexist.
- Do not change the CLI.

## Decisions

**1. Two focused server endpoints, not one**

`GET /api/sysinfo/tools` runs three quick `where` checks in parallel and returns `{ tools: string[] }`.

`GET /api/sysinfo/run` reads `settings.fetchTool`, runs it via `exec` with `--pipe false` (fastfetch) and `COLORTERM=truecolor` env to force ANSI output when no TTY is present. Returns `{ output: string }`.

**2. `fetchTool` in Settings, persisted via existing `PUT /api/settings`**

No new endpoint needed — the existing endpoint merges any fields. The modal calls `updateSettings({ fetchTool: selected })` after the user picks.

**3. Modal flow**

```
openSystemInfoModal()
  │
  ├─ settings.fetchTool is null?
  │    └─ fetch /api/sysinfo/tools
  │         ├─ tools found → show radio picker + "Confirm" button
  │         └─ no tools → show "No supported tool found."
  │
  └─ settings.fetchTool is set?
       └─ fetch /api/sysinfo/run → display output in <pre>
            └─ "Change tool" link → resets local `showPicker` signal to true
```

**4. Grid-based terminal renderer**

Instead of stripping or naively converting ANSI codes, `renderTerminalOutput()` simulates a terminal:
- Maintains a 2D `Cell[][]` grid tracking character + fg color + bold per cell
- Parses all CSI sequences: SGR (colors), cursor forward/back/up/down, set column, set position
- `\x1B[40C` (cursor forward 40) advances `col += 40` — subsequent characters land in the right column
- After parsing, renders grid row-by-row into HTML with `<span style="color:...">` groups
- Supports 16-color, 256-color (`38;5;n`), and true-color RGB (`38;2;r;g;b`) sequences
- OSC and other non-SGR sequences are consumed and discarded cleanly

This makes fastfetch's logo-left / info-right two-column layout work correctly in `<pre>`.

**5. Escape key and Backdrop close**

`handleKeyDown` in `ui.ts` calls `closeSystemInfoModal()` in the Escape branch. Modal backdrop uses the same always-in-DOM + `.open` class pattern as `SettingsModal.tsx`.

## Risks / Trade-offs

- **`winfetch` is a PowerShell script** — `exec('winfetch')` may fail if PowerShell execution policy blocks it. The error message is shown as-is.
- **10s timeout** — generous for fastfetch (< 1s) but needed for neofetch.
- **No output streaming** — full output returned as a single JSON string. Fetch tool outputs are typically < 4 KB so this is fine.
- **Wide character support** — not implemented; CJK double-width characters may mis-align. Not relevant for fastfetch/neofetch output.
