## MODIFIED Requirements

### Requirement: Log API returns structured entries
The system SHALL return log entries as structured objects with a timestamp and line field.

#### Scenario: Log entries fetched via REST
- **WHEN** the client calls `GET /api/services/:id/logs`
- **THEN** the response SHALL be a JSON array of objects with shape `{ "t": "<ISO-or-time-string>", "line": "<log-line>" }`
- **THEN** each entry's `t` field SHALL be a non-empty string representing when the line was captured

#### Scenario: LogViewer displays timestamps
- **WHEN** the LogViewer component receives log entries from the API
- **THEN** it SHALL display the time portion of `entry.t` alongside `entry.line`
- **THEN** no entries SHALL be silently dropped due to format mismatch

---

### Requirement: Duplicate folder fetch eliminated
The system SHALL fetch folder data only once per status refresh cycle.

#### Scenario: Status refresh
- **WHEN** `getStatus` is called on the frontend
- **THEN** only one request SHALL be made to retrieve folder data
- **THEN** the folders from `/api/services` SHALL be used directly
- **THEN** no separate `/api/folders` request SHALL be made in the same cycle
