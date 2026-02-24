const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

// System tray support
let systray;
try {
  systray = require('systray');
} catch (e) {
  console.log('Systray not available:', e.message);
}

// Helper function to properly quote Windows paths and arguments
function quoteWindowsPath(str) {
  if (!str) return str;
  // If the string contains spaces and isn't already quoted
  if (str.includes(' ') && !str.startsWith('"') && !str.endsWith('"')) {
    return `"${str}"`;
  }
  return str;
}

// Helper function to escape arguments for PowerShell
function escapePowerShellArg(arg) {
  if (!arg) return '""';
  // Escape single quotes by doubling them and wrap in single quotes
  return `'${arg.replace(/'/g, "''")}'`;
}

// Helper function to kill a process by executable name
function killProcessByName(exePath, callback) {
  const exeName = path.basename(exePath, '.exe');
  const killCmd = `taskkill /IM "${path.basename(exePath)}" /F 2>nul || taskkill /IM "${exeName}.exe" /F 2>nul`;
  exec(killCmd, callback);
}

// Input validation to prevent command injection
function sanitizeString(str, allowEmpty = false) {
  if (!str) return allowEmpty ? '' : null;
  if (typeof str !== 'string') return null;
  // Remove null bytes and control characters except newlines/tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 10000);
}

function validatePort(port) {
  if (!port) return null; // No port is OK
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
  return portNum.toString();
}

function validateServiceInput(service) {
  const errors = [];
  
  const name = sanitizeString(service.name);
  if (!name) errors.push('Invalid service name');
  
  const command = sanitizeString(service.command);
  if (!command) errors.push('Invalid command');
  
  const port = validatePort(service.port);
  if (service.port && !port) errors.push('Invalid port number');
  
  const args = sanitizeString(service.args, true);
  const cwd = sanitizeString(service.cwd, true);
  const description = sanitizeString(service.description, true);
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      id: service.id,
      name,
      command,
      args: args || '',
      cwd: cwd || '',
      port: port || '',
      description: description || '',
      autoRestart: Boolean(service.autoRestart),
      env: service.env || {},
      tags: Array.isArray(service.tags) ? service.tags : [],
      minimized: Boolean(service.minimized)
    }
  };
}

// ── Autostart (Windows Registry) ───────────────────────────────────────────────
function getExePath() {
  if (process.execPath.endsWith('node.exe')) {
    return process.execPath;
  }
  return process.execPath;
}

function isAutostartEnabled() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve(false);
      return;
    }
    const exePath = getExePath();
    const regCmd = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL`;
    exec(regCmd, (err, stdout) => {
      resolve(!err && stdout.includes('WinCTL'));
    });
  });
}

function enableAutostart() {
  return new Promise((resolve, reject) => {
    if (os.platform() !== 'win32') {
      reject(new Error('Autostart only supported on Windows'));
      return;
    }
    const exePath = getExePath();
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL /t REG_SZ /d "\\"${exePath}\\" --minimized --autostart" /f`;
    exec(regCmd, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Autostart enabled');
        resolve();
      }
    });
  });
}

function disableAutostart() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve();
      return;
    }
    const regCmd = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL /f`;
    exec(regCmd, () => {
      console.log('Autostart disabled');
      resolve();
    });
  });
}

// Hide console window on Windows if minimized flag is set
if (os.platform() === 'win32' && process.argv.includes('--minimized')) {
  // Use VBScript to hide the console window
  const vbsPath = path.join(__dirname, 'hide_console.vbs');
  exec(`cscript //nologo "${vbsPath}"`, (error) => {
    if (error) {
      // Fallback: try PowerShell directly
      exec('powershell -WindowStyle Hidden -Command "& {Add-Type -Name Win32 -MemberDefinition \\"[DllImport(\\\"user32.dll\\\")][return: MarshalAs(UnmanagedType.Bool)]public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);[DllImport(\\\"kernel32.dll\\\")]public static extern IntPtr GetConsoleWindow();\\"; $hWnd = [Win32]::GetConsoleWindow(); [Win32]::ShowWindow($hWnd, 0);}"');
    }
  });
}

// Skip CLI mode check if started as daemon (child process)
const isDaemon = process.argv.includes('--daemon');
let isStartingUp = false;

// ── CLI Commands ───────────────────────────────────────────────────────────────
const DEFAULT_PORT = process.env.PORT || 8888;

function parseCliArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const flags = {
    noConsole: args.includes('--no-console') || args.includes('-nc'),
    all: args.includes('--all') || args.includes('-a'),
    minimized: args.includes('--minimized') || args.includes('-m'),
    autostart: args.includes('--autostart'),
    port: DEFAULT_PORT
  };
  
  // Check for custom port flag
  const portIndex = args.findIndex(a => a === '--port' || a === '-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    flags.port = parseInt(args[portIndex + 1], 10) || DEFAULT_PORT;
  }
  
  return { command, flags };
}

function isWinctlRunning(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

function getWinctlPid(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      const match = stdout.trim().match(/(\d+)\s*$/);
      resolve(match ? parseInt(match[1], 10) : null);
    });
  });
}

function getWinctlExePath() {
  // Get the path to the current executable
  const exePath = process.execPath;
  const scriptPath = __filename;
  
  // If running as exe, use the exe path
  if (exePath.includes('winctl.exe') || exePath.endsWith('winctl')) {
    return exePath;
  }
  
  // If running via node, use node with the script
  return process.argv[0];
}

function startWinctl(noConsole, port) {
  return new Promise(async (resolve) => {
    const running = await isWinctlRunning(port);
    if (running) {
      console.log(`WinCTL is already running on port ${port}`);
      resolve({ ok: false, msg: 'Already running' });
      return;
    }
    
    const exePath = process.execPath;
    let scriptPath = __filename;
    
    // Fix for packaged exe: __filename points to snapshot path, need to use actual exe
    const isPackedExe = exePath.includes('winctl.exe') && !exePath.includes('node.exe');
    if (isPackedExe) {
      // When running as packaged exe, spawn the exe itself with --daemon flag
      // Use the exe path directly - no script path needed
      scriptPath = exePath;
    } else if (scriptPath.includes('snapshot') || !fs.existsSync(scriptPath)) {
      // If running from snapshot or script doesn't exist, try to find the actual script
      scriptPath = path.join(path.dirname(exePath), 'server.js');
      if (!fs.existsSync(scriptPath)) {
        // Fallback: use the original directory
        scriptPath = path.join(process.cwd(), 'server.js');
      }
    }
    
    let args = [];
    if (isPackedExe) {
      // For packed exe: exe first, then flags
      args.push(exePath);
      if (noConsole) {
        args.push('--minimized');
      }
      args.push('--daemon');
    } else {
      // For node: script path first, then flags
      args.push(scriptPath);
      args.push('--daemon');
      if (noConsole) {
        args.push('--minimized');
      }
    }
    
    let spawnEnv = { ...process.env, PORT: port.toString() };
    
    console.log(`[START] exePath: ${exePath}`);
    console.log(`[START] scriptPath: ${scriptPath}`);
    console.log(`[START] args: ${args.join(' ')}`);
    
    // Spawn detached and exit immediately (daemonize)
    spawn(exePath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: noConsole,
      env: spawnEnv,
      cwd: process.cwd()
    });
    
    // Exit immediately - don't wait
    console.log(`WinCTL started on port ${port}`);
    resolve({ ok: true, msg: 'Started' });
  });
}

function stopWinctl(stopAll) {
  return new Promise(async (resolve) => {
    const port = DEFAULT_PORT;
    const running = await isWinctlRunning(port);
    
    if (!running) {
      console.log('WinCTL is not running');
      resolve({ ok: false, msg: 'Not running' });
      return;
    }
    
    // Get PID of winctl process
    let pid = await getWinctlPid(port);
    
    if (!pid) {
      // Try to find by process name
      const exeName = path.basename(process.execPath);
      pid = await getPidByProcessName(exeName);
    }
    
    if (stopAll) {
      const config = loadConfig();
      const runningServices = config.services.filter(s => getStatus(s.id) === 'running');
      
      for (const svc of runningServices) {
        await stopService(svc.id);
      }
      
      // Wait for services to stop
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Kill by port if we have PID
    if (pid) {
      exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
        if (err) {
          console.log('Failed to kill winctl process');
          resolve({ ok: false, msg: 'Failed to stop' });
        } else {
          console.log('WinCTL stopped successfully');
          resolve({ ok: true, msg: 'Stopped' });
        }
      });
    } else {
      // Fallback: try to kill by port
      exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /PID %a /F`, (err) => {
        if (err) {
          console.log('Failed to stop winctl');
          resolve({ ok: false, msg: 'Failed to stop' });
        } else {
          console.log('WinCTL stopped successfully');
          resolve({ ok: true, msg: 'Stopped' });
        }
      });
    }
  });
}

async function runCliCommand() {
  const { command, flags } = parseCliArgs();
  
  switch (command) {
    case 'start': {
      const result = await startWinctl(flags.noConsole, flags.port);
      process.exit(result.ok ? 0 : 1);
      break;
    }
    case 'stop': {
      const result = await stopWinctl(true); // Always stop all services
      process.exit(result.ok ? 0 : 1);
      break;
    }
    case 'status': {
      const running = await isWinctlRunning(flags.port);
      if (running) {
        console.log(`WinCTL is running on port ${flags.port}`);
        process.exit(0);
      } else {
        console.log(`WinCTL is not running on port ${flags.port}`);
        process.exit(1);
      }
      break;
    }
    case 'autostart': {
      const subcommand = process.argv[2];
      if (subcommand === 'enable') {
        await enableAutostart();
        console.log('Autostart enabled');
        process.exit(0);
      } else if (subcommand === 'disable') {
        await disableAutostart();
        console.log('Autostart disabled');
        process.exit(0);
      } else if (subcommand === 'status') {
        const enabled = await isAutostartEnabled();
        console.log(enabled ? 'Autostart is enabled' : 'Autostart is disabled');
        process.exit(enabled ? 0 : 1);
      } else {
        console.log('Usage: winctl autostart [enable|disable|status]');
        process.exit(1);
      }
      break;
    }
    case 'run':
    default:
      // Normal server mode - continue with app setup
      return false; // Signal to continue with server
  }
}

// Check if we're in CLI mode - if command is 'run' or not recognized, start server
const { command: cliCommand } = parseCliArgs();
const isCliMode = !isDaemon && ['start', 'stop', 'status'].includes(cliCommand);

// Flag to track if we should start the server
let shouldStartServer = true;

// Check if we're in CLI mode
if (isCliMode) {
  runCliCommand();
  // CLI commands handle their own process.exit()
  // Set flag to false to prevent server from starting
  shouldStartServer = false;
} else {
  // Server mode - just call runCliCommand and continue
  runCliCommand();
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config persistence ──────────────────────────────────────────────────────
// Store configs in user's home directory under .winctl
const CONFIG_DIR = path.join(os.homedir(), '.winctl');
const CONFIG_FILE = path.join(CONFIG_DIR, 'services.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const THEMES_DIR = path.join(CONFIG_DIR, 'themes');

// Config caching to reduce file I/O
let configCache = { services: [], folders: [] };
let configCacheTime = 0;
let settingsCache = {};
let settingsCacheTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5 seconds
const SETTINGS_CACHE_TTL = 5000; // 5 seconds

const DEFAULT_THEMES = {
  'dark-default': {
    name: 'Dark Default',
    author: 'WinCTL',
    builtIn: true,
    colors: {
      bg: '#0d0f14',
      surface: '#13161d',
      surface2: '#1a1e28',
      border: '#252a38',
      border2: '#2e3547',
      text: '#e8ecf5',
      text2: '#8892a8',
      text3: '#505870',
      green: '#22d47a',
      'green-dim': '#1a4a32',
      red: '#f5524a',
      'red-dim': '#3d1f1d',
      yellow: '#f0b429',
      'yellow-dim': '#3d2f10',
      blue: '#4d9de0',
      'blue-dim': '#1a2d47',
      accent: '#5e72e4',
      'accent-glow': 'rgba(94,114,228,0.3)'
    }
  },
  'light-default': {
    name: 'Light Default',
    author: 'WinCTL',
    builtIn: true,
    colors: {
      bg: '#f8f9fc',
      surface: '#ffffff',
      surface2: '#f0f2f5',
      border: '#e2e5eb',
      border2: '#d1d5dc',
      text: '#1a1e28',
      text2: '#5a6072',
      text3: '#949cad',
      green: '#1db954',
      'green-dim': '#d4f5e0',
      red: '#e53935',
      'red-dim': '#ffe5e5',
      yellow: '#ff9800',
      'yellow-dim': '#fff4e0',
      blue: '#2196f3',
      'blue-dim': '#e3f2fd',
      accent: '#5e72e4',
      'accent-glow': 'rgba(94,114,228,0.2)'
    }
  },
  'monokai': {
    name: 'Monokai',
    author: 'WinCTL',
    builtIn: true,
    colors: {
      bg: '#272822',
      surface: '#1e1f1a',
      surface2: '#3e3d32',
      border: '#49483e',
      border2: '#5a594d',
      text: '#f8f8f2',
      text2: '#b8b8a5',
      text3: '#75715e',
      green: '#a6e22e',
      'green-dim': '#3d4a1a',
      red: '#f92672',
      'red-dim': '#4a1a2d',
      yellow: '#e6db74',
      'yellow-dim': '#4a4620',
      blue: '#66d9ef',
      'blue-dim': '#1a3d4a',
      accent: '#ae81ff',
      'accent-glow': 'rgba(174,129,255,0.3)'
    }
  },
  'dracula': {
    name: 'Dracula',
    author: 'Dracula Theme',
    builtIn: true,
    colors: {
      bg: '#282a36',
      surface: '#21222c',
      surface2: '#343746',
      border: '#44475a',
      border2: '#6272a4',
      text: '#f8f8f2',
      text2: '#bfbfbf',
      text3: '#6272a4',
      green: '#50fa7b',
      'green-dim': '#2d4a2d',
      red: '#ff5555',
      'red-dim': '#4a2d2d',
      yellow: '#f1fa8c',
      'yellow-dim': '#4a4a2d',
      blue: '#8be9fd',
      'blue-dim': '#2d4a5a',
      accent: '#bd93f9',
      'accent-glow': 'rgba(189,147,249,0.3)'
    }
  },
  'nord': {
    name: 'Nord',
    author: 'Arctic Ice Studio',
    builtIn: true,
    colors: {
      bg: '#2e3440',
      surface: '#242933',
      surface2: '#3b4252',
      border: '#4c566a',
      border2: '#576079',
      text: '#eceff4',
      text2: '#d8dee9',
      text3: '#7b88a1',
      green: '#a3be8c',
      'green-dim': '#3e4a3a',
      red: '#bf616a',
      'red-dim': '#4a3a3e',
      yellow: '#ebcb8b',
      'yellow-dim': '#4a453a',
      blue: '#81a1c1',
      'blue-dim': '#3a4a5a',
      accent: '#88c0d0',
      'accent-glow': 'rgba(136,192,208,0.3)'
    }
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    author: 'Enkia',
    builtIn: true,
    colors: {
      bg: '#1a1b26',
      surface: '#16161e',
      surface2: '#24283b',
      border: '#3b4261',
      border2: '#4f5779',
      text: '#c0caf5',
      text2: '#9aa5ce',
      text3: '#565f89',
      green: '#9ece6a',
      'green-dim': '#2d3a2d',
      red: '#f7768e',
      'red-dim': '#4a2d3a',
      yellow: '#e0af68',
      'yellow-dim': '#4a3a2d',
      blue: '#7aa2f7',
      'blue-dim': '#2d3a5a',
      accent: '#bb9af7',
      'accent-glow': 'rgba(187,154,247,0.3)'
    }
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    author: 'Catppuccin',
    builtIn: true,
    colors: {
      bg: '#1e1e2e',
      surface: '#181825',
      surface2: '#313244',
      border: '#45475a',
      border2: '#585b70',
      text: '#cdd6f4',
      text2: '#bac2de',
      text3: '#6c7086',
      green: '#a6e3a1',
      'green-dim': '#2d3a2d',
      red: '#f38ba8',
      'red-dim': '#4a2d3a',
      yellow: '#f9e2af',
      'yellow-dim': '#4a4230',
      blue: '#89b4fa',
      'blue-dim': '#2d3a5a',
      accent: '#cba6f7',
      'accent-glow': 'rgba(203,166,247,0.3)'
    }
  }
};

// Create config directory if it doesn't exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(THEMES_DIR)) {
  fs.mkdirSync(THEMES_DIR, { recursive: true });
}

// Ensure default themes exist
Object.entries(DEFAULT_THEMES).forEach(([id, theme]) => {
  const themePath = path.join(THEMES_DIR, `${id}.json`);
  if (!fs.existsSync(themePath)) {
    fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
  }
});

function loadConfig() {
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return configCache;
  }
  
  let services = [];
  let folders = [];
  
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      services = data.services || [];
      folders = data.folders || [];
    } catch { /* ignore */ }
  }
  
  configCache = { services, folders };
  configCacheTime = now;
  return configCache;
}

function loadSettings() {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }
  
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = { 
      folderStatePreference: 'remember', 
      showFolderCount: true,
      autoStart: false 
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    settingsCache = defaultSettings;
    settingsCacheTime = now;
    return defaultSettings;
  }
  
  try {
    settingsCache = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    settingsCacheTime = now;
    return settingsCache;
  } catch {
    settingsCache = { 
      folderStatePreference: 'remember', 
      showFolderCount: true,
      autoStart: false 
    };
    settingsCacheTime = now;
    return settingsCache;
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  configCache = data;
  configCacheTime = Date.now();
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  settingsCache = settings;
  settingsCacheTime = Date.now();
}

function migrateSettings() {
  // Check if settings.json doesn't exist but services.json does
  if (!fs.existsSync(SETTINGS_FILE) && fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data.settings) {
        console.log('Migrating settings from services.json to settings.json');
        saveSettings(data.settings);
      }
    } catch (error) {
      console.log('Error migrating settings:', error.message);
    }
  }
}

// ── Process registry ────────────────────────────────────────────────────────
// Map<id, { process, logs[], startedAt, restartCount, status }>
const registry = new Map();

function getStatus(id) {
  const entry = registry.get(id);
  if (!entry) return 'stopped';
  if (entry.state) return entry.state;
  if (entry.process?.exitCode !== null) return 'stopped';
  if (entry.process?.killed) return 'stopped';
  return 'running';
}

async function checkPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

async function verifyPortOpen(service, entry, attempts = 0) {
  if (attempts >= 20) return;
  await new Promise(r => setTimeout(r, 500));
  if (!registry.has(service.id)) return;
  if (entry.state !== 'starting') return;
  
  const portOpen = await checkPort(service.port);
  if (portOpen) {
    entry.state = 'running';
    entry.stateReason = 'Port confirmed open';
    broadcastStatus();
    return;
  }
  if (entry.process?.exitCode !== null) {
    entry.state = 'stopped';
    entry.stateReason = 'Process exited during startup';
    broadcastStatus();
    return;
  }
  verifyPortOpen(service, entry, attempts + 1);
}

function broadcastStatus() {
  const config = loadConfig();
  const settings = loadSettings();
  const payload = {
    services: config.services.map(s => ({
      ...s,
      status: getStatus(s.id),
      stateReason: registry.get(s.id)?.stateReason ?? null,
      pid: registry.get(s.id)?.actualPid ?? registry.get(s.id)?.process?.pid ?? null,
      startedAt: registry.get(s.id)?.startedAt ?? null,
      restartCount: registry.get(s.id)?.restartCount ?? 0,
      recentLogs: (registry.get(s.id)?.logs ?? []).slice(-50),
    })),
    folders: config.folders || [],
    settings: settings
  };
  io.emit('status', payload);
}

async function checkPidRunning(pid) {
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

async function getPidOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      const match = stdout.match(/\s+(\d+)\s*$/m);
      resolve(match ? parseInt(match[1]) : null);
    });
  });
}

async function verifyProcessAlive(service, entry) {
  if (!entry || entry.state === 'starting' || entry.state === 'stopping') return;
  
  let isAlive = false;
  let actualPid = null;
  
  if (service.port) {
    const portOpen = await checkPort(service.port);
    if (portOpen) {
      isAlive = true;
      actualPid = await getPidOnPort(service.port);
    }
  } else if (entry.actualPid) {
    isAlive = await checkPidRunning(entry.actualPid);
  } else if (entry.process?.pid) {
    isAlive = await checkPidRunning(entry.process.pid);
  } else {
    // Check for special process mappings (AHK, Komorebi, etc.)
    const cmd = service.command.toLowerCase();
    let exeName = '';
    
    // Special mappings for services where command differs from process name
    const processNameMap = {
      'komorebic': 'komorebi.exe',
      'komorebic.exe': 'komorebi.exe',
      'powertoys': 'PowerToys.exe',
      'PowerToys.exe': 'PowerToys.exe',
      'sefirah': 'Sefirah.exe',
      'Sefirah.exe': 'Sefirah.exe'
    };
    
    // AHK scripts - map .ahk files to AutoHotkey64.exe processes
    if (cmd.endsWith('.ahk')) {
      exeName = 'AutoHotkey64.exe';
    } else if (processNameMap[cmd] || processNameMap[service.command]) {
      exeName = processNameMap[cmd] || processNameMap[service.command];
    }
    
    if (exeName) {
      actualPid = await getPidByProcessName(exeName);
      if (actualPid) {
        isAlive = true;
        entry.actualPid = actualPid;
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

async function periodicStatusCheck() {
  const config = loadConfig();
  for (const service of config.services) {
    let entry = registry.get(service.id);
    
    // If service not in registry, check if it's actually running
    if (!entry) {
      let isRunning = false;
      let actualPid = null;
      
      // Check by port first
      if (service.port) {
        const portOpen = await checkPort(service.port);
        if (portOpen) {
          isRunning = true;
          actualPid = await getPidOnPort(service.port);
        }
      }
      
      // Check for special process mappings (AHK, Komorebi, etc.)
      if (!isRunning) {
        const cmd = service.command.toLowerCase();
        let exeName = '';
        
        // Special mappings for services where command differs from process name
        const processNameMap = {
          'komorebic': 'komorebi.exe',
          'komorebic.exe': 'komorebi.exe'
        };
        
        // AHK scripts - map .ahk files to AutoHotkey64.exe processes
        if (cmd.endsWith('.ahk')) {
          exeName = 'AutoHotkey64.exe';
        } else if (processNameMap[cmd] || processNameMap[service.command]) {
          exeName = processNameMap[cmd] || processNameMap[service.command];
        }
        
        if (exeName) {
          actualPid = await getPidByProcessName(exeName);
          if (actualPid) {
            isRunning = true;
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
          actualPid: actualPid
        };
        registry.set(service.id, entry);
        broadcastStatus();
        continue;
      }
      continue;
    }
    
    // Check all non-transitioning states
    if (entry.state === 'running' || entry.state === 'stopped' || !entry.state) {
      await verifyProcessAlive(service, entry);
    }
  }
}

setInterval(periodicStatusCheck, 15000);

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
    
    // Skip killing during startup to avoid race conditions
    if (isStartingUp) {
      console.log('Skipping process kill during startup');
      resolve({ ok: true, msg: 'Skipped during startup' });
      return;
    }
    
    const isBatchFile = command.endsWith('.bat') || command.endsWith('.cmd') || command.endsWith('.ps1');
    
    if (os.platform() === 'win32') {
      if (isBatchFile) {
        // For batch files, we need to kill cmd.exe processes that are running the batch file
        const batchName = path.basename(command);
        console.log(`Looking for cmd.exe processes running ${batchName}`);
        
        // Find cmd.exe processes running our batch file
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
              console.log(`No cmd.exe processes found running ${batchName}`);
              resolve({ ok: true, msg: `No processes found running ${batchName}` });
            }
          } else {
            console.log(`No cmd.exe processes found running ${batchName}`);
            resolve({ ok: true, msg: `No processes found running ${batchName}` });
          }
        });
      } else {
        // For executables, try multiple approaches
        const exeName = path.basename(command);
        const exeWithoutExt = path.basename(command, '.exe');
        
        console.log(`Looking for exe processes: ${exeName} (${exeWithoutExt})`);
        
        // First try with full name
        exec(`taskkill /IM "${exeName}" /F`, (error, stdout, stderr) => {
          console.log(`Taskkill result for ${exeName}:`, { stdout: stdout?.trim(), stderr: stderr?.trim() });
          
          // If that fails, try without .exe extension
          if (error && error.message.includes('not found')) {
            exec(`taskkill /IM "${exeWithoutExt}.exe" /F`, (error2, stdout2, stderr2) => {
              console.log(`Taskkill result for ${exeWithoutExt}.exe:`, { stdout: stdout2?.trim(), stderr: stderr2?.trim() });
              
              // Try PowerShell as final fallback
              exec(`powershell "Get-Process -Name '${exeWithoutExt}' -ErrorAction SilentlyContinue | Stop-Process -Force"`, (psError, psStdout, psStderr) => {
                if (psError) {
                  console.log(`PowerShell fallback for ${exeWithoutExt} skipped`);
                } else {
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
      // Linux/Mac: kill by process name
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

// ── Start a service ─────────────────────────────────────────────────────────
async function startService(service, autoRestart = true) {
  const currentState = getStatus(service.id);
  if (currentState === 'running') return { ok: false, msg: 'Already running' };
  if (currentState === 'starting') return { ok: false, msg: 'Already starting' };

  // Clear any stale entry
  registry.delete(service.id);

  // Check if process is already running before attempting to start
  let existingPid = null;
  const cmd = service.command.toLowerCase();
  let exeName = '';
  
  // Special mappings for services where command differs from process name
  const processNameMap = {
    'komorebic': 'komorebi.exe',
    'komorebic.exe': 'komorebi.exe',
    'powertoys': 'PowerToys.exe',
    'PowerToys.exe': 'PowerToys.exe',
    'sefirah': 'Sefirah.exe',
    'Sefirah.exe': 'Sefirah.exe'
  };
  
  // Determine the executable name to check
  if (cmd.endsWith('.ahk')) {
    exeName = 'AutoHotkey64.exe';
  } else if (processNameMap[cmd] || processNameMap[service.command]) {
    exeName = processNameMap[cmd] || processNameMap[service.command];
  } else if (cmd.endsWith('.exe')) {
    exeName = path.basename(service.command);
  }
  
  // Check if process is already running
  if (exeName) {
    existingPid = await getPidByProcessName(exeName);
    if (existingPid) {
      // Process is already running, create entry and set to running state
      const entry = {
        process: { 
          pid: null, 
          killed: false, 
          exitCode: null,
          kill: () => {
            entry.process.killed = true;
            entry.process.exitCode = 0;
            entry.state = 'stopped';
            entry.stateReason = 'Stopped by user';
            registry.delete(service.id);
            broadcastStatus();
          }
        },
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
  const entry = {
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
  const cwd = service.cwd || process.cwd();
  const useShell = service.command.endsWith('.bat') || service.command.endsWith('.cmd') || service.command.endsWith('.ps1');
  const isExe = service.command.toLowerCase().endsWith('.exe');
  const minimized = service.minimized && isExe;

  let proc;
  try {
    entry.stateReason = 'Spawning process...';
    broadcastStatus();
    
    if (minimized && os.platform() === 'win32' && !useShell) {
      // For Windows .exe files with minimized flag, use nircmd exec hide
      const quotedCommand = quoteWindowsPath(service.command);
      const quotedArgs = args.map(arg => quoteWindowsPath(arg)).join(' ');
      const fullCommand = quotedCommand + (quotedArgs ? ' ' + quotedArgs : '');
      const nircmdCmd = `nircmd exec hide ${fullCommand}`;
      
      console.log(`[MINIMIZED] Starting with nircmd: ${nircmdCmd}`);
      entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Starting minimized process: ${service.command}` });
      
      proc = spawn(nircmdCmd, [], {
        cwd,
        env: { ...process.env, ...(service.env || {}) },
        shell: true,
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      });
      
      // Add error handling for nircmd spawn
      proc.on('error', (err) => {
        console.log(`nircmd spawn error for ${service.id}:`, err.message);
        entry.logs.push({ t: new Date().toISOString(), line: `[ERR] nircmd spawn failed: ${err.message}` });
        
        // Try fallback to regular spawn if nircmd fails
        console.log(`[FALLBACK] Trying regular spawn for ${service.command}`);
        entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Trying fallback spawn method...` });
        
        try {
          const quotedCommand = quoteWindowsPath(service.command);
          const quotedArgs = args.map(quoteWindowsPath).join(' ');
          const fullCommand = quotedCommand + (quotedArgs ? ' ' + quotedArgs : '');
          const fallbackProc = spawn(fullCommand, [], {
            cwd,
            env: { ...process.env, ...(service.env || {}) },
            shell: true,
            windowsHide: true,
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          
          entry.process = fallbackProc;
          entry.stateReason = 'Process spawned (fallback)';
          entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Fallback spawn successful, PID: ${fallbackProc.pid}` });
        } catch (fallbackErr) {
          entry.state = 'stopped';
          entry.stateReason = `Both nircmd and fallback spawn failed: ${fallbackErr.message}`;
          entry.logs.push({ t: new Date().toISOString(), line: `[ERR] Fallback spawn failed: ${fallbackErr.message}` });
          broadcastStatus();
        }
      });
      
      // For minimized processes, we can't track the actual process, so create a mock
      entry.process = { 
        pid: null, 
        killed: false, 
        exitCode: null,
        // Mock process object for status tracking
        kill: () => {
          console.log(`[KILL] Terminating minimized process: ${service.command}`);
          entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Terminating minimized process: ${service.command}` });
          
          // Actually kill the process by executable name
          killProcessByName(service.command, (error, stdout, stderr) => {
            if (error) {
              console.log(`[KILL] Error terminating ${service.command}:`, error.message);
              entry.logs.push({ t: new Date().toISOString(), line: `[ERR] Failed to terminate: ${error.message}` });
            } else {
              console.log(`[KILL] Successfully terminated ${service.command}`);
              entry.logs.push({ t: new Date().toISOString(), line: `[SYS] Process terminated successfully` });
            }
          });
          
          entry.process.killed = true;
          entry.process.exitCode = 0;
          registry.delete(service.id);
          broadcastStatus();
        }
      };
    } else {
      // For shell: true, properly quote command and arguments to handle spaces
      const quotedCommand = quoteWindowsPath(service.command);
      const quotedArgs = args.map(quoteWindowsPath).join(' ');
      const fullCommand = quotedCommand + (quotedArgs ? ' ' + quotedArgs : '');
      
      // Enhanced environment with explicit PATH
      const spawnEnv = { 
        ...process.env, 
        ...(service.env || {}),
        PATH: process.env.PATH // Explicitly ensure PATH is available
      };
      
      proc = spawn(fullCommand, [], {
        cwd,
        env: spawnEnv,
        shell: true,
        windowsHide: minimized,
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      entry.process = proc;
    }
    
    // Add error handler for spawn failures
    proc.on('error', (err) => {
      console.log(`Spawn error for ${service.id}:`, err.message);
      entry.state = 'stopped';
      entry.stateReason = `Spawn error: ${err.message}`;
      entry.logs.push({ t: new Date().toISOString(), line: `[ERR] Failed to start: ${err.message}` });
      broadcastStatus();
    });
  } catch (e) {
    entry.state = 'stopped';
    entry.stateReason = `Exception: ${e.message}`;
    broadcastStatus();
    return { ok: false, msg: e.message };
  }

  // Set running state after successful spawn
  entry.startedAt = new Date().toISOString();
  entry.state = 'running';
  entry.stateReason = 'Process spawned';
  broadcastStatus();

  // Only capture logs if not using detached start command
  if (!(minimized && os.platform() === 'win32' && !useShell) && proc) {
    const pushLog = (source, data) => {
      const line = data.toString().trim();
      console.log(`[LOG:${service.id}] ${line}`);
      
      // Smart log level detection
      let logLevel = source;
      if (source === 'ERR') {
        // Check if stderr actually contains an error or just normal logs
        if (line.includes('level=ERROR') || line.includes('level=FATAL') || 
            line.includes('[ERR]') || line.includes('ERROR:') ||
            line.includes('FATAL:') || line.includes('panic:') ||
            line.includes('fatal:') || line.includes('error:')) {
          logLevel = 'ERR';
        } else if (line.includes('level=INFO') || line.includes('level=DEBUG') || 
                   line.includes('level=WARN') || line.includes('[INFO]') ||
                   line.includes('[DEBUG]') || line.includes('[WARN]') ||
                   line.includes('INFO:') || line.includes('DEBUG:')) {
          logLevel = 'INFO';
        } else {
          // Default stderr content to INFO unless it looks like an error
          logLevel = 'INFO';
        }
      }
      
      entry.logs.push({ t: new Date().toISOString(), line: `[${logLevel}] ${line}` });
      if (entry.logs.length > 500) entry.logs.shift();
      io.emit(`log:${service.id}`, { t: new Date().toISOString(), line: `[${logLevel}] ${line}` });
    };

    proc.stdout.on('data', d => {
      pushLog('OUT', d);
    });
    proc.stderr.on('data', d => {
      pushLog('ERR', d);
    });

    proc.on('exit', (code, signal) => {
      pushLog('SYS', `Process exited (code=${code}, signal=${signal})`);
      entry.state = 'stopped';
      entry.stateReason = signal ? `Killed by signal ${signal}` : `Exited with code ${code}`;
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
  } else {
    if (proc) {
      proc.on('exit', (code, signal) => {
        console.log(`Minimized process ${service.id} exited (code=${code}, signal=${signal})`);
        entry.process.killed = true;
        entry.process.exitCode = code;
        entry.state = 'stopped';
        entry.stateReason = signal ? `Killed by signal ${signal}` : `Exited with code ${code}`;
        broadcastStatus();
      });
    }
  }

  // Verify port and capture actual PID for port-based services
  if (service.port && entry.state === 'running') {
    verifyPortAndCapturePid(service, entry);
  } else if (entry.state === 'running') {
    // For non-port services, try to find actual PID by process name
    setTimeout(() => capturePidByName(service, entry), 2000);
  }

  return { ok: true, pid: proc?.pid };
}

async function verifyPortAndCapturePid(service, entry, attempts = 0) {
  if (attempts >= 20) return;
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  await new Promise(r => setTimeout(r, 500));
  
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  const portOpen = await checkPort(service.port);
  
  if (portOpen) {
    // Capture actual PID from port
    const pid = await getPidOnPort(service.port);
    if (pid) {
      entry.actualPid = pid;
      console.log(`Captured actual PID ${pid} for ${service.id} on port ${service.port}`);
    }
    entry.stateReason = 'Port confirmed open';
    broadcastStatus();
    return;
  }
  
  if (entry.process?.exitCode !== null || entry.process?.killed) {
    entry.state = 'stopped';
    entry.stateReason = 'Process exited during startup';
    broadcastStatus();
    return;
  }

  verifyPortAndCapturePid(service, entry, attempts + 1);
}

async function capturePidByName(service, entry) {
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;
  
  const cmd = service.command.toLowerCase();
  let exeName = '';
  
  // Special mappings for services where command differs from process name
  const processNameMap = {
    'komorebic': 'komorebi.exe',
    'komorebic.exe': 'komorebi.exe',
    'powertoys': 'PowerToys.exe',
    'PowerToys.exe': 'PowerToys.exe',
    'sefirah': 'Sefirah.exe',
    'Sefirah.exe': 'Sefirah.exe'
  };
  
  // AHK scripts - map .ahk files to AutoHotkey64.exe processes
  if (cmd.endsWith('.ahk')) {
    exeName = 'AutoHotkey64.exe';
  } else if (processNameMap[cmd] || processNameMap[service.command]) {
    exeName = processNameMap[cmd] || processNameMap[service.command];
  } else if (cmd.endsWith('.exe')) {
    exeName = path.basename(service.command);
  } else if (cmd.endsWith('.bat') || cmd.endsWith('.cmd')) {
    // For batch files, the command is the batch file itself
    exeName = path.basename(service.command, path.extname(service.command));
  } else {
    // For shell commands like 'ollama', use the command name
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

async function getPidByProcessName(name) {
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
          resolve(parseInt(match[2]));
          return;
        }
      }
      resolve(null);
    });
  });
}

async function verifyPortOpen(service, entry, attempts = 0) {
  if (attempts >= 20) return;
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  await new Promise(r => setTimeout(r, 500));
  
  if (!registry.has(service.id)) return;
  if (entry.state !== 'running') return;

  const portOpen = await checkPort(service.port);
  
  if (portOpen) {
    entry.stateReason = 'Port confirmed open';
    broadcastStatus();
    return;
  }
  
  if (entry.process?.exitCode !== null || entry.process?.killed) {
    entry.state = 'stopped';
    entry.stateReason = 'Process exited during startup';
    broadcastStatus();
    return;
  }

  verifyPortOpen(service, entry, attempts + 1);
}

async function stopService(id) {
  const entry = registry.get(id);
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
  
  // Get actual PID - prefer actualPid, then port-based PID, then shell PID
  let pid = entry.actualPid;
  if (!pid && service?.port) {
    pid = await getPidOnPort(service.port);
    entry.actualPid = pid;
  }
  if (!pid && entry.process?.pid) {
    pid = entry.process.pid;
  }
  
  console.log(`Stopping service ${id}, PID: ${pid}, port: ${service?.port}`);
  
  if (os.platform() === 'win32') {
    // Kill by port first if available (most reliable for shell-spawned)
    if (service?.port) {
      await new Promise((resolve) => {
        exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${service.port} ^| findstr LISTENING') do set "process=%%a" && taskkill /PID !process! /F`, (err, stdout, stderr) => {
          console.log(`Killed process on port ${service.port}:`, stdout.trim() || stderr.trim() || 'done');
          resolve();
        });
      });
    }
    
    // Kill by PID if we have one
    if (pid) {
      await new Promise((resolve) => {
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
      if (entry.process && !entry.process.killed) {
        entry.process.kill('SIGKILL');
      }
    } catch (e) {
      // Ignore
    }
    
  } else {
    // Non-Windows
    if (entry.process) entry.process.kill('SIGTERM');
    if (pid) {
      await new Promise(r => setTimeout(r, 2000));
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
  const validation = validateServiceInput(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.errors.join(', ') });
  }
  
  const config = loadConfig();
  const svc = {
    id: Date.now().toString(36),
    ...validation.sanitized,
    folderId: req.body.folderId || null,
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
  
  const validation = validateServiceInput({ ...config.services[idx], ...req.body });
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.errors.join(', ') });
  }
  
  config.services[idx] = { ...validation.sanitized, id: req.params.id };
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

app.get('/api/folders', (req, res) => {
  const config = loadConfig();
  res.json(config.folders || []);
});

app.post('/api/folders', (req, res) => {
  const config = loadConfig();
  const folder = {
    id: Date.now().toString(36),
    name: req.body.name || 'New Folder',
    createdAt: new Date().toISOString(),
  };
  config.folders = config.folders || [];
  config.folders.push(folder);
  saveConfig(config);
  broadcastStatus();
  res.json(folder);
});

app.put('/api/folders/:id', (req, res) => {
  const config = loadConfig();
  const idx = (config.folders || []).findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  config.folders[idx] = { ...config.folders[idx], ...req.body, id: req.params.id };
  saveConfig(config);
  broadcastStatus();
  res.json(config.folders[idx]);
});

app.delete('/api/folders/:id', (req, res) => {
  const config = loadConfig();
  config.folders = (config.folders || []).filter(f => f.id !== req.params.id);
  config.services = (config.services || []).map(s => 
    s.folderId === req.params.id ? { ...s, folderId: null } : s
  );
  saveConfig(config);
  broadcastStatus();
  res.json({ ok: true });
});

app.post('/api/folders/:id/start', async (req, res) => {
  const config = loadConfig();
  const folderServices = (config.services || []).filter(s => s.folderId === req.params.id && getStatus(s.id) === 'stopped');
  let started = 0;
  for (const s of folderServices) {
    try {
      await startService(s);
      started++;
    } catch (e) { console.error(`Failed to start ${s.name}:`, e); }
  }
  res.json({ ok: true, started });
});

app.post('/api/folders/:id/stop', (req, res) => {
  const config = loadConfig();
  const folderServices = (config.services || []).filter(s => s.folderId === req.params.id && getStatus(s.id) === 'running');
  let stopped = 0;
  for (const s of folderServices) {
    const result = stopService(s.id);
    if (result.ok) stopped++;
  }
  res.json({ ok: true, stopped });
});

app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const currentSettings = loadSettings();
  const updatedSettings = { ...currentSettings, ...req.body };
  saveSettings(updatedSettings);
  res.json(updatedSettings);
});

// ── Autostart API ───────────────────────────────────────────────────────────────
app.get('/api/autostart', async (req, res) => {
  const enabled = await isAutostartEnabled();
  res.json({ enabled });
});

app.post('/api/autostart/enable', async (req, res) => {
  try {
    await enableAutostart();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/autostart/disable', async (req, res) => {
  try {
    await disableAutostart();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Theme API ────────────────────────────────────────────────────────────────
app.get('/api/themes', (req, res) => {
  const themes = [];
  const files = fs.existsSync(THEMES_DIR) ? fs.readdirSync(THEMES_DIR) : [];
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const themePath = path.join(THEMES_DIR, file);
        const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
        themes.push({ id: file.replace('.json', ''), ...theme });
      } catch { /* ignore invalid theme files */ }
    }
  });
  
  res.json(themes);
});

app.get('/api/themes/:id', (req, res) => {
  const themePath = path.join(THEMES_DIR, `${req.params.id}.json`);
  
  if (!fs.existsSync(themePath)) {
    return res.status(404).json({ error: 'Theme not found' });
  }
  
  try {
    const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    res.json({ id: req.params.id, ...theme });
  } catch {
    res.status(500).json({ error: 'Invalid theme file' });
  }
});

app.post('/api/themes', (req, res) => {
  const { id, name, author, colors } = req.body;
  
  if (!id || !name || !colors) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const safeId = id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const themePath = path.join(THEMES_DIR, `${safeId}.json`);
  
  const theme = {
    name,
    author: author || 'User',
    builtIn: false,
    colors
  };
  
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
  res.json({ id: safeId, ...theme });
});

app.delete('/api/themes/:id', (req, res) => {
  const themePath = path.join(THEMES_DIR, `${req.params.id}.json`);
  
  if (!fs.existsSync(themePath)) {
    return res.status(404).json({ error: 'Theme not found' });
  }
  
  try {
    const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    if (theme.builtIn) {
      return res.status(403).json({ error: 'Cannot delete built-in theme' });
    }
  } catch { /* ignore */ }
  
  fs.unlinkSync(themePath);
  res.json({ ok: true });
});

// ── Detect running processes on startup ─────────────────────────────────────
let isStartingUp = true; // Flag to prevent process killing during startup

async function detectRunningProcesses() {
  const config = loadConfig();
  
  for (const service of config.services) {
    let isRunning = false;
    let detectedPid = null;
    let stateReason = null;
    
    // Primary: Check by port (most reliable)
    if (service.port) {
      const portOpen = await checkPort(service.port);
      if (portOpen) {
        isRunning = true;
        stateReason = 'Port detected listening';
        // Try to get PID from port
        const portPid = await getPidFromPort(service.port);
        if (portPid) detectedPid = portPid;
        console.log(`Detected running service by port ${service.port}: ${service.name}${detectedPid ? ` (PID: ${detectedPid})` : ''}`);
      }
    }
    
    // Secondary: Check by exe name (Windows)
    if (!isRunning && os.platform() === 'win32' && service.command) {
      const isBatchFile = service.command.endsWith('.bat') || service.command.endsWith('.cmd') || service.command.endsWith('.ps1');
      const isExe = service.command.endsWith('.exe');
      
      if (isExe) {
        const exeName = path.basename(service.command);
        const stdout = await new Promise(resolve => {
          exec(`tasklist /FI "IMAGENAME eq ${exeName}" /FO CSV /NH`, (err, out) => resolve(out || ''));
        });
        if (stdout.toLowerCase().includes(exeName.toLowerCase())) {
          isRunning = true;
          stateReason = 'Process detected running';
          // Extract PID from CSV output
          const match = stdout.match(/"([^"]+)","(\d+)"/);
          if (match) detectedPid = parseInt(match[2]);
          console.log(`Detected running exe: ${service.name}${detectedPid ? ` (PID: ${detectedPid})` : ''}`);
        }
      }
      // Note: Batch files can't be detected by name (they run as cmd.exe)
      // They should be detected by port instead
    }
    
    // Create registry entry if running
    if (isRunning) {
      registry.set(service.id, {
        process: detectedPid ? { pid: detectedPid, killed: false, exitCode: null } : { pid: null, killed: false, exitCode: null },
        logs: [{ t: new Date().toISOString(), line: '[SYS] Process detected running on WinCTL startup' }],
        startedAt: new Date().toISOString(),
        restartCount: 0,
        state: 'running',
        stateReason: stateReason,
        actualPid: detectedPid,
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
        console.error(`Failed to auto-start ${service.name}:`, error.message);
      }
    }
  }
  
  isStartingUp = false;
  console.log('Startup process detection complete');
  broadcastStatus();
}

async function getPidFromPort(port) {
  return new Promise(resolve => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      // Output format: "  TCP    0.0.0.0:7801    0.0.0.0:0    LISTENING    12345"
      const match = stdout.match(/LISTENING\s+(\d+)/);
      resolve(match ? parseInt(match[1]) : null);
    });
  });
}

// ── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  console.log(`[SOCKET] Total clients: ${io.sockets.sockets.size}`);
  
  // Broadcast current status immediately on connection
  broadcastStatus();
  
  socket.on('subscribe:logs', id => {
    console.log(`[SOCKET] Client ${socket.id} subscribed to logs for ${id}`);
    socket.join(`logs:${id}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    console.log(`[SOCKET] Total clients: ${io.sockets.sockets.size}`);
  });
});

// Only start server if not in CLI mode
if (!shouldStartServer) {
  // Server won't start - CLI command will handle exit
} else {
// ── Boot: auto-start services marked autoRestart ────────────────────────────
const PORT = process.env.PORT || 8888;
const startMinimized = process.argv.includes('--minimized');
const noBrowser = process.argv.includes('--no-browser');
let trayInstance = null;

// System tray menu generator with themed colors
function getTrayMenu(theme) {
  const colors = theme?.colors || {
    bg: '#1a1e28',
    text: '#e8ecf5',
    accent: '#5e72e4',
    green: '#22d47a'
  };
  
  return [
    {
      text: 'WinCTL',
      isDisabled: true
    },
    {
      text: '─────────────────',
      isDisabled: true
    },
    {
      text: 'Open WinCTL',
      click: () => {
        require('child_process').exec(`start http://localhost:${PORT}`);
      }
    },
    {
      text: '─────────────────',
      isDisabled: true
    },
    {
      text: 'Running Services',
      isDisabled: true
    },
    {
      text: '─────────────────',
      isDisabled: true
    },
    {
      text: 'Exit WinCTL',
      click: async () => {
        if (trayInstance) {
          trayInstance.quit();
        }
        process.exit(0);
      }
    }
  ];
}

// Initialize system tray
function initTray() {
  if (!systray) {
    console.log('Systray module not loaded');
    return;
  }
  
  if (os.platform() !== 'win32') {
    console.log('System tray not available on this platform');
    return;
  }
  
  const iconPath = path.join(__dirname, 'icons', 'icon-16.png');
  
  // Check if icon exists
  if (!fs.existsSync(iconPath)) {
    console.log('Tray icon not found:', iconPath);
    return;
  }
  
  const settings = loadSettings();
  const themes = [];
  const themeFiles = fs.existsSync(THEMES_DIR) ? fs.readdirSync(THEMES_DIR) : [];
  themeFiles.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const themeData = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), 'utf8'));
        themes.push({ id: file.replace('.json', ''), ...themeData });
      } catch {}
    }
  });
  const currentTheme = themes.find(t => t.id === settings.theme) || themes[0];
  
  try {
    console.log('Initializing system tray...');
    trayInstance = new systray({
      icon: iconPath,
      menu: getTrayMenu(currentTheme),
      tooltip: 'WinCTL - Windows Service Manager'
    });
    
    trayInstance.on('click', () => {
      require('child_process').exec(`start http://localhost:${PORT}`);
    });
    
    trayInstance.on('right-click', () => {
      const settings = loadSettings();
      const themes = [];
      const themeFiles = fs.existsSync(THEMES_DIR) ? fs.readdirSync(THEMES_DIR) : [];
      themeFiles.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const themeData = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), 'utf8'));
            themes.push({ id: file.replace('.json', ''), ...themeData });
          } catch {}
        }
      });
      const currentTheme = themes.find(t => t.id === settings.theme) || themes[0];
      trayInstance.setMenu(getTrayMenu(currentTheme));
    });
    
    console.log('System tray initialized');
  } catch (err) {
    console.error('Failed to initialize system tray:', err.message);
  }
}

// API to refresh tray menu (called when theme changes)
app.post('/api/tray/refresh', (req, res) => {
  const settings = loadSettings();
  const themes = [];
  const themeFiles = fs.existsSync(THEMES_DIR) ? fs.readdirSync(THEMES_DIR) : [];
  themeFiles.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const themeData = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), 'utf8'));
        themes.push({ id: file.replace('.json', ''), ...themeData });
      } catch {}
    }
  });
  const currentTheme = themes.find(t => t.id === settings.theme) || themes[0];
  
  if (trayInstance) {
    trayInstance.setMenu(getTrayMenu(currentTheme));
  }
  res.json({ ok: true });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WinCTL running on http://127.0.0.1:${PORT}`);
  
  // Migrate settings if needed
  migrateSettings();
  
  // Initialize system tray
  if (!startMinimized) {
    setTimeout(initTray, 1000);
  } else {
    initTray();
  }
  
  // Detect running processes first
  detectRunningProcesses();
  
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
}
