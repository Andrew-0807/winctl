## Context

WinCTL is a Windows process/service manager with a Rust daemon (lib.rs, process.rs), a React/TypeScript frontend (src/), and a CLI (cli/). The audit revealed 22 bugs spanning security vulnerabilities, runtime correctness issues, and broken UX flows. Fixes touch the Rust server, TypeScript frontend, and CLI — making this a cross-cutting change requiring coordinated decisions.

## Goals / Non-Goals

**Goals:**
- Eliminate all 4 critical security vulnerabilities (injection, timing attack)
- Fix all 8 high-severity correctness bugs (device_id, port unification, supervision, exec lifecycle)
- Fix all 10 medium-severity issues (log format, CLI commands, onboarding UX, etc.)
- Maintain backward compatibility with existing `services.json` and `settings.json` configs

**Non-Goals:**
- Adding new user-facing features
- Changing the overall architecture (daemon/UI/CLI split stays)
- Upgrading runtime dependencies beyond what's needed for timing-safe comparison

## Decisions

### 1. Timing-safe token comparison: `subtle` crate

Use the `subtle` crate's `ConstantTimeEq` trait for token comparison in `validate_token`. This is the standard Rust approach and is already commonly available. Alternative: `ring::constant_time::verify_slices_are_equal` — rejected because `ring` is a heavier dependency not already in the lockfile.

### 2. PowerShell injection: argument arrays, not format strings

Replace `format!("... -eq '{}' ...", exe_name, args)` with PowerShell `-ArgumentList` passing via separate args, or escape single-quotes by doubling them (`'` → `''`) before interpolation. The doubling approach is simpler and doesn't require restructuring the WMI query. For `run_fetch_tool`, validate `tool` against an allowlist of known fetch tools (`fastfetch`, `neofetch`, `winfetch`) — this is a settings field, not user-supplied at runtime.

### 3. `open_access` runtime sync: update AtomicBool in `update_settings`

In the `update_settings` handler, after persisting the new settings, call `state.open_access.store(new_settings.open_access, Ordering::SeqCst)`. No restart required. This is a one-line fix with no architectural implication.

### 4. Token TTL: reduce from 100 years to 30 days

Change `TOKEN_EXPIRY_SECS` from `365 * 100 * 24 * 3600` to `30 * 24 * 3600`. Clients that store tokens will need to re-authenticate after 30 days. This is acceptable — the desktop app can handle a re-auth flow on 401.

### 5. Token revocation on `complete_setup`: rotate signing key

When `complete_setup` is called and `api_secret` changes, always generate a fresh `signing_key` (remove the `if signing_key.is_none()` guard). All previously issued tokens become invalid immediately. Clients receive 401 and re-authenticate.

### 6. Default port unification: single constant

Introduce `const DEFAULT_PORT: u16 = 8080` in a shared location (or top of lib.rs) and reference it from all three paths (`start_http_server`, `run_headless_with_state`, `run_cli_async`). Remove the hardcoded `8888` literals.

### 7. `is_process_alive` for externally-owned processes: use OS PID check

For processes with `externally_owned = true`, check liveness via `OpenProcess` / `GetExitCodeProcess` on the stored PID rather than via the `child` handle. If no PID is stored, treat as not alive. This requires storing the PID for externally-owned processes when they are first attached.

### 8. `exec_children` cleanup on session end

Track active exec sessions per WebSocket connection ID. On `disconnect` event, iterate all sessions for that connection and kill+remove their `exec_children` entries. Use `DashMap::remove` + `child.kill()` in the disconnect handler.

### 9. TypeScript exec payload types: define interfaces, remove `as any`

Define `ExecOutputEvent { stream: 'stdout' | 'stderr'; line: string }` and `ExecDoneEvent { exitCode: number | null }` interfaces in `socket.ts`. Use these in `wsHandlers` instead of `as any`.

### 10. Window event bus replacement: typed EventTarget

Replace `window.__winctl_exec_output` / `window.__winctl_exec_done` with a module-level `EventTarget` (`const execEvents = new EventTarget()`) in `ui.ts`. Dispatch `CustomEvent<ExecOutputEvent>` and `CustomEvent<ExecDoneEvent>`. Consumers use `execEvents.addEventListener(...)`. This keeps the decoupled pattern while restoring type safety.

### 11. Log wire format: server sends `{ t, line }` objects

Change `process.rs:logs()` to return `Vec<LogEntry>` where `LogEntry = { t: String, line: String }`. The ring buffer already stores timestamped entries — expose the timestamp. Update the `/api/services/:id/logs` route to serialize as `[{ "t": "...", "line": "..." }]`. `LogViewer` requires no frontend changes.

### 12. Theme ID collision: server-side uniqueness enforcement

On `POST /api/themes`, if a theme with the derived ID already exists and the request doesn't include `force: true`, return 409 Conflict. The frontend's theme creation flow appends a numeric suffix on 409 (retry logic). This avoids silent overwrites without changing the ID derivation algorithm.

### 13. `clipboard_auto_copy` default: false

Change the default value in `Settings::default()` (or wherever the field is initialized) from `true` to `false`. Existing users with `settings.json` already written are unaffected (their stored value is respected).

### 14. `device_id` fix: use generated ID everywhere

In `register_device`, store the newly generated `device_id` (not `req.device_id`) in `trusted_devices`. The response and storage are then consistent.

### 15. `CompleteSetupRequest` port field: add and apply

Add `port: Option<u16>` to `CompleteSetupRequest`. If provided, write it to settings as `lan_port` and use it when binding the HTTP server. If the server is already running (re-setup scenario), log a warning that a restart is required for port change.

### 16. `addAlpha` fix: use padding not doubling

Change `alpha + alpha` to `format!("{:0>2}", alpha)` — pad to 2 chars with leading zero. This correctly handles 1-char inputs like `'3'` → `'03'` instead of `'33'`.

### 17. Initial status emit: enrich before broadcasting

In `run_gui_with_state`, call `process_manager.enrich_services(&services)` before the initial `emit("status", ...)`. This ensures the first event has `status`, `pid`, and `restartCount` populated.

### 18. Onboarding error display: catch and show

Wrap the `completeSetup` call in a try/catch that sets an `error` signal and renders it in the UI. Call `onComplete` only on success.

### 19. Redundant `/api/folders` fetch: remove

In `socket.ts:getStatus`, remove the standalone `apiFetch('/api/folders')` call. Use `servicesResult.folders` from the `/api/services` response (which already includes folders).

### 20. CLI `*-svc` commands: implement as aliases

In `run_cli_async`, map `"start-svc"` → `"start"`, `"stop-svc"` → `"stop"`, `"restart-svc"` → `"restart"` before the match arm, so the same handler logic is reused.

## Risks / Trade-offs

- **Token TTL reduction (30 days)**: Clients that cached long-lived tokens will get 401 after the daemon is updated. The desktop app must handle re-auth gracefully. → Mitigation: ensure 401 triggers re-auth flow in the frontend before shipping.
- **Signing key rotation on re-setup**: If a user re-runs onboarding (unlikely but possible), all existing device tokens are invalidated. → Acceptable: re-authentication is the correct behavior after credential rotation.
- **Port unification at 8080**: Any user running CLI against an old daemon on 8888 will need to set `WINCTL_PORT=8888` temporarily. → Mitigation: document in release notes.
- **`subtle` crate addition**: Adds one small transitive dependency. → Risk is negligible; `subtle` is widely audited.
- **`is_process_alive` OS PID check on Windows**: `OpenProcess` may return false negatives if the process exited and PID was reused. → Mitigation: check exit code via `GetExitCodeProcess` and treat `STILL_ACTIVE` (259) as alive.
