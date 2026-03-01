const config = require('./dist-server/config.js');
const pm = require('./dist-server/process-manager.js');
const fs = require('fs');
const path = require('path');

// Mock config load since we are testing in isolation
config.loadConfig = () => ({ services: [] });
config.loadSettings = () => ({});

async function runTests() {
    console.log("--- 4.1 Test launching a standard .exe without providing cwd ---");
    const testExe = 'C:\\Windows\\System32\\calc.exe';
    if (fs.existsSync(testExe)) {
        const res1 = await pm.startService({
            id: 'test-exe',
            name: 'Calculator',
            command: testExe,
            args: '',
            autoStart: false
        });
        console.log("Result 4.1:", res1);
        await new Promise(r => setTimeout(r, 1000));
    } else {
        console.log(`Skip 4.1: ${testExe} not found`);
    }

    console.log("\n--- 4.2 Test launching an .ahk script ---");
    const testAhk = path.join(process.cwd(), 'test-script.ahk');
    fs.writeFileSync(testAhk, 'MsgBox, "Test AHK"');
    try {
        const res2 = await pm.startService({
            id: 'test-ahk',
            name: 'Test AHK',
            command: testAhk,
            args: '',
            autoStart: false
        });
        console.log("Result 4.2:", res2);
        await new Promise(r => setTimeout(r, 1000));
    } finally {
        if (fs.existsSync(testAhk)) fs.unlinkSync(testAhk);
    }

    console.log("\n--- 4.3 Test launching a non-existent file to verify error handling behavior ---");
    const res3 = await pm.startService({
        id: 'test-missing',
        name: 'Missing File',
        command: 'C:\\does_not_exist_at_all.exe',
        args: '',
        autoStart: false
    });
    console.log("Result 4.3:", res3);
    await new Promise(r => setTimeout(r, 1000));

    process.exit(0);
}

runTests().catch(console.error);
