const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config persistence ──────────────────────────────────────────────────────
// Store configs in user's home directory under .winctl
const CONFIG_DIR = path.join(os.homedir(), '.winctl');
const CONFIG_FILE = path.join(CONFIG_DIR, 'services.json');

// Create config directory if it doesn't exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { services: [] };
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { services: [] }; }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// ── Process registry ────────────────────────────────────────────────────────
// Map<id, { process, logs[], startedAt, restartCount, status }>
const registry = new Map();

function getStatus(id) {
  const entry = registry.get(id);
  if (!entry) return 'stopped';
  if (entry.process && !entry.process.killed && entry.process.exitCode === null) return 'running';
  return 'stopped';
}

function broadcastStatus() {
  const config = loadConfig();
  const payload = config.services.map(s => ({
    ...s,
    status: getStatus(s.id),
    pid: registry.get(s.id)?.process?.pid ?? null,
    startedAt: registry.get(s.id)?.startedAt ?? null,
    restartCount: registry.get(s.id)?.restartCount ?? 0,
    recentLogs: (registry.get(s.id)?.logs ?? []).slice(-50),
  }));
  io.emit('status', payload);
}

// ── Kill process on port ───────────────────────────────────────────────────────
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (!port) {
      resolve({ ok: true, msg: 'No port specified' });
      return;
    }
    
    if (os.platform() === 'win32') {
      // Windows: find process using the port and kill it
      exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
        if (error || !stdout) {
          resolve({ ok: true, msg: `No process found on port ${port}` });
          return;
        }
        
        const lines = stdout.split('\n');
        const pids = new Set();
        
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
      // Linux/Mac: use lsof to find and kill process
      exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
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

// ── Kill specific application processes ─────────────────────────────────────────
function killApplicationProcesses(command) {
  return new Promise((resolve) => {
    if (!command) {
      resolve({ ok: true, msg: 'No command specified' });
      return;
    }
    
    const appName = path.basename(command, path.extname(command)).toLowerCase();
    console.log(`Looking for processes matching: ${appName}`);
    
    if (os.platform() === 'win32') {
      // For batch files, kill the batch file process itself, not trying to find .exe
      const isBatchFile = command.endsWith('.bat') || command.endsWith('.cmd') || command.endsWith('.ps1');
      
      if (isBatchFile) {
        // Kill batch file processes by the batch file name
        exec(`taskkill /IM "${appName}" /F`, (error, stdout, stderr) => {
          if (error && !error.message.includes('not found') && !error.message.includes('not running')) {
            console.log(`Taskkill for ${appName} failed:`, { error: error?.message, stdout: stdout?.trim(), stderr: stderr?.trim() });
          } else {
            console.log(`Taskkill result for ${appName}:`, { stdout: stdout?.trim(), stderr: stderr?.trim() });
          }
          
          resolve({ ok: true, msg: `Attempted to kill all ${appName} processes` });
        });
      } else {
        // For executables, kill by .exe name
        exec(`taskkill /IM "${appName}.exe" /F`, (error, stdout, stderr) => {
          if (error && !error.message.includes('not found') && !error.message.includes('not running')) {
            console.log(`Taskkill for ${appName} failed:`, { error: error?.message, stdout: stdout?.trim(), stderr: stderr?.trim() });
          } else {
            console.log(`Taskkill result for ${appName}:`, { stdout: stdout?.trim(), stderr: stderr?.trim() });
          }
          
          // Try PowerShell as fallback for more thorough process killing
          exec(`powershell "Get-Process -Name '${appName}' -ErrorAction SilentlyContinue | Stop-Process -Force"`, (psError, psStdout, psStderr) => {
            if (psError) {
              // PowerShell often fails due to execution policy, but that's okay if taskkill worked
              console.log(`PowerShell fallback for ${appName} skipped (taskkill succeeded)`);
            } else {
              console.log(`PowerShell kill result for ${appName}:`, { stdout: psStdout?.trim(), stderr: psStderr?.trim() });
            }
            
            resolve({ ok: true, msg: `Attempted to kill all ${appName} processes` });
          });
        });
      }
    } else {
      // Linux/Mac: kill by process name
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

// ── Start a service ─────────────────────────────────────────────────────────
async function startService(service, autoRestart = true) {
  if (getStatus(service.id) === 'running') return { ok: false, msg: 'Already running' };

  // Kill any process running on the specified port first
  if (service.port) {
    console.log(`Checking for processes on port ${service.port}...`);
    const portResult = await killProcessOnPort(service.port);
    console.log(`Port cleanup result:`, portResult.msg);
  }

  // Kill all processes with the same application name
  if (service.command) {
    console.log(`Checking for existing ${service.command} processes...`);
    const appResult = await killApplicationProcesses(service.command);
    console.log(`Application cleanup result:`, appResult.msg);
  }

  // Wait a moment for processes to be fully terminated
  await new Promise(resolve => setTimeout(resolve, 2000));

  const args = service.args ? service.args.split(' ').filter(Boolean) : [];
  const cwd = service.cwd || process.cwd();

  let proc;
  try {
    // Use shell: true for batch files and complex commands
    const useShell = service.command.endsWith('.bat') || service.command.endsWith('.cmd') || service.command.endsWith('.ps1');
    
    proc = spawn(service.command, args, {
      cwd,
      env: { ...process.env, ...(service.env || {}) },
      shell: useShell,
      windowsHide: true,
      detached: false,
    });
  } catch (e) {
    return { ok: false, msg: e.message };
  }

  const entry = {
    process: proc,
    logs: [],
    startedAt: new Date().toISOString(),
    restartCount: registry.get(service.id)?.restartCount ?? 0,
  };
  registry.set(service.id, entry);

  const pushLog = (source, data) => {
    const line = `[${source}] ${data.toString().trim()}`;
    entry.logs.push({ t: new Date().toISOString(), line });
    if (entry.logs.length > 500) entry.logs.shift();
    io.emit(`log:${service.id}`, { t: new Date().toISOString(), line });
  };

  proc.stdout.on('data', d => pushLog('OUT', d));
  proc.stderr.on('data', d => pushLog('ERR', d));

  proc.on('exit', (code, signal) => {
    pushLog('SYS', `Process exited (code=${code}, signal=${signal})`);
    broadcastStatus();

    if (autoRestart && service.autoRestart && code !== 0 && !signal) {
      const delay = Math.min(1000 * Math.pow(2, entry.restartCount), 30000);
      pushLog('SYS', `Auto-restarting in ${delay}ms (attempt ${entry.restartCount + 1})`);
      entry.restartCount++;
      setTimeout(() => {
        const cfg = loadConfig();
        const svc = cfg.services.find(s => s.id === service.id);
        if (svc) startService(svc, true);
      }, delay);
    }
  });

  broadcastStatus();
  return { ok: true, pid: proc.pid };
}

function stopService(id) {
  const entry = registry.get(id);
  if (!entry || !entry.process) return { ok: false, msg: 'Not running' };
  
  const pid = entry.process.pid;
  const config = loadConfig();
  const service = config.services.find(s => s.id === id);
  
  console.log(`Attempting to stop service ${id} with PID ${pid}`);
  
  try {
    // Kill all processes with the same application name first
    if (service && service.command) {
      console.log(`Killing all ${service.command} processes...`);
      killApplicationProcesses(service.command).then(result => {
        console.log(`Application kill result:`, result.msg);
      });
    }
    
    // On Windows, try to kill the specific PID but handle errors gracefully
    if (os.platform() === 'win32') {
      // Try taskkill first
      exec(`taskkill /PID ${pid} /T /F`, (error, stdout, stderr) => {
        if (error && !error.message.includes('not found')) {
          console.log(`Taskkill result for PID ${pid}:`, { error: error?.message, stdout: stdout.trim(), stderr: stderr.trim() });
        } else if (error && error.message.includes('not found')) {
          console.log(`Process ${pid} already terminated`);
        } else {
          console.log(`Taskkill successful for PID ${pid}:`, stdout.trim());
        }
      });
      
      // Try PowerShell as fallback for process tree killing
      exec(`powershell "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, (error, stdout, stderr) => {
        if (error) {
          // PowerShell often fails due to execution policy, but that's okay if taskkill worked
          console.log(`PowerShell fallback for PID ${pid} skipped (other methods succeeded)`);
        } else {
          console.log(`PowerShell kill completed for PID ${pid}`);
        }
      });
      
      // Force kill the main process directly
      try {
        entry.process.kill('SIGKILL');
        console.log(`Direct kill sent to PID ${pid}`);
      } catch (e) {
        console.log(`Direct kill failed (process likely already terminated): ${e.message}`);
      }
      
      // Clean up registry immediately
      registry.delete(id);
      broadcastStatus();
      
    } else {
      // Non-Windows systems
      entry.process.kill('SIGTERM');
      
      setTimeout(() => {
        if (registry.has(id)) {
          const currentEntry = registry.get(id);
          if (currentEntry && currentEntry.process && !currentEntry.process.killed) {
            currentEntry.process.kill('SIGKILL');
            console.log(`Force killed service ${id} with SIGKILL`);
          }
          registry.delete(id);
          broadcastStatus();
        }
      }, 2000);
    }
    
    return { ok: true };
  } catch (error) {
    console.error(`Error stopping service ${id}:`, error);
    // Force cleanup even on error
    registry.delete(id);
    broadcastStatus();
    return { ok: false, msg: error.message };
  }
}

// ── REST API ────────────────────────────────────────────────────────────────
app.get('/api/services', (req, res) => {
  const config = loadConfig();
  const data = config.services.map(s => ({
    ...s,
    status: getStatus(s.id),
    pid: registry.get(s.id)?.process?.pid ?? null,
    startedAt: registry.get(s.id)?.startedAt ?? null,
    restartCount: registry.get(s.id)?.restartCount ?? 0,
    recentLogs: (registry.get(s.id)?.logs ?? []).slice(-50),
  }));
  res.json(data);
});

app.post('/api/services', (req, res) => {
  const config = loadConfig();
  const svc = {
    id: Date.now().toString(36),
    name: req.body.name || 'Unnamed',
    command: req.body.command || '',
    args: req.body.args || '',
    cwd: req.body.cwd || '',
    port: req.body.port || '',
    description: req.body.description || '',
    autoRestart: req.body.autoRestart ?? false,
    env: req.body.env || {},
    tags: req.body.tags || [],
    createdAt: new Date().toISOString(),
  };
  config.services.push(svc);
  saveConfig(config);
  broadcastStatus();
  res.json(svc);
});

app.put('/api/services/:id', (req, res) => {
  const config = loadConfig();
  const idx = config.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  config.services[idx] = { ...config.services[idx], ...req.body, id: req.params.id };
  saveConfig(config);
  broadcastStatus();
  res.json(config.services[idx]);
});

app.delete('/api/services/:id', (req, res) => {
  stopService(req.params.id);
  const config = loadConfig();
  config.services = config.services.filter(s => s.id !== req.params.id);
  saveConfig(config);
  registry.delete(req.params.id);
  broadcastStatus();
  res.json({ ok: true });
});

app.post('/api/services/:id/start', async (req, res) => {
  const config = loadConfig();
  const svc = config.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await startService(svc);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services/:id/stop', (req, res) => {
  res.json(stopService(req.params.id));
});

app.post('/api/services/:id/restart', async (req, res) => {
  stopService(req.params.id);
  const config = loadConfig();
  const svc = config.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  setTimeout(async () => {
    try {
      await startService(svc);
    } catch (error) {
      console.error('Restart error:', error);
    }
  }, 500);
  res.json({ ok: true });
});

app.get('/api/services/:id/logs', (req, res) => {
  const entry = registry.get(req.params.id);
  res.json(entry?.logs ?? []);
});

app.get('/api/system', (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    cpus: os.cpus().length,
    loadavg: os.loadavg(),
  });
});

// ── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', socket => {
  broadcastStatus();
  socket.on('subscribe:logs', id => socket.join(`logs:${id}`));
});

// ── Boot: auto-start services marked autoRestart ────────────────────────────
const PORT = process.env.PORT || 3500;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WinCTL running on http://0.0.0.0:${PORT}`);
  const config = loadConfig();
  config.services
    .filter(s => s.autoRestart)
    .forEach(async s => {
      console.log(`Auto-starting: ${s.name}`);
      try {
        await startService(s);
      } catch (error) {
        console.error(`Failed to auto-start ${s.name}:`, error);
      }
    });
});
