## 1. Frontend API URL Resolution

- [x] 1.1 Add `getApiBase()` helper to `src/stores/socket.ts` that returns `http://localhost:8080` when `isTauri()` is true, empty string otherwise
- [x] 1.2 Update `apiFetch()` to prepend `getApiBase()` to all URL arguments
- [x] 1.3 Update `login()` to use `getApiBase()` prefix for `/api/auth/login`
- [x] 1.4 Update `connectWebSocket()` to construct absolute `ws://localhost:8080/api/ws` URL when `isTauri()` is true

## 2. Tauri Auto-Login

- [x] 2.1 In `initializeSocket()` in `src/stores/services.ts`, set `isLoggedIn: true` immediately when `isTauri()` is true (before calling `api.initSocket`)
- [x] 2.2 Update `App.tsx` to skip login screen when `isTauri()` is true and setup is complete — ensure `checkSetupStatus` still works with absolute URLs

## 3. Backend Port Configuration

- [x] 3.1 In `start_http_server()` in `lib.rs`, read port from `state.settings.port` first, then `WINCTL_PORT` env, then `DEFAULT_PORT`
- [x] 3.2 Verify the onboarding `complete_setup` handler correctly writes the configured port to settings

## 4. Auto-Start & Supervision in GUI Mode

- [x] 4.1 Extract the auto-start logic from the `service_mode` branch in `run()` into a reusable function
- [x] 4.2 Call the auto-start function from both `service_mode` and the normal GUI branch
- [x] 4.3 Extract the supervision loop from `service_mode` into a reusable function
- [x] 4.4 Call the supervision loop from both `service_mode` and the normal GUI branch

## 5. CSP & Config Fixes

- [x] 5.1 Update `tauri.conf.json` CSP to add `https://fonts.googleapis.com` to `style-src` and `connect-src`
- [x] 5.2 Update `tauri.conf.json` CSP to add `https://fonts.gstatic.com` to `font-src`

## 6. Settings update_settings Bug Fix

- [x] 6.1 Fix `update_settings` handler in `lib.rs` line ~423 to read `open_access` from the merged settings, not the pre-merge settings

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` to confirm no TypeScript errors
- [x] 7.2 Run `cargo check` in `src-tauri/` to confirm no Rust compilation errors
- [x] 7.3 Test build mode: `npm run tauri build` and verify the built app auto-logs in and loads services
