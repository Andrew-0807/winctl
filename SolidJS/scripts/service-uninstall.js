#!/usr/bin/env node
/**
 * WinCTL Service Uninstaller
 * Run as Administrator: node scripts/service-uninstall.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

if (os.platform() !== 'win32') {
    console.error('Service management is only supported on Windows.');
    process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const daemonScript = path.join(rootDir, 'dist-server', 'index.js');

let Service;
try {
    Service = require('node-windows').Service;
} catch (e) {
    console.error('node-windows not found. Run: npm install');
    process.exit(1);
}

const svc = new Service({
    name: 'WinCTL',
    script: daemonScript
});

svc.on('uninstall', () => {
    console.log('✅ WinCTL service uninstalled successfully.');
    process.exit(0);
});

svc.on('notinstalled', () => {
    console.log('⚠️  WinCTL service is not installed.');
    process.exit(0);
});

svc.on('error', (err) => {
    console.error('❌ Service error:', err);
    process.exit(1);
});

console.log('Stopping and uninstalling WinCTL service...');
svc.uninstall();
