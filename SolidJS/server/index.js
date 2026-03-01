"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logToFile = logToFile;
exports.startDaemon = startDaemon;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const config_js_1 = require("./config.js");
const process_manager_js_1 = require("./process-manager.js");
const routes_js_1 = require("./routes.js");
// ── Logging ───────────────────────────────────────────────────────────────────
function logToFile(msg) {
    try {
        const dir = path_1.default.dirname(config_js_1.LOG_FILE);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.appendFileSync(config_js_1.LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    }
    catch { /* ignore */ }
}
// ── Global error handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    logToFile(`UNCAUGHT: ${err.message}\n${err.stack}`);
    console.error('Uncaught error:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    logToFile(`REJECTION: ${err}`);
    console.error('Unhandled rejection:', err);
});
// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || process.env.WINCTL_PORT || '8080', 10);
function getLocalIPs() {
    const ifaces = os_1.default.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
        const list = ifaces[name];
        if (!list)
            continue;
        for (const iface of list) {
            if (iface.family === 'IPv4' && !iface.internal)
                ips.push(iface.address);
        }
    }
    return ips;
}
let SystrayClass = null;
try {
    const mod = require('systray');
    // Handle CJS default export patterns
    SystrayClass = (mod?.default ?? mod);
}
catch {
    console.log('[TRAY] systray module not available');
}
let trayInstance = null;
function getTrayMenu() {
    return [
        { text: 'WinCTL', isDisabled: true },
        { text: '─────────────────────', isDisabled: true },
        {
            text: `Open Web UI  (:${PORT})`,
            click: () => (0, child_process_1.exec)(`start http://localhost:${PORT}`),
        },
        { text: '─────────────────────', isDisabled: true },
        {
            text: 'Exit WinCTL',
            click: () => {
                if (trayInstance)
                    trayInstance.quit();
                process.exit(0);
            },
        },
    ];
}
function initTray() {
    if (!SystrayClass || os_1.default.platform() !== 'win32')
        return;
    const iconPaths = [
        path_1.default.join(__dirname, '..', 'public', 'icons', 'icon-16.png'),
        path_1.default.join(__dirname, '..', 'dist', 'icons', 'icon-16.png'),
    ];
    const iconPath = iconPaths.find((p) => fs_1.default.existsSync(p));
    if (!iconPath) {
        console.log('[TRAY] Icon not found, skipping tray');
        return;
    }
    try {
        trayInstance = new SystrayClass({
            icon: iconPath,
            menu: getTrayMenu(),
            tooltip: 'WinCTL — Windows Service Manager',
        });
        trayInstance.on('click', () => (0, child_process_1.exec)(`start http://localhost:${PORT}`));
        console.log('[TRAY] System tray initialized');
    }
    catch (err) {
        console.error('[TRAY] Failed to init:', err.message);
    }
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`[STARTUP] WinCTL starting on port ${PORT}`);
    (0, config_js_1.ensureConfigDirs)();
    (0, config_js_1.migrateSettings)();
    // ── Express + Socket.IO ─────────────────────────────────────────────────────
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer);
    app.use(express_1.default.json());
    // Serve built SolidJS UI, fall back to public/
    const distPath = path_1.default.join(__dirname, '..', 'dist');
    const publicPath = path_1.default.join(__dirname, '..', 'public');
    if (fs_1.default.existsSync(distPath)) {
        app.use(express_1.default.static(distPath));
        console.log('[STATIC] Serving SolidJS build from dist/');
    }
    else if (fs_1.default.existsSync(publicPath)) {
        app.use(express_1.default.static(publicPath));
        console.log('[STATIC] Serving from public/ (run build:client for production UI)');
    }
    (0, process_manager_js_1.initProcessManager)(io);
    (0, routes_js_1.setupRoutes)(app, io);
    // ── Socket.IO ───────────────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);
        (0, process_manager_js_1.broadcastStatus)();
        socket.on('subscribe:logs', (id) => socket.join(`logs:${id}`));
        socket.on('get-system-info', () => {
            socket.emit('system-info', {
                hostname: os_1.default.hostname(),
                platform: os_1.default.platform(),
                arch: os_1.default.arch(),
                uptime: os_1.default.uptime(),
                totalMem: os_1.default.totalmem(),
                freeMem: os_1.default.freemem(),
                cpus: os_1.default.cpus().length,
            });
        });
        socket.on('disconnect', () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
        });
    });
    // Handle tray refresh from UI
    io.on('tray:refresh', () => {
        if (trayInstance)
            trayInstance.setMenu(getTrayMenu());
    });
    // ── Server start ────────────────────────────────────────────────────────────
    httpServer.on('error', (err) => {
        logToFile(`SERVER ERROR: ${err.message}`);
        if (err.code === 'EADDRINUSE') {
            console.error(`[ERROR] Port ${PORT} is already in use. Is WinCTL already running?`);
        }
        else {
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
        console.log(`  Log:     ${config_js_1.LOG_FILE}`);
        // Init tray after a short delay to let the server settle
        setTimeout(initTray, 1500);
        // Detect already-running processes then auto-start services
        (0, process_manager_js_1.detectRunningProcesses)().then(() => {
            const config = (0, config_js_1.loadConfig)();
            config.services
                .filter((s) => s.autoStart && (0, process_manager_js_1.getStatus)(s.id) === 'stopped')
                .forEach(async (s) => {
                console.log(`[AUTO-START] ${s.name}`);
                try {
                    await (0, process_manager_js_1.startService)(s);
                }
                catch (e) {
                    console.error(`[AUTO-START] Failed for ${s.name}:`, e);
                }
            });
        });
    });
}
// Export for CLI to start daemon
async function startDaemon() {
    await main();
}
// Only auto-start when run directly (not imported)
// Check if this is being run as a CLI command vs imported as module
const isRunningDirectly = require.main === module;
if (isRunningDirectly) {
    main().catch((err) => {
        logToFile(`MAIN ERROR: ${err.message}\n${err.stack}`);
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
