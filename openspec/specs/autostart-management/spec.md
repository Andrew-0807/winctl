## ADDED Requirements

### Requirement: Autostart Configuration Updates

The system SHALL support an autostart setting in its configuration. When modified, the system SHALL synchronize the OS autostart state.

#### Scenario: User enables autostart via config

- **WHEN** the user sets the autostart configuration to true
- **THEN** the system SHALL add the winctl executable to the Windows autostart configuration

#### Scenario: User disables autostart via config

- **WHEN** the user sets the autostart configuration to false
- **THEN** the system SHALL remove the winctl executable from the Windows autostart configuration

### Requirement: Init Command Integration

The `winctl init` command SHALL process the autostart configuration during the initialization phase.

#### Scenario: Init runs with autostart enabled

- **WHEN** `winctl init` is executed and the configuration has autostart enabled
- **THEN** the system SHALL configure Windows to autostart the application
