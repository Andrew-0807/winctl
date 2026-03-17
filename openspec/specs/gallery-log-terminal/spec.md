## ADDED Requirements

### Requirement: Log Terminal Overlay for Folders

The system SHALL display the log terminal for folder items as an overlay popup positioned to the left of the folder, rather than expanding inline within the grid.

#### Scenario: User opens log terminal for a folder

- **WHEN** the user clicks the log terminal toggle button on a folder item in the gallery view
- **THEN** an overlay popup containing the log terminal appears to the left of the folder
- **AND** the layout of the gallery grid remains unchanged

### Requirement: Log Terminal Display for Non-folder Items

The system SHALL properly render the log terminal console and its output for standalone (non-folder) items when the log terminal is toggled.

#### Scenario: User opens log terminal for a non-folder item

- **WHEN** the user clicks the log terminal toggle button on a non-folder item in the gallery view
- **THEN** the item expands or displays an overlay (consistent with the UI pattern) showing the actual console output
- **AND** the console area is not empty if log data is available
