## ADDED Requirements

### Requirement: Gallery View layout
The system MUST provide a gallery view layout option that displays items and folders in a responsive grid.

#### Scenario: Activating gallery view
- **WHEN** the user toggles the view mode to gallery
- **THEN** the items and folders are displayed as grid items
- **THEN** the layout adapts to the available screen width

### Requirement: Expandable folders in grid
The system MUST allow users to expand and collapse folders while in the gallery view state.

#### Scenario: Expanding a folder in gallery view
- **WHEN** the user interacts with a folder to expand it
- **THEN** the folder's children are rendered
- **THEN** the grid layout accommodates the new children items logically
