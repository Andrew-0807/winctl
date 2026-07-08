## 1. Atomic Config IO

- [x] 1.1 Refactor `config::write_services` to use write-to-temp-then-rename pattern (write `.tmp` sibling, `fs::rename` over target, fallback to direct write+flush)
- [x] 1.2 Refactor `config::write_settings` with the same atomic write pattern
- [x] 1.3 Change all `let _ = config::write_services(...)` call sites in `lib.rs` to propagate errors — return 500 with `{"error": "Failed to save configuration"}` on failure
- [x] 1.4 Change all `let _ = config::write_settings(...)` call sites in `lib.rs` to propagate errors
- [x] 1.5 Add rollback logic: clone in-memory state before mutation, restore on write failure (create_service, update_service, delete_service, reorder_services, folders_create, folders_update, folders_delete, update_settings)

## 2. Auth Hardening — CSRF Origin Validation

- [x] 2.1 Add Origin validation to the auth middleware: when `Origin` header is present on localhost requests, verify it matches `http://localhost:{port}`, `http://127.0.0.1:{port}`, `https://tauri.localhost`, or `tauri://localhost` — reject with 403 if not
- [x] 2.2 Pass the server's actual port into the middleware closure so the Origin check uses the correct port
- [x] 2.3 Allow localhost requests with no `Origin` header (CLI, curl) to pass through as before

## 3. Auth Hardening — Password Hashing

- [x] 3.1 Add `argon2` and `password-hash` crates to `Cargo.toml`
- [x] 3.2 Create helper functions `hash_password(plaintext) -> String` and `verify_password(plaintext, hash) -> bool` using argon2id
- [x] 3.3 Update `login` handler to use `verify_password` instead of `password != secret`
- [x] 3.4 Update `complete_setup` handler to hash the password before storing in `api_secret`
- [x] 3.5 Add startup migration: if `api_secret` is set and doesn't start with `$argon2`, hash it and write back

## 4. Auth Hardening — WebSocket Authentication

- [x] 4.1 Modify `ws_handler` to extract `Origin` header and `ConnectInfo<SocketAddr>` from the upgrade request and pass to `handle_ws`
- [x] 4.2 In `handle_ws`, for non-exempt connections (remote or localhost with invalid Origin): wait up to 5s for `{"type":"auth","token":"..."}` message, validate token, close with code 4001 on failure
- [x] 4.3 Exempt localhost connections with valid Origin from the WebSocket auth requirement

## 5. Auth Hardening — Setup & Settings Protection

- [x] 5.1 Add idempotency guard to `complete_setup`: check `settings.onboarding_complete`, return 409 Conflict if already true
- [x] 5.2 Update `update_settings` handler to preserve `trusted_devices` in addition to `api_secret` and `signing_key`
- [x] 5.3 Fix `register_device`: use `req.device_id` for the retain check AND the new insert (don't generate a new UUID), or if the intent is server-generated IDs, fix the retain to not use the request ID

## 6. Exec Endpoint Sandboxing

- [x] 6.1 Add `exec_enabled: bool` (default false) and `exec_allowlist: Vec<String>` (default empty) fields to `Settings` struct
- [x] 6.2 In `exec_command` handler: check `settings.exec_enabled`, return 403 if disabled
- [x] 6.3 Extract command basename (before first space), check against `exec_allowlist` case-insensitively, return 403 if not in list
- [x] 6.4 Validate `cwd` field: must be absolute path and must exist, return 400 if invalid

## 7. Graceful Shutdown

- [x] 7.1 Add a `tokio::sync::watch<bool>` shutdown channel to `AppState`
- [x] 7.2 Replace `std::process::exit(0)` in `shutdown_handler` with sending `true` on the shutdown channel
- [x] 7.3 Replace `std::process::exit(0)` in `restart_handler` — spawn new process first, then send shutdown signal
- [x] 7.4 In the HTTP server setup, use axum's `with_graceful_shutdown` to listen on the watch channel receiver
- [x] 7.5 Add 5-second kill timeout: after sending kill to managed processes, wait up to 5s then `taskkill /F /PID`

## 8. Runtime Consolidation & Restart Race Fix

- [x] 8.1 Consolidate to single Tokio runtime: move `start_http_server`, `start_auto_start_services`, and `start_supervision_loop` into a single `tokio::runtime::Runtime` block
- [x] 8.2 Convert `start_auto_start_services` and `start_supervision_loop` from `std::thread::spawn` + `Runtime::new()` to `tokio::spawn` tasks
- [x] 8.3 Add `restart_locks: Arc<DashMap<String, Arc<AsyncMutex<()>>>>` to `AppState`
- [x] 8.4 In `service_restart` handler: acquire per-service restart lock before kill+spawn sequence
- [x] 8.5 In supervision loop: use `try_lock` on the per-service restart lock; skip the service if lock is held

## 9. Port Unification

- [ ] 9.1 Change `DEFAULT_PORT` in `lib.rs` from `8080` to `8888`
- [ ] 9.2 Add a Tauri command `get_server_port` that reads port from settings and returns it to the frontend
- [ ] 9.3 Update `src/stores/socket.ts` `getApiBase()` to call the Tauri command for the port instead of hardcoding `8080`
- [ ] 9.4 Update the WebSocket URL construction to use the dynamic port

## 10. Frontend Updates

- [ ] 10.1 Update `OnboardingFlow.tsx` to remove `as any` casts and add proper types for setup/settings API calls
- [ ] 10.2 Sanitize the ANSI-to-HTML renderer in `SystemInfoModal.tsx` — ensure color values from ANSI parsing are validated as hex/named colors before interpolation into `style` attributes
