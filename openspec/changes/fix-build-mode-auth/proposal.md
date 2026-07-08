## Why

In dev mode (Vite dev server on port 8787), the frontend proxies all `/api` calls to `localhost:8080` and the auth middleware auto-passes localhost requests — the user never sees a login screen. In **build mode** (Tauri webview loading bundled `dist/` files), the same auto-auth path breaks because:

1. **Tauri webview uses `tauri://localhost` origin** — The frontend's relative `/api` fetch calls resolve against `tauri://localhost`, not `http://localhost:8080`. API calls fail silently and the setup-status check returns `false`, trapping the user on the login screen.
2. **No built-in Tauri IPC bridge for HTTP API** — The frontend relies on browser `fetch()` and `WebSocket` to a relative `/api` path, but in the Tauri webview there's no HTTP server at the webview origin. The socket layer detects `__TAURI_INTERNALS__` and uses Tauri events for status updates, but all `apiFetch` calls (services, settings, setup-status, login) still use browser `fetch()` to relative URLs that don't resolve.
3. **Network bind_host not applied from settings** — When onboarding configures `bind_host: "0.0.0.0"`, the HTTP server reads `bind_host` from settings at startup, but `start_http_server` uses `WINCTL_PORT` env rather than `settings.port`. The configured port from settings is ignored; it always falls back to `DEFAULT_PORT (8080)` regardless of what the user chose during onboarding.
4. **CSP blocks Google Fonts in build** — The CSP in `tauri.conf.json` doesn't include `fonts.googleapis.com` or `fonts.gstatic.com`, so custom font loading fails in build mode.
5. **Incomplete auto-start flow in GUI mode** — `service_mode` has the auto-start + supervision loop, but the normal GUI path (`!service_mode`) never auto-starts services or runs the supervision loop.

## What Changes

- **Fix `apiFetch` for Tauri context**: When `isTauri()` returns true, prefix all API URLs with the backend's HTTP base URL (`http://localhost:{port}`), so `fetch('/api/services')` becomes `fetch('http://localhost:8080/api/services')`. The port should come from a Tauri command or hardcoded default matching backend config.
- **Fix `connectWebSocket` for Tauri context**: Construct full `ws://localhost:{port}/api/ws` URL instead of relative `/api/ws`.
- **Auto-login in Tauri context**: When running inside Tauri, skip the login screen entirely (connections from localhost are already auth-bypassed by the backend middleware). Set `isLoggedIn: true` immediately in `initializeSocket` when `isTauri()`.
- **Use `settings.port` in `start_http_server`**: Read port from settings first, then fall back to `WINCTL_PORT` env, then `DEFAULT_PORT`.
- **Enable auto-start & supervision in GUI mode**: The auto-start and supervision loops currently only run in `service_mode`. Bring them to the standard GUI path as well.
- **Fix CSP for Google Fonts**: Add `fonts.googleapis.com` and `fonts.gstatic.com` to the `font-src` and `style-src` directives in `tauri.conf.json`.
- **Fix `update_settings` open_access race**: The handler reads `open_access` from the old settings instead of the merged settings, so toggling open_access in settings UI has no effect on the auth middleware.

## Capabilities

### New Capabilities
- `tauri-api-bridge`: Ensure all frontend `fetch()` and WebSocket calls correctly resolve in both Tauri webview and browser contexts by constructing absolute URLs when inside Tauri.

### Modified Capabilities
- `root-routing`: Auto-login bypass when running inside Tauri (localhost is already trusted by backend auth middleware).

## Impact

- **Frontend**: `src/stores/socket.ts` (apiFetch, WebSocket URL, initSocket auto-login), `src/stores/services.ts` (isLoggedIn initial state), `src/components/App.tsx` (Tauri auto-login flow)
- **Backend**: `src-tauri/src/lib.rs` (start_http_server port resolution, auto-start in GUI mode, update_settings open_access fix)
- **Config**: `src-tauri/tauri.conf.json` (CSP font-src, style-src, connect-src)
- **No breaking changes** — all fixes are backward-compatible with existing browser/remote access
