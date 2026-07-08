## 1. Security: Timing-Safe Auth & Token Hardening

- [x] 1.1 Add `subtle` crate to `Cargo.toml` dependencies
- [x] 1.2 Replace `==` string comparison in `validate_token` (lib.rs:73) with `subtle::ConstantTimeEq` byte comparison
- [x] 1.3 Reduce `TOKEN_EXPIRY_SECS` from 100-year value to `30 * 24 * 3600` (30 days)
- [x] 1.4 In `complete_setup`, remove the `if signing_key.is_none()` guard so a new signing key is always generated, invalidating all prior tokens

## 2. Security: Command Injection Prevention

- [x] 2.1 In `find_process_by_command` (lib.rs:155–165), escape single-quotes in `exe_name` and `args` by doubling them before PowerShell interpolation
- [x] 2.2 Define an allowlist constant for valid `fetchTool` values: `["fastfetch", "neofetch", "winfetch"]`
- [x] 2.3 In `run_fetch_tool` (lib.rs:772–777), validate `tool` against the allowlist before passing to `cmd.exe /C`; return an error for unlisted values

## 3. Security: Settings & Clipboard Defaults

- [x] 3.1 In `update_settings` handler (lib.rs:394–418), after persisting settings, call `state.open_access.store(new_value, Ordering::SeqCst)` to sync the AtomicBool immediately
- [x] 3.2 Change `clipboard_auto_copy` default to `false` in `Settings::default()` (or equivalent initialization)

## 4. Correctness: Device Registration Fix

- [x] 4.1 In `register_device` (lib.rs:300–317), store the newly generated `device_id` (not `req.device_id`) in `trusted_devices`
- [x] 4.2 Verify the response `device_id` and stored `device_id` are the same value

## 5. Correctness: Port Unification

- [x] 5.1 Define a single `const DEFAULT_PORT: u16 = 8080` at the top of lib.rs
- [x] 5.2 Replace all three hardcoded port defaults (lib.rs:1059, 1436, 1473) with `DEFAULT_PORT`
- [x] 5.3 Add `port: Option<u16>` field to `CompleteSetupRequest` struct (lib.rs:904 area)
- [x] 5.4 In `complete_setup` handler, if `port` is provided, persist it to settings as the LAN port

## 6. Correctness: Service Supervision Fixes

- [x] 6.1 In `is_process_alive` (process.rs:257–266), add a branch for `externally_owned = true` that calls `OpenProcess`/`GetExitCodeProcess` on the stored PID to check liveness
- [x] 6.2 Return `false` if no PID is stored for an externally-owned process
- [x] 6.3 Replace the `unwrap()` on the RwLock in `enrich_services` (process.rs:269) with `map_err` + graceful error log + return unenriched list
- [x] 6.4 In `run_gui_with_state` (lib.rs:1417–1424), call `enrich_services` on the initial services list before emitting the first `status` event

## 7. Correctness: Exec Session Lifecycle

- [x] 7.1 Track active exec session IDs per WebSocket connection ID in `lib.rs`
- [x] 7.2 In the WebSocket `disconnect` handler, iterate sessions for that connection ID, kill each child process, and remove from `exec_children` map
- [x] 7.3 Verify that naturally-exiting exec sessions still clean up their map entries correctly

## 8. Frontend: Typed WebSocket Exec Payloads

- [x] 8.1 Define `ExecOutputEvent` interface (`{ stream: 'stdout' | 'stderr'; line: string }`) in `socket.ts`
- [x] 8.2 Define `ExecDoneEvent` interface (`{ exitCode: number | null }`) in `socket.ts`
- [x] 8.3 Replace `as any` casts on exec WebSocket handlers (socket.ts:112–113) with the new typed interfaces

## 9. Frontend: Exec Event Bus Replacement

- [x] 9.1 Create a module-level `execEvents = new EventTarget()` in `ui.ts`
- [x] 9.2 Replace `window.__winctl_exec_output` dispatch with `execEvents.dispatchEvent(new CustomEvent('exec-output', { detail: data }))`
- [x] 9.3 Replace `window.__winctl_exec_done` dispatch with `execEvents.dispatchEvent(new CustomEvent('exec-done', { detail: data }))`
- [x] 9.4 Update all consumers to use `execEvents.addEventListener(...)` instead of `window` listeners
- [x] 9.5 Remove `__winctl_exec_output` and `__winctl_exec_done` from the `window` global declarations

## 10. Frontend & Server: Log Format Fix

- [x] 10.1 Change `process.rs:logs()` return type to `Vec<LogEntry>` where `LogEntry` has `t: String` and `line: String`
- [x] 10.2 Update the ring buffer to store `LogEntry` structs (timestamp + line) instead of plain strings
- [x] 10.3 Update the `/api/services/:id/logs` route to serialize entries as `[{ "t": "...", "line": "..." }]`
- [x] 10.4 Verify `LogViewer.tsx` correctly renders `entry.t.substring(11, 19)` and `entry.line` with the new format

## 11. Frontend: Onboarding & Status Fixes

- [x] 11.1 In `OnboardingFlow.tsx` (line ~891–913), add an `error` state signal
- [x] 11.2 Wrap `completeSetup` call in try/catch; on failure set the error state and display a human-readable error message in the UI
- [x] 11.3 Call `onComplete` only on success
- [x] 11.4 In `socket.ts:getStatus` (line ~222–228), remove the standalone `apiFetch('/api/folders')` call and use `servicesResult.folders` instead

## 12. Frontend: Theme Management Fixes

- [x] 12.1 Fix `addAlpha` in `themes.ts` (line ~51–57): replace `alpha + alpha` with zero-padded 2-char string (e.g., `alpha.padStart(2, '0')`)
- [x] 12.2 On the server, in the theme creation handler, check if a theme with the derived ID already exists; return HTTP 409 if so
- [x] 12.3 In the frontend theme creation flow (`themes.ts:139` area), handle 409 by appending a numeric suffix and retrying up to 5 times

## 13. CLI: Implement Missing svc Subcommands

- [x] 13.1 In `run_cli_async` (lib.rs:1207–1209 area), add mapping: `"start-svc"` → same handler as `"start"`, `"stop-svc"` → `"stop"`, `"restart-svc"` → `"restart"`
- [ ] 13.2 Test each subcommand manually against a running daemon to confirm they work end-to-end
