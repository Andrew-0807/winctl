## Why

A full static audit of the WinCTL codebase surfaced 4 critical security vulnerabilities, 8 high-severity correctness/type-safety bugs, and 10 medium-severity issues — several of which cause visible feature breakage (log display, onboarding port selection, CLI commands, externally-owned service supervision). These must be fixed before any public release.

## What Changes

- Sanitize PowerShell and cmd.exe command interpolation to eliminate injection vectors
- Replace non-constant-time token comparison with a timing-safe equivalent
- Enforce reasonable token TTL and add token revocation on credential rotation
- Sync `open_access` AtomicBool at runtime when settings change (no restart required)
- Fix `device_id` round-trip so registered device IDs match stored IDs
- Unify default port constant across server, CLI, and headless paths
- Fix `is_process_alive` for externally-owned processes
- Wire `port` field through `CompleteSetupRequest` so onboarding port selection works
- Add proper TypeScript types for WebSocket exec payloads (remove `as any`)
- Kill and clean up orphaned `exec_children` entries when client sessions end
- Harden theme ID generation server-side to prevent silent overwrites
- Change `clipboard_auto_copy` default to `false`
- Replace `unwrap()` on RwLock in `enrich_services` with graceful error handling
- Show user-visible error in `OnboardingFlow` on setup failure
- Eliminate redundant `/api/folders` fetch in `getStatus`
- Fix log wire format so `LogViewer` receives `{ t, line }` objects
- Implement `start-svc`, `stop-svc`, `restart-svc` CLI subcommands
- Fix `addAlpha` dead branch logic
- Enrich services before the initial status emit on daemon start
- Replace `window` event bus for exec output with a typed event emitter

## Capabilities

### New Capabilities

- `security-hardening`: Injection prevention, timing-safe auth, token TTL/revocation, open_access runtime sync, clipboard default change
- `exec-session-lifecycle`: Proper cleanup of orphaned exec children; typed WebSocket exec payloads; window event bus replacement
- `cli-svc-commands`: Implement the missing `start-svc`, `stop-svc`, `restart-svc` CLI subcommands

### Modified Capabilities

- `device-registration`: Fix device_id mismatch between response and stored value
- `onboarding`: Wire port field through CompleteSetupRequest; show errors on failure
- `log-streaming`: Fix wire format mismatch between server (plain strings) and LogViewer ({ t, line })
- `service-supervision`: Fix is_process_alive for externally-owned processes
- `theme-management`: Harden theme ID generation to prevent silent overwrites; fix addAlpha

## Impact

- **server/lib.rs**: auth middleware, token validation, register_device, complete_setup, update_settings, find_process_by_command, run_fetch_tool, exec endpoint, CompleteSetupRequest struct, initial status emit
- **server/process.rs**: is_process_alive, enrich_services RwLock unwrap
- **src/stores/socket.ts**: getStatus duplicate fetch, exec WebSocket types
- **src/stores/ui.ts**: window event bus for exec output
- **src/stores/themes.ts**: theme ID generation, addAlpha
- **src/components/LogViewer.tsx**: log format handling
- **src/components/OnboardingFlow.tsx**: error display on setup failure
- **cli/**: new svc subcommand handlers
- **No external dependencies added** — timing-safe comparison uses `subtle` crate (already in Rust ecosystem)
