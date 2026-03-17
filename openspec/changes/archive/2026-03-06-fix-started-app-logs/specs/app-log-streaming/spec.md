## ADDED Requirements

### Requirement: Application Output Stream Forwarding

The system SHALL capture the standard output and standard error from any launched application and forward it as log events to the corresponding frontend listening component.

#### Scenario: Running application generates log line

- **WHEN** the running application process outputs a new line to `stdout` or `stderr`
- **THEN** the backend process manager dispatches that data line to active clients subscribed to the application's specific logging channel

### Requirement: Frontend Subscription Binding

The frontend UI components displaying logs SHALL bind their internal subscriptions correctly to the backend stream ID corresponding to the started process.

#### Scenario: User toggles log view for app

- **WHEN** the user opens the log terminal view for an app
- **THEN** the UI dynamically subscribes to new log output associated with that app's specific child process id or namespace
