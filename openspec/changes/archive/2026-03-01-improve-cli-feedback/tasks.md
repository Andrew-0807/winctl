## 1. Implement Status Command Enhancements

- [x] 1.1 Add `-p` and `--port` arguments to the `status` command parser in `cli/index.ts`.
- [x] 1.2 Update the status logic to only check the requested port if `-p` is provided, otherwise perform the default check.
- [x] 1.3 Ensure the output for port-specific status is clear (e.g., "Daemon is running on port XXXX" or "No daemon running on port XXXX").

## 2. Implement Start Command State-Awareness

- [x] 2.1 In `cli/index.ts` for the `start` command, add logic to check if the daemon is already running on the target port before initiating the start sequence.
- [x] 2.2 If the daemon is running, print "Daemon is already running on port XXXX" and exit without starting.
- [x] 2.3 If the daemon is not running, proceed with the normal start sequence and print the standard "Started" message.

## 3. Implement Stop Command State-Awareness

- [x] 3.1 In `cli/index.ts` for the `stop` command, add logic to check if the daemon is currently running on the given port before initiating the stop sequence.
- [x] 3.2 If the daemon is not running, print "No daemon is currently running on port XXXX" and exit.
- [x] 3.3 If the daemon is running, proceed with the normal stop sequence and print "Stopped".
