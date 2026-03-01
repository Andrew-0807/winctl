import { exec } from 'child_process';
import os from 'os';
import type { Express, Request, Response } from 'express';
import type { Server } from 'socket.io';

// Helper to extract string param safely
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : (val ?? '');
}
import type { Service, ValidationResult } from './types.js';
import {
  loadConfig,
  saveConfig,
  loadSettings,
  saveSettings,
  loadThemes,
  saveCustomTheme,
  deleteCustomTheme,
  getThemeById,
  THEMES_DIR
} from './config.js';
import {
  startService,
  stopService,
  getStatus,
  getRegistry,
  broadcastStatus
} from './process-manager.js';

// ── Input validation ──────────────────────────────────────────────────────────

export function sanitizeString(str: unknown, allowEmpty = false): string | null {
  if (!str) return allowEmpty ? '' : null;
  if (typeof str !== 'string') return null;
  // Remove null bytes and control characters except newlines/tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 10000);
}

export function validatePort(port: unknown): string | null {
  if (!port) return null; // No port is OK
  const portNum = parseInt(String(port), 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
  return portNum.toString();
}

export function validateServiceInput(service: Partial<Service> & Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const name = sanitizeString(service.name);
  if (!name) errors.push('Invalid service name');

  const command = sanitizeString(service.command);
  if (!command) errors.push('Invalid command');

  const port = validatePort(service.port);
  if (service.port && !port) errors.push('Invalid port number');

  const args = sanitizeString(service.args, true);
  const cwd = sanitizeString(service.cwd, true);
  const description = sanitizeString(service.description, true);

  // Validate folderId — should be a string or null
  const folderId = service.folderId === null ? null : sanitizeString(service.folderId as string, true);

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      id: service.id as string,
      name: name ?? '',
      command: command ?? '',
      args: args || '',
      cwd: cwd || '',
      port: port || '',
      description: description || '',
      autoRestart: Boolean(service.autoRestart),
      autoStart: Boolean(service.autoStart),
      env: (service.env as Record<string, string>) || {},
      tags: Array.isArray(service.tags) ? (service.tags as string[]) : [],
      minimized: Boolean(service.minimized),
      folderId: folderId || null,
      sortOrder: typeof service.sortOrder === 'number' ? service.sortOrder : Date.now()
    }
  };
}

// ── Autostart (Windows Registry) ──────────────────────────────────────────────

function getExePath(): string {
  return process.execPath;
}

export function isAutostartEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      resolve(false);
      return;
    }
    const regCmd = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL`;
    exec(regCmd, (err, stdout) => {
      resolve(!err && stdout.includes('WinCTL'));
    });
  });
}

export function enableAutostart(): Promise<void> {
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

export function disableAutostart(): Promise<void> {
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

// ── Route setup ───────────────────────────────────────────────────────────────

export function setupRoutes(app: Express, io: Server, onTrayRefresh?: () => void, onShutdown?: (force: boolean) => void): void {

  // ── Services ────────────────────────────────────────────────────────────────

  app.get('/api/services', (_req: Request, res: Response) => {
    const config = loadConfig();
    const registry = getRegistry();

    // Sort services by sortOrder, then by name
    const sortedServices = [...config.services].sort((a, b) => {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : Infinity;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    const data = sortedServices.map(s => ({
      ...s,
      status: getStatus(s.id),
      stateReason: registry.get(s.id)?.stateReason ?? null,
      pid: registry.get(s.id)?.actualPid ?? (registry.get(s.id)?.process as { pid?: number | null } | null)?.pid ?? null,
      startedAt: registry.get(s.id)?.startedAt ?? null,
      restartCount: registry.get(s.id)?.restartCount ?? 0,
      recentLogs: (registry.get(s.id)?.logs ?? []).slice(-50),
    }));
    res.json(data);
  });

  app.post('/api/services', (req: Request, res: Response) => {
    const validation = validateServiceInput(req.body as Partial<Service>);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    const config = loadConfig();
    const svc: Service = {
      ...validation.sanitized,
      id: Date.now().toString(36),
      folderId: (req.body as { folderId?: string | null }).folderId ?? null,
      createdAt: new Date().toISOString(),
    };
    config.services.push(svc);
    saveConfig(config);
    broadcastStatus();
    res.json(svc);
  });

  // NOTE: /reorder must be registered BEFORE /:id so Express doesn't treat
  // the literal string "reorder" as a service ID parameter.
  app.put('/api/services/reorder', (req: Request, res: Response) => {
    const orderedIds = req.body as string[];
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'Expected array of service IDs' });
    }

    const config = loadConfig();
    const serviceMap = new Map(config.services.map(s => [s.id, s]));

    // Update sortOrder based on position in array
    orderedIds.forEach((id, index) => {
      const service = serviceMap.get(id);
      if (service) {
        service.sortOrder = index;
      }
    });

    saveConfig(config);
    broadcastStatus();
    res.json({ ok: true });
  });

  app.put('/api/services/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    const idx = config.services.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const validation = validateServiceInput({ ...config.services[idx], ...(req.body as Partial<Service>) });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    config.services[idx] = { ...validation.sanitized, id };
    saveConfig(config);
    broadcastStatus();
    res.json(config.services[idx]);
  });

  app.delete('/api/services/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    stopService(id);
    const config = loadConfig();
    config.services = config.services.filter(s => s.id !== id);
    saveConfig(config);
    getRegistry().delete(id);
    broadcastStatus();
    res.json({ ok: true });
  });

  app.post('/api/services/:id/start', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    const svc = config.services.find(s => s.id === id);
    if (!svc) return res.status(404).json({ error: 'Not found' });
    try {
      const result = await startService(svc);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/services/:id/stop', async (req: Request, res: Response) => {
    const result = await stopService(param(req, 'id'));
    res.json(result);
  });

  app.post('/api/services/:id/restart', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    await stopService(id);
    const config = loadConfig();
    const svc = config.services.find(s => s.id === id);
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

  app.get('/api/services/:id/logs', (req: Request, res: Response) => {
    const entry = getRegistry().get(param(req, 'id'));
    res.json(entry?.logs ?? []);
  });

  // ── Daemon status ───────────────────────────────────────────────────────────

  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ ok: true, pid: process.pid });
  });

  // ── Daemon shutdown ───────────────────────────────────────────────────────────

  app.post('/api/shutdown', (_req: Request, res: Response) => {
    console.log('[SHUTDOWN] Daemon shutdown requested via API');
    res.json({ ok: true });
    // Graceful shutdown after response is sent
    setTimeout(() => {
      if (onShutdown) onShutdown(false);
      else process.exit(0);
    }, 200);
  });

  app.post('/api/shutdown/force', (_req: Request, res: Response) => {
    console.log('[SHUTDOWN] Force shutdown requested via API');
    res.json({ ok: true });
    // Force shutdown after response is sent
    setTimeout(() => {
      if (onShutdown) onShutdown(true);
      else process.exit(1);
    }, 200);
  });

  // ── Folders ─────────────────────────────────────────────────────────────────

  app.get('/api/folders', (_req: Request, res: Response) => {
    const config = loadConfig();
    res.json(config.folders || []);
  });

  app.post('/api/folders', (req: Request, res: Response) => {
    const config = loadConfig();
    const folder = {
      id: Date.now().toString(36),
      name: (req.body as { name?: string }).name || 'New Folder',
      createdAt: new Date().toISOString(),
    };
    config.folders = config.folders || [];
    config.folders.push(folder);
    saveConfig(config);
    broadcastStatus();
    res.json(folder);
  });

  app.put('/api/folders/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    const idx = (config.folders || []).findIndex(f => f.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    config.folders[idx] = { ...config.folders[idx], ...(req.body as object), id };
    saveConfig(config);
    broadcastStatus();
    res.json(config.folders[idx]);
  });

  app.delete('/api/folders/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    config.folders = (config.folders || []).filter(f => f.id !== id);
    // Move services in this folder to root
    config.services = (config.services || []).map(s =>
      s.folderId === id ? { ...s, folderId: null } : s
    );
    saveConfig(config);
    broadcastStatus();
    res.json({ ok: true });
  });

  app.post('/api/folders/:id/start', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    const folderServices = (config.services || []).filter(
      s => s.folderId === id && getStatus(s.id) === 'stopped'
    );
    let started = 0;
    for (const s of folderServices) {
      try {
        await startService(s);
        started++;
      } catch (e) {
        console.error(`Failed to start ${s.name}:`, e);
      }
    }
    res.json({ ok: true, started });
  });

  app.post('/api/folders/:id/stop', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const config = loadConfig();
    const folderServices = (config.services || []).filter(
      s => s.folderId === id && getStatus(s.id) === 'running'
    );
    let stopped = 0;
    for (const s of folderServices) {
      const result = await stopService(s.id);
      if (result.ok) stopped++;
    }
    res.json({ ok: true, stopped });
  });

  // ── System ──────────────────────────────────────────────────────────────────

  app.get('/api/system', (_req: Request, res: Response) => {
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

  // ── Settings ────────────────────────────────────────────────────────────────

  app.get('/api/settings', (_req: Request, res: Response) => {
    const settings = loadSettings();
    res.json(settings);
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings, ...(req.body as object) };
    saveSettings(updatedSettings);
    res.json(updatedSettings);
  });

  // ── Autostart ───────────────────────────────────────────────────────────────

  app.get('/api/autostart', async (_req: Request, res: Response) => {
    const enabled = await isAutostartEnabled();
    res.json({ enabled });
  });

  app.post('/api/autostart/enable', async (_req: Request, res: Response) => {
    try {
      await enableAutostart();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/autostart/disable', async (_req: Request, res: Response) => {
    try {
      await disableAutostart();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Themes ──────────────────────────────────────────────────────────────────

  app.get('/api/themes', (_req: Request, res: Response) => {
    const themes = loadThemes();
    res.json(themes);
  });

  app.get('/api/themes/:id', (req: Request, res: Response) => {
    const theme = getThemeById(param(req, 'id'));
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json(theme);
  });

  app.post('/api/themes', (req: Request, res: Response) => {
    const { id, name, author, colors } = req.body as {
      id?: string;
      name?: string;
      author?: string;
      colors?: Record<string, string>;
    };

    if (!id || !name || !colors) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const theme = saveCustomTheme(id, {
      name,
      author: author || 'User',
      builtIn: false,
      colors: colors as unknown as import('./types.js').ThemeColors
    });
    res.json(theme);
  });

  app.delete('/api/themes/:id', (req: Request, res: Response) => {
    const result = deleteCustomTheme(param(req, 'id'));
    if (!result.ok) {
      const status = result.error === 'Theme not found' ? 404 : 403;
      return res.status(status).json({ error: result.error });
    }
    res.json({ ok: true });
  });

  // ── Tray refresh ─────────────────────────────────────────────────────────────

  app.post('/api/tray/refresh', (_req: Request, res: Response) => {
    // Call the tray refresh handler directly — do NOT use io.emit('tray:refresh')
    // because io.on('tray:refresh') is NOT a socket-message event and never fires.
    if (onTrayRefresh) onTrayRefresh();
    res.json({ ok: true });
  });
}
