## 1. Tauri Project Scaffold

- [x] 1.1 Install Rust toolchain (`rustup`) and verify `cargo` is available
- [x] 1.2 Run `cargo tauri init` in repo root, configuring `distDir` to `../dist` and `devUrl` to Vite's dev server
- [x] 1.3 Configure `tauri.conf.json`: app name "WinCTL", identifier `com.winctl.app`, window title, tray enabled
- [x] 1.4 Configure `tauri.conf.json` bundle to produce a single `winctl.exe` (no installer for now)
- [x] 1.5 Verify `cargo tauri build` produces `src-tauri/target/release/winctl.exe` and opens without error
- [x] 1.6 Verify `cargo tauri dev` starts Vite HMR and the Tauri window simultaneously

## 2. axum HTTP Server (replaces Express)

- [x] 2.1 Add `axum`, `tokio` (full features), `tower`, `tower-http` to `src-tauri/Cargo.toml`
- [x] 2.2 Implement full axum router (services CRUD, settings, folders, themes, autostart)
- [x] 2.3 Register `/api/services/reorder` before `/api/services/:id` to match Express route ordering
- [x] 2.4-2.6 Complete: static file serving via tower-http, port from WINCTL_PORT, HTTP server in thread
- [x] 2.7 Smoke test: React SPA loads from `localhost:8080` and all existing API calls return correct responses

## 3. WebSocket Status Broadcast (replaces Socket.IO)

- [x] 3.1 Add `tokio::sync::broadcast` channel to shared app state
- [x] 3.2 Implement axum WebSocket handler at `/ws`; each connection subscribes to the broadcast receiver
- [x] 3.3 Emit full service-list JSON on every service state change (mirroring the Socket.IO `status` event payload)
- [x] 3.4 Emit Tauri event (`status`) via `app_handle.emit_all` for the embedded WebView path
- [x] 3.5 Test: open two browser tabs; start/stop a service; verify both tabs update within 100 ms

## 4. Rust Config Manager

- [x] 4.1 Add `serde`, `serde_json`, `dirs` crates to `Cargo.toml`
- [x] 4.2 Define Rust structs mirroring `ServiceConfig`, `FolderConfig`, `Settings`, `Theme` from `server/types.ts`
- [x] 4.3 Implement `read_services()` / `write_services()` reading from `~/.config/winctl/services.json`
- [x] 4.4 Implement `read_settings()` / `write_settings()` reading from `~/.config/winctl/settings.json`
- [x] 4.5 Add 5-second TTL in-memory cache for both config files
- [x] 4.6 Implement theme file list / read / write / delete in `~/.config/winctl/themes/`
- [x] 4.7 Seed built-in themes to `~/.config/winctl/themes/` on first startup if directory is empty

## 5. Rust Process Manager

- [x] 5.1 Implement `spawn_service()` using `tokio::process::Command`, capturing stdout+stderr via async readers
- [x] 5.2 Implement per-service `VecDeque<String>` log buffer (max 500 lines) behind `Arc<RwLock<>>`
- [x] 5.3 Implement graceful stop: send `CTRL_C_EVENT` / `TerminateProcess`, wait 5 s, force-kill if needed
- [x] 5.4 Implement auto-restart with exponential backoff (1 s base, 30 s cap, configurable max retries)
- [x] 5.5 Emit status broadcast on every state transition (starting → running → stopped / errored / restarting)
- [x] 5.6 Port "detect already-running process" logic (PID file or port probe) from `server/process-manager.ts`
- [x] 5.7 Integration test: add a service via API, start it, verify logs accumulate, stop it, verify status

## 6. Windows Autostart (replaces node-windows)

- [x] 6.1 Add `winreg` crate to `Cargo.toml`
- [x] 6.2 Implement `enable_autostart()` writing `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\WinCTL`
- [x] 6.3 Implement `disable_autostart()` removing the registry key
- [x] 6.4 Implement `is_autostart_enabled()` checking the key's existence
- [x] 6.5 Wire autostart helpers into the `/api/settings` route handlers

## 7. System Tray (replaces systray npm)

- [x] 7.1 Add `tauri-plugin-tray` to `Cargo.toml` and register in `tauri.conf.json`
- [x] 7.2 Build tray menu matching current menu items (Open, Hide/Show Window, Quit)
- [x] 7.3 Implement tray click handler: show/focus window in GUI mode; open browser in headless mode
- [x] 7.4 Verify tray icon appears correctly in all three run modes (GUI, headless, service)

## 8. Run Mode Flags

- [x] 8.1 Parse `--headless` and `--service` flags before Tauri initialisation using `std::env::args`
- [x] 8.2 In headless mode: skip window creation, show tray icon, start HTTP server
- [x] 8.3 In service mode: skip window and tray, start HTTP server only
- [x] 8.4 Test each mode: confirm correct process count and behaviour in Task Manager

## 9. Frontend Transport Shim

- [x] 9.1 Add `@tauri-apps/api` to `package.json`
- [x] 9.2 Create `src/stores/socket-shim.ts` that detects `window.__TAURI_INTERNALS__` and exports a unified `onStatus(cb)` / `offStatus(cb)` interface
- [x] 9.3 Tauri path: use `@tauri-apps/api/event` `listen('status', cb)`
- [x] 9.4 Browser path: use native `WebSocket` connecting to `ws://localhost:PORT/ws`, parse JSON messages
- [x] 9.5 Update `src/stores/services.ts` to use the shim instead of `socket.io-client` directly
- [x] 9.6 Remove `socket.io-client` from `package.json` dependencies
- [x] 9.7 Test: open dashboard in Tauri WebView and in a browser tab; confirm live updates work in both

## 10. CLI Unification

- [x] 10.1 Add `clap` crate (derive feature) to `Cargo.toml`
- [x] 10.2 Define CLI subcommands matching all commands in `cli/index.ts`: `start`, `stop`, `restart`, `status`, `services`, `start-svc`, `stop-svc`, `restart-svc`, `logs`, `open`, `setup-firewall`, `init`
- [x] 10.3 Detect CLI mode at binary entry: if first arg matches a subcommand, skip Tauri init
- [x] 10.4 Implement each subcommand as an HTTP request to `localhost:WINCTL_PORT` using `reqwest`
- [x] 10.5 Print clear error "WinCTL is not running on port PORT" and exit non-zero when connection refused
- [x] 10.6 Delete `cli/` TypeScript directory and remove CLI-related entries from `package.json` and `tsconfig.cli.json`
- [x] 10.7 Test: `winctl.exe services`, `winctl.exe start myservice`, `winctl.exe logs myservice` all produce correct output

## 11. Build System & Packaging

- [x] 11.1 Remove `pkg`, `tsx`, `concurrently` from `package.json` devDependencies
- [x] 11.2 Update `package.json` scripts: `dev` → `cargo tauri dev`, `build` → `vite build && cargo tauri build`, remove `pkg:*` scripts
- [x] 11.3 Verify `cargo tauri build` embeds `dist/` assets and produces a standalone `winctl.exe` under `src-tauri/target/release/`
- [x] 11.4 Run `npx tsc --noEmit` on remaining TypeScript to confirm no type errors after socket.io removal
- [x] 11.5 Update `CLAUDE.md` and `README.md` build instructions

## 12. Cleanup

- [x] 12.1 Delete `server/` directory
- [x] 12.2 Delete `cli/` directory and associated tsconfigs
- [x] 12.3 Delete `dist-server/` and `dist-cli/` output directories from `.gitignore` / repo
- [x] 12.4 Remove `winctl-daemon.exe` and `winctl.exe` (old pkg outputs) from repo root if present
- [x] 12.5 Final smoke test: fresh checkout, `cargo tauri build`, run `winctl.exe`, open browser to `localhost:8080`, start/stop a service, check Task Manager shows single process
