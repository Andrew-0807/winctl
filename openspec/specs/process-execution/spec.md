# Process Execution

## Requirements

### Requirement: Cross-platform command execution

The process manager SHALL execute commands in a platform-appropriate manner, stripping unsupported Unix commands like `sudo` when running on Windows.

#### Scenario: Stripping sudo on Windows

- **WHEN** the process manager is instructed to run a command starting with `sudo`
- **AND** the host operating system is Windows (`win32`)
- **THEN** the process manager spawns the command without the `sudo` prefix
