//! Global hotkeys for launching/focusing/closing apps — a Rust reimplementation
//! of the AHK `OpenApp` desktop scripts, so it runs as an honestly-named process
//! instead of AutoHotkey.exe. No input injection, no process hiding: it only
//! enumerates windows and calls SetForegroundWindow/ShowWindow.
//!
//! Bindings live on `Service` records (`hotkey`, `hotkeyAction`, `hotkeyMatchExe`).
//! Registered via tauri-plugin-global-shortcut; on press we run the window action
//! on a scratch thread (window ops + taskkill are blocking).

use crate::config::Service;
use once_cell::sync::OnceCell;
use std::str::FromStr;
use std::sync::Mutex;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use windows::core::{BOOL, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
    PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, EnumWindows, GetForegroundWindow, GetSystemMetrics, GetWindowRect,
    GetWindowTextLengthW, GetWindowThreadProcessId, SetCursorPos, SetForegroundWindow,
    SetWindowPos, ShowWindow, HWND_TOP, SM_CXSCREEN, SM_CYSCREEN, SWP_NOZORDER, SW_MINIMIZE,
    SW_RESTORE,
};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};

// ponytail: fixed size matching the prior AHK SteelSeries layout the user
// navigates by muscle memory. Add a per-service dims field if another app needs it.
const RESIZE_W: i32 = 1500;
const RESIZE_H: i32 = 1000;

static HANDLE_CELL: OnceCell<tauri::AppHandle> = OnceCell::new();
static BINDINGS: Mutex<Vec<(Shortcut, Service)>> = Mutex::new(Vec::new());

/// Store the Tauri handle so `sync` can reach the global-shortcut manager from
/// anywhere (including axum HTTP handlers on a different thread).
pub fn init_handle(handle: &tauri::AppHandle) {
    let _ = HANDLE_CELL.set(handle.clone());
}

/// Re-register all service hotkeys. Idempotent: clears everything first, so it's
/// safe to call after any service create/update/delete. No-op until the handle
/// is set (HTTP mutations during the brief pre-Tauri-setup window just wait for
/// the next edit — startup sync covers the normal case).
pub fn sync(services: &[Service]) {
    let Some(handle) = HANDLE_CELL.get() else { return };
    let gs = handle.global_shortcut();
    let _ = gs.unregister_all();

    let mut binds = BINDINGS.lock().unwrap();
    binds.clear();
    for svc in services {
        let Some(acc) = svc.hotkey.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
            continue;
        };
        match Shortcut::from_str(acc) {
            Ok(sc) => {
                if gs.register(sc).is_ok() {
                    binds.push((sc, svc.clone()));
                } else {
                    eprintln!(
                        "[winctl] hotkey '{}' for '{}' failed to register (conflict?)",
                        acc, svc.name
                    );
                }
            }
            Err(e) => eprintln!("[winctl] invalid hotkey '{}' for '{}': {}", acc, svc.name, e),
        }
    }
}

/// Called from the plugin handler on key-down. Dispatches the matching service's
/// action on a scratch thread so blocking window/taskkill calls don't stall the
/// hotkey event loop.
pub fn on_pressed(shortcut: &Shortcut) {
    let svc = {
        let binds = BINDINGS.lock().unwrap();
        binds.iter().find(|(sc, _)| sc == shortcut).map(|(_, s)| s.clone())
    };
    if let Some(svc) = svc {
        std::thread::spawn(move || run_action(&svc));
    }
}

fn run_action(svc: &Service) {
    let exe = match_exe(svc);
    if exe.is_empty() {
        return;
    }
    let action = svc.hotkey_action.as_deref().unwrap_or("focus");
    let when_active = svc.hotkey_when_active.as_deref().unwrap_or("none");
    let hwnd = find_window_for_exe(&exe);

    // "close" primary = unconditional kill, regardless of focus/minimized state.
    if action == "close" {
        close(hwnd, &exe);
        return;
    }

    let center = action == "focus_center";

    match hwnd {
        None => {
            // Not running — launch it. Detached so it survives WinCTL exit and is
            // never wrapped in our kill-on-exit job object. open == ShellExecute:
            // handles .exe, .lnk and PATH commands, matching AHK Run().
            let _ = open::that_detached(&svc.command);

            // Wait/poll for the window of the newly launched process to appear.
            // We retry up to 100 times with a 50ms delay, i.e., up to 5 seconds.
            let mut new_hwnd = None;
            for _ in 0..100 {
                std::thread::sleep(std::time::Duration::from_millis(50));
                if let Some(h) = find_window_for_exe(&exe) {
                    new_hwnd = Some(h);
                    break;
                }
            }

            if let Some(h) = new_hwnd {
                unsafe {
                    activate(h);

                    // Wait for the window to restore/position itself (up to 250ms)
                    // before centering/resizing or moving the cursor.
                    let mut rect = RECT::default();
                    for _ in 0..25 {
                        if GetWindowRect(h, &mut rect).is_ok() && rect.left > -30000 {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }

                    if center {
                        resize_center(h);
                    }
                    move_cursor_center(h);
                }
            }
        }
        Some(hwnd) => unsafe {
            if GetForegroundWindow() == hwnd {
                // Already focused — apply the "when active" behavior.
                match when_active {
                    "minimize" => {
                        let _ = ShowWindow(hwnd, SW_MINIMIZE);
                    }
                    "close" => close(Some(hwnd), &exe),
                    _ => {} // "none": do nothing
                }
            } else {
                activate(hwnd);

                // Wait for the window to restore from minimized state (up to 250ms)
                // before centering/resizing or moving the cursor.
                let mut rect = RECT::default();
                for _ in 0..25 {
                    if GetWindowRect(hwnd, &mut rect).is_ok() && rect.left > -30000 {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }

                if center {
                    resize_center(hwnd);
                }
                move_cursor_center(hwnd);
            }
        },
    }
}

/// Window-match target: explicit override (for .lnk / launcher-spawned apps whose
/// process name differs from the command, e.g. SteelSeries GG.lnk ->
/// SteelSeriesGGClient.exe), else the basename of the command.
fn match_exe(svc: &Service) -> String {
    if let Some(m) = svc.hotkey_match_exe.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        return m.to_lowercase();
    }
    basename(&svc.command).to_lowercase()
}

fn basename(path: &str) -> String {
    path.rsplit(['\\', '/']).next().unwrap_or(path).to_string()
}

struct FindData {
    target_lc: String,
    result: Option<HWND>,
}

/// First top-level window (with a title) owned by a process whose image basename
/// matches `exe`. Titled rather than visible so tray-minimized apps still match,
/// mirroring AHK's DetectHiddenWindows(true).
fn find_window_for_exe(exe: &str) -> Option<HWND> {
    let mut data = FindData { target_lc: exe.to_string(), result: None };
    unsafe {
        let _ = EnumWindows(Some(enum_cb), LPARAM(&mut data as *mut _ as isize));
    }
    data.result
}

unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let data = &mut *(lparam.0 as *mut FindData);
    if GetWindowTextLengthW(hwnd) == 0 {
        return true.into();
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == 0 {
        return true.into();
    }
    if let Some(name) = process_image_basename(pid) {
        if name.eq_ignore_ascii_case(&data.target_lc) {
            data.result = Some(hwnd);
            return false.into(); // stop enumerating
        }
    }
    true.into()
}

fn process_image_basename(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 260];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut size,
        )
        .is_ok();
        let _ = CloseHandle(handle);
        if !ok {
            return None;
        }
        let full = String::from_utf16_lossy(&buf[..size as usize]);
        Some(basename(&full))
    }
}

/// Bring a window to the foreground without synthetic input. RegisterHotKey grants
/// the handler foreground rights; AttachThreadInput covers the case where the
/// call runs off the granted thread. No SendInput/keybd_event — that's exactly the
/// synthetic input EAC flags, and we deliberately avoid it.
unsafe fn activate(hwnd: HWND) {
    let _ = ShowWindow(hwnd, SW_RESTORE);
    let fg = GetForegroundWindow();
    if fg == hwnd {
        return;
    }
    let cur = GetCurrentThreadId();
    let target_thread = GetWindowThreadProcessId(hwnd, None);
    let fg_thread = if fg.0.is_null() {
        0
    } else {
        GetWindowThreadProcessId(fg, None)
    };

    if fg_thread != 0 && fg_thread != cur {
        let _ = AttachThreadInput(cur, fg_thread, true);
    }
    if target_thread != 0 && target_thread != cur {
        let _ = AttachThreadInput(cur, target_thread, true);
    }

    let _ = BringWindowToTop(hwnd);
    let _ = SetForegroundWindow(hwnd);

    if target_thread != 0 && target_thread != cur {
        let _ = AttachThreadInput(cur, target_thread, false);
    }
    if fg_thread != 0 && fg_thread != cur {
        let _ = AttachThreadInput(cur, fg_thread, false);
    }
}

unsafe fn resize_center(hwnd: HWND) {
    let h_monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    let mut monitor_info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    
    let (monitor_w, monitor_h, monitor_x, monitor_y) = if GetMonitorInfoW(h_monitor, &mut monitor_info).as_bool() {
        let rect = monitor_info.rcWork;
        (
            rect.right - rect.left,
            rect.bottom - rect.top,
            rect.left,
            rect.top,
        )
    } else {
        (
            GetSystemMetrics(SM_CXSCREEN),
            GetSystemMetrics(SM_CYSCREEN),
            0,
            0,
        )
    };

    let x = monitor_x + (monitor_w - RESIZE_W) / 2;
    let y = monitor_y + (monitor_h - RESIZE_H) / 2;
    let _ = SetWindowPos(hwnd, Some(HWND_TOP), x, y, RESIZE_W, RESIZE_H, SWP_NOZORDER);
}

unsafe fn move_cursor_center(hwnd: HWND) {
    let mut rect = RECT::default();
    if GetWindowRect(hwnd, &mut rect).is_ok() && rect.left > -30000 {
        let cx = (rect.left + rect.right) / 2;
        let cy = (rect.top + rect.bottom) / 2;
        let _ = SetCursorPos(cx, cy);
    }
}

/// Terminate the process behind the window (or all instances by image name if no
/// window is found). taskkill /T tears down the child tree. CREATE_NO_WINDOW
/// keeps a console from flashing.
fn close(hwnd: Option<HWND>, exe: &str) {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    use std::os::windows::process::CommandExt;

    let mut cmd = std::process::Command::new("taskkill");
    if let Some(hwnd) = hwnd {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
        if pid != 0 {
            cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
        } else {
            cmd.args(["/F", "/IM", exe]);
        }
    } else {
        cmd.args(["/F", "/IM", exe]);
    }
    let _ = cmd.creation_flags(CREATE_NO_WINDOW).output();
}
