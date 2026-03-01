## Why

Currently, when running `winctl start`, it prints that the server has started even if it was already running or the port was occupied. Similarly, `winctl stop` says it stopped even if nothing was running. This leads to confusion and a lack of clear feedback regarding the actual state of the daemon. We need the CLI to accurately reflect the true state of the daemon. Furthermore, there is no way to check the status of a specific port (e.g., `winctl status -p 8081`). 

## What Changes

1.  **State-Aware `start` command:** The `winctl start` command will check if the daemon is already running (or if the port is occupied) and output a descriptive message instead of blindly saying it started.
2.  **State-Aware `stop` command:** The `winctl stop` command will check if the daemon is actually running. If not, it will inform the user that nothing is currently running.
3.  **Enhanced `status` command:** Add support for `winctl status -p <port>` to check the status of a specific instance/port.

## Capabilities

### New Capabilities
- `cli-port-status`: Adding `-p <port>` flag to the `status` command to check specific instances.

### Modified Capabilities
- `cli-start-stop`: Modifying the requirements for start and stop commands to provide context-aware feedback based on the current process state.

## Impact

- `CLI`: The command-line interface logic for `start`, `stop`, and `status`.
- `Daemon Management`: The logic used by the CLI to determine if the daemon process is running on a given port.
