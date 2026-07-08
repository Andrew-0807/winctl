## ADDED Requirements

### Requirement: Read and write services config
The system SHALL read and write `~/.config/winctl/services.json` in the existing JSON format, preserving all fields and structure.

#### Scenario: Config round-trip
- **WHEN** the config is read and then written back without changes
- **THEN** the resulting JSON is byte-equivalent to the original (modulo whitespace normalisation)

### Requirement: Read and write settings config
The system SHALL read and write `~/.config/winctl/settings.json` in the existing JSON format, preserving theme, folder preferences, and autoStart fields.

#### Scenario: Settings persist across restarts
- **WHEN** settings are updated via the API and the app is restarted
- **THEN** the updated settings are loaded on the next startup

### Requirement: Config TTL cache
The system SHALL cache the parsed config in memory and re-read from disk only when the cached value is older than 5 seconds, matching the existing behaviour.

#### Scenario: Rapid reads use cache
- **WHEN** the config is read twice within 5 seconds with no write in between
- **THEN** only one disk read occurs

### Requirement: Theme file management
The system SHALL read, write, and list theme JSON files in `~/.config/winctl/themes/`, writing built-in themes on first startup if they do not exist.

#### Scenario: Built-in themes seeded on first run
- **WHEN** the app starts and `~/.config/winctl/themes/` is empty or absent
- **THEN** all built-in theme files are written to that directory
