# WinCTL Tauri Migration — Fix Plan

> Status: **DO NOT SHIP.** CLI is broken, server double-binds, and the intern cut corners
> throughout. Fix everything below before this touches a user machine.

---

## Bug 1 — CLI shows partial output or nothing at all (CRITICAL)

**Root cause — two separate problems, both must be fixed:**

### 1a. JSON shape mismatch (primary — breaks `status` and `services`)

`GET /api/services` returns `ServiceConfig = { services: [...], folders: [...] }`.
CLI at `lib.rs:1142` deserializes the response as `Vec<serde_json::Value>`. That
fails silently (`if let Ok(arr)` never matches). Result: daemon is running, port
line prints, then nothing — looks like a hang.

**Fix in `run_cli_async`, both `"status"` and `"services"` arms:**
```rust
// Wrong:
resp.json::<Vec<serde_json::Value>>().await

// Right:
resp.json::<serde_json::Value>().await
// then index into ["services"] array
```

### 1b. Console handles not reconnected after `AttachConsole` (release builds)

`main.rs:1` marks the binary as `windows_subsystem = "windows"`. Windows doesn't
open stdout/stderr for GUI subsystem apps. `AttachConsole(0xFFFFFFFF)` re-attaches
to the parent console, but Rust's `println!` still writes to fd 1 — which is null.
Output is silently discarded in every release build CLI invocation.

**Fix in `main.rs` — after `AttachConsole`, reopen the handles:**
```rust
#[cfg(windows)]
unsafe {
    extern "system" {
        fn AttachConsole(dwProcessId: u32) -> i32;
        fn SetStdHandle(nStdHandle: u32, hHandle: *mut std::ffi::c_void) -> i32;
        fn CreateFileW(
            lpFileName: *const u16, dwDesiredAccess: u32, dwShareMode: u32,
            lpSecurityAttributes: *const std::ffi::c_void, dwCreationDisposition: u32,
            dwFlagsAndAttributes: u32, hTemplateFile: *mut std::ffi::c_void,
        ) -> *mut std::ffi::c_void;
    }
    const ATTACH_PARENT_PROCESS: u32 = 0xFFFFFFFF;
    const GENERIC_WRITE: u32 = 0x40000000;
    const FILE_SHARE_WRITE: u32 = 0x2;
    const OPEN_EXISTING: u32 = 3;
    const STD_OUTPUT_HANDLE: u32 = 0xFFFFFFF5;
    const STD_ERROR_HANDLE: u32 = 0xFFFFFFF4;
    const INVALID_HANDLE_VALUE: *mut std::ffi::c_void = usize::MAX as _;

    if AttachConsole(ATTACH_PARENT_PROCESS) != 0 {
        // Re-open stdout and stderr to the attached console
        let conout: Vec<u16> = "CONOUT$\0".encode_utf16().collect();
        let h = CreateFileW(conout.as_ptr(), GENERIC_WRITE, FILE_SHARE_WRITE,
                            std::ptr::null(), OPEN_EXISTING, 0, std::ptr::null_mut());
        if h != INVALID_HANDLE_VALUE {
            SetStdHandle(STD_OUTPUT_HANDLE, h);
            SetStdHandle(STD_ERROR_HANDLE, h);
        }
    }
}
```

---

## Bug 2 — HTTP server started twice in `--service` mode (HIGH)

**File:** `lib.rs:961` and `lib.rs:992`

`start_http_server(state.clone())` is called inside `if service_mode { }`, then
`start_http_server(state)` is called again unconditionally 31 lines later. Second
`TcpListener::bind` on the same port panics or silently fails. In service mode,
only one of them actually serves, the other thread is dead or thrashing.

**Fix:** Guard the unconditional call:
```rust
// lib.rs ~992 — change:
start_http_server(state);

// to:
if !service_mode {
    start_http_server(state);
}
```

---

## Bug 3 — `setx PATH` fire-and-forget (MEDIUM)

**File:** `lib.rs:915-929`

`spawn()` is used instead of `output()`. The parent process may return before
`setx` completes. The child leaks. Also `%PATH%` is passed literally — setx
doesn't expand env vars in the value argument on all Windows versions.

**Fix:** Use `.output()` and read the actual current PATH:
```rust
let current_path = std::env::var("PATH").unwrap_or_default();
let new_path = format!("{};{}", config_path, current_path);
let output = std::process::Command::new("setx")
    .args(["PATH", &new_path])
    .output()
    .map_err(|e| format!("setx failed: {}", e))?;
```

---

## Bug 4 — `start` CLI command is wrong (MEDIUM)

**File:** `lib.rs:1225-1227`

```rust
"start" => {
    eprintln!("WinCTL is already running ...");
}
```

This always prints the same message regardless of whether the daemon is running or
not. It writes to `stderr`, not `stdout`. It doesn't exit with an error code.
The user runs `winctl start` and gets a lie.

**Fix:** Either:
- Actually detect if daemon is running (try `GET /api/services`, print status if
  yes, print launch instructions if no), or
- Remove `"start"` from the match arm list and let it fall to the `_` unknown
  command handler so the user gets a clear error.

Recommend option 2 — don't pretend the CLI can start the daemon when it can't.

---

## Bug 5 — Service IDs use UUID instead of base-36 timestamp (LOW)

**File:** `lib.rs:210`

```rust
id: Uuid::new_v4().simple().to_string(),
```

`CLAUDE.md` specifies: *Service IDs: `Date.now().toString(36)` (base-36, not
UUIDs)*. The Rust port should match:

```rust
let ts = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
id: radix_fmt::radix(ts, 36).to_string(),
// or inline: format!("{}", radix_64::encode(ts)) — pick a crate or roll it
```

This matters for config file compatibility with any existing Node.js-generated data.

---

## Bug 6 — `find_process_by_command` ignores the `args` parameter (LOW)

**File:** `lib.rs:131`

```rust
fn find_process_by_command(command: &str, _args: &str) -> Option<u32>
```

Only matches by exe filename. If two processes share the same exe name (e.g. two
`node.exe` instances), this supervises the wrong one. The `_args` parameter
silently swallows the intent.

Either use `wmic process where "commandline like '...'"` to match on full command
line, or at minimum document the limitation as a known caveat comment so it's not
silently surprising.

---

## Summary — Priority Order

| # | Severity | File | Fix effort |
|---|----------|------|-----------|
| 1a | **CRITICAL** | `lib.rs:1142,1154` | 5 min — fix JSON parsing |
| 1b | **CRITICAL** | `main.rs:6-10` | 20 min — reconnect handles |
| 2  | **HIGH** | `lib.rs:992` | 1 min — add `if !service_mode` |
| 3  | **MEDIUM** | `lib.rs:915` | 10 min — fix setx |
| 4  | **MEDIUM** | `lib.rs:1225` | 5 min — fix `start` command |
| 5  | **LOW** | `lib.rs:210` | 15 min — base-36 IDs |
| 6  | **LOW** | `lib.rs:131` | 30 min — full cmdline match |

Fix 1a and 2 first — they're the most user-visible and the fastest. Don't touch
anything else until those are verified working in a release build.
