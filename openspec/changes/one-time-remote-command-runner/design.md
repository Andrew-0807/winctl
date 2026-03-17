## Context

WinCTL's daemon (`server/`) already spawns and tracks child processes for managed services via `process-manager.ts`. It uses a `registry: Map<string, ServiceEntry>` for persistent services. Log streaming works by appending lines to an in-memory ring buffer per service and emitting a Socket.IO `status` event.

For one-shot exec, we don't want to mix with the service registry. The pattern is: spawn → stream lines via a dedicated Socket.IO channel keyed by `execId` → emit done event with exit code → clean up. No persistence, no registry entry.

## Goals / Non-Goals

**Goals:**
- Run any shell command on the host from the dashboard
- Stream stdout/stderr lines to the UI in real time
- Report exit code when the process finishes
- Support cancellation (kill the process before it exits naturally)
- Design REST-first so an Android app can use the same endpoint

**Non-Goals:**
- Command history / persistence
- Multiple concurrent exec sessions visible in the UI simultaneously (one at a time in the panel is fine; concurrent is allowed at the API level)
- PTY / interactive terminal (no stdin from the browser)
- Saving exec output as a log

## Decisions

### 1. API contract

```
POST /api/exec
Body: { command: string, cwd?: string, env?: Record<string, string> }
Response: { execId: string }   // 200 immediately, before process exits
```

The endpoint returns immediately with an `execId`. The client subscribes to Socket.IO events for that ID to receive output.

```
POST /api/exec/:execId/kill
Response: { ok: true }
```

Sends SIGKILL to the running process (if still alive).

**Why respond immediately instead of waiting for process exit?** Long-running commands (e.g., a build) would time out the HTTP connection. Socket.IO handles the streaming naturally.

### 2. Socket.IO event protocol

```
// Server → client, for each stdout/stderr line:
exec:output  { execId: string, stream: 'stdout' | 'stderr', line: string }

// Server → client, when process exits:
exec:done    { execId: string, exitCode: number | null }
```

Clients join no special room — events are broadcast to all connected clients. The `execId` lets the UI filter to its own session. This is consistent with how `status` events work today (broadcast to all).

### 3. Server implementation — `runExec()` in `process-manager.ts`

```ts
interface ExecSession {
  process: ChildProcess;
  execId: string;
  startedAt: string;
}

const execRegistry = new Map<string, ExecSession>();

export function runExec(
  io: Server,
  request: ExecRequest
): string {
  const execId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { command, cwd, env } = request;

  // Spawn via cmd.exe /c to support shell builtins and PATH resolution
  const proc = spawn('cmd.exe', ['/c', command], {
    cwd: cwd || undefined,
    env: { ...process.env, ...env },
    windowsHide: true,
  });

  execRegistry.set(execId, { process: proc, execId, startedAt: new Date().toISOString() });

  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) io.emit('exec:output', { execId, stream: 'stdout', line });
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) io.emit('exec:output', { execId, stream: 'stderr', line });
    }
  });

  proc.on('close', (code) => {
    io.emit('exec:done', { execId, exitCode: code });
    execRegistry.delete(execId);
  });

  return execId;
}

export function killExec(execId: string): boolean {
  const session = execRegistry.get(execId);
  if (!session) return false;
  session.process.kill('SIGKILL');
  execRegistry.delete(execId);
  return true;
}
```

**Why `cmd.exe /c`?** Same reason as existing service spawning — supports batch files, shell builtins (`dir`, `echo`), PATH resolution, pipes.

**Why split on `\r?\n` per chunk?** Chunks may contain multiple lines or partial lines. For simplicity, this approach may split a line across two chunks. Acceptable for a fire-and-forget terminal — we don't need perfect line buffering for this use case.

### 4. Route registration

Register before the generic `/:id` catch-all pattern isn't an issue here since `/exec` is a new top-level path. Both routes are straightforward:

```ts
// NOTE: register /exec/reusable before /exec/:execId/kill if needed
app.post('/api/exec', (req, res) => { ... });
app.post('/api/exec/:execId/kill', (req, res) => { ... });
```

Input validation: `command` must be a non-empty string, max 2000 chars. `cwd` must pass `sanitizeString`. `env` values must all be strings.

### 5. Frontend — `RunCommandPanel.tsx`

A collapsible panel at the bottom of the main content area (or accessible via toolbar button). Contains:

- A text input for the command (full width, monospace font)
- A "Run" button (disabled while a command is running)
- A "Kill" button (shown only while running)
- An output area styled like `LogViewer` — dark background, monospace, scrollable, auto-scroll to bottom
- A status line showing "Running..." or "Exited with code N" (green/red)

State lives in `stores/ui.ts`:

```ts
interface ExecState {
  command: string;          // current input value
  execId: string | null;    // null = not running
  lines: ExecLine[];        // accumulated output
  exitCode: number | null;  // null = still running
}

interface ExecLine {
  stream: 'stdout' | 'stderr';
  line: string;
}
```

When "Run" is clicked:
1. `POST /api/exec` with the command → get `execId`
2. Set `execId` in state, clear `lines`, set `exitCode = null`
3. Socket.IO `exec:output` handler appends to `lines` (filtered by `execId`)
4. Socket.IO `exec:done` handler sets `exitCode`, clears `execId`

When "Kill" is clicked:
1. `POST /api/exec/:execId/kill`
2. Clear `execId` in state immediately (don't wait for `exec:done`)

### 6. Security considerations

The `/api/exec` endpoint runs arbitrary shell commands on the host. WinCTL is a self-hosted, LAN-only tool — this is by design (same threat model as the existing service start/stop). No additional auth is added, consistent with the rest of the API.

Input sanitization still applies: strip null bytes and control characters from `command` and `cwd`. Max command length: 2000 chars.

## Risks / Trade-offs

- **Partial lines on chunk boundaries**: A line split across two `data` events will appear as two short lines in the output. Acceptable for a terminal-style display.
- **No stdin**: Commands that wait for user input will hang until killed. The UI should make this obvious (e.g., note "no interactive input").
- **Broadcast to all clients**: If multiple browser tabs are open, all receive all `exec:output` events. They filter by `execId`, so only the tab that initiated the exec will display it. Other tabs silently receive and discard the events.
