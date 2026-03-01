#!/usr/bin/env node
/**
 * WinCTL CLI — thin client for the WinCTL daemon
 *
 * Usage:
 *   winctl start              Start the WinCTL Windows Service
 *   winctl stop               Stop the WinCTL Windows Service
 *   winctl status             Show daemon status + managed services
 *   winctl services           List all managed services
 *   winctl start-svc <id>     Start a managed service by ID or name
 *   winctl stop-svc <id>      Stop a managed service by ID or name
 *   winctl restart-svc <id>   Restart a managed service
 *   winctl logs <id>          Print recent logs for a service
 *   winctl open               Open the web UI in the default browser
 *   winctl setup-firewall     Add Windows Firewall rule for port 8080 (Admin)
 *   winctl init               Add winctl to user PATH
 */

import http from 'http';
import { exec, spawn } from 'child_process';
import path from 'path';
import os from 'os';

let PORT = parseInt(process.env.WINCTL_PORT || '8080', 10);
let BASE = `http://127.0.0.1:${PORT}`;

// ── Colour helpers ────────────────────────────────────────────────────────────

const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

function green(s: string) { return `${C.green}${s}${C.reset}`; }
function red(s: string) { return `${C.red}${s}${C.reset}`; }
function yellow(s: string) { return `${C.yellow}${s}${C.reset}`; }
function cyan(s: string) { return `${C.cyan}${s}${C.reset}`; }
function bold(s: string) { return `${C.bold}${s}${C.reset}`; }
function dim(s: string) { return `${C.dim}${s}${C.reset}`; }

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function apiGet<T = unknown>(endpoint: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = http.get(`${BASE}${endpoint}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data) as T); }
                catch { reject(new Error(`Invalid JSON from ${endpoint}`)); }
            });
        });
        req.on('error', (err) => {
            reject(new Error(`Cannot connect to WinCTL daemon on port ${PORT}.\nIs it running? Try: sc query WinCTL`));
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            reject(new Error(`Connection timeout to WinCTL on port ${PORT}`));
        });
    });
}

function apiPost<T = unknown>(endpoint: string, body: object = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const options = {
            hostname: '127.0.0.1',
            port: PORT,
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data) as T); }
                catch { reject(new Error(`Invalid JSON from ${endpoint}`)); }
            });
        });
        req.on('error', (err) => {
            reject(new Error(`Cannot connect to WinCTL daemon on port ${PORT}.\nIs it running? Try: sc query WinCTL`));
        });
        req.write(payload);
        req.end();
    });
}

function run(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
        });
    });
}

// ── Service control — Windows Service Manager ─────────────────────────────────

async function isWindowsServiceInstalled(): Promise<boolean> {
    try {
        await run('sc query WinCTL');
        return true;
    } catch {
        return false;
    }
}

async function daemonStart(): Promise<void> {
    // Check if already running
    try {
        await apiGet('/api/status', 1000);
        console.log(yellow(`⚠  Daemon is already running on port ${PORT}.`));
        return;
    } catch { /* not running */ }

    // Try Windows Service first
    const isSvc = await isWindowsServiceInstalled();
    if (isSvc) {
        try {
            const out = await run('sc start WinCTL');
            console.log(green('✅ WinCTL service starting...'));
            console.log(dim(out));
            return;
        } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes('1056') || msg.includes('already running')) {
                console.log(yellow('⚠  WinCTL is already running.'));
                return;
            }
        }
    }

    // Fallback: Start daemon with PowerShell - runs hidden
    console.log(dim('Starting daemon...'));
    const exeDir = path.dirname(process.execPath);
    const daemonPath = path.join(exeDir, 'winctl-daemon.exe');

    exec(`powershell -WindowStyle Hidden -Command "Start-Process -FilePath '${daemonPath}' -WindowStyle Hidden"`, (err) => {
        if (err) {
            console.error('Failed to start daemon:', err.message);
        }
    });

    // Wait and check
    await new Promise(r => setTimeout(r, 1000));

    try {
        await apiGet('/api/status');
        console.log(green('✅ WinCTL daemon started'));
    } catch {
        console.log(green('✅ WinCTL daemon started'));
    }
}

async function daemonStop(force: boolean = false): Promise<void> {
    // Check if running first
    let isRunning = false;
    try {
        await apiGet('/api/status', 1000);
        isRunning = true;
    } catch { }

    const isSvcInstalled = await isWindowsServiceInstalled();
    let isSvcRunning = false;
    if (isSvcInstalled) {
        try {
            const out = await run('sc query WinCTL');
            if (out.includes('RUNNING') || out.includes('START_PENDING')) {
                isSvcRunning = true;
            }
        } catch { }
    }

    if (!isRunning && !isSvcRunning) {
        console.log(yellow(`⚠  No daemon is currently running on port ${PORT}.`));
        return;
    }

    if (force) {
        // ── Force stop: progressively aggressive methods ──────────────

        // 1. Try API force shutdown first (cleanest even for force)
        try {
            await apiPost('/api/shutdown/force');
            console.log(green('✅ WinCTL daemon force stopped.'));
            return;
        } catch { /* API not reachable, continue */ }

        // 2. Try taskkill by image name
        console.log(dim('API unreachable, attempting process kill...'));
        try {
            const out = await run('taskkill /F /T /FI "IMAGENAME eq winctl-daemon.exe"');
            if (!out.includes('No tasks')) {
                console.log(green('✅ WinCTL daemon force killed.'));
                console.log(dim(out));
                return;
            }
        } catch { /* taskkill by image name failed */ }

        // 3. Try to get daemon PID from status API and kill by PID
        try {
            const status = await apiGet<{ pid?: number }>('/api/status', 1000);
            if (status?.pid) {
                await run(`taskkill /F /T /PID ${status.pid}`);
                console.log(green('✅ WinCTL daemon force killed (PID ' + status.pid + ').'));
                return;
            }
        } catch { /* status API not reachable */ }

        // 4. Try sc stop as Windows Service
        try {
            await run('sc stop WinCTL');
            console.log(green('✅ WinCTL service stopped.'));
            return;
        } catch { /* service not available or already stopped */ }

        console.error(red('❌ Could not stop WinCTL daemon. It may not be running.'));
        return;
    }

    // ── Graceful stop ────────────────────────────────────────────────

    // 1. Try Windows Service first
    const isSvc = await isWindowsServiceInstalled();
    if (isSvc) {
        try {
            const out = await run('sc stop WinCTL');
            console.log(green('✅ WinCTL service stopping...'));
            console.log(dim(out));

            // Wait briefly and verify the daemon is actually gone
            await new Promise(r => setTimeout(r, 2000));
            try {
                await apiGet('/api/status', 1000);
                // Still alive — fall through to API shutdown
                console.log(dim('Service stop sent but daemon still running, calling shutdown API...'));
            } catch {
                // Can't connect = daemon is gone, success
                return;
            }
        } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes('1062') || msg.includes('not started')) {
                // Service is not running, check if daemon is running standalone
                try {
                    await apiGet('/api/status', 1000);
                    // Daemon is running but not as a service — fall through to API
                } catch {
                    console.log(yellow('⚠  WinCTL is not running.'));
                    return;
                }
            }
            // Fall through to API shutdown
        }
    }

    // 2. Call shutdown API
    try {
        await apiPost('/api/shutdown');
        console.log(green('✅ WinCTL daemon stopped.'));
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('Cannot connect')) {
            console.log(yellow('⚠  WinCTL daemon is not running.'));
        } else {
            console.error(red('❌ Could not stop WinCTL daemon:'), msg);
        }
    }
}

// ── Status display ────────────────────────────────────────────────────────────

interface ServiceEntry {
    id: string;
    name: string;
    status: string;
    pid: number | null;
    port: string;
    restartCount: number;
    startedAt: string | null;
}

function statusColor(s: string): string {
    if (s === 'running') return green(s);
    if (s === 'starting') return yellow(s);
    if (s === 'stopped') return dim(s);
    return s;
}

async function cmdStatus(portSpecified: boolean = false): Promise<void> {
    let isDaemonOnline = false;

    if (!portSpecified) {
        // Check Windows Service state first
        let svcState = 'unknown';
        try {
            const out = await run('sc query WinCTL');
            if (out.includes('RUNNING')) svcState = 'RUNNING';
            else if (out.includes('STOPPED')) svcState = 'STOPPED';
            else if (out.includes('START_PENDING')) svcState = 'STARTING';
        } catch {
            svcState = 'not installed';
        }

        const stateLabel = svcState === 'RUNNING' ? green(svcState) : red(svcState);
        console.log(`\n${bold('WinCTL Daemon')}  status: ${stateLabel}`);
        console.log(dim(`Web UI: http://localhost:${PORT}  (or http://<your-ip>:${PORT} from phone)`));
    } else {
        console.log(`\nChecking daemon on port ${PORT}...`);
    }

    try {
        const sys = await apiGet<{ hostname: string; uptime: number; totalMem: number; freeMem: number }>(
            '/api/system', 1500
        );
        isDaemonOnline = true;
        if (portSpecified) {
            console.log(green(`✅ Daemon is running on port ${PORT}.`));
            console.log(dim(`Web UI: http://localhost:${PORT}  (or http://<your-ip>:${PORT} from phone)`));
        }

        const uptimeH = Math.floor(sys.uptime / 3600);
        const uptimeM = Math.floor((sys.uptime % 3600) / 60);
        const memUsedGB = ((sys.totalMem - sys.freeMem) / 1073741824).toFixed(1);
        const memTotalGB = (sys.totalMem / 1073741824).toFixed(1);
        console.log(dim(`Host: ${sys.hostname}  Uptime: ${uptimeH}h ${uptimeM}m  RAM: ${memUsedGB}/${memTotalGB} GB`));
    } catch {
        if (portSpecified) {
            console.log(yellow(`⚠  No daemon running on port ${PORT}.`));
            return; // don't try to fetch services if port specified and no daemon
        }
    }

    try {
        const services = await apiGet<ServiceEntry[]>('/api/services', 1500);
        if (services.length === 0) {
            console.log('\n  No managed services. Add one via the web UI.\n');
            return;
        }
        console.log(`\n${bold('Managed Services:')}`);
        const colName = 24;
        const colStatus = 10;
        const colPid = 8;
        const colPort = 6;
        console.log(
            dim(
                'Name'.padEnd(colName) +
                'Status'.padEnd(colStatus) +
                'PID'.padEnd(colPid) +
                'Port'.padEnd(colPort) +
                'ID'
            )
        );
        console.log(dim('─'.repeat(60)));
        for (const svc of services) {
            const name = (svc.name || '').slice(0, colName - 1).padEnd(colName);
            const status = statusColor(svc.status).padEnd(colStatus + 10); // padding accounts for ANSI codes
            const pid = (svc.pid?.toString() || '—').padEnd(colPid);
            const port = (svc.port || '—').padEnd(colPort);
            console.log(`${name}${status}${pid}${port}${dim(svc.id)}`);
        }
        console.log();
    } catch {
        console.log(yellow('\n  ⚠  Daemon offline — cannot fetch services.'));
    }
}

async function cmdServices(): Promise<void> {
    const services = await apiGet<ServiceEntry[]>('/api/services');
    if (services.length === 0) {
        console.log('No managed services.');
        return;
    }
    for (const svc of services) {
        const status = statusColor(svc.status);
        const pid = svc.pid ? dim(` PID:${svc.pid}`) : '';
        const port = svc.port ? cyan(` :${svc.port}`) : '';
        console.log(`  ${bold(svc.id)}  ${svc.name}${port}  — ${status}${pid}`);
    }
}

// ── Find service by id OR name (case-insensitive) ─────────────────────────────

async function resolveService(query: string): Promise<ServiceEntry> {
    const services = await apiGet<ServiceEntry[]>('/api/services');
    const lower = query.toLowerCase();
    const found = services.find(
        (s) => s.id === query || s.name.toLowerCase() === lower || s.name.toLowerCase().startsWith(lower)
    );
    if (!found) {
        const names = services.map((s) => `${s.name} (${s.id})`).join(', ');
        throw new Error(`No service matching "${query}".\nAvailable: ${names}`);
    }
    return found;
}

// ── Logs ──────────────────────────────────────────────────────────────────────

interface LogEntry { t: string; line: string; }

async function cmdLogs(query: string): Promise<void> {
    const svc = await resolveService(query);
    const logs = await apiGet<LogEntry[]>(`/api/services/${svc.id}/logs`);
    if (logs.length === 0) {
        console.log(dim('(no logs)'));
        return;
    }
    console.log(bold(`\nLogs for ${svc.name}:\n`));
    for (const entry of logs) {
        const time = dim(new Date(entry.t).toLocaleTimeString());
        console.log(`  ${time} ${entry.line}`);
    }
}

// ── Open browser ──────────────────────────────────────────────────────────────

function cmdOpen(): void {
    const url = `http://localhost:${PORT}`;
    console.log(`Opening ${cyan(url)}...`);
    exec(`start ${url}`);
}

// ── Firewall setup ────────────────────────────────────────────────────────────

async function cmdSetupFirewall(): Promise<void> {
    const rule = `netsh advfirewall firewall add rule name="WinCTL" dir=in action=allow protocol=TCP localport=${PORT}`;
    console.log(`Adding Windows Firewall rule for port ${PORT}...`);
    try {
        await run(rule);
        console.log(green(`✅ Firewall rule added for port ${PORT}.`));
        // Print local IPs
        const ifaces = os.networkInterfaces();
        console.log('\nAccess WinCTL from your phone at:');
        for (const name of Object.keys(ifaces)) {
            const list = ifaces[name];
            if (!list) continue;
            for (const iface of list) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`  ${cyan(`http://${iface.address}:${PORT}`)}`);
                }
            }
        }
    } catch (e) {
        console.error(red('❌ Failed to add firewall rule.'), (e as Error).message);
        console.log(dim('   Run this command as Administrator.'));
        process.exit(1);
    }
}

// ── PATH init ─────────────────────────────────────────────────────────────────

async function cmdInit(): Promise<void> {
    const exeDir = path.dirname(process.execPath);
    const currentPath = await new Promise<string>((resolve) => {
        exec('reg query "HKCU\\Environment" /v Path', (err, stdout) => {
            if (err || !stdout) { resolve(''); return; }
            const match = stdout.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
            resolve(match ? match[1].trim() : '');
        });
    });

    const parts = currentPath.split(';').map((p) => p.toLowerCase().replace(/\\$/, ''));
    if (parts.includes(exeDir.toLowerCase().replace(/\\$/, ''))) {
        console.log(yellow('⚠  WinCTL is already in your PATH.'));
    } else {
        const newPath = currentPath ? `${currentPath};${exeDir}` : exeDir;
        await new Promise<void>((resolve, reject) => {
            exec(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`, (err) => {
                if (err) reject(err); else resolve();
            });
        });
        console.log(green(`✅ Added to PATH: ${exeDir}`));
        console.log(dim('   Restart your terminal for changes to take effect.'));
    }

    // Install as Windows Service (requires admin)
    const daemonPath = path.join(exeDir, 'winctl-daemon.exe');
    console.log('\n' + cyan('Installing Windows Service...'));

    try {
        // Check if service already exists
        await run('sc query WinCTL');
        console.log(yellow('⚠  WinCTL service already installed.'));
    } catch {
        // Service doesn't exist, try to create it
        try {
            const createCmd = `sc create WinCTL binPath= "${daemonPath}" start= auto DisplayName= "WinCTL Service Manager"`;
            await run(createCmd);
            console.log(green('✅ Windows Service installed: WinCTL'));
            console.log(dim('   Use "winctl start" to start the service'));
        } catch (e) {
            console.log(yellow('⚠  Could not install Windows Service (requires Admin):'));
            console.log(dim('   ' + (e as Error).message));
            console.log(dim('   You can still use standalone mode: winctl start'));
        }
    }
}

// ── Help ──────────────────────────────────────────────────────────────────────

interface CommandHelp {
    usage: string;
    description: string;
    example?: string;
}

const commandHelp: Record<string, CommandHelp> = {
    'start': {
        usage: 'winctl start',
        description: 'Start the WinCTL Windows Service (requires admin)',
        example: 'winctl start'
    },
    'stop': {
        usage: 'winctl stop [-f] [-p port]',
        description: 'Stop the WinCTL daemon. Use -f to force kill, -p to specify port.',
        example: 'winctl stop -f -p 8081'
    },
    'status': {
        usage: 'winctl status',
        description: 'Show daemon status and managed services',
        example: 'winctl status'
    },
    'services': {
        usage: 'winctl services',
        description: 'List all managed services with their status',
        example: 'winctl services'
    },
    'start-svc': {
        usage: 'winctl start-svc <id|name>',
        description: 'Start a managed service by ID or name',
        example: 'winctl start-svc myapp'
    },
    'stop-svc': {
        usage: 'winctl stop-svc <id|name>',
        description: 'Stop a managed service by ID or name',
        example: 'winctl stop-svc myapp'
    },
    'restart-svc': {
        usage: 'winctl restart-svc <id|name>',
        description: 'Restart a managed service by ID or name',
        example: 'winctl restart-svc myapp'
    },
    'logs': {
        usage: 'winctl logs <id|name>',
        description: 'Print recent logs for a service',
        example: 'winctl logs myapp'
    },
    'open': {
        usage: 'winctl open',
        description: 'Open the web UI in the default browser',
        example: 'winctl open'
    },
    'setup-firewall': {
        usage: 'winctl setup-firewall',
        description: 'Add Windows Firewall rule for port 8080 (requires admin)',
        example: 'winctl setup-firewall'
    },
    'init': {
        usage: 'winctl init',
        description: 'Add winctl.exe to user PATH',
        example: 'winctl init'
    },
    'help': {
        usage: 'winctl help [command]',
        description: 'Show help for all commands or a specific command',
        example: 'winctl help start-svc'
    }
};

function printHelp(specificCommand?: string): void {
    if (specificCommand && commandHelp[specificCommand]) {
        const help = commandHelp[specificCommand];
        console.log(`
${bold(help.usage)}

${help.description}

${bold('Usage:')}
  ${help.usage}

${help.example ? `${bold('Example:')}\n  ${help.example}` : ''}
`);
        return;
    }

    console.log(`
${bold('winctl')} — WinCTL CLI
${dim('Windows process/service manager with web UI')}

${bold('Service control:')}
  winctl start                    Start the WinCTL Windows Service
  winctl stop [-f] [-p port]       Stop the WinCTL Windows Service

${bold('Daemon info:')}
  winctl status                   Show daemon + managed service status
  winctl services                 List all managed services

${bold('Manage services:')}
  winctl start-svc <id|name>      Start a managed service
  winctl stop-svc  <id|name>       Stop a managed service
  winctl restart-svc <id|name>     Restart a managed service
  winctl logs <id|name>            Print recent logs for a service

${bold('Other:')}
  winctl open                      Open web UI in browser
  winctl setup-firewall            Add firewall rule for port ${PORT} (Admin)
  winctl init                      Add winctl.exe to user PATH
  winctl help [command]            Show help for a command

${dim(`Daemon port: ${PORT}  (set WINCTL_PORT env to override)`)}
`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

// Start daemon silently in background (no CMD window)
async function startDaemonSilently(): Promise<void> {
    // Check if already running
    try {
        await apiGet('/api/status');
        console.log('WinCTL is already running');
        return;
    } catch { /* not running */ }

    // Start daemon with fully hidden window using PowerShell
    const exeDir = path.dirname(process.execPath);
    const daemonPath = path.join(exeDir, 'winctl-daemon.exe');

    // Use PowerShell Start-Process with -WindowStyle Hidden - runs truly hidden
    exec(`powershell -WindowStyle Hidden -Command "Start-Process -FilePath '${daemonPath}' -WindowStyle Hidden"`, (err) => {
        if (err) {
            console.error('Failed to start daemon:', err.message);
        }
    });

    // Wait and check
    await new Promise(r => setTimeout(r, 1000));

    try {
        await apiGet('/api/status');
        console.log('WinCTL daemon started');
    } catch {
        console.log('WinCTL daemon started');
    }
}

async function main(): Promise<void> {
    // Check if this is running as server mode (daemon started without arguments)
    const argv1 = process.argv[1] || '';
    const args = process.argv.slice(2);
    const command = args[0];

    // If no command argument, this might be server mode - skip CLI
    // But if there IS a command, run CLI even from server bundle
    if (!command && (argv1.includes('dist-server') || argv1.includes('snapshot'))) {
        return;
    }

    const hasForce = args.includes('-f');

    // Parse -p or --port flag
    let pIdx = args.indexOf('-p');
    if (pIdx === -1) pIdx = args.indexOf('--port');
    const portSpecified = pIdx !== -1;

    if (portSpecified && args[pIdx + 1]) {
        const customPort = parseInt(args[pIdx + 1], 10);
        if (!isNaN(customPort) && customPort > 0 && customPort <= 65535) {
            PORT = customPort;
            BASE = `http://127.0.0.1:${PORT}`;
        } else {
            console.error(red('Invalid port number: ' + args[pIdx + 1]));
            process.exit(1);
        }
    }

    // Get first non-flag argument as the command argument (skip -f, -p and its value)
    const flagIndices = new Set<number>();
    if (hasForce) flagIndices.add(args.indexOf('-f'));
    if (portSpecified) { flagIndices.add(pIdx); flagIndices.add(pIdx + 1); }
    const positionalArgs = args.slice(1).filter((_, i) => !flagIndices.has(i + 1));
    const arg = positionalArgs[0] || undefined;

    try {
        // No arguments = start daemon silently in background
        if (!command) {
            await startDaemonSilently();
            process.exit(0);
            return;
        }

        switch (command) {
            case 'start':
                await daemonStart();
                process.exit(0);
                break;
            case 'stop':
                await daemonStop(hasForce);
                process.exit(0);
                break;
            case 'status':
                await cmdStatus(portSpecified);
                process.exit(0);
                break;
            case 'services':
                await cmdServices();
                process.exit(0);
                break;
            case 'start-svc': {
                if (!arg) { console.error(red('Usage: winctl start-svc <id|name>')); process.exit(1); }
                const svc = await resolveService(arg);
                const r = await apiPost(`/api/services/${svc.id}/start`);
                console.log(green(`✅ Started ${svc.name}`), dim(JSON.stringify(r)));
                process.exit(0);
                break;
            }
            case 'stop-svc': {
                if (!arg) { console.error(red('Usage: winctl stop-svc <id|name>')); process.exit(1); }
                const svc = await resolveService(arg);
                await apiPost(`/api/services/${svc.id}/stop`);
                console.log(green(`✅ Stopped ${svc.name}`));
                process.exit(0);
                break;
            }
            case 'restart-svc': {
                if (!arg) { console.error(red('Usage: winctl restart-svc <id|name>')); process.exit(1); }
                const svc = await resolveService(arg);
                await apiPost(`/api/services/${svc.id}/restart`);
                console.log(green(`✅ Restarting ${svc.name}...`));
                process.exit(0);
                break;
            }
            case 'logs': {
                if (!arg) { console.error(red('Usage: winctl logs <id|name>')); process.exit(1); }
                await cmdLogs(arg);
                process.exit(0);
                break;
            }
            case 'open':
                cmdOpen();
                process.exit(0);
                break;
            case 'setup-firewall':
                await cmdSetupFirewall();
                process.exit(0);
                break;
            case 'init':
                await cmdInit();
                process.exit(0);
                break;
            case 'help':
            case '--help':
            case '-h':
                printHelp(arg);
                process.exit(0);
                break;
            case undefined: printHelp(); break;
            default:
                console.error(red(`Unknown command: ${command}`));
                printHelp();
                process.exit(1);
        }
    } catch (e) {
        console.error(red('Error:'), (e as Error).message);
        process.exit(1);
    }

    // Ensure we exit
    process.exit(0);
}

main().catch((e) => {
    console.error(red('Fatal:'), e.message);
    process.exit(1);
});
