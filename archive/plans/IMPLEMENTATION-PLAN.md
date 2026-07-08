# WinCTL — Consolidated Implementation Plan

Order per request: **audit fixes → new features (icons, delayed start) → onboarding polish.**
Each phase compiles/type-checks before the next. Autostart already exists — not rebuilt.

---

## Phase 1 — Audit fixes (make the app actually work)

| # | File | Change |
|---|------|--------|
| 1 | `process.rs` `is_process_alive` | **Reap owned children with `try_wait()`.** Take write lock; `Ok(None)` = alive, `Ok(Some)`/`Err` = dead → set `Stopped`, clear pid. Fixes auto-restart never firing for managed services. |
| 3 | `lib.rs` router | **Guard setup routes.** Move the loopback/Origin check (currently only in `auth_layer`) in front of `/api/setup/*` so a webpage can't hijack pre-onboarding setup. |
| 2 | `lib.rs` `exec_command` | **Reject shell metacharacters** (`& | > < ^ ( )` etc.) so the allowlist can't be bypassed via `echo x & evil`. |
| 4 | `lib.rs` router | **Move `/api/fonts` behind auth** + cache result once (`OnceCell`). Kills the anonymous blocking-PowerShell DoS. |
| 5 | `lib.rs` `get_system_info` | Replace per-call PowerShell uptime with `GetTickCount64()/1000` (needs `Win32_System_SystemInformation` feature). |
| 6 | `lib.rs` `run()` + README | Make bare `start/stop/restart` target the **daemon**; keep `*-svc` for services. Align README. |
| 7 | `config.rs` | Drop the redundant 5s file cache; `AppState` RwLock is the live copy. |
| 8 | repo | Delete `SolidJS/`, stale scratch files, rewrite `CLAUDE.md` for the Rust/Tauri layout. |

## Phase 2 — New features

**Per-service icon** (`icon: Option<String>` — already added to `Service`)
- Field holds *either* a Lucide name *or* a `data:image/...;base64,...` URI.
- `ServiceModal`: new "Icon" picker with two tabs —
  - **Search**: filter over all `lucide-react` names, render matches as a grid.
  - **Upload**: `<input type=file accept=".png,.svg,image/*">` → FileReader → PNG/JPG downscaled to 64px via canvas, SVG embedded as-is → store data URI. Cap raw input ~256KB.
  - "None" clears it.
- New `renderServiceIcon(icon)` helper: empty → nothing; `data:` → `<img>`; else Lucide component (`<img>` can't execute SVG scripts → safe).
- `ServiceCard`: render icon in the header next to the status dot, only when set.
- `socket.ts`: add `icon?: string | null` to `ServiceStatus`.

**Delayed auto-start** (`start_delay_mins: u32` — already added to `Service`)
- `lib.rs` `spawn_auto_start_services`: per service, if `start_delay_mins > 0`, `sleep(delay*60)` before `spawn`, then broadcast `update` so the UI reflects the delayed launch.
- `ServiceModal`: number input "Delay start by (minutes)", shown only when auto-start is on.
- `socket.ts`: add `startDelayMins?: number`.

## Phase 3 — Onboarding: make it work + feel nice

- **Fix unrecoverable password (breaking):** add a final **"Your access key" step** that shows the resolved secret with a copy button before finishing. The auto-generated LAN password is currently lost (settings.json holds only the argon2 hash). For local-only, still show/allow copy.
- **Port default:** change onboarding `lanPort` default `8080 → 8888` to match the backend + `socket.ts`.
- **Polish:** finish/success confirmation, keep the existing slide animations, ensure Back preserves entered values (already does).
- Verify the whole flow end-to-end against a fresh `~/.config/winctl/`.

---

## Verification per phase
- Rust: `cargo check` in `src-tauri/`.
- Frontend: `npx tsc --noEmit`.
- Manual: fresh-config onboarding run; add a service with an icon + 1-min delay; kill it and confirm auto-restart fires.
