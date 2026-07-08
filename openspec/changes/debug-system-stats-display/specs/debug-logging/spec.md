## ADDED Requirements

### Requirement: Debug logging for SystemStats

Add console.log statements to diagnose why memory and uptime display incorrectly.

#### Scenario: Log systemInfo on render
- **WHEN** SystemStats renders
- **THEN** console.log the systemInfo object with label "DEBUG SystemStats:"

#### Scenario: Log API response in loadSystem
- **WHEN** loadSystem completes
- **THEN** console.log the API response with label "DEBUG API getSystemInfo:"