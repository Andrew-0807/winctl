## ADDED Requirements

### Requirement: Icon System Integration
The system SHALL provide a centralized Lucide icon integration for the SolidJS UI using lucide-solid package.

#### Scenario: Install lucide-solid dependency
- **WHEN** developer runs npm install
- **THEN** lucide-solid is added to package.json dependencies

#### Scenario: Create Icon component
- **WHEN** UI needs to display an icon
- **THEN** a centralized Icon component is used with consistent sizing and theming

#### Scenario: Icon mapping from Feather to Lucide
- **WHEN** existing Feather icon is used in component
- **THEN** equivalent Lucide icon replaces it with same visual function

### Requirement: Component Icon Updates
The system SHALL update all UI components to use Lucide icons.

#### Scenario: Sidebar icons updated
- **WHEN** Sidebar component renders
- **THEN** Lucide icons display for: views, actions, settings

#### Scenario: ServiceCard icons updated
- **WHEN** ServiceCard component renders
- **THEN** Lucide icons display for: start, stop, restart actions

#### Scenario: FolderCard icons updated
- **WHEN** FolderCard component renders
- **THEN** Lucide icons display for folder operations

#### Scenario: LogViewer icons updated
- **WHEN** LogViewer component renders
- **THEN** Lucide icons display for log actions

#### Scenario: Modal icons updated
- **WHEN** any modal component renders
- **THEN** Lucide icons display for close, save, actions

#### Scenario: FAB and Header icons updated
- **WHEN** FAB or Header component renders
- **THEN** Lucide icons display for primary actions
