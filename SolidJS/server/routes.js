"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = sanitizeString;
exports.validatePort = validatePort;
exports.validateServiceInput = validateServiceInput;
exports.isAutostartEnabled = isAutostartEnabled;
exports.enableAutostart = enableAutostart;
exports.disableAutostart = disableAutostart;
exports.setupRoutes = setupRoutes;
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
// Helper to extract string param safely
function param(req, name) {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : (val ?? '');
}
const config_js_1 = require("./config.js");
const process_manager_js_1 = require("./process-manager.js");
// ── Input validation ──────────────────────────────────────────────────────────
function sanitizeString(str, allowEmpty = false) {
    if (!str)
        return allowEmpty ? '' : null;
    if (typeof str !== 'string')
        return null;
    // Remove null bytes and control characters except newlines/tabs
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 10000);
}
function validatePort(port) {
    if (!port)
        return null; // No port is OK
    const portNum = parseInt(String(port), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535)
        return null;
    return portNum.toString();
}
function validateServiceInput(service) {
    const errors = [];
    const name = sanitizeString(service.name);
    if (!name)
        errors.push('Invalid service name');
    const command = sanitizeString(service.command);
    if (!command)
        errors.push('Invalid command');
    const port = validatePort(service.port);
    if (service.port && !port)
        errors.push('Invalid port number');
    const args = sanitizeString(service.args, true);
    const cwd = sanitizeString(service.cwd, true);
    const description = sanitizeString(service.description, true);
    // Validate folderId — should be a string or null
    const folderId = service.folderId === null ? null : sanitizeString(service.folderId, true);
    return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
            id: service.id,
            name: name ?? '',
            command: command ?? '',
            args: args || '',
            cwd: cwd || '',
            port: port || '',
            description: description || '',
            autoRestart: Boolean(service.autoRestart),
            autoStart: Boolean(service.autoStart),
            env: service.env || {},
            tags: Array.isArray(service.tags) ? service.tags : [],
            minimized: Boolean(service.minimized),
            folderId: folderId || null,
            sortOrder: typeof service.sortOrder === 'number' ? service.sortOrder : Date.now()
        }
    };
}
// ── Autostart (Windows Registry) ──────────────────────────────────────────────
function getExePath() {
    return process.execPath;
}
function isAutostartEnabled() {
    return new Promise((resolve) => {
        if (os_1.default.platform() !== 'win32') {
            resolve(false);
            return;
        }
        const regCmd = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL`;
        (0, child_process_1.exec)(regCmd, (err, stdout) => {
            resolve(!err && stdout.includes('WinCTL'));
        });
    });
}
function enableAutostart() {
    return new Promise((resolve, reject) => {
        if (os_1.default.platform() !== 'win32') {
            reject(new Error('Autostart only supported on Windows'));
            return;
        }
        const exePath = getExePath();
        const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL /t REG_SZ /d "\\"${exePath}\\" --minimized --autostart" /f`;
        (0, child_process_1.exec)(regCmd, (err) => {
            if (err) {
                reject(err);
            }
            else {
                console.log('Autostart enabled');
                resolve();
            }
        });
    });
}
function disableAutostart() {
    return new Promise((resolve) => {
        if (os_1.default.platform() !== 'win32') {
            resolve();
            return;
        }
        const regCmd = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v WinCTL /f`;
        (0, child_process_1.exec)(regCmd, () => {
            console.log('Autostart disabled');
            resolve();
        });
    });
}
// ── Route setup ───────────────────────────────────────────────────────────────
function setupRoutes(app, io) {
    // ── Services ────────────────────────────────────────────────────────────────
    app.get('/api/services', (_req, res) => {
        const config = (0, config_js_1.loadConfig)();
        const registry = (0, process_manager_js_1.getRegistry)();
        // Sort services by sortOrder, then by name
        const sortedServices = [...config.services].sort((a, b) => {
            const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : Infinity;
            const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : Infinity;
            if (orderA !== orderB)
                return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
        const data = sortedServices.map(s => ({
            ...s,
            status: (0, process_manager_js_1.getStatus)(s.id),
            stateReason: registry.get(s.id)?.stateReason ?? null,
            pid: registry.get(s.id)?.actualPid ?? registry.get(s.id)?.process?.pid ?? null,
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
        const config = (0, config_js_1.loadConfig)();
        const svc = {
            ...validation.sanitized,
            id: Date.now().toString(36),
            folderId: req.body.folderId ?? null,
            createdAt: new Date().toISOString(),
        };
        config.services.push(svc);
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json(svc);
    });
    app.put('/api/services/:id', (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        const idx = config.services.findIndex(s => s.id === id);
        if (idx === -1)
            return res.status(404).json({ error: 'Not found' });
        const validation = validateServiceInput({ ...config.services[idx], ...req.body });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors.join(', ') });
        }
        config.services[idx] = { ...validation.sanitized, id };
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json(config.services[idx]);
    });
    app.delete('/api/services/:id', (req, res) => {
        const id = param(req, 'id');
        (0, process_manager_js_1.stopService)(id);
        const config = (0, config_js_1.loadConfig)();
        config.services = config.services.filter(s => s.id !== id);
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.getRegistry)().delete(id);
        (0, process_manager_js_1.broadcastStatus)();
        res.json({ ok: true });
    });
    app.put('/api/services/reorder', (req, res) => {
        const orderedIds = req.body;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'Expected array of service IDs' });
        }
        const config = (0, config_js_1.loadConfig)();
        const serviceMap = new Map(config.services.map(s => [s.id, s]));
        // Update sortOrder based on position in array
        orderedIds.forEach((id, index) => {
            const service = serviceMap.get(id);
            if (service) {
                service.sortOrder = index;
            }
        });
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json({ ok: true });
    });
    app.post('/api/services/:id/start', async (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        const svc = config.services.find(s => s.id === id);
        if (!svc)
            return res.status(404).json({ error: 'Not found' });
        try {
            const result = await (0, process_manager_js_1.startService)(svc);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/services/:id/stop', async (req, res) => {
        const result = await (0, process_manager_js_1.stopService)(param(req, 'id'));
        res.json(result);
    });
    app.post('/api/services/:id/restart', async (req, res) => {
        const id = param(req, 'id');
        await (0, process_manager_js_1.stopService)(id);
        const config = (0, config_js_1.loadConfig)();
        const svc = config.services.find(s => s.id === id);
        if (!svc)
            return res.status(404).json({ error: 'Not found' });
        setTimeout(async () => {
            try {
                await (0, process_manager_js_1.startService)(svc);
            }
            catch (error) {
                console.error('Restart error:', error);
            }
        }, 500);
        res.json({ ok: true });
    });
    app.get('/api/services/:id/logs', (req, res) => {
        const entry = (0, process_manager_js_1.getRegistry)().get(param(req, 'id'));
        res.json(entry?.logs ?? []);
    });
    // ── Daemon shutdown ───────────────────────────────────────────────────────────
    app.post('/api/shutdown', (_req, res) => {
        console.log('[SHUTDOWN] Daemon shutdown requested via API');
        res.json({ ok: true });
        // Force close any child processes before exiting
        setTimeout(() => {
            process.exit(0);
        }, 200);
    });
    app.post('/api/shutdown/force', (_req, res) => {
        console.log('[SHUTDOWN] Force shutdown requested via API');
        res.json({ ok: true });
        // Kill all child processes aggressively
        if (process.platform === 'win32') {
            (0, child_process_1.exec)('taskkill /F /T /PID ' + process.pid);
        }
        process.exit(1);
    });
    // ── Folders ─────────────────────────────────────────────────────────────────
    app.get('/api/folders', (_req, res) => {
        const config = (0, config_js_1.loadConfig)();
        res.json(config.folders || []);
    });
    app.post('/api/folders', (req, res) => {
        const config = (0, config_js_1.loadConfig)();
        const folder = {
            id: Date.now().toString(36),
            name: req.body.name || 'New Folder',
            createdAt: new Date().toISOString(),
        };
        config.folders = config.folders || [];
        config.folders.push(folder);
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json(folder);
    });
    app.put('/api/folders/:id', (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        const idx = (config.folders || []).findIndex(f => f.id === id);
        if (idx === -1)
            return res.status(404).json({ error: 'Not found' });
        config.folders[idx] = { ...config.folders[idx], ...req.body, id };
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json(config.folders[idx]);
    });
    app.delete('/api/folders/:id', (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        config.folders = (config.folders || []).filter(f => f.id !== id);
        // Move services in this folder to root
        config.services = (config.services || []).map(s => s.folderId === id ? { ...s, folderId: null } : s);
        (0, config_js_1.saveConfig)(config);
        (0, process_manager_js_1.broadcastStatus)();
        res.json({ ok: true });
    });
    app.post('/api/folders/:id/start', async (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        const folderServices = (config.services || []).filter(s => s.folderId === id && (0, process_manager_js_1.getStatus)(s.id) === 'stopped');
        let started = 0;
        for (const s of folderServices) {
            try {
                await (0, process_manager_js_1.startService)(s);
                started++;
            }
            catch (e) {
                console.error(`Failed to start ${s.name}:`, e);
            }
        }
        res.json({ ok: true, started });
    });
    app.post('/api/folders/:id/stop', async (req, res) => {
        const id = param(req, 'id');
        const config = (0, config_js_1.loadConfig)();
        const folderServices = (config.services || []).filter(s => s.folderId === id && (0, process_manager_js_1.getStatus)(s.id) === 'running');
        let stopped = 0;
        for (const s of folderServices) {
            const result = await (0, process_manager_js_1.stopService)(s.id);
            if (result.ok)
                stopped++;
        }
        res.json({ ok: true, stopped });
    });
    // ── System ──────────────────────────────────────────────────────────────────
    app.get('/api/system', (_req, res) => {
        res.json({
            hostname: os_1.default.hostname(),
            platform: os_1.default.platform(),
            arch: os_1.default.arch(),
            uptime: os_1.default.uptime(),
            totalMem: os_1.default.totalmem(),
            freeMem: os_1.default.freemem(),
            cpus: os_1.default.cpus().length,
            loadavg: os_1.default.loadavg(),
        });
    });
    // ── Settings ────────────────────────────────────────────────────────────────
    app.get('/api/settings', (_req, res) => {
        const settings = (0, config_js_1.loadSettings)();
        res.json(settings);
    });
    app.put('/api/settings', (req, res) => {
        const currentSettings = (0, config_js_1.loadSettings)();
        const updatedSettings = { ...currentSettings, ...req.body };
        (0, config_js_1.saveSettings)(updatedSettings);
        res.json(updatedSettings);
    });
    // ── Autostart ───────────────────────────────────────────────────────────────
    app.get('/api/autostart', async (_req, res) => {
        const enabled = await isAutostartEnabled();
        res.json({ enabled });
    });
    app.post('/api/autostart/enable', async (_req, res) => {
        try {
            await enableAutostart();
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/autostart/disable', async (_req, res) => {
        try {
            await disableAutostart();
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ── Themes ──────────────────────────────────────────────────────────────────
    app.get('/api/themes', (_req, res) => {
        const themes = (0, config_js_1.loadThemes)();
        res.json(themes);
    });
    app.get('/api/themes/:id', (req, res) => {
        const theme = (0, config_js_1.getThemeById)(param(req, 'id'));
        if (!theme) {
            return res.status(404).json({ error: 'Theme not found' });
        }
        res.json(theme);
    });
    app.post('/api/themes', (req, res) => {
        const { id, name, author, colors } = req.body;
        if (!id || !name || !colors) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const theme = (0, config_js_1.saveCustomTheme)(id, {
            name,
            author: author || 'User',
            builtIn: false,
            colors: colors
        });
        res.json(theme);
    });
    app.delete('/api/themes/:id', (req, res) => {
        const result = (0, config_js_1.deleteCustomTheme)(param(req, 'id'));
        if (!result.ok) {
            const status = result.error === 'Theme not found' ? 404 : 403;
            return res.status(status).json({ error: result.error });
        }
        res.json({ ok: true });
    });
    // ── Tray refresh ─────────────────────────────────────────────────────────────
    app.post('/api/tray/refresh', (_req, res) => {
        // Tray refresh is handled in index.ts via the trayInstance
        // Emit a tray-refresh event so index.ts can handle it
        io.emit('tray:refresh');
        res.json({ ok: true });
    });
}
