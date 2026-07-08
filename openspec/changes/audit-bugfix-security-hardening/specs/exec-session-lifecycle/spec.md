## ADDED Requirements

### Requirement: Exec session cleanup on disconnect
The system SHALL kill and remove all running exec child processes associated with a WebSocket client when that client disconnects.

#### Scenario: Client disconnects during exec
- **WHEN** a WebSocket client disconnects while one or more exec sessions are running
- **THEN** the system SHALL send SIGKILL (or Windows equivalent) to each child process of those sessions
- **THEN** the system SHALL remove all corresponding entries from the exec session map
- **THEN** no zombie processes or map entries SHALL remain after cleanup

#### Scenario: Normal exec completion
- **WHEN** an exec session's child process exits naturally
- **THEN** the system SHALL remove its map entry and emit `exec-done` to the client

---

### Requirement: Typed exec WebSocket payloads
The system SHALL use defined TypeScript interfaces for all exec-related WebSocket events.

#### Scenario: exec-output event received
- **WHEN** the client receives an `exec-output` WebSocket event
- **THEN** the payload SHALL conform to `{ stream: 'stdout' | 'stderr'; line: string }`
- **THEN** no `as any` cast SHALL be needed to access `stream` or `line`

#### Scenario: exec-done event received
- **WHEN** the client receives an `exec-done` WebSocket event
- **THEN** the payload SHALL conform to `{ exitCode: number | null }`
- **THEN** no `as any` cast SHALL be needed to access `exitCode`

---

### Requirement: Typed exec event bus
The system SHALL use a module-scoped typed EventTarget for routing exec output to UI components, not the global `window` object.

#### Scenario: Exec output routed to terminal component
- **WHEN** an `exec-output` event is received from the WebSocket
- **THEN** the system SHALL dispatch a `CustomEvent<ExecOutputEvent>` on the module-level event emitter
- **THEN** the terminal UI component SHALL receive the event via `addEventListener` on the same emitter
- **THEN** the global `window` object SHALL NOT be used as the event bus
