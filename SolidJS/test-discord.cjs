const config = require('./dist-server/config.js');
const pm = require('./dist-server/process-manager.js');
const fs = require('fs');

// Mock config load since we are testing in isolation
config.loadConfig = () => ({ services: [] });
config.loadSettings = () => ({});

async function testDiscord() {
    console.log("--- 4.4 Test launching Discord shortcut ---");
    const testLnk = 'C:\\Users\\andrei\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Scoop Apps\\Discord.lnk';
    if (fs.existsSync(testLnk)) {
        const res = await pm.startService({
            id: 'test-discord',
            name: 'Discord',
            command: testLnk,
            args: '',
            autoStart: false
        });
        console.log("Result 4.4:", res);
        await new Promise(r => setTimeout(r, 1000));
    } else {
        console.log(`Skip 4.4: ${testLnk} not found`);
    }
    process.exit(0);
}

testDiscord().catch(console.error);
