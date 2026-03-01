## ADDED Requirements

### Requirement: Preserve folderId when editing service
The system SHALL preserve the folderId of a service when the user edits and saves the service.

#### Scenario: Edit service in folder
- **GIVEN** a service "MyApp" exists in folder "Development"
- **WHEN** user edits the service "MyApp"
- **AND** changes the name to "MyApp Updated"
- **AND** saves the service
- **THEN** the service remains in folder "Development"
- **AND** the folderId is not null

#### Scenario: Edit service at root
- **GIVEN** a service "MyApp" exists at root (no folder)
- **WHEN** user edits the service "MyApp"
- **AND** saves the service
- **THEN** the service remains at root
- **AND** the folderId is null

#### Scenario: Move service to different folder via edit
- **GIVEN** a service "MyApp" exists in folder "Work"
- **WHEN** user edits the service and explicitly changes the folder
- **THEN** the service moves to the new folder

### Requirement: New service defaults to root
New services created via the UI SHALL default to no folder (root level).

#### Scenario: Create new service
- **WHEN** user creates a new service
- **AND** does not select a folder
- **THEN** the service is created at root level
- **AND** folderId is null
