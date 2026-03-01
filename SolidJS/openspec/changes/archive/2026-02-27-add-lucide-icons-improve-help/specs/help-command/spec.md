## ADDED Requirements

### Requirement: Help Command Enhancement
The system SHALL provide an improved help command with better formatting, examples, and usability.

#### Scenario: Display help without arguments
- **WHEN** user runs `winctl help` or `winctl --help`
- **THEN** formatted help output displays with command sections

#### Scenario: Display help for specific command
- **WHEN** user runs `winctl help <command>`
- **THEN** detailed help for that specific command displays

#### Scenario: Help output formatting
- **WHEN** help is displayed
- **THEN** output uses color coding, proper alignment, and grouped sections

#### Scenario: Shell integration
- **WHEN** user presses Tab after typing `winctl `
- **THEN** shell autocomplete shows available commands (if supported)

### Requirement: Help Command Content
The help command SHALL include comprehensive information for all CLI commands.

#### Scenario: Service control commands documented
- **WHEN** help is displayed
- **THEN** commands: start, stop, status, services are documented

#### Scenario: Service management commands documented
- **WHEN** help is displayed
- **THEN** commands: start-svc, stop-svc, restart-svc, logs are documented

#### Scenario: Utility commands documented
- **WHEN** help is displayed
- **THEN** commands: open, setup-firewall, init are documented

#### Scenario: Examples included
- **WHEN** help is displayed
- **THEN** common usage examples are shown for key commands
