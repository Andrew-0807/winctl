import { exec } from 'child_process';

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_NAME = 'WinCTL';

export function enableAutostart(): void {
    const exePath = process.execPath;
    const cmd = `reg add "${REG_KEY}" /v ${APP_NAME} /t REG_SZ /d "\\"${exePath}\\"" /f`;
    exec(cmd, (err) => {
        if (err) console.error('[Autostart] Failed to enable:', err.message);
        else console.log('[Autostart] Enabled');
    });
}

export function disableAutostart(): void {
    const cmd = `reg delete "${REG_KEY}" /v ${APP_NAME} /f`;
    exec(cmd, (err) => {
        if (err && !err.message.includes('system was unable to find')) {
            console.error('[Autostart] Failed to disable:', err.message);
        } else {
            console.log('[Autostart] Disabled');
        }
    });
}
