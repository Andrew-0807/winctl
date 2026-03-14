# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

WinCTL is a self-hosted Windows process/service manager with a web dashboard. It has three parts:
- **Daemon** (`SolidJS/server/`) — Express + Socket.IO server that spawns and tracks child processes
- **UI** (`SolidJS/src/`) — SolidJS SPA served by the daemon
- **CLI** (`cli/index.ts`) — thin HTTP client that talks to the daemon

All development work happens inside the `SolidJS/` directory.

## Commands

All commands run from `SolidJS/`:

```bash
# Development (hot-reloading client + server)
npm run dev

# Build everything (client + server + CLI)
npm run build

# Individual builds
npm run build:client    # Vite → dist/
npm run build:server    # tsc → dist-server/
npm run build:cli       # tsc → dist-cli/

# Package to Windows executables (requires pkg, runs build first)
npm run package         # produces winctl-daemon.exe + winctl.exe in repo root
```

## Architecture

### Data flow

The daemon is the source of truth. On any change (service start/stop, config update), `broadcastStatus()` pushes a `status` Socket.IO event to all connected clients. The SolidJS store (`stores/services.ts`) subscribes to this event and reconciles local state.

The UI also uses REST for mutations (`/api/services`, `/api/settings`, etc.) but always re-fetches after each mutation so the Socket.IO broadcast keeps everything consistent.

### Server layer (`SolidJS/server/`)

| File | Responsibility |
|------|---------------|
| `index.ts` | Express setup, Socket.IO, system tray (via `systray`), graceful shutdown |
| `process-manager.ts` | Spawn child processes, capture stdout/stderr into in-memory log ring buffer, auto-restart with exponential backoff, detect already-running processes |
| `config.ts` | Read/write `~/.winctl/services.json` and `~/.winctl/settings.json` (5 s TTL cache), manage themes in `~/.winctl/themes/` |
| `routes.ts` | REST endpoints + input validation/sanitization |
| `types.ts` | All shared TypeScript types |
| `autostart.ts` | Windows Registry (`HKCU\...\Run`) autostart helpers |

**Config files** live in `~/.winctl/`:
- `services.json` — services and folders
- `settings.json` — app settings (theme, folder preferences, autoStart)
- `themes/` — JSON theme files (built-in ones are written on startup)

**Port**: uses `WINCTL_PORT` env var (not `PORT`), defaults to `8080`.

**Route ordering**: `/api/services/reorder` must be registered before `/api/services/:id` in `routes.ts` so Express doesn't treat `"reorder"` as an ID parameter.

### Frontend layer (`SolidJS/src/`)

- `stores/socket.ts` — Socket.IO client instance + all REST API wrappers (`apiFetch`)
- `stores/services.ts` — SolidJS store (services, folders, settings, systemInfo); all mutations go through here
- `stores/ui.ts` — UI-only state (modals, selected service, etc.)
- `components/` — SolidJS components; `App.tsx` is the root

### CLI (`cli/index.ts`)

Standalone binary. Communicates with the daemon exclusively over HTTP on `localhost:WINCTL_PORT`. Commands: `start`, `stop`, `status`, `services`, `start-svc`, `stop-svc`, `restart-svc`, `logs`, `open`, `setup-firewall`, `init`.

### Build outputs

| Directory | Contents |
|-----------|---------|
| `SolidJS/dist/` | Vite client build (served as static files by daemon) |
| `SolidJS/dist-server/` | Compiled daemon TypeScript |
| `SolidJS/dist-cli/` | Compiled CLI TypeScript |
| `winctl-daemon.exe` | pkg-bundled daemon (node18-win-x64) |
| `winctl.exe` | pkg-bundled CLI |

In `pkg` builds, `__dirname` points into the virtual snapshot. Static file serving resolves paths relative to `process.execPath` directory first, falling back to `__dirname`-relative paths for dev mode.

### Service IDs

Generated as `Date.now().toString(36)` — base-36 timestamps. Not UUIDs.

### Theme system

Themes are CSS variable sets stored as JSON. Built-in themes are written to `~/.winctl/themes/` on startup if they don't exist. Custom themes can be created/deleted via the API. The active theme ID is stored in `settings.json`.
