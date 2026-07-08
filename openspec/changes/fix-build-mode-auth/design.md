## Context

WinCTL is a Tauri 2 app with a Rust backend (axum HTTP server) and React frontend. It has two runtime modes:

1. **Dev mode**: Vite dev server on port 8787 proxies `/api` → `http://localhost:8080`. The frontend uses relative URLs (`/api/services`), and the Vite proxy transparently forwards them. The backend auth middleware auto-passes localhost connections. Everything works.

2. **Build mode**: Tauri bundles the frontend into `dist/` and loads it inside a webview at `tauri://localhost`. The axum server runs on `http://localhost:8080` (or configured port) and serves `dist/` as a fallback. The frontend's relative `/api` calls resolve against the webview origin (`tauri://localhost`), not the HTTP server. All API calls fail.

The frontend has a dual-transport layer: Tauri IPC events for status broadcasts, and HTTP `fetch()` for all CRUD operations. The CRUD path is completely broken in build mode because URL resolution targets the wrong host.

Additionally, network configuration from onboarding (port, bind_host) is partially ignored by `start_http_server`, and the GUI mode lacks the auto-start and supervision features that only exist in `--service` mode.

## Goals / Non-Goals

**Goals:**
- All API calls work correctly in both dev (Vite proxy) and build (Tauri webview) modes
- Auto-login when running inside Tauri webview (backend already trusts localhost)
- Onboarding network settings (port, bind_host) are respected at HTTP server startup
- Auto-start and process supervision work in GUI mode, not just `--service` mode
- CSP allows Google Fonts loading in build mode
- Settings update correctly propagates open_access state

**Non-Goals:**
- Replacing HTTP fetch with Tauri IPC commands (would be cleaner but is a much larger refactor)
- Supporting non-localhost Tauri webview access
- Adding new features beyond fixing existing broken ones

## Decisions

### 1. URL Resolution Strategy: Dynamic Base URL

**Decision**: Add a `getApiBase()` helper to `socket.ts` that returns `''` (empty, for relative URLs) in browser mode and `http://localhost:{port}` in Tauri mode. All `apiFetch` and WebSocket URLs prepend this base.

**Alternative considered**: Tauri IPC commands for every API call. Rejected — requires Tauri command bindings for 30+ endpoints, massive refactor. The HTTP server already runs and handles auth correctly for localhost.

**Alternative considered**: Configure Vite to proxy in build too. Not applicable — Vite only runs in dev mode.

### 2. Port Discovery

**Decision**: Hardcode default port 8080 in the frontend `getApiBase()`, matching `DEFAULT_PORT` in Rust. Backend already uses this as the fallback. For the backend, read port from `settings.port` first, then `WINCTL_PORT` env, then `DEFAULT_PORT`.

**Alternative considered**: Tauri command to query the running port. More robust but adds complexity. Port 8080 is the default and the vast majority of users won't change it. If they do, the onboarding already sets it in settings which the backend will now respect.

### 3. Auto-Login in Tauri

**Decision**: When `isTauri()` is true, `initializeSocket` immediately sets `isLoggedIn: true` without checking for a stored token. The backend auth middleware already bypasses auth for loopback connections (`is_local` check at line 940), so Tauri webview requests are always authenticated.

**Rationale**: The Tauri window is the primary UI for the local user. Requiring them to enter a password to access their own machine's process manager is bad UX. The password only matters for remote browser access.

### 4. Auto-Start & Supervision in GUI Mode

**Decision**: Extract the auto-start and supervision loop code from the `service_mode` branch and also run it in the GUI branch. Both modes should auto-start services with `auto_start: true` and run the supervision loop for `auto_restart` services.

**Rationale**: Users running the app in GUI mode (default) expect auto-start to work. Currently it only works with `--service` flag.

### 5. CSP Update

**Decision**: Add `https://fonts.googleapis.com` to `style-src` and `connect-src`, and `https://fonts.gstatic.com` to `font-src` in `tauri.conf.json`. This allows Google Fonts loaded in `index.html` to work in the Tauri webview.

### 6. open_access Fix in update_settings

**Decision**: Fix line 423 in `lib.rs` where `new_open_access` reads from the old settings (`settings.open_access`) instead of the merged settings (`merged_settings.open_access`). This is a simple bug fix.

## Risks / Trade-offs

- **Hardcoded port in frontend** → If user changes port via env var, the Tauri webview won't match. Mitigation: Backend now reads from settings.port, and the frontend default matches DEFAULT_PORT. Future improvement could use a Tauri IPC command to query the actual port.
- **Auto-login bypass** → Anyone with access to the Tauri window has full control. Mitigation: This is already the case — Tauri windows are local-only. The login screen was adding friction without security value for the native app.
- **CSP loosening** → Adding Google domains to CSP. Mitigation: Only fonts.googleapis.com and fonts.gstatic.com, both trusted Google CDN domains. This matches the existing `index.html` which already loads from these origins.
