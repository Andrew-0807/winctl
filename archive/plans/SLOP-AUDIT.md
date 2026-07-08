# WinCTL Slop Audit — Things That Should Not Have Shipped

Every item below is something I found by reading the code. No guessing.
Severity: **[BROKEN]** = wrong behavior, **[SLOP]** = lazy/careless code, **[BOMB]** = will hurt you later.

---

## 1. `restart_handler` is just `shutdown_handler` copy-pasted — and doesn't restart [BROKEN]

`lib.rs:616-637` vs `lib.rs:592-613`. Identical functions. Both call `std::process::exit(0)`.
"Restart" just kills the process. It does not re-exec, does not relaunch, does nothing special.
If you call `POST /api/restart` from the CLI, WinCTL dies and stays dead unless something external
(Windows service manager) revives it. The CLI prints "WinCTL restarting..." — a lie.

**Fix:** Either implement actual re-exec (`std::process::Command::new(current_exe).spawn()` before
exit), or rename the endpoint to `/api/stop` and kill the duplicate.

---

## 2. `kill_exec_session` doesn't kill anything [BROKEN]

`lib.rs:530-536`. It broadcasts a `"type": "exec-kill"` message over the WebSocket channel.
That's it. The actual `tokio::spawn` started in `exec_command` holds no stored handle —
the `JoinHandle` is thrown away at line 525. There is no registry of running execs.
Calling `POST /api/exec/{id}/kill` does nothing to the underlying process. The command keeps running.

**Fix:** Store `JoinHandle`s and `Child` handles in a `DashMap<String, (JoinHandle, Child)>`
keyed by execId. Call `.abort()` and `.kill()` on the right entry.

---

## 3. `get_system_info` returns Unix timestamp as "uptime" [BROKEN]

`lib.rs:464-468`:
```rust
let uptime = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
```
That's the current Unix time (~1.75 billion seconds), not system uptime.
The UI presumably shows this to the user as how long their PC has been on.

**Fix:** Use `GetTickCount64()` on Windows (divide by 1000 for seconds), or read
`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters`.
Simplest: `winapi::um::sysinfoapi::GetTickCount64() / 1000`.

---

## 4. `flush_memory` reports wrong number and flushes nothing reliably [BROKEN]

`lib.rs:482-492`:
- `EmptyStandbyList.exe` is a **third-party Sysinternals tool**, not part of Windows.
  Most users won't have it. The call silently does nothing if it's not installed.
- It's spawned fire-and-forget (`.spawn()`, no `.wait()`).
- `freed` is immediately read from `mem_info().avail` — before the flush has any effect.
- The value returned is current free memory, **not how much was freed**.

**Fix:** Use `SetSystemFileCacheSize` / `EmptyWorkingSet` via winapi if you want a real
flush. If keeping the external tool, `.output()` it and wait. The response field should
be named `free_mem`, not `freed`.

---

## 5. `get_sysinfo_tools` returns duplicates [SLOP]

`lib.rs:563-567`:
```rust
if check("fastfetch.exe") { tools.push("fastfetch".to_string()); }
// ...
if check("fastfetch") { tools.push("fastfetch".to_string()); }
```
On any system where `fastfetch` is in PATH, both checks pass and `"fastfetch"` is
pushed twice. The UI gets `["fastfetch", "fastfetch"]`.

**Fix:** Check once. `.exe` suffix is irrelevant on Windows — `where fastfetch`
finds `fastfetch.exe` automatically.

---

## 6. `run_fetch_tool` holds a RwLock while running a blocking process [BOMB]

`lib.rs:573-588`. `state.settings.read()` acquires the lock. Then immediately:
```rust
let output = std::process::Command::new("cmd.exe")
    .args(["/C", tool])
    .output()  // ← blocks this thread for the duration of the command
    ...
```
The read lock is held for the entire runtime of the command (fastfetch/neofetch can
take 1-3 seconds). Any concurrent `PUT /api/settings` that tries a write lock deadlocks.

**Fix:** Read the tool name, drop the lock, then run the command:
```rust
let tool = { state.settings.read()...fetch_tool.clone() };
// lock dropped here
std::process::Command::new(...)
```

---

## 7. `power_control` "display-off" is random internet garbage [BROKEN]

`lib.rs:645-650`:
```rust
std::process::Command::new("powershell")
    .args(["-NoProfile", "-Command",
           "(Add-Type -TypeName 'Microsoft.VisualBasic.Interaction' -PassThru)::SendKeys('%{F4}')"])
```
This tries to send `Alt+F4` via VB.NET's SendKeys to turn off the display.
That sends a close-window keystroke to whatever window has focus. It will randomly
close the user's foreground application instead of turning off the display.

**Fix (one line):**
```rust
// nircmd.exe monitor off  — if available
// or the correct Win32 approach:
std::process::Command::new("powershell")
    .args(["-NoProfile", "-Command",
           "(Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);' -Name 'Win32' -Namespace 'Win32Functions' -PassThru)::SendMessage(0xFFFF, 0x0112, 0xF170, 2)"])
```
Or use `nircmd.exe monitor off` which the intern almost certainly knew about given
the rest of this file.

---

## 8. Dead variable in `power_control` [SLOP]

`lib.rs:643-676`:
```rust
let code = match action.as_str() {
    "sleep" => std::process::Command::new(...).spawn()?    // returns Child
    "lock"  => std::process::Command::new(...).spawn()?    // returns Child
    ...
};
let _ = code;  // immediately discarded
```
`code` is assigned a `Child` handle then immediately dropped. The child process exit
status is never checked. The `let code = ...` / `let _ = code` pattern is what
you write when you don't understand what you're doing — just write `.spawn()?;`
and drop it on the floor explicitly from the start.

---

## 9. `service_restart` does `tokio::spawn(...).await` twice for no reason [SLOP]

`lib.rs:426-434`:
```rust
tokio::spawn(async move { pm.kill(&sid).await })
    .await.map_err(...)?.map_err(...)?;
// ...
tokio::spawn(async move { pm.spawn(&s).await })
    .await.map_err(...)?.map_err(...)?;
```
`tokio::spawn` + immediate `.await` is identical to just calling the async function
directly. The only valid reason to do this is panic isolation, which isn't the intent
here. It just adds JoinHandle error mapping overhead and makes the error types wrong
(`map_err(|_| INTERNAL_SERVER_ERROR)` swallows the actual reason kill/spawn failed).

Same pattern in `service_start` and `service_stop`.

---

## 10. WebSocket ignores the message type and always dumps full state [SLOP]

`lib.rs:799-815`. The broadcast channel carries typed messages: `"exec-done"`,
`"fetch-output"`, `"status"`, etc. The WebSocket handler ignores the actual message
entirely:
```rust
Ok(_) | Err(RecvError::Lagged(_)) => {
    // always sends full service state snapshot regardless of what triggered this
    let services = state.services.read()...
    let payload = json!({ "type": "status", ... });
```
So when an exec command completes, every connected WebSocket client receives a full
services+folders+settings dump. The `"exec-done"` payload with stdout/stderr is never
forwarded to the frontend at all — it vanishes. That's why exec output doesn't appear
in the UI.

**Fix:** Forward the broadcast message as-is when it isn't an `"update"` trigger:
```rust
Ok(msg) => {
    if msg == "update" { /* send status snapshot */ }
    else { /* forward msg directly to ws client */ }
}
```

---

## 11. `/api/shutdown` and `/api/stop` are the same route [SLOP]

`lib.rs:764-765`:
```rust
.route("/api/shutdown", post(shutdown_handler))
.route("/api/stop",     post(shutdown_handler))
```
Two routes, one handler. Pick one name and remove the other. The CLI uses `/api/stop`.
The frontend probably uses `/api/shutdown`. Nobody knows. There's also `/api/restart`
which doesn't restart. This API is a mess.

---

## 12. `get_fonts` is unauthenticated, blocking, and slow [BOMB]

`lib.rs:538-551`. It's on `public_routes` (no auth). It runs PowerShell synchronously
via `std::process::Command` (blocks a thread). On a machine with 300 fonts, PowerShell
cold-start + enumeration takes 2-4 seconds. Any anonymous client can hit this endpoint
in a loop and starve the thread pool.

Move it behind auth, cache the result, or use the Windows Registry
`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` directly.

---

## Summary table

| # | Location | Category | One-liner |
|---|----------|----------|-----------|
| 1 | `lib.rs:616` | BROKEN | `restart_handler` doesn't restart |
| 2 | `lib.rs:530` | BROKEN | exec kill does nothing |
| 3 | `lib.rs:464` | BROKEN | uptime = Unix timestamp |
| 4 | `lib.rs:482` | BROKEN | flush_memory lies about what it freed |
| 5 | `lib.rs:563` | SLOP | sysinfo tools list has duplicates |
| 6 | `lib.rs:573` | BOMB | RwLock held across blocking process call |
| 7 | `lib.rs:645` | BROKEN | display-off sends Alt+F4 to foreground window |
| 8 | `lib.rs:675` | SLOP | dead variable `code` in power_control |
| 9 | `lib.rs:426` | SLOP | spawn+await instead of direct await |
| 10 | `lib.rs:799` | BROKEN | WebSocket swallows exec-done output |
| 11 | `lib.rs:764` | SLOP | duplicate shutdown routes |
| 12 | `lib.rs:538` | BOMB | unauthenticated blocking font endpoint |

Fix order: 10 → 1 → 7 → 6 → 2 → 3 → rest.
