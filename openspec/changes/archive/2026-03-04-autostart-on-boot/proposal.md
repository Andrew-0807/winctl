## Why

Users of `winctl` currently have to manually start the application or configure Windows task scheduler themselves to have it run on boot. Adding a built-in autostart capability, which can be configured during `init` and toggled silently via configuration changes, provides a seamless background daemon experience typical of such management tools.

## What Changes

- Add a new `autostart-on-boot` setting to the application configuration.
- Enhance the `winctl init` command to check this configuration and automatically add the application to the Windows startup folder if enabled.
- Add a configuration watcher or hook so that when the user modifies the autostart setting via the app, `winctl` silently adds or removes itself from the autostart.

## Capabilities

### New Capabilities

- `autostart-management`: Handles adding and removing the application from the Windows autostart folder natively, and keeping the system state in sync with the application configuration.

### Modified Capabilities

## Impact

- `init` command: Modified to invoke autostart setup if configured.
- Configuration module: Modified to trigger side effects on autostart setting mutation.
- OS Interaction: Will programmatically manage a shortcut/registry entry in the Windows autostart environment.
