## ADDED Requirements

### Requirement: SystemInfo interface matches backend serialization

The SystemInfo interface SHALL use camelCase field names to match the Rust backend's JSON serialization format.

#### Scenario: Interface fields align with API response
- **WHEN** the frontend receives a SystemInfo response from `/api/system`
- **THEN** the interface fields `cpuCount`, `totalMem`, `freeMem` SHALL match the JSON keys `cpuCount`, `totalMem`, `freeMem`

#### Scenario: SystemStats displays correct memory values
- **WHEN** `loadSystem()` fetches system info
- **THEN** `formatMem(systemInfo.totalMem)` SHALL return a valid GB value (not NaN)
- **AND** `formatMem(systemInfo.freeMem)` SHALL return a valid GB value (not NaN)

#### Scenario: SystemStats displays correct CPU cores
- **WHEN** `loadSystem()` fetches system info
- **THEN** `systemInfo.cpuCount` SHALL display in the CPU Cores card

#### Scenario: SystemStats displays uptime when available
- **WHEN** `systemInfo.uptime` is greater than 0
- **THEN** `formatUptime(systemInfo.uptime)` SHALL return a human-readable duration