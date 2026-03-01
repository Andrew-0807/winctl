const { spawn } = require('child_process');

const target = 'C:\\Users\\andrei\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Scoop Apps\\Discord.lnk';

console.log('--- Testing multiple ways to launch .lnk files ---');

// Method 3: Using cmd.exe /c "start \"\" \"PATH\""
console.log('Method 3: cmd.exe /c start "" "PATH"');
const proc3 = spawn('cmd.exe', ['/c', `start "" "${target}"`], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore'
});
proc3.on('error', e => console.error('proc3 err:', e.message));

// Method 4: Using PowerShell
setTimeout(() => {
    console.log('Method 4: powershell.exe Start-Process');
    const proc4 = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${target}'`], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore'
    });
    proc4.on('error', e => console.error('proc4 err:', e.message));
}, 2000);

// Method 5: Using explorer.exe
setTimeout(() => {
    console.log('Method 5: explorer.exe "PATH"');
    const proc5 = spawn('explorer.exe', [target], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore'
    });
    proc5.on('error', e => console.error('proc5 err:', e.message));
}, 4000);
