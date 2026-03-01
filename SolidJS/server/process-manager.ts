import { spawn, exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { Server } from 'socket.io';
import type { Service, ServiceEntry, LogEntry, MockProcess } from './types.js';
import { loadConfig, loadSettings } from './config.js';

// ── Resolve executable from PATH ───────────────────────────────────────────────

function resolveFromPath(command: string): string | null {
  // Get PATH from current process environment
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);

  // Also search common Windows Program Files directories
  const programFilesDirs: string[] = [];
  if (os.platform() === 'win32') {
    // Add Program Files directories
    const pf = process.env['ProgramFiles'];
    const pf86 = process.env['ProgramFiles(x86)'];
    const pf86Alt = 'C:\\Program Files (x86)';

    if (pf) programFilesDirs.push(pf);
    if (pf86) programFilesDirs.push(pf86);
    if (!pf86 && fs.existsSync(pf86Alt)) programFilesDirs.push(pf86Alt);

    // Add subdirectories of Program Files (for apps like Radmin VPN)
    for (const baseDir of [...programFilesDirs]) {
      try {
        const subDirs = fs.readdirSync(baseDir);
        for (const subDir of subDirs) {
          const fullPath = path.join(baseDir, subDir);
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              programFilesDirs.push(fullPath);
            }
          } catch { /* skip inaccessible */ }
        }
      } catch { /* skip inaccessible */ }
    }
  }

  // Combine PATH directories with Program Files directories
  const allDirs = [...pathDirs, ...programFilesDirs];

  // Try each directory
  for (const dir of allDirs) {
    try {
      const fullPath = path.join(dir, command);
      const extPath = fullPath + '.exe';

      // Check if file exists (with or without .exe extension)
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
      if (fs.existsSync(extPath)) {
        return extPath;
      }
    } catch {
      // Skip directories we can't access
    }
  }

  return null;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, ServiceEntry>();

// Track manually stopped services to prevent auto-restart loops
const manuallyStoppedServices = new Set<string>();

// Socket.IO instance (set via initProcessManager)
let _io: Server | null = null;

// Flag to prevent process killing during startup
let isStartingUp = false;

// ── Init ──────────────────────────────────────────────────────────────────────

export function initProcessManager(io: Server): void {
  _io = io;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function getRegistry(): Map<string, ServiceEntry> {
  return registry;
}

export function getStatus(id: string): string {
  const entry = registry.get(id);
  if (!entry) return 'stopped';
  if (entry.state) return entry.state;
  const proc = entry.process as { exitCode?: number | null; killed?: boolean } | null;
  if (proc?.exitCode !== null && proc?.exitCode !== undefined) return 'stopped';
  if (proc?.killed) return 'stopped';
  return 'running';
}

export function broadcastStatus(): void {
  if (!_io) return;
  const config = loadConfig();
  const settings = loadSettings();
  const payload = {
    services: config.services.map(s => ({
      ...s,
      status: getStatus(s.id),
      stateReason: registry.get(s.id)?.stateReason ?? null,
      pid: registry.get(s.id)?.actualPid ?? (registry.get(s.id)?.process as { pid?: number | null } | null)?.pid ?? null,
      startedAt: registry.get(s.id)?.startedAt ?? null,
      restartCount: registry.get(s.id)?.restartCount ?? 0,
      recentLogs: (registry.get(s.id)?.logs ?? []).slice(-50),
    })),
    folders: config.folders || [],
    settings
  };
  _io.emit('status', payload);
}

// ── Port utilities ────────────────────────────────────────────────────────────

export async function checkPort(port: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

export async function getPidOnPort(port: string): Promise<number | null> {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      const match = stdout.match(/\s+(\d+)\s*$/m);
      resolve(match ? parseInt(match[1], 10) : null);
    });
  });
}

export async function getPidFromPort(port: string): Promise<number | null> {
  return new Promise(resolve => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      const match = stdout.match(/LISTENING\s+(\d+)/);
      resolve(match ? parseInt(match[1], 10) : null);
    });
  });
}

export async function killProcessOnPort(port: string): Promise<{ ok: boolean; msg: string }> {
  return new Promise((resolve) => {
    if (!port) {
      resolve({ ok: true, msg: 'No port specified' });
      return;
    }

    // Skip killing if we're the daemon process trying to kill ourselves
    if (process.env.WINCTL_DAEMON === '1') {
      console.log(`[PORT] Daemon detected, skipping port ${port} cleanup to avoid self-termination`);
      resolve({ ok: true, msg: 'Daemon skipping port cleanup' });
      return;
    }

    if (os.platform() === 'win32') {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve({ ok: true, msg: `No process found on port ${port}` });
          return;
        }

        const lines = stdout.split('\n');
        const pids = new Set<string>();

        lines.forEach(line => {
          const match = line.match(/\s+(\d+)$/);
          if (match) {
            pids.add(match[1]);
          }
        });

        if (pids.size === 0) {
          resolve({ ok: true, msg: `No process found on port ${port}` });
          return;
        }

        let killed = 0;
        pids.forEach(pid => {
          exec(`taskkill /PID ${pid} /F`, (killError, killStdout, killStderr) => {
            killed++;
            console.log(`Killed PID ${pid} on port ${port}:`, {
              error: killError?.message,
              stdout: killStdout?.trim(),
              stderr: killStderr?.trim()
            });

            if (killed === pids.size) {
              resolve({ ok: true, msg: `Killed ${pids.size} process(es) on port ${port}` });
            }
          });
        });
      });
    } else {
      exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout) => {
        if (error) {
          resolve({ ok: true, msg: `No process found on port ${port}` });
          return;
        }
        console.log(`Killed process(es) on port ${port}:`, stdout.trim());
        resolve({ ok: true, msg: `Killed process(es) on port ${port}` });
      });
    }
  });
}

// ── Process name utilities ────────────────────────────────────────────────────

export async function getPidByProcessName(name: string): Promise<number | null> {
  return new Promise((resolve) => {
    exec(`tasklist /FI "IMAGENAME eq ${name}*" /FO CSV /NH`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      const lines = stdout.trim().split('\n');
      if (lines.length > 0) {
        const match = lines[0].match(/"([^"]+)","(\d+)"/);
        if (match) {
          resolve(parseInt(match[2], 10));
          return;
        }
      }
      resolve(null);
    });
  });
}

export async function getAhkPidByScript(scriptPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const scriptBase = path.basename(scriptPath);
    // WMI requires escaping backslashes, but basename is simpler and usually unique enough
    exec(`wmic process where "name like '%AutoHotkey%' and commandline like '%${scriptBase}%'" get processid /format:value`, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      const match = stdout.match(/ProcessId=(\d+)/);
      resolve(match ? parseInt(match[1], 10) : null);
    });
  });
}

async function checkPidRunning(pid: number): Promise<boolean> {
  if (!pid) return false;
  return new Promise((resolve) => {
    exec(`tasklist /FI "PID eq ${pid}" /NH`, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
        return;
      }
      resolve(stdout.includes(pid.toString()));
    });
  });
}

// ── Process name map ──────────────────────────────────────────────────────────

const PROCESS_NAME_MAP: Record<string, string> = {
  'komorebic': 'komorebi.exe',
  'komorebic.exe': 'komorebi.exe',
  'powertoys': 'PowerToys.exe',
  'PowerToys.exe': 'PowerToys.exe',
  'sefirah': 'Sefirah.exe',
  'Sefirah.exe': 'Sefirah.exe'
};

function getExeNameForService(service: Service): string {
  const cmd = service.command.toLowerCase();
  if (cmd.endsWith('.ahk')) return 'AutoHotkey64.exe';
  if (PROCESS_NAME_MAP[cmd]) return PROCESS_NAME_MAP[cmd];
  if (PROCESS_NAME_MAP[service.command]) return PROCESS_NAME_MAP[service.command];
  if (cmd.endsWith('.exe')) return path.basename(service.command);
  return '';
}

// ── Kill application processes ────────────────────────────────────────────────

export function killApplicationProcesses(command: string): Promise<{ ok: boolean; msg: string }> {
  return new Promise((resolve) => {
    if (!command) {
      resolve({ ok: true, msg: 'No command specified' });
      return;
    }

    if (isStartingUp) {
      console.log('Skipping process kill during startup');
      resolve({ ok: true, msg: 'Skipped during startup' });
      return;
    }

    const isBatchFile = command.endsWith('.bat') || command.endsWith('.cmd') || command.endsWith('.ps1');
    const isAhk = command.toLowerCase().endsWith('.ahk');

    if (os.platform() === 'win32') {
      if (isBatchFile) {
        const batchName = path.basename(command);
        console.log(`Looking for cmd.exe processes running ${batchName}`);

        exec(`wmic process where "name='cmd.exe' and commandline like '%${batchName}%'" get processid /format:value`, (error, stdout) => {
          if (!error && stdout.includes('ProcessId')) {
            const pids = stdout.match(/ProcessId=(\d+)/g);
            if (pids && pids.length > 0) {
              pids.forEach(pidLine => {
                const pid = pidLine.split('=')[1];
                console.log(`Killing cmd.exe PID ${pid} running ${batchName}`);
                exec(`taskkill /PID ${pid} /F`, (killError, killStdout, killStderr) => {
                  console.log(`Kill result for PID ${pid}:`, {
                    error: killError?.message,
                    stdout: killStdout?.trim(),
                    stderr: killStderr?.trim()
                  });
                });
              });
              resolve({ ok: true, msg: `Killed ${pids.length} cmd.exe processes running ${batchName}` });
            } else {
              resolve({ ok: true, msg: `No processes found running ${batchName}` });
            }
          } else {
            resolve({ ok: true, msg: `No processes found running ${batchName}` });
          }
        });
      } else if (isAhk) {
        getAhkPidByScript(command).then(pid => {
          if (pid) {
            exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
              console.log(`Taskkill WMI PID ${pid} for ${command}:`, { stdout: stdout?.trim(), stderr: stderr?.trim() });
              resolve({ ok: true, msg: `Killed AHK process with PID ${pid}` });
            });
          } else {
            resolve({ ok: true, msg: `No AHK process found running ${command}` });
          }
        });
      } else {
        const exeName = path.basename(command);
        const exeWithoutExt = path.basename(command, '.exe');

        exec(`taskkill /IM "${exeName}" /F`, (error, stdout, stderr) => {
          console.log(`Taskkill result for ${exeName}:`, { stdout: stdout?.trim(), stderr: stderr?.trim() });

          if (error && error.message.includes('not found')) {
            exec(`taskkill /IM "${exeWithoutExt}.exe" /F`, (error2, stdout2, stderr2) => {
              console.log(`Taskkill result for ${exeWithoutExt}.exe:`, { stdout: stdout2?.trim(), stderr: stderr2?.trim() });

              exec(`powershell "Get-Process -Name '${exeWithoutExt}' -ErrorAction SilentlyContinue | Stop-Process -Force"`, (psError, psStdout, psStderr) => {
                if (!psError) {
                  console.log(`PowerShell kill result for ${exeWithoutExt}:`, { stdout: psStdout?.trim(), stderr: psStderr?.trim() });
                }
                resolve({ ok: true, msg: `Attempted to kill all ${exeName} processes` });
              });
            });
          } else {
            resolve({ ok: true, msg: `Attempted to kill all ${exeName} processes` });
          }
        });
      }
    } else {
      const appName = path.basename(command, path.extname(command));
      exec(`pkill -f "${appName}" || killall "${appName}"`, (error, stdout, stderr) => {
        console.log(`Killed ${appName} processes:`, {
          error: error?.message,
          stdout: stdout?.trim(),
          stderr: stderr?.trim()
        });
        resolve({ ok: true, msg: `Attempted to kill all ${appName} processes` });
      });
    }
  });
}

// ── Port verification ─────────────────────────────────────────────────────────

async function verifyPortAndCapturePid(service: Service, entry: ServiceEntry, attempts = 0): Promise<void> {
  if (attempts >= 20) return;
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  await new Promise(r => setTimeout(r, 500));

  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  const portOpen = await checkPort(service.port);

  if (portOpen) {
    const pid = await getPidOnPort(service.port);
    if (pid) {
      entry.actualPid = pid;
      console.log(`Captured actual PID ${pid} for ${service.id} on port ${service.port}`);
    }
    entry.stateReason = 'Port confirmed open';
    broadcastStatus();
    return;
  }

  const proc = entry.process as { exitCode?: number | null; killed?: boolean } | null;
  if (proc?.exitCode !== null && proc?.exitCode !== undefined || proc?.killed) {
    entry.state = 'stopped';
    entry.stateReason = 'Process exited during startup';
    broadcastStatus();
    return;
  }

  verifyPortAndCapturePid(service, entry, attempts + 1);
}

async function capturePidByName(service: Service, entry: ServiceEntry): Promise<void> {
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  const cmd = service.command.toLowerCase();
  let exeName = '';

  if (cmd.endsWith('.ahk')) {
    const pid = await getAhkPidByScript(service.command);
    if (pid) {
      entry.actualPid = pid;
      console.log(`Captured PID ${pid} for ${service.id} by AHK script name`);
      broadcastStatus();
    }
    return;
  } else if (PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command]) {
    exeName = PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command];
  } else if (cmd.endsWith('.exe')) {
    exeName = path.basename(service.command);
  } else if (cmd.endsWith('.bat') || cmd.endsWith('.cmd')) {
    exeName = path.basename(service.command, path.extname(service.command));
  } else {
    exeName = service.command.split(' ')[0];
  }

  if (exeName) {
    const pid = await getPidByProcessName(exeName);
    if (pid) {
      entry.actualPid = pid;
      console.log(`Captured PID ${pid} for ${service.id} by name '${exeName}'`);
      broadcastStatus();
    }
  }
}

// ── Periodic status check ─────────────────────────────────────────────────────

async function verifyProcessAlive(service: Service, entry: ServiceEntry): Promise<void> {
  if (!entry || entry.state === 'starting' || entry.state === 'stopping') return;

  let isAlive = false;
  let actualPid: number | null = null;

  if (service.port) {
    const portOpen = await checkPort(service.port);
    if (portOpen) {
      isAlive = true;
      actualPid = await getPidOnPort(service.port);
    }
  } else if (entry.actualPid) {
    isAlive = await checkPidRunning(entry.actualPid);
    // If actualPid died but it's an AHK script, try to re-detect it just in case
    if (!isAlive && service.command.toLowerCase().endsWith('.ahk')) {
      actualPid = await getAhkPidByScript(service.command);
      if (actualPid) {
        isAlive = true;
        entry.actualPid = actualPid;
      }
    }
  } else {
    const cmd = service.command.toLowerCase();

    if (cmd.endsWith('.ahk')) {
      // For AHK scripts, ignore proc.pid because the launcher exits. Rely purely on WMI.
      actualPid = await getAhkPidByScript(service.command);
      if (actualPid) {
        isAlive = true;
        entry.actualPid = actualPid;
      }
    } else {
      const proc = entry.process as { pid?: number | null } | null;
      if (proc?.pid) {
        isAlive = await checkPidRunning(proc.pid);
      } else {
        let exeName = '';

        if (PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command]) {
          exeName = PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command];
        }

        if (exeName) {
          actualPid = await getPidByProcessName(exeName);
          if (actualPid) {
            isAlive = true;
            entry.actualPid = actualPid;
          }
        }
      }
    }
  }

  const wasRunning = entry.state === 'running';

  if (wasRunning && !isAlive) {
    entry.state = 'stopped';
    entry.stateReason = 'Process died externally';
    entry.logs.push({ t: new Date().toISOString(), line: '[SYS] Process stopped (detected externally)' });
    broadcastStatus();
  } else if (!wasRunning && isAlive) {
    entry.state = 'running';
    entry.stateReason = 'Process detected running';
    if (actualPid) entry.actualPid = actualPid;
    if (!entry.startedAt) entry.startedAt = new Date().toISOString();
    entry.logs.push({ t: new Date().toISOString(), line: '[SYS] Process detected as running' });
    broadcastStatus();
  } else if (isAlive && actualPid && actualPid !== entry.actualPid) {
    entry.actualPid = actualPid;
  }
}

async function periodicStatusCheck(): Promise<void> {
  const config = loadConfig();
  for (const service of config.services) {
    let entry = registry.get(service.id);

    if (!entry) {
      let isRunning = false;
      let actualPid: number | null = null;

      if (service.port) {
        const portOpen = await checkPort(service.port);
        if (portOpen) {
          isRunning = true;
          actualPid = await getPidOnPort(service.port);
        }
      }

      if (!isRunning) {
        const cmd = service.command.toLowerCase();
        let exeName = '';

        if (cmd.endsWith('.ahk')) {
          actualPid = await getAhkPidByScript(service.command);
          if (actualPid) {
            isRunning = true;
          }
        } else {
          if (PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command]) {
            exeName = PROCESS_NAME_MAP[cmd] || PROCESS_NAME_MAP[service.command];
          }

          if (exeName) {
            actualPid = await getPidByProcessName(exeName);
            if (actualPid) {
              isRunning = true;
            }
          }
        }
      }

      if (isRunning) {
        entry = {
          process: null,
          logs: [{ t: new Date().toISOString(), line: '[SYS] Detected running process' }],
          startedAt: new Date().toISOString(),
          restartCount: 0,
          state: 'running',
          stateReason: 'Detected on startup',
          actualPid
        };
        registry.set(service.id, entry);
        broadcastStatus();
        continue;
      }
      continue;
    }

    if (entry.state === 'running' || entry.state === 'stopped' || !entry.state) {
      await verifyProcessAlive(service, entry);
    }
  }
}

setInterval(periodicStatusCheck, 15000);

// ── Start service ─────────────────────────────────────────────────────────────

export async function startService(service: Service, autoRestart = true): Promise<{ ok: boolean; msg?: string; pid?: number | null }> {
  // Clear manually stopped flag so user can restart a service
  manuallyStoppedServices.delete(service.id);

  const currentState = getStatus(service.id);
  if (currentState === 'running') return { ok: false, msg: 'Already running' };
  if (currentState === 'starting') return { ok: false, msg: 'Already starting' };

  // Clear any stale entry
  registry.delete(service.id);

  // Check if process is already running before attempting to start
  const exeName = getExeNameForService(service);

  if (exeName) {
    const existingPid = await getPidByProcessName(exeName);
    if (existingPid) {
      const mockKill = (): void => {
        mockProc.killed = true;
        mockProc.exitCode = 0;
        const e = registry.get(service.id);
        if (e) {
          e.state = 'stopped';
          e.stateReason = 'Stopped by user';
        }
        registry.delete(service.id);
        broadcastStatus();
      };
      const mockProc: MockProcess = { pid: null, killed: false, exitCode: null, kill: mockKill };
      const entry: ServiceEntry = {
        process: mockProc,
        logs: [],
        startedAt: new Date().toISOString(),
        restartCount: 0,
        state: 'running',
        stateReason: 'Process detected running',
        actualPid: existingPid
      };
      registry.set(service.id, entry);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Process detected running with PID ${existingPid}` });
      broadcastStatus();
      return { ok: true, msg: 'Process was already running', pid: existingPid };
    }
  }

  // Create entry with starting state immediately
  const entry: ServiceEntry = {
    process: null,
    logs: [],
    startedAt: null,
    restartCount: 0,
    state: 'starting',
    stateReason: 'Initializing...'
  };
  registry.set(service.id, entry);
  broadcastStatus();

  // Only kill processes on port if specified
  if (service.port) {
    entry.stateReason = 'Cleaning port...';
    broadcastStatus();
    console.log(`Checking for processes on port ${service.port}...`);
    const portResult = await killProcessOnPort(service.port);
    console.log(`Port cleanup result:`, portResult.msg);
  }

  console.log(`Starting service: ${service.name}`);

  const args = service.args ? service.args.split(' ').filter(Boolean) : [];
  const cleanCmd = service.command.replace(/"/g, ''); // Keep original casing for path resolution

  // ── 2. Working Directory Resolution ──
  let defaultCwd = process.cwd();
  if (path.isAbsolute(cleanCmd) && fs.existsSync(cleanCmd)) {
    defaultCwd = path.dirname(cleanCmd);
  }
  const cwd = service.cwd || defaultCwd;

  const cmdLower = cleanCmd.toLowerCase();
  const isBatchFile = cmdLower.endsWith('.bat') || cmdLower.endsWith('.cmd');
  const isPsFile = cmdLower.endsWith('.ps1');
  const isExe = cmdLower.endsWith('.exe');
  const isShortcut = cmdLower.endsWith('.url') || cmdLower.endsWith('.lnk');
  const isAhk = cmdLower.endsWith('.ahk');
  // minimized flag only applies to .exe files
  const minimized = service.minimized && isExe;

  let proc: ReturnType<typeof spawn> | null = null;

  try {
    entry.stateReason = 'Spawning process...';
    broadcastStatus();

    if (isBatchFile && os.platform() === 'win32') {
      // ── FIX: Use explicit cmd.exe /c with shell: false — no CMD flash ──────
      // Pass the batch file path and args as separate arguments to cmd.exe
      const cmdPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'cmd.exe');
      const spawnArgs = ['/c', service.command, ...args];

      console.log(`[BATCH] Starting hidden: ${cmdPath} /c "${service.command}" ${args.join(' ')}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting hidden batch: ${service.command}` });

      proc = spawn(cmdPath, spawnArgs, {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: false,       // No shell wrapper — prevents CMD flash
        windowsHide: true,  // Hide any window
        detached: false,    // Keep attached so we can track it
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      entry.process = proc;

    } else if (isPsFile && os.platform() === 'win32') {
      // ── PowerShell scripts ────────────────────────────────────────────────
      const psPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const spawnArgs = ['-ExecutionPolicy', 'Bypass', '-File', service.command, ...args];

      console.log(`[PS] Starting PowerShell script: ${service.command}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting PowerShell script: ${service.command}` });

      proc = spawn(psPath, spawnArgs, {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: false,
        windowsHide: true,
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      entry.process = proc;

    } else if (minimized && os.platform() === 'win32') {
      // ── FIX: .exe with minimized flag — use windowsHide: true, no nircmd ──
      // Native windowsHide is sufficient; no nircmd dependency needed
      console.log(`[MINIMIZED] Starting hidden exe: ${service.command}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting minimized process: ${service.command}` });

      proc = spawn(service.command, args, {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: false,       // No shell — prevents CMD flash
        windowsHide: true,  // Hide window natively
        detached: true,     // Detach so it runs independently
        stdio: 'ignore',    // Can't capture logs from detached
      });

      proc.unref();

      // Create a mock process object for status tracking since we can't track detached
      const mockKill = (): void => {
        console.log(`[KILL] Terminating minimized process: ${service.command}`);
        entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Terminating minimized process: ${service.command}` });
        const exeBaseName = path.basename(service.command);
        exec(`taskkill /IM "${exeBaseName}" /F`, (error, stdout, stderr) => {
          if (error) {
            console.log(`[KILL] Error terminating ${service.command}:`, error.message);
            entry.logs.push({ t: new Date().toISOString(), line: `[ERR] Failed to terminate: ${error.message}` });
          } else {
            console.log(`[KILL] Successfully terminated ${service.command}`);
            entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Process terminated successfully` });
          }
        });
        mockProc.killed = true;
        mockProc.exitCode = 0;
        registry.delete(service.id);
        broadcastStatus();
      };
      const mockProc: MockProcess = { pid: proc.pid ?? null, killed: false, exitCode: null, kill: mockKill };
      entry.process = mockProc;

    } else if (isAhk && os.platform() === 'win32') {
      // ── AutoHotkey scripts ────────────────────────────────────────────────
      console.log(`[AHK] Starting AutoHotkey script: ${service.command}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting AutoHotkey script: ${service.command}` });

      // ── 1.2 Runner Mapping ──
      const ahkRunner = 'AutoHotkey.exe';
      const spawnArgs = [service.command, ...args];

      proc = spawn(ahkRunner, spawnArgs, {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: false,
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      });

      proc.unref();
      entry.process = proc;

    } else if (isShortcut && os.platform() === 'win32') {
      // ── Windows Shortcuts (.url, .lnk) ────────────────────────────────────
      console.log(`[SHORTCUT] Starting Windows shortcut: ${service.command}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting shortcut: ${service.command}` });

      const explorerPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'explorer.exe');

      proc = spawn(explorerPath, [service.command], {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: false,       // Explorer natively handles the .lnk file
        windowsHide: true,
        detached: true,     // Hand off to the shell handler
        stdio: 'ignore',
      });

      proc.unref();

      // Shortcuts spawn the target app and the proxy shell dies immediately.
      // We mark them as "MockProcess" so they appear running, but we can't reliably
      // track the actual spawned game/app PID unless it has a dedicated port.
      const mockKill = (): void => {
        mockProc.killed = true;
        mockProc.exitCode = 0;
        registry.delete(service.id);
        broadcastStatus();
      };
      const mockProc: MockProcess = { pid: null, killed: false, exitCode: null, kill: mockKill };
      entry.process = mockProc;

    } else {
      // ── Regular commands (node, python, ollama, etc.) ─────────────────────
      // FIX: Resolve executable from PATH and spawn directly with shell: false
      // This prevents CMD window flash while still finding executables in PATH
      const spawnEnv = {
        ...process.env,
        ...(service.env || {}),
      };

      // Try to resolve the command from PATH
      let resolvedCommand = service.command;
      const cmdLower = service.command.toLowerCase();

      // Only try to resolve if it doesn't contain path separators and doesn't end with .exe
      if (!cmdLower.includes('\\') && !cmdLower.includes('/') && !cmdLower.endsWith('.exe')) {
        const resolved = resolveFromPath(service.command);
        if (resolved) {
          resolvedCommand = resolved;
          console.log(`[CMD] Resolved '${service.command}' to '${resolved}'`);
        }
      }

      console.log(`[CMD] Starting: ${resolvedCommand} ${args.join(' ')}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting: ${resolvedCommand}` });

      // Try spawn with shell: false first
      let spawnError: Error | null = null;

      proc = spawn(resolvedCommand, args, {
        cwd,
        env: spawnEnv,
        shell: false,
        windowsHide: true,
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Add error handler for spawn failures
      proc.on('error', (err: Error) => {
        spawnError = err;
        console.log(`[CMD] Spawn attempt failed: ${err.message}`);
      });

      entry.process = proc;
    }

    // Add error handler for spawn failures (only for non-mock processes)
    if (proc) {
      proc.on('error', (err: Error) => {
        console.log(`Spawn error for ${service.id}:`, err.message);
        entry.state = 'stopped';
        entry.stateReason = `Spawn error: ${err.message}`;
        entry.logs.push({ t: new Date().toISOString(), line: `[ERR] Failed to start: ${err.message}` });
        broadcastStatus();
      });
    }

  } catch (e) {
    entry.state = 'stopped';
    entry.stateReason = `Exception: ${(e as Error).message}`;
    broadcastStatus();
    return { ok: false, msg: (e as Error).message };
  }

  // Set running state after successful spawn
  entry.startedAt = new Date().toISOString();
  entry.state = 'running';
  entry.stateReason = 'Process spawned';
  broadcastStatus();

  // Capture logs if we have a real process with stdio pipes
  const isDetachedNoLogs = (minimized || isAhk) && os.platform() === 'win32';

  if (!isDetachedNoLogs && proc && proc.stdout && proc.stderr) {
    const pushLog = (source: string, data: Buffer | string): void => {
      const line = data.toString().trim();
      if (!line) return;
      console.log(`[LOG:${service.id}] ${line}`);

      // Smart log level detection
      let logLevel = source;
      if (source === 'ERR') {
        if (line.includes('level=ERROR') || line.includes('level=FATAL') ||
          line.includes('[ERR]') || line.includes('ERROR:') ||
          line.includes('FATAL:') || line.includes('panic:') ||
          line.includes('fatal:') || line.includes('error:')) {
          logLevel = 'ERR';
        } else {
          // Default stderr content to INFO unless it looks like an error
          logLevel = 'INFO';
        }
      }

      const logEntry: LogEntry = { t: new Date().toISOString(), line: `[${logLevel}] ${line}` };
      entry.logs.push(logEntry);
      if (entry.logs.length > 500) entry.logs.shift();
      if (_io) _io.emit(`log:${service.id}`, logEntry);
    };

    proc.stdout.on('data', (d: Buffer) => pushLog('OUT', d));
    proc.stderr.on('data', (d: Buffer) => pushLog('ERR', d));

    proc.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      pushLog('SYS', `Process exited (code=${code}, signal=${signal})`);
      entry.state = 'stopped';
      entry.stateReason = signal ? `Killed by signal ${signal}` : `Exited with code ${code}`;
      broadcastStatus();

      // Auto-restart logic:
      // 1. autoRestart must be enabled for this service
      // 2. Service was NOT manually stopped by the user
      // 3. Process exited with non-zero code (crash) OR was killed
      if (autoRestart && service.autoRestart && !manuallyStoppedServices.has(service.id)) {
        if (code !== 0 || signal) {
          const delay = Math.min(1000 * Math.pow(2, entry.restartCount), 30000);
          pushLog('SYS', `Auto-restarting in ${delay}ms (attempt ${entry.restartCount + 1})`);
          entry.restartCount++;
          setTimeout(() => {
            const cfg = loadConfig();
            const svc = cfg.services.find(s => s.id === service.id);
            if (svc) startService(svc, true);
          }, delay);
        }
      }
    });

  } else if (proc) {
    // Detached process — just track exit
    proc.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      console.log(`Detached process ${service.id} exited (code=${code}, signal=${signal})`);

      const isAhkDetect = service.command.toLowerCase().endsWith('.ahk');
      if (isAhkDetect) {
        console.log(`[AHK] Ignored launcher exit for ${service.id}, deferring to WMI tracking`);
        return;
      }

      const mockProc = entry.process as MockProcess | null;
      if (mockProc) {
        mockProc.killed = true;
        mockProc.exitCode = code;
      }
      entry.state = 'stopped';
      entry.stateReason = signal ? `Killed by signal ${signal}` : `Exited with code ${code}`;
      broadcastStatus();
    });
  }

  // Verify port and capture actual PID for port-based services
  if (service.port && entry.state === 'running') {
    verifyPortAndCapturePid(service, entry);
  } else if (entry.state === 'running') {
    // For non-port services, try to find actual PID by process name
    setTimeout(() => capturePidByName(service, entry), 2000);
  }

  return { ok: true, pid: proc?.pid ?? null };
}

// ── Stop service ──────────────────────────────────────────────────────────────

export async function stopService(id: string): Promise<{ ok: boolean; msg?: string }> {
  let entry = registry.get(id);
  const config = loadConfig();
  const service = config.services.find(s => s.id === id);

  if (!entry && !service) return { ok: false, msg: 'Not found' };

  // Create entry if missing (for externally started processes)
  if (!entry) {
    entry = {
      process: null,
      logs: [],
      startedAt: null,
      restartCount: 0,
      state: 'running',
      stateReason: 'Detected externally'
    };
    registry.set(id, entry);
  }

  // Set stopping state immediately
  entry.state = 'stopping';
  entry.stateReason = 'Stopping...';
  broadcastStatus();

  // Get actual PID — prefer actualPid, then port-based PID, then process PID
  let pid: number | null = entry.actualPid ?? null;
  if (!pid && service?.port) {
    pid = await getPidOnPort(service.port);
    entry.actualPid = pid;
  }
  if (!pid) {
    const proc = entry.process as { pid?: number | null } | null;
    if (proc?.pid) pid = proc.pid;
  }

  if (!pid && service && service.command.toLowerCase().endsWith('.ahk')) {
    pid = await getAhkPidByScript(service.command);
    if (pid) entry.actualPid = pid;
  }

  console.log(`Stopping service ${id}, PID: ${pid}, port: ${service?.port}`);

  // Mark as manually stopped to prevent auto-restart
  manuallyStoppedServices.add(id);

  if (os.platform() === 'win32') {
    // Kill by port first if available (most reliable for shell-spawned processes)
    if (service?.port) {
      await new Promise<void>((resolve) => {
        exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${service.port} ^| findstr LISTENING') do taskkill /PID %a /F`, (err, stdout, stderr) => {
          console.log(`Killed process on port ${service.port}:`, stdout?.trim() || stderr?.trim() || 'done');
          resolve();
        });
      });
    }

    // Kill by PID if we have one
    if (pid) {
      await new Promise<void>((resolve) => {
        exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
          if (err && !err.message.includes('not found')) {
            console.log(`Taskkill error:`, err.message);
          } else {
            console.log(`Taskkill PID ${pid}: done`);
          }
          resolve();
        });
      });
    }

    // Also try killing the Node.js child process handle
    try {
      const proc = entry.process;
      if (proc && typeof (proc as { kill?: (sig: string) => void }).kill === 'function') {
        const mockProc = proc as MockProcess;
        if (!mockProc.killed) {
          (proc as { kill: (sig: string) => void }).kill('SIGKILL');
        }
      }
    } catch { /* ignore */ }

  } else {
    // Non-Windows
    const proc = entry.process;
    if (proc && typeof (proc as { kill?: (sig: string) => void }).kill === 'function') {
      (proc as { kill: (sig: string) => void }).kill('SIGTERM');
    }
    if (pid) {
      await new Promise<void>(r => setTimeout(r, 2000));
      exec(`kill -9 ${pid} 2>/dev/null || true`);
    }
  }

  // Set stopped state
  entry.state = 'stopped';
  entry.stateReason = 'Stopped by user';
  entry.actualPid = null;
  registry.delete(id);
  broadcastStatus();

  return { ok: true };
}

// ── Startup detection ─────────────────────────────────────────────────────────

export async function detectRunningProcesses(): Promise<void> {
  isStartingUp = true;
  const config = loadConfig();

  for (const service of config.services) {
    let isRunning = false;
    let detectedPid: number | null = null;
    let stateReason: string | null = null;

    // Primary: Check by port (most reliable)
    if (service.port) {
      const portOpen = await checkPort(service.port);
      if (portOpen) {
        isRunning = true;
        stateReason = 'Port detected listening';
        const portPid = await getPidFromPort(service.port);
        if (portPid) detectedPid = portPid;
        console.log(`Detected running service by port ${service.port}: ${service.name}${detectedPid ? ` (PID: ${detectedPid})` : ''}`);
      }
    }

    // Secondary: Check by exe name (Windows)
    if (!isRunning && os.platform() === 'win32' && service.command) {
      const cmdLower = service.command.toLowerCase();
      const isExe = cmdLower.endsWith('.exe');
      const isAhk = cmdLower.endsWith('.ahk');

      if (isAhk) {
        const pid = await getAhkPidByScript(service.command);
        if (pid) {
          isRunning = true;
          stateReason = 'AHK script detected running';
          detectedPid = pid;
          console.log(`Detected running AHK script: ${service.name} (PID: ${pid})`);
        }
      } else if (isExe) {
        const exeBaseName = path.basename(service.command);
        const stdout = await new Promise<string>(resolve => {
          exec(`tasklist /FI "IMAGENAME eq ${exeBaseName}" /FO CSV /NH`, (err, out) => resolve(out || ''));
        });
        if (stdout.toLowerCase().includes(exeBaseName.toLowerCase())) {
          isRunning = true;
          stateReason = 'Process detected running';
          const match = stdout.match(/"([^"]+)","(\d+)"/);
          if (match) detectedPid = parseInt(match[2], 10);
          console.log(`Detected running exe: ${service.name}${detectedPid ? ` (PID: ${detectedPid})` : ''}`);
        }
      }
    }

    if (isRunning) {
      registry.set(service.id, {
        process: detectedPid
          ? { pid: detectedPid, killed: false, exitCode: null, kill: () => { } }
          : { pid: null, killed: false, exitCode: null, kill: () => { } },
        logs: [{ t: new Date().toISOString(), line: '[SYS] Process detected running on WinCTL startup' }],
        startedAt: new Date().toISOString(),
        restartCount: 0,
        state: 'running',
        stateReason: stateReason ?? 'Detected on startup',
        actualPid: detectedPid
      });
    }
  }

  // Start services with autoStart: true that are not already running
  console.log('Starting auto-start services...');
  for (const service of config.services) {
    if (service.autoStart && getStatus(service.id) === 'stopped') {
      console.log(`Auto-starting service: ${service.name}`);
      try {
        await startService(service, false); // Don't auto-restart auto-started services
        console.log(`Successfully auto-started: ${service.name}`);
      } catch (error) {
        console.error(`Failed to auto-start ${service.name}:`, (error as Error).message);
      }
    }
  }

  isStartingUp = false;
  console.log('Startup process detection complete');
  broadcastStatus();
}
