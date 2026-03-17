## 1. Process Manager Update

- [x] 1.1 Update `SolidJS/server/process-manager.ts` to detect if `os.platform() === 'win32'`
- [x] 1.2 Modify the command execution logic to strip the `sudo` prefix from commands on Windows before spawning
- [x] 1.3 Verify that background services configured with `sudo python` start correctly on Windows without throwing `ENOENT`
