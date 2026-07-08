## Context

WinCTL is a Windows process/service manager with a web dashboard (Axum HTTP + WebSocket server, React SPA frontend, CLI). The server runs locally but can bind to `0.0.0.0` for LAN access. A code audit revealed critical security vulnerabilities — most notably an unauthenticated RCE chain (exec endpoint + localhost auth bypass) — alongside stability issues (non-atomic config writes, abrupt `exit(0)`, race conditions in process restart, multiple Tokio runtimes).

Current auth model: localhost connections bypass auth entirely; remote connections require an HMAC token validated against a plaintext `api_secret` stored in `settings.json`. The WebSocket is fully public. The `/api/exec` endpoint passes user input directly to `cmd.exe /C`.

## Goals / Non-Goals

**Goals:**
- Eliminate the unauthenticated RCE chain (exec sandboxing + CSRF protection)
- Harden authentication: hash passwords, authenticate WebSocket, protect setup endpoint
- Make config persistence crash-safe via atomic writes with error propagation
- Implement graceful shutdown that awaits child process cleanup and pending IO
- Fix the restart race condition between supervision loop and explicit restart
- Unify the default port across server, CLI, and frontend

**Non-Goals:**
- Full RBAC/permissions system (out of scope — single-user tool)
- TLS/HTTPS support (users are expected to use a reverse proxy for that)
- Rewriting the frontend authentication flow (only adding WebSocket token handshake and port discovery)
- Changing the HMAC token scheme (it already uses constant-time comparison via `subtle`)

## Decisions

### D1: Exec endpoint — allowlist + opt-in toggle

**Decision**: Replace the open `cmd.exe /C` shell with a configurable allowlist of permitted commands stored in `settings.json`. The exec endpoint is disabled by default; users must explicitly enable it in settings. When enabled, only the command basename (before first space) is checked against the allowlist. The `cwd` field is validated to be an absolute path under allowed roots.

**Alternative considered**: Remove the exec endpoint entirely. Rejected because it's a core feature for power users running ad-hoc commands from the dashboard.

**Alternative considered**: Run commands in a restricted Windows job object. Rejected as overly complex for the current scope and still requires an allowlist to be meaningful.

### D2: Localhost CSRF protection — Origin header validation

**Decision**: Replace the blanket localhost auth bypass with Origin-based CSRF protection. Localhost connections are still trusted (no token required) but the middleware MUST verify that the `Origin` or `Referer` header is either absent (non-browser request) or matches the WinCTL dashboard origin (`http://localhost:{port}` or `http://127.0.0.1:{port}` or `tauri://localhost`). Requests from foreign origins (e.g., `http://evil.com`) are rejected with 403.

**Alternative considered**: Require tokens for localhost too. Rejected because it breaks the Tauri app flow and the CLI, which both connect locally without a token. CSRF protection via Origin check is the industry-standard approach (see OWASP CSRF Prevention Cheat Sheet).

### D3: Password hashing — argon2

**Decision**: Use the `argon2` crate (via `password-hash` trait) to hash the API secret before storing it in `settings.json`. On login, verify with `argon2::verify`. This replaces the current plaintext `password != secret` comparison. The `api_secret` field in `settings.json` changes from plaintext to an argon2 hash string. Migration: on first startup after upgrade, if `api_secret` is not an argon2 hash (doesn't start with `$argon2`), hash it in place and write back.

**Alternative considered**: bcrypt. Rejected in favor of argon2 which is the current OWASP recommendation and is memory-hard.

### D4: WebSocket authentication — token in first message

**Decision**: After WebSocket upgrade, the server waits up to 5 seconds for an `{"type":"auth","token":"..."}` message. If no valid auth message arrives within the timeout, the connection is closed. Localhost connections with valid Origin (per D2) are exempt. This avoids changing the WebSocket URL (no query-string tokens, which would appear in server logs).

**Alternative considered**: Token in WebSocket URL query parameter. Rejected — tokens in URLs leak via logs and Referer headers.

### D5: Setup race protection — one-time setup check

**Decision**: The `complete_setup` handler checks `settings.onboarding_complete` and rejects with 409 Conflict if setup is already done. This is already partially in place (the endpoint writes `onboarding_complete = true`) but there's no guard against calling it when already complete. Add the guard as the first check.

**Alternative considered**: Time-limited setup token generated on first launch. Rejected as unnecessarily complex — the simpler idempotency check is sufficient since setup is a one-shot operation.

### D6: Atomic config writes — write-then-rename

**Decision**: Change `write_services` and `write_settings` to: (1) write to a `.tmp` sibling file, (2) `fs::rename` the temp file over the target. On Windows, `fs::rename` is atomic within the same volume. All callers that currently use `let _ =` MUST propagate the error — change return types from `()` to `Result` and surface errors to the HTTP response.

### D7: Graceful shutdown — tokio::signal + shutdown channel

**Decision**: Replace `std::process::exit(0)` in shutdown/restart handlers with a cooperative shutdown. Use a `tokio::sync::watch` channel: handlers send a shutdown signal, the main loop receives it and: (1) stops accepting new connections, (2) kills managed processes (if `keep_services_on_exit` is false), (3) awaits pending config writes, (4) drops the Axum server. For restart, spawn the new process BEFORE exiting.

### D8: Restart race fix — per-service restart mutex

**Decision**: Add a `DashMap<String, Arc<AsyncMutex<()>>>` of per-service restart locks. Both the explicit restart handler and the supervision loop must acquire this lock before killing/spawning. The supervision loop skips a service if the lock is currently held (non-blocking `try_lock`).

### D9: Port unification — single source of truth

**Decision**: Change `DEFAULT_PORT` in `lib.rs` from `8080` to `8888` to match `Settings::default()`. The Tauri frontend reads the port from `settings.json` at startup via a Tauri command (not hardcoded). The CLI reads from `WINCTL_PORT` env var, falling back to the same `8888` default.

## Risks / Trade-offs

- **[Risk] Origin header not sent by all HTTP clients** → Mitigation: Only enforce Origin check when the header IS present. Absent Origin = non-browser client (CLI, curl) = trusted if localhost. This matches the OWASP recommendation.
- **[Risk] Argon2 migration breaks existing installs** → Mitigation: Auto-detect plaintext vs hash on startup and migrate silently. If hashing fails, fall back to plaintext comparison with a warning log.
- **[Risk] WebSocket auth timeout breaks slow clients** → Mitigation: 5-second timeout is generous. Clients that fail to auth get a close frame with reason code, allowing retry logic.
- **[Risk] Atomic rename on Windows may fail across volumes** → Mitigation: Config dir and temp file are always on the same volume (`~/.config/winctl/`). Add a fallback to direct write with fsync if rename fails.
- **[Risk] Graceful shutdown may hang if a child process refuses to die** → Mitigation: 5-second timeout on child process kill, then force-kill (`taskkill /F /PID`).
