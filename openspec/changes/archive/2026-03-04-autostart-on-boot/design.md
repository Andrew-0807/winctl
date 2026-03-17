## Context

Users want `winctl` to automatically start when Windows boots up, removing the need to manually start the daemon. This is a standard expectation for background service management tools. The change involves adding a configuration setting and the necessary system-level integration to trigger on boot.

## Goals / Non-Goals

**Goals:**

- Provide a configuration option (`autostart-on-boot`) to enable or disable automatic startup.
- During `init`, check this configuration and configure Windows to start `winctl` on boot if enabled.
- Automatically add or remove the autostart hook when the user modifies this configuration setting.

**Non-Goals:**

- Supporting OSes other than Windows (since `winctl` is Windows-specific).
- Complex service installation (e.g., creating a true Windows Service using `sc.exe` or `nssm`). A simple user login autostart is sufficient.

## Decisions

- **Startup Method:** Use the current user's Startup folder (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`) or the Windows Registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - *Decision:* We will use the Startup folder or registry via a simple node utility or script. It is less intrusive and easy to manage programmatically.
- **Config Watcher:** The application already has configuration management.
  - *Decision:* Add a side-effect hook when the config is updated. If the new config changes the `autostart-on-boot` state, the system syncs the autostart registry/shortcut accordingly.

## Risks / Trade-offs

- **Risk:** Anti-virus software might flag programmatic additions to the autostart registry or Startup folder.
  - *Mitigation:* Ensure the action is strictly tied to explicit user-initiated configuration changes.
- **Risk:** Path resolution issues for packaged vs unpackaged app.
  - *Mitigation:* Use reliable methods to detect the current executable path (`process.execPath`) when registering for autostart so it works in both dev and packaged environments.
