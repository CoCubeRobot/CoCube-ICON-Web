const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4173';

async function mockBridge() {
    window.androidBridge = {};
    window.calls = [];
    window.listeners = new Map();
    window.removed = [];
    window.failMethod = '';
    window.devices = [{ deviceId: 'one', productName: 'CoCube' }];
    let id = 0;
    const methods = {
        UsbSerial: ['listDevices', 'requestPermission', 'open', 'close', 'write', 'setDTR', 'setRTS'],
        BluetoothLe: ['initialize', 'requestLEScan', 'stopLEScan', 'connect', 'disconnect', 'startNotifications', 'stopNotifications', 'writeWithoutResponse'],
        CoCubeFilePicker: ['openFile', 'saveFile'], App: ['exitApp'], StatusBar: ['hide'], SplashScreen: ['hide']
    };
    window.emitNative = (plugin, event, data) => {
        for (const item of listeners.values()) if (item.plugin === plugin && item.event === event) item.callback(data);
    };
    window.Capacitor = {
        PluginHeaders: Object.entries(methods).map(([name, list]) => ({ name, methods: [
            ...list.map(name => ({ name, rtype: 'promise' })),
            { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }
        ] })),
        nativeCallback(plugin, method, args, callback) {
            const key = String(++id);
            listeners.set(key, { plugin, event: args.eventName, callback });
            return key;
        },
        async nativePromise(plugin, method, args) {
            calls.push({ plugin, method, args });
            if (method === 'removeListener') { removed.push(args.callbackId); listeners.delete(args.callbackId); }
            if (method === failMethod) throw new Error('injected ' + method);
            if (method === 'listDevices') return { devices };
            if (method === 'write' || method === 'writeWithoutResponse') await new Promise(resolve => setTimeout(resolve, 15));
            return {};
        }
    };
}
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ locale: 'zh-CN' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(mockBridge);
        await page.goto(base + '/icon.html');
        await page.waitForFunction(() => !!window.CoCubeEditorShell);
        await page.evaluate(() => { window.reportedErrors = []; MB_editor.reportError = error => reportedErrors.push(String(error)); });
        // Actual native BLE conversion, 63-byte segmentation, sequential writes and notifications.
        const opening = page.evaluate(async () => {
            window.ble = new CapacitorBLESerial();
            window.rx = [];
            ble.onData(bytes => rx.push([...bytes]));
            await ble.connect();
        });
        await page.waitForFunction(() => [...listeners.values()].some(x => x.event === 'onScanResult'));
        await page.evaluate(() => emitNative('BluetoothLe', 'onScanResult', { device: { deviceId: 'robot', name: 'CoCube' }, rssi: -40 }));
        await page.locator('.device-item').click();
        await opening;
        await page.evaluate(async () => {
            const data = Uint8Array.from({ length: 190 }, (_, i) => i % 256);
            if (ble.write_data(data) !== data.length) throw new Error('not accepted');
            ble.write_data(Uint8Array.of(250, 26, 0));
            await ble.drain();
            emitNative('BluetoothLe', 'notification|robot|bb37a001-b922-4018-8e74-e14824b3a638|bb37a003-b922-4018-8e74-e14824b3a638', { value: 'fa 1a 00' });
        });
        const writes = await page.evaluate(() => calls.filter(c => c.method === 'writeWithoutResponse').map(c => c.args.value));
        const bytes = writes.map(s => s.trim().split(/\s+/).map(x => parseInt(x, 16)));
        assert.deepEqual(bytes.map(b => b.length), [63, 63, 63, 1, 3]);
        assert.deepEqual(bytes.flat(), [...Array.from({ length: 190 }, (_, i) => i), 250, 26, 0]);
        assert.deepEqual(await page.evaluate(() => rx), [[250, 26, 0]]);
        // Write failure must become a rejected drain and a disconnected transport.
        assert.equal(await page.evaluate(async () => {
            window.failMethod = 'writeWithoutResponse';
            ble.write_data(Uint8Array.of(1));
            try { await ble.drain(); return false; } catch (_) { return !ble.isConnected(); }
        }), true);
        await page.evaluate(async () => { failMethod = ''; await ble.disconnect(); });
        // Native port reconnect stress verifies no USB data listeners survive a close.
        await page.evaluate(async () => {
            for (let i = 0; i < 20; i++) {
                const port = new MB_CommPort();
                await port.connect('serial');
                emitNative('UsbSerial', 'usbSerialData', { data: [250, 26, i] });
                if (JSON.stringify([...port.read()]) !== JSON.stringify([250, 26, i])) throw new Error('duplicate data');
                await port.disconnect();
                if ([...listeners.values()].some(x => x.plugin === 'UsbSerial')) throw new Error('USB listener leaked');
            }
        });
        // Cancelling an active BLE scan cleans the dialog and native scan subscription.
        const cancelled = page.evaluate(async () => {
            const serial = new CapacitorBLESerial();
            try { await serial.connect(); return false; } catch (_) { return !serial.isConnected(); }
        });
        await page.waitForFunction(() => [...listeners.values()].some(x => x.event === 'onScanResult'));
        await page.locator('.ble-device-dialog .cancel-btn').click({ force: true });
        assert.equal(await cancelled, true);
        assert.equal(await page.locator('.ble-device-dialog').count(), 0);
        assert.equal(await page.evaluate(() => [...listeners.values()].some(x => x.event === 'onScanResult')), false);
        // Closing the port must cancel a visible chooser, not wait for the user.
        await page.evaluate(() => { reportedErrors.length = 0; });
        await page.evaluate(() => { window.pendingPort = new MB_CommPort(); void pendingPort.connect('BLE'); });
        await page.waitForFunction(() => [...listeners.values()].some(x => x.event === 'onScanResult'));
        await page.locator('.ble-device-dialog .cancel-btn').click({ force: true });
        await page.evaluate(() => pendingPort.nativeSession.opening);
        assert.deepEqual(await page.evaluate(() => reportedErrors), []);
        assert.equal(await page.locator('.window').count(), 0);
        const scanClosing = page.evaluate(async () => {
            window.pendingPort = new MB_CommPort();
            window.pendingOpening = pendingPort.connect('BLE');
        });
        await scanClosing;
        await page.waitForFunction(() => [...listeners.values()].some(x => x.event === 'onScanResult'));
        await page.evaluate(() => pendingPort.disconnect());
        assert.equal(await page.locator('.ble-device-dialog').count(), 0);
        await page.evaluate(() => { devices = [{deviceId:'a'}, {deviceId:'b'}]; });
        await page.evaluate(() => { window.pendingPort = new MB_CommPort(); void pendingPort.connect('serial'); });
        await page.waitForSelector('.ble-device-dialog', {state:'attached',timeout:5000});
        await page.evaluate(() => pendingPort.disconnect());
        assert.equal(await page.locator('.ble-device-dialog').count(), 0);
        assert.equal(await page.evaluate(() => [...listeners.values()].some(x => x.plugin === 'UsbSerial')), false);
        assert.deepEqual(await page.evaluate(() => reportedErrors), []);
        // Paused editor receives no activity bytes, while the feature subscriber does.
        await page.evaluate(async () => {
            devices = [{deviceId:'one'}];
            const port = new MB_CommPort();
            await port.connect('serial');
            port.inputPaused = true;
            const featureBytes = [];
            const off = port.nativeSession.serial.onData(bytes => featureBytes.push(...bytes));
            for (let i = 0; i < 1000; i++) emitNative('UsbSerial','usbSerialData',{data:[250,26,0]});
            if (port.inputBuffers.length !== 0 || featureBytes.length !== 3000) throw new Error('handoff routed data incorrectly');
            off();
            await port.disconnect();
        });
        assert.deepEqual(errors, []);
        console.log('PASS BLE conversion/ordered segmentation/notifications/write failure, 20 USB reconnects, scan/chooser cancellation and activity input isolation');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
