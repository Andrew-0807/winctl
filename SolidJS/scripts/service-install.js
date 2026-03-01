#!/usr/bin/env node
/**
 * WinCTL Service Installer
 * Run as Administrator: node scripts/service-install.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

if (os.platform() !== 'win32') {
    console.error('Service installation is only supported on Windows.');
    process.exit(1);
}

// Resolve the daemon script — either the compiled JS or this script's parent
const rootDir = path.join(__dirname, '..');
const daemonScript = path.join(rootDir, 'dist-server', 'index.js');

if (!fs.existsSync(daemonScript)) {
    console.error(`Daemon not found at: ${daemonScript}`);
    console.error('Run "npm run build:server" first.');
    process.exit(1);
}

let Service;
try {
    Service = require('node-windows').Service;
} catch (e) {
    console.error('node-windows not found. Run: npm install');
    process.exit(1);
}

const svc = new Service({
    name: 'WinCTL',
    description: 'WinCTL Windows Service Manager — background process & service manager with web UI.',
    script: daemonScript,
    nodeOptions: [],
    env: [
        { name: 'PORT', value: '8080' },
        { name: 'NODE_ENV', value: 'production' }
    ]
});

svc.on('install', () => {
    console.log('✅ WinCTL service installed successfully.');
    console.log('   Starting service...');
    svc.start();
});

svc.on('start', () => {
    console.log('✅ WinCTL service started.');
    console.log('');
    console.log('   Web UI: http://localhost:8080');
    console.log('   To check status: winctl status');
    console.log('   To open firewall for phone access: winctl setup-firewall');
    process.exit(0);
});

svc.on('alreadyinstalled', () => {
    console.log('⚠️  WinCTL service is already installed.');
    console.log('   To reinstall, run: node scripts/service-uninstall.js first.');
    process.exit(0);
});

svc.on('error', (err) => {
    console.error('❌ Service error:', err);
    process.exit(1);
});

console.log('Installing WinCTL as a Windows Service...');
console.log(`  Script: ${daemonScript}`);
svc.install();
