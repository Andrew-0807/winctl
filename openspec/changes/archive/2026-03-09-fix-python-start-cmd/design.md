## Context

The application is failing to start a background Python script on Windows, producing the following error:
`Starting: sudo python .\mainScripts\start.py Failed to start: spawn sudo python .\mainScripts\start.py ENOENT`

This occurs because the process manager is attempting to execute a command that begins with `sudo`, which is a Unix-specific privilege elevation command and is not natively available on Windows (`win32` platform). The command is likely defined in the user's service configuration (`~/.winctl/services.json`) or a default configuration.

## Goals / Non-Goals

**Goals:**

- Allow the application to successfully launch the Python script without `ENOENT` errors on Windows by ensuring the executed command is valid for the `win32` platform.
- Prevent issues caused by accidentally using macOS/Linux commands (`sudo`) in the Windows application runner.

**Non-Goals:**

- Refactoring the entire `process-manager.ts` service execution flow.
- Changing the underlying structure of `services.json`.

## Decisions

**1. Strip `sudo` prefix on Windows**
*Rationale:* In `SolidJS/server/process-manager.ts`, when preparing the command for execution (e.g., in `startService`), we will check if the OS is Windows (`os.platform() === 'win32'`) and if the command starts with `sudo`. If so, we will strip `sudo` from the command prior to spawning. This makes the runner resilient against cross-platform command copying or incorrect default templates.
*Alternative considered:* Modifying the user's `~/.winctl/services.json` directly. While valid, patching right at the runner level is more robust and acts as a safety net.

## Risks / Trade-offs

- [Risk] Legitimate use of third-party `sudo` utilities on Windows (like `gsudo` aliased as `sudo`) might be unintentionally stripped.
  → Mitigation: Given the typical user base and the specific error (`ENOENT`), it is highly likely the user does *not* have a `sudo` executable. The trade-off leans heavily towards fixing the broken default experience at the cost of a rare edge case.
