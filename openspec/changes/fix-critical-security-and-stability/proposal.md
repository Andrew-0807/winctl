## Why

A thorough code audit revealed 5 critical, 14 high, and 16 medium severity issues across the server, frontend, and CLI. The most dangerous finding is an unauthenticated remote code execution chain: the `/api/exec` endpoint passes user input directly to `cmd.exe /C`, and the auth middleware unconditionally bypasses authentication for all localhost connections — meaning any JavaScript in a browser tab can execute arbitrary OS commands. Several high-severity stability issues (non-atomic config writes, `std::process::exit(0)` skipping destructors, multiple Tokio runtimes causing zombie processes) compound the risk of data loss during normal operation. These must be fixed before any public release.

## What Changes

- **BREAKING**: Remove or sandbox the `/api/exec` endpoint — currently allows arbitrary command execution via `cmd.exe /C` with zero input validation
- **BREAKING**: Replace localhost auth bypass with Origin/CSRF validation — localhost connections will require either a valid token or a verified same-origin request
- Add rate limiting and confirmation requirement to power control endpoints (shutdown, restart, sleep, lock)
- Replace plaintext password storage with bcrypt/argon2 hashing and constant-time comparison
- Sanitize ANSI-to-HTML rendering in `SystemInfoModal` to prevent XSS via crafted terminal output
- Protect `/api/setup/complete` with a time-limited setup token to prevent setup race attacks
- Add WebSocket authentication (token required on connection handshake)
- Replace `std::process::exit(0)` with graceful shutdown that awaits pending writes and child process cleanup
- Implement atomic config writes (write-to-temp then rename)
- Propagate config write errors instead of silently discarding with `let _ =`
- Add restart debounce/lock to prevent supervision loop vs explicit restart race condition
- Fix port mismatch: unify default port across server settings (8888), CLI (`DEFAULT_PORT`), and Tauri frontend (hardcoded 8080)

## Capabilities

### New Capabilities
- `exec-sandboxing`: Command execution endpoint hardening — whitelist-based command validation, input sanitization, and optional endpoint disable
- `auth-hardening`: CSRF protection for localhost, bcrypt password hashing, constant-time comparison, WebSocket auth, setup endpoint protection
- `atomic-config-io`: Atomic file writes for services.json and settings.json with error propagation
- `graceful-shutdown`: Clean shutdown sequence that awaits child process termination and pending config writes before exit

### Modified Capabilities
- `process-execution`: Fix restart race condition between supervision loop and explicit restart handler; consolidate to single Tokio runtime
- `graceful-shutdown`: Replace `std::process::exit(0)` with proper shutdown coordination (existing spec covers shutdown but not the destructors/IO flush issue)

## Impact

- **Server (`src-tauri/src/`)**: `lib.rs` (auth middleware, route handlers, shutdown, exec, power control, WebSocket), `config.rs` (atomic writes, error propagation), `process.rs` (restart locking, single runtime)
- **Frontend (`src/`)**: `stores/socket.ts` (dynamic port resolution, WebSocket auth token), `components/SystemInfoModal.tsx` (ANSI sanitizer), `components/OnboardingFlow.tsx` (setup token flow)
- **CLI (`cli/`)**: Update default port constant to match server
- **Config (`~/.config/winctl/`)**: `settings.json` schema changes — password field becomes hash, new `setup_token` field
- **Dependencies**: Add `bcrypt`/`argon2` crate, `subtle` crate for constant-time comparison
