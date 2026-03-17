## 1. Utilities and OS Integration

- [x] 1.1 Implement a utility function to add `winctl` to the Windows Startup folder (or Registry) pointing to the current executable.
- [x] 1.2 Implement a utility function to remove `winctl` from the Windows Startup folder (or Registry).

## 2. Configuration Management

- [x] 2.1 Add an `autostart-on-boot` boolean parameter (default `false`) to the configuration schema.
- [x] 2.2 Wire up a configuration mutation hook so that changing `autostart-on-boot` automatically calls the OS integration utilities (add or remove).

## 3. Command Line Interface

- [x] 3.1 Update the `winctl init` command to consult the `autostart-on-boot` configuration parameter.
- [x] 3.2 If enabled, ensure the `init` command invokes the autostart registration utility during the setup sequence.
