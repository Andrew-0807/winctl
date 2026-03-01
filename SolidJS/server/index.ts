import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  ensureConfigDirs,
  loadConfig,
  loadSettings,
  migrateSettings,
  LOG_FILE,
} from './config.js';
import {
  initProcessManager,
  broadcastStatus,
  detectRunningProcesses,
  stopService,
  getRegistry,
  getStatus,
} from './process-manager.js';
import { setupRoutes } from './routes.js';

// ── Logging ───────────────────────────────────────────────────────────────────

export function logToFile(msg: string): void {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* ignore */ }
}

// ── Global error handlers ─────────────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  logToFile(`UNCAUGHT: ${err.message}\n${err.stack}`);
  console.error('Uncaught error:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err: unknown) => {
  logToFile(`REJECTION: ${err}`);
  console.error('Unhandled rejection:', err);
});

// ── Config ────────────────────────────────────────────────────────────────────

// Use WINCTL_PORT only — process.env.PORT is not set by Windows Service Manager
// and would log as "undefined", causing confusing startup messages.
const PORT = parseInt(process.env.WINCTL_PORT || '8080', 10);

function getLocalIPs(): string[] {
  const ifaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// ── System tray ────────────────────────────────────────────────────────────────
// systray package API: new SysTray({ menu: { icon, title, tooltip, items: [...] } })
// Each item: { title, tooltip, checked, enabled, hidden?, click() (not used by lib) }
// Clicks are handled via instance.onClick(action => ...) where action.seq_id identifies item

interface TrayMenuItem {
  title: string;
  tooltip: string;
  checked: boolean;
  enabled: boolean;
}

interface SysTrayMenu {
  icon: string;   // base64 or path
  title: string;
  tooltip: string;
  items: TrayMenuItem[];
}

interface SysTrayInstance {
  onClick(listener: (action: { seq_id: number; item: TrayMenuItem }) => void): SysTrayInstance;
  sendAction(action: object): SysTrayInstance;
  kill(exitNode?: boolean): void;
}

interface SysTrayConstructor {
  new(conf: { menu: SysTrayMenu; debug?: boolean; copyDir?: boolean }): SysTrayInstance;
}

let SysTrayClass: SysTrayConstructor | null = null;
try {
  const mod = require('systray');
  SysTrayClass = (mod?.default ?? mod) as SysTrayConstructor;
} catch {
  console.log('[TRAY] systray module not available');
}

let trayInstance: SysTrayInstance | null = null;

// Menu item indices (must match the items array order)
const TRAY_IDX_OPEN = 0;
const TRAY_IDX_EXIT = 1;

function getTrayMenuDef(iconBase64: string): SysTrayMenu {
  return {
    icon: iconBase64,
    title: '',
    tooltip: 'WinCTL — Windows Service Manager',
    items: [
      {
        title: `Open Web UI  (:${PORT})`,
        tooltip: `Open http://localhost:${PORT} in browser`,
        checked: false,
        enabled: true,
      },
      {
        title: 'Exit WinCTL',
        tooltip: 'Stop WinCTL daemon',
        checked: false,
        enabled: true,
      },
    ],
  };
}

function initTray(): void {
  if (!SysTrayClass || os.platform() !== 'win32') return;

  // Resolve icon relative to the actual exe location first (works in pkg builds).
  // Fall back to __dirname-relative paths for dev mode (tsx / ts-node).
  const exeDir = path.dirname(process.execPath);
  const iconPaths = [
    path.join(exeDir, 'public', 'icons', 'icon-16.png'),
    path.join(exeDir, 'icons', 'icon-16.png'),
    path.join(__dirname, '..', 'public', 'icons', 'icon-16.png'),
    path.join(__dirname, '..', 'dist', 'icons', 'icon-16.png'),
  ];
  const iconPath = iconPaths.find((p) => fs.existsSync(p));
  if (!iconPath) {
    console.log('[TRAY] Icon not found, skipping tray');
    return;
  }

  // systray expects icon as base64-encoded PNG
  let iconBase64: string;
  try {
    iconBase64 = fs.readFileSync(iconPath).toString('base64');
  } catch (err) {
    console.error('[TRAY] Failed to read icon:', (err as Error).message);
    return;
  }

  try {
    trayInstance = new SysTrayClass({ menu: getTrayMenuDef(iconBase64) });

    trayInstance.onClick((action) => {
      switch (action.seq_id) {
        case TRAY_IDX_OPEN:
          exec(`start http://localhost:${PORT}`);
          break;
        case TRAY_IDX_EXIT:
          trayInstance?.kill(false);
          process.exit(0);
          break;
      }
    });

    console.log('[TRAY] System tray initialized');
  } catch (err) {
    console.error('[TRAY] Failed to init:', (err as Error).message);
  }
}

// Called when tray menu needs refreshing (e.g. after service state changes)
export function refreshTrayMenu(): void {
  // systray does not expose a direct setMenu — the icon must stay the same.
  // A full restart of the tray process would be needed for dynamic menus.
  // For now, this is a no-op placeholder (tray shows static items).
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;
let httpServerRef: ReturnType<typeof createServer> | null = null;

async function shutdownDaemon(force: boolean): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const label = force ? 'Force' : 'Graceful';
  console.log(`[SHUTDOWN] ${label} shutdown initiated`);
  logToFile(`${label} shutdown initiated`);

  // Hard timeout — guarantee exit even if cleanup hangs
  const hardTimeout = setTimeout(() => {
    console.log('[SHUTDOWN] Hard timeout reached, forcing exit');
    process.exit(1);
  }, 5000);
  hardTimeout.unref();

  if (force) {
    // Force: skip service cleanup, exit immediately
    try { trayInstance?.kill(false); } catch { /* ignore */ }
    process.exit(1);
    return;
  }

  // Graceful: stop all running managed services
  try {
    const registry = getRegistry();
    const stopPromises: Promise<unknown>[] = [];
    for (const [id] of registry) {
      if (getStatus(id) === 'running' || getStatus(id) === 'starting') {
        stopPromises.push(stopService(id).catch(e => {
          console.log(`[SHUTDOWN] Error stopping ${id}:`, (e as Error).message);
        }));
      }
    }
    if (stopPromises.length > 0) {
      console.log(`[SHUTDOWN] Stopping ${stopPromises.length} managed service(s)...`);
      await Promise.all(stopPromises);
      console.log('[SHUTDOWN] All managed services stopped');
    }
  } catch (e) {
    console.log('[SHUTDOWN] Error during service cleanup:', (e as Error).message);
  }

  // Close HTTP server
  try {
    httpServerRef?.close();
  } catch { /* ignore */ }

  // Kill tray
  try { trayInstance?.kill(false); } catch { /* ignore */ }

  console.log('[SHUTDOWN] Cleanup complete, exiting');
  process.exit(0);
}

// Export for routes to call
export { shutdownDaemon };


// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[STARTUP] WinCTL starting on port ${PORT}`);

  ensureConfigDirs();
  migrateSettings();

  // ── Express + Socket.IO ─────────────────────────────────────────────────────

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  app.use(express.json());

  // Serve built SolidJS UI, fall back to public/
  // In pkg builds, __dirname is inside the virtual snapshot — use exe dir first
  const exeDir = path.dirname(process.execPath);
  const staticCandidates = [
    path.join(exeDir, 'dist'),           // next to winctl-daemon.exe
    path.join(exeDir, 'public'),         // next to winctl-daemon.exe
    path.join(__dirname, '..', 'dist'),  // dev mode (dist-server/../dist)
    path.join(__dirname, '..', 'public'),// dev mode
  ];
  let distPath = '';
  let publicPath = '';
  for (const candidate of staticCandidates) {
    if (fs.existsSync(candidate)) {
      if (!distPath && candidate.endsWith('dist')) distPath = candidate;
      if (!publicPath && candidate.endsWith('public')) publicPath = candidate;
    }
  }

  if (distPath) {
    app.use(express.static(distPath));
    console.log(`[STATIC] Serving SolidJS build from ${distPath}`);
  } else if (publicPath) {
    app.use(express.static(publicPath));
    console.log(`[STATIC] Serving from ${publicPath}`);
  } else {
    console.log('[STATIC] No static files found — UI will not be available');
  }

  initProcessManager(io);
  httpServerRef = httpServer;
  setupRoutes(app, io, () => {
    // Tray menu refresh is a no-op: systray doesn't support live menu updates.
    // The tray shows static items (Open Web UI, Exit). Refresh acknowledged.
  }, shutdownDaemon);

  // Fallback for SPA routing - must be AFTER API routes
  app.get('*', (req, res) => {
    const distIndex = path.join(distPath, 'index.html');
    const publicIndex = path.join(publicPath, 'index.html');

    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else if (fs.existsSync(publicIndex)) {
      res.sendFile(publicIndex);
    } else {
      res.status(404).send('index.html not found - run build:client');
    }
  });


  // ── Socket.IO ───────────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    broadcastStatus();

    socket.on('subscribe:logs', (id: string) => socket.join(`logs:${id}`));

    socket.on('get-system-info', () => {
      socket.emit('system-info', {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        cpus: os.cpus().length,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  // NOTE: tray:refresh is handled directly in the POST /api/tray/refresh route
  // (which calls trayInstance.setMenu directly). io.on('tray:refresh', ...) is
  // NOT a socket-message listener — it would fire on every new client connection.

  // ── Server start ────────────────────────────────────────────────────────────

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    logToFile(`SERVER ERROR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${PORT} is already in use. Is WinCTL already running?`);
    } else {
      console.error(`[ERROR] Server failed to start: ${err.message}`);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('WinCTL running:');
    console.log(`  Local:   http://127.0.0.1:${PORT}`);
    for (const ip of ips) {
      console.log(`  Network: http://${ip}:${PORT}`);
    }
    console.log(`  Log:     ${LOG_FILE}`);

    // Init tray after a short delay to let the server settle
    setTimeout(initTray, 1500);

    // detectRunningProcesses() already handles auto-start internally.
    // Do NOT add another auto-start loop here — it would start services twice.
    detectRunningProcesses();

    // ── Signal handlers for graceful shutdown ──────────────────────────────────
    process.on('SIGTERM', () => {
      console.log('[SIGNAL] Received SIGTERM');
      shutdownDaemon(false);
    });
    process.on('SIGINT', () => {
      console.log('[SIGNAL] Received SIGINT');
      shutdownDaemon(false);
    });
  });
}

// Export for CLI to start daemon (optional - not used in current approach)
export async function startDaemon(): Promise<void> {
  await main();
}

main().catch((err) => {
  logToFile(`MAIN ERROR: ${(err as Error).message}\n${(err as Error).stack}`);
  console.error('Fatal error:', err);
  process.exit(1);
});
