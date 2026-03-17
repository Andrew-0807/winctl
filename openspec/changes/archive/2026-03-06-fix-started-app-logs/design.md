## Context

When users start a command or application through the platform, they rely on the log terminal specifically to monitor its output (stdout and stderr). Currently, started applications fail to stream these logs successfully into the UI terminal. As a result, users cannot troubleshoot errors or trace the application's execution state.

## Goals / Non-Goals

**Goals:**

- Debug and resolve why standard streams for launched applications are not transmitted and/or rendered in the frontend log terminal.
- Ensure the frontend log components dynamically subscribe or listen to the log stream of a specific ongoing child process correctly.
- Ensure backend process handlers properly route standard stream data into the frontend socket/event listener setup.

**Non-Goals:**

- Introduce a full logging aggregator or historical storage.
- Introduce advanced UI modifications to the terminal interface beyond piping the actual log output.

## Decisions

- **Direct Stream Piping:** The backend should explicitly capture `stdout` and `stderr` streams for any newly instantiated process, routing these output lines directly to WebSocket event pipelines or socket.io rooms designated for the individual task/item id.
- **Targeted Log Subscription on Frontend:** The `gallery-log-inline-panel` components on the browser must listen to these process-specific events and render their payload linearly, taking into consideration autoscrolling rules.

## Risks / Trade-offs

- [Risk] Large volumes of output from noisy apps can overwhelm the browser UI. -> Mitigation: The terminal component should implement a capped buffer (e.g. latest 2000 lines) or we implement rate limiting on the bridge, if necessary. For now, we will focus on re-establishing the basic pipe.
