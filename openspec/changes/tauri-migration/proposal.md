## Why

WinCTL currently produces multiple `node.exe` processes in Task Manager (two in dev, two executables in production where the CLI spawns the daemon as a child), because it relies on `pkg`-wrapped Node.js and `concurrently` for orchestration. Migrating to Tauri delivers a single native `winctl.exe` binary with a Rust core — eliminating all stray Node processes, cutting memory and startup time significantly, and making WinCTL appear as a proper Windows application.

## What Changes

- **BREAKING**: Replace Express + Socket.IO server (`server/`) with an axum/tokio Rust backend embedded in the Tauri binary
- **BREAKING**: Replace `pkg` packaging (two executables) with `cargo tauri build` (one executable)
- Replace `socket.io-client` in the React frontend with a dual-path shim: Tauri IPC for the embedded WebView, native WebSocket for browser clients
- Merge the standalone CLI binary into `winctl.exe` — subcommands (`start`, `stop`, `status`, `logs`, …) are detected at startup via CLI args and delegate to the running instance over HTTP
- Replace `systray` npm package with `tauri-plugin-tray`
- Replace `node-windows` autostart with the `winreg` Rust crate
- Keep React + Vite frontend entirely intact; only the transport layer changes
- Add run-mode flags: `--headless` (tray only, no window), `--service` (no tray, no window)

## Capabilities

### New Capabilities
- `tauri-shell`: Single Tauri application binary with GUI window, tray, and headless modes
- `rust-process-manager`: Native Rust process manager replacing the Node.js `child_process` implementation
- `rust-config-manager`: Native Rust config read/write replacing the Node.js `fs`/JSON implementation
- `axum-http-server`: Embedded axum HTTP + WebSocket server replacing Express + Socket.IO
- `cli-unified`: Unified CLI as subcommands of `winctl.exe` rather than a separate binary

### Modified Capabilities

## Impact

- `server/` directory replaced by `src-tauri/src/` (Rust)
- `cli/index.ts` removed; CLI logic moves to Rust within Tauri binary
- `package.json` scripts: `dev` → `cargo tauri dev`, `build`/`package` → `cargo tauri build`
- New dependencies: Rust toolchain, `tauri`, `axum`, `tokio`, `serde_json`, `winreg`
- Removed npm dependencies: `express`, `socket.io`, `systray`, `node-windows`, `pkg`, `tsx`, `concurrently`
- `socket.io-client` replaced by a thin shim in `src/stores/socket.ts`
- REST API surface (`/api/*`) preserved — existing browser clients and the CLI HTTP protocol are unchanged
- Requires WebView2 runtime on target machines (present by default on Win10 1803+ and all Win11)
