## Context

WinCTL is a Windows process/service manager with three components: an Express+Socket.IO daemon (`server/`), a React SPA (`src/`), and a CLI (`cli/`). In production both the daemon and CLI are packaged with `pkg` into two separate Node18 executables. In dev, `concurrently` spawns Vite and `tsx watch` as sibling processes. The result is multiple `node.exe` entries in Task Manager and a fragmented distribution story.

The migration replaces the Node backend with a Rust core embedded in a Tauri binary, keeping the React frontend untouched except for swapping the Socket.IO transport layer.

## Goals / Non-Goals

**Goals:**
- Single `winctl.exe` in Task Manager (no `node.exe` at all in production)
- GUI mode (window + tray), headless mode (tray only), service mode (no UI)
- CLI subcommands (`start`, `stop`, `logs`, etc.) built into the same binary
- Preserve the existing REST API surface so browser clients need no changes
- Sub-300 ms cold startup; ≤60 MB idle memory

**Non-Goals:**
- Cross-platform support (Windows only, WebView2 assumed present)
- Rewriting the React UI beyond the transport shim
- Changing the config file format (`services.json` / `settings.json`)
- Supporting Node.js plugin/extension hooks in the new runtime

## Decisions

### 1. Tauri over Electron

Tauri uses the system WebView2 (always present on Win10 1803+ / Win11) rather than bundling Chromium. Result: ~5–15 MB binary vs ~150 MB for Electron, and the process tree shows `winctl.exe` as the host — not `chrome.exe` derivatives.

*Alternative considered*: Neutralino — lighter but weaker ecosystem and no Rust-native IPC.

### 2. axum for the embedded HTTP + WebSocket server

axum runs inside the same Tauri process on `WINCTL_PORT`. It exposes the identical REST routes that Express currently exposes, so the CLI and any browser tab pointing at `localhost:8080` keep working without modification.

Socket.IO is replaced by a plain axum WebSocket handler. The broadcast pattern is implemented with `tokio::sync::broadcast::channel` — one sender per daemon, all WS connections subscribe.

*Alternative considered*: keeping a separate Node sidecar (Phase 0 bridge) — rejected for the full migration because it still embeds a Node runtime and still shows a child node.exe.

### 3. Tauri IPC for the embedded WebView, WebSocket for browser

Within the Tauri WebView, `@tauri-apps/api/event` replaces Socket.IO (in-process, zero TCP overhead). A thin shim in `src/stores/socket.ts` detects `window.__TAURI_INTERNALS__` and picks the right transport:

```ts
const isTauri = '__TAURI_INTERNALS__' in window;
// tauri path  → listen/emit from @tauri-apps/api/event
// browser path → native WebSocket to ws://localhost:PORT/ws
```

This means the rest of the React store is unchanged.

### 4. CLI merged into winctl.exe via Clap

`winctl.exe start redis` → Clap arg parser detects a subcommand, skips Tauri init, sends HTTP to the running instance, prints result, exits. The same binary serves all three roles. No separate `winctl.exe` CLI artifact.

```
winctl.exe              → start full app (GUI + tray + HTTP server)
winctl.exe --headless   → tray only
winctl.exe --service    → no UI, pure server
winctl.exe <subcmd>     → CLI delegate over HTTP
```

### 5. Process manager in Rust with tokio

`tokio::process::Command` replaces `child_process.spawn`. Each managed service runs as a `tokio::task`. Stdout/stderr are captured via `tokio::io::BufReader` and pushed into a `VecDeque<String>` log buffer behind `Arc<RwLock<>>`. Auto-restart uses `tokio::time::sleep` for backoff.

### 6. Config in Rust with serde_json

`~/.config/winctl/services.json` and `settings.json` are read/written with `serde_json`. A 5-second TTL cache (matching current behaviour) is held in `Arc<RwLock<Option<(Instant, Config)>>>`. Theme JSON files follow the same pattern.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| WebView2 not present on very old Win10 builds | Ship Tauri's WebView2 bootstrapper; falls back to silent install. Document minimum: Win10 1803. |
| Rust port effort for process manager | Port is ~600–800 LOC but straightforward mapping. Phase the work: HTTP server first (unblocks UI), then process manager. |
| axum WebSocket is lower-level than Socket.IO | Implement room-less broadcast with `tokio::sync::broadcast` — the app only has one "channel" (status updates), so no room management needed. |
| `node-windows` Windows Service install | Replace with a small Rust helper using `windows-service` crate or NSSM shelling out; deprioritised (autostart via Registry is sufficient for most users). |
| Tauri IPC breaking on Tauri version updates | Pin Tauri to a minor version range; IPC API is stable in Tauri 2.x. |

## Migration Plan

1. **Phase 0** — Scaffold Tauri project alongside existing code (no behaviour change yet)
   - `cargo tauri init` inside repo root, configure `tauri.conf.json` to serve Vite's `dist/`
   - Verify `cargo tauri build` produces a single `winctl.exe`
2. **Phase 1** — Port HTTP server (axum routes matching current Express API)
   - Wire axum server into Tauri's `setup` hook
   - Smoke test: React UI loads and REST calls work
3. **Phase 2** — Port process manager + config manager to Rust
   - Replace Node sidecar entirely; remove `server/` directory
4. **Phase 3** — Tauri IPC shim in React frontend
   - Replace `socket.io-client` initialisation with transport shim
   - Verify both WebView IPC path and browser WebSocket path work
5. **Phase 4** — Merge CLI into binary (Clap)
   - Remove `cli/` TypeScript; implement subcommands in Rust
6. **Phase 5** — Update CI/CD, packaging, and docs

Rollback: each phase is additive. Reverting means removing the new files; the old Node server is untouched until Phase 3.

## Open Questions

- Should Tauri window open on startup or only when tray icon is clicked? (Current behaviour: opens immediately — keep for now, make configurable later.)
- Is NSIS installer needed, or is a bare `.exe` sufficient for distribution?
- Should `winctl.exe --service` register itself as a Windows Service or just run without a tray?
