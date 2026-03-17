## 1. Types

- [x] 1.1 Add `ExecRequest` interface to `server/types.ts`: `{ command: string, cwd?: string, env?: Record<string, string> }`
- [x] 1.2 Add `ExecSession` interface to `server/types.ts`: `{ process: ChildProcess, execId: string, startedAt: string }`

## 2. Server — exec runner

- [x] 2.1 In `server/process-manager.ts`, add `execRegistry: Map<string, ExecSession>` (module-level, alongside the service `registry`)
- [x] 2.2 Add `runExec(io: Server, request: ExecRequest): string` function — spawns `cmd.exe /c <command>`, streams stdout/stderr via `io.emit('exec:output', ...)`, emits `io.emit('exec:done', ...)` on close, returns `execId`
- [x] 2.3 Add `killExec(execId: string): boolean` function — kills the process in `execRegistry` if found, deletes the entry, returns true/false

## 3. Server — routes

- [x] 3.1 In `server/routes.ts`, add `POST /api/exec` route: validate `command` (non-empty string, max 2000 chars), sanitize `cwd`, call `runExec(io, request)`, respond with `{ execId }`
- [x] 3.2 Add `POST /api/exec/:execId/kill` route: call `killExec(execId)`, respond with `{ ok: true }` (or 404 if not found)
- [x] 3.3 Pass `io` into `setupRoutes()` if not already available in scope (check — `io` is already a parameter of `setupRoutes`)

## 4. Frontend — store

- [x] 4.1 In `src/stores/ui.ts`, add `ExecLine` type `{ stream: 'stdout' | 'stderr', line: string }` and `execState` signal: `{ command, execId, lines, exitCode }`
- [x] 4.2 Add `setExecCommand`, `startExec`, `killExec`, `clearExec` actions to `ui.ts`
- [x] 4.3 In `src/stores/socket.ts`, add `exec:output` socket listener — appends line to `execState.lines` if `execId` matches
- [x] 4.4 In `src/stores/socket.ts`, add `exec:done` socket listener — sets `exitCode`, clears `execId`
- [x] 4.5 In `src/stores/socket.ts` (or `ui.ts`), add `postExec(command, cwd?)` API wrapper that calls `POST /api/exec` and returns `execId`

## 5. Frontend — RunCommandPanel component

- [x] 5.1 Create `src/components/RunCommandPanel.tsx` — collapsible panel with command input, Run/Kill buttons, output area, and status line
- [x] 5.2 Style the output area to match `LogViewer` (dark background, monospace, auto-scroll to bottom on new lines)
- [x] 5.3 Show stderr lines in a distinct color (e.g., red/orange) to distinguish from stdout
- [x] 5.4 Display "Exited with code N" after process completes — green for 0, red for non-zero
- [x] 5.5 Disable Run button while `execId` is set (command running); show Kill button only while running

## 6. Frontend — integration

- [x] 6.1 Add a "Run Command" toolbar button or panel toggle in `src/components/Toolbar.tsx` (or wherever appropriate in the current layout)
- [x] 6.2 Mount `<RunCommandPanel />` in `src/components/App.tsx` (or the main layout component)

## 7. Verification

- [ ] 7.1 Build server: `cd SolidJS && npm run build:server`
- [ ] 7.2 Build client: `cd SolidJS && npm run build:client`
- [ ] 7.3 Test: run a short command (`echo hello`) — verify output appears and exit code 0 is shown
- [ ] 7.4 Test: run a command that produces stderr (`cmd /c "dir nonexistent"`) — verify stderr appears in red
- [ ] 7.5 Test: run a long-running command (`ping -n 10 localhost`) and click Kill — verify process stops and no more output arrives
- [ ] 7.6 Test: run a command with a non-zero exit code — verify red "Exited with code N" is shown
