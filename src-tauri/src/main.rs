#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::INVALID_HANDLE_VALUE;
        use windows::Win32::Storage::FileSystem::{CreateFileA, FILE_CREATION_DISPOSITION, FILE_FLAGS_AND_ATTRIBUTES, FILE_SHARE_MODE};
        use windows::Win32::System::Console::{AttachConsole, SetStdHandle, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE};

        let _ = AttachConsole(u32::MAX); // ATTACH_PARENT_PROCESS = 0xFFFFFFFF

        // Windows has already nulled stdout/stderr handles for GUI binaries.
        // Reopen CONOUT$ and wire it up as the standard handles.
        let conout: Vec<u8> = b"CONOUT$\0".to_vec();
        let handle = CreateFileA(
            windows::core::PCSTR(conout.as_ptr()),
            0x40000000u32, // GENERIC_WRITE
            FILE_SHARE_MODE(0x2 | 0x1), // FILE_SHARE_WRITE | FILE_SHARE_READ
            None,
            FILE_CREATION_DISPOSITION(3), // OPEN_EXISTING
            FILE_FLAGS_AND_ATTRIBUTES(0x80000000 | 0x20000000), // FILE_WRITE_THROUGH | FILE_NO_BUFFERING
            None,
        );

        if let Ok(handle) = handle {
            if handle != INVALID_HANDLE_VALUE {
                SetStdHandle(STD_OUTPUT_HANDLE, handle).ok();
                SetStdHandle(STD_ERROR_HANDLE, handle).ok();


            }
        }
    }

    winctl_lib::run()
}
