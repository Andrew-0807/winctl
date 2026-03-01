## 1. Server Shutdown Logic

- [x] 1.1 Create `shutdownDaemon(force: boolean)` function in `server/index.ts` that: iterates the registry and calls `stopService()` for each running service, closes the HTTP server, kills the tray icon, then calls `process.exit(0)`. If force=true, skip service cleanup and call `process.exit(1)` immediately. Add a 5-second hard timeout that force-exits if cleanup hangs.
- [x] 1.2 Add `SIGTERM` and `SIGINT` signal handlers in `server/index.ts` that call `shutdownDaemon(false)`
- [x] 1.3 Update `/api/shutdown` route in `server/routes.ts` to call `shutdownDaemon(false)` after sending the response
- [x] 1.4 Update `/api/shutdown/force` route in `server/routes.ts` to call `shutdownDaemon(true)` after sending the response (remove the `taskkill /F /T /PID` self-kill hack)

## 2. Status API

- [x] 2.1 Add `pid: process.pid` to the `/api/status` response (or create the endpoint if it doesn't exist) in `server/routes.ts`

## 3. CLI Force Stop

- [x] 3.1 Update `daemonStop(force=true)` in `cli/index.ts` to: first try `/api/shutdown/force`, then `taskkill /F /T /FI "IMAGENAME eq winctl-daemon.exe"`, then as final fallback query `/api/status` for the daemon PID and run `taskkill /F /PID <pid>`
- [x] 3.2 Update `daemonStop(force=false)` in `cli/index.ts` to: after `sc stop WinCTL`, wait briefly and verify the daemon is actually gone by checking `/api/status`; if still alive, fall through to the API shutdown path

## 4. Verification

- [x] 4.1 Build the CLI and server (`npm run build` or equivalent)
- [ ] 4.2 Test `winctl stop` stops the daemon cleanly
- [ ] 4.3 Test `winctl stop -f` force-kills the daemon when normal stop is unresponsive
