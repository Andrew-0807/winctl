# CLAUDE.md

WinCTL — Windows process/service manager with a web dashboard.
- **Backend** (`src-tauri/src/`) — Rust: Axum HTTP + WebSocket server, embedded in a Tauri app (tray + webview). Spawns/supervises child processes.
- **Frontend** (`src/`) — React SPA, Zustand + Framer Motion, Vite.
- **CLI** — the same Rust binary; subcommands dispatched in `lib.rs::run()`.

## Commands
```
npm run dev              # Vite dev server (frontend)
npm run tauri dev        # full app (Rust backend + webview)
cd src-tauri && cargo check    # type-check backend
npx tsc --noEmit         # type-check frontend
npm run tauri build      # release bundle
```

## Key architecture
- `AppState` (`lib.rs`) is the live source of truth: `services`/`settings` in `Arc<RwLock>`, broadcast over Socket via `tx.send("update")`.
- The broadcast string `"update"` triggers a full status snapshot to WS clients + the Tauri webview (`broadcast_listener`); any other payload (e.g. `exec-output`, `exec-done`) is forwarded verbatim.
- Port: `settings.port` (default `8888`), overridable via `WINCTL_PORT`.
- Config: `~/.config/winctl/` (`services.json`, `settings.json`, `themes/`).
- Auth: loopback is exempt (CSRF-checked by Origin); remote needs an HMAC token or `open_access`. Passwords stored as argon2 hashes. Setup routes are loopback+Origin guarded (`setup_guard`).
- Service IDs: base-36 timestamp (`radix_fmt`), not UUIDs.
- **Route ordering:** `/api/services/reorder` is registered BEFORE `/api/services/{id}`.

## Backend files (`src-tauri/src/`)
| File | Role |
|------|------|
| `lib.rs` | Axum router, handlers, WS, auth, CLI, Tauri setup, supervision |
| `process.rs` | spawn/kill, log ring buffer (500), liveness via `try_wait`/`GetExitCodeProcess` |
| `config.rs` | read/write config (atomic), themes, autostart (registry) |

## Frontend files (`src/`)
- `stores/socket.ts` — WS client, `apiFetch`, types
- `stores/services.ts` — Zustand store (services, folders, settings)
- `stores/ui.ts` — modal/selection state
- `stores/themes.ts` — theme CRUD
- `components/ServiceIcon.tsx` / `IconPicker.tsx` — per-service icons (Lucide name or data-URI upload)
- `components/GenerativeBackground.tsx` — canvas-based vector flow-field background (used in Login/Onboarding)

## Service fields of note
- `icon` — Lucide icon name OR `data:` URI; empty = no icon.
- `startDelayMins` — minutes to wait after boot before auto-starting (needs `autoStart`).
- `autoStart` / `autoRestart` — launch on boot / relaunch on crash.
