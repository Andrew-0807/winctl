## ADDED Requirements

### Requirement: Services display in sortOrder order
The system SHALL display services sorted by a sortOrder field, then by name as tiebreaker.

#### Scenario: Services sort by sortOrder
- **GIVEN** three services exist with sortOrder 100, 50, and 75
- **WHEN** services are displayed
- **THEN** they appear in order: sortOrder 50, then 75, then 100

#### Scenario: Services without sortOrder sort last
- **GIVEN** two services exist: one with sortOrder 100, one without
- **WHEN** services are displayed
- **THEN** the service with sortOrder 100 appears first
- **AND** the service without sortOrder appears after

### Requirement: Drag-drop reordering in folder
The system SHALL allow users to reorder services within a folder using drag-and-drop.

#### Scenario: Reorder services in folder
- **GIVEN** folder Dev contains services App1, App2, App3
- **WHEN** user drags App3 above App1
- **THEN** the services reorder to App3, App1, App2
- **AND** the new order persists after page refresh

### Requirement: Drag-drop reordering at root
The system SHALL allow users to reorder services at root level using drag-and-drop.

#### Scenario: Reorder root services
- **GIVEN** root level contains services A, B, C
- **WHEN** user drags A below C
- **THEN** the services reorder to B, C, A

### Requirement: API endpoint for reordering
The system SHALL provide an API endpoint to update service sortOrder.

#### Scenario: Reorder via API
- **WHEN** client sends PUT /api/services/reorder with array of service IDs in desired order
- **THEN** each service sortOrder is updated to reflect the new position
- **AND** the services return in the new order

### Requirement: New services get unique sortOrder
New services SHALL receive a unique sortOrder based on timestamp.

#### Scenario: New service gets unique order
- **WHEN** user creates a new service
- **THEN** the service receives a sortOrder value greater than existing services
