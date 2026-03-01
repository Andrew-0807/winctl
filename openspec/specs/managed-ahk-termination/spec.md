## ADDED Requirements

### Requirement: Isolated AHK Script Termination
The system MUST accurately identify and terminate a specific AutoHotkey script managed by a service without affecting other running AutoHotkey scripts.

#### Scenario: Stopping one of multiple AHK scripts
- **WHEN** multiple AutoHotkey scripts are running under different services and the user stops one specific service
- **THEN** only the AutoHotkey process executing that specific script is terminated, and the other script processes remain running.

#### Scenario: Stopping all AHK scripts individually
- **WHEN** the user stops each AutoHotkey script service one by one
- **THEN** each corresponding AutoHotkey process is successfully terminated, leaving no orphaned processes running.
