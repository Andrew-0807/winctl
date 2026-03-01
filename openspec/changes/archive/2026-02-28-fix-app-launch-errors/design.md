## Context

WinCTL currently supports launching various applications and scripts configured by the user. However, some items, specifically AutoHotkey scripts and certain executables, are failing to launch or throwing `ENOENT` errors. This happens because the current spawning logic might be improperly handling file extensions, missing explicit shells for scripts, or incorrectly resolving working directories.

## Goals / Non-Goals

**Goals:**
- Reliable execution of all configured executable types (e.g., `.exe`, `.ahk`, `.bat`, etc.).
- Proper error catching and reporting when a launch fails.
- Resolution of working directory issues that lead to `ENOENT`.

**Non-Goals:**
- Implementing a completely new process manager.
- Modifying how apps are configured in the UI.

## Decisions

1. **Use well-defined runners based on file extension:** Instead of a generic `exec` or `spawn` for everything, the system will identify the file type and use the appropriate runner (e.g., executing AutoHotkey.exe for `.ahk` files, or using `shell: true` for `.bat`).
2. **Explicit Working Directories:** The working directory for the spawned process will default to the directory of the target executable if not explicitly provided, preventing `ENOENT` due to relative paths.
3. **Structured Error Handling:** Wrap the spawn logic in a try-catch block and attach error listeners to the child process to handle async spawn errors elegantly.

## Risks / Trade-offs

- **Risk:** Shell execution might introduce security vulnerabilities if input is not sanitized.
  - **Mitigation:** Only use `shell: true` when absolutely necessary (e.g., for batch scripts) and ensure paths are properly escaped or handled.
- **Risk:** The correct executable for scripts (like AutoHotkey) might not be in the system PATH.
  - **Mitigation:** Provide a way to configure custom runner paths, or attempt to resolve from registry/common installation paths if possible, but fallback to clear error messages asking the user to install them or add them to PATH.
