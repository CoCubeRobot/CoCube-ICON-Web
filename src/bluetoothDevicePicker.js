import { selectionCancelled } from './selectionCancelled.js';

const service = 'bb37a001-b922-4018-8e74-e14824b3a638';

export async function selectBluetoothDevice(serial) {
    const dialog = createBluetoothDialog();
    const locale = (window.GetText?.currentLocale || navigator.language || 'en').toLowerCase();
    const labels = locale.startsWith('zh') ? ['选择蓝牙设备', '扫描中...', '未命名设备', '关闭', '未找到设备'] : locale.startsWith('es') ? ['Seleccionar dispositivo Bluetooth', 'Buscando...', 'Dispositivo sin nombre', 'Cerrar', 'No se encontraron dispositivos'] : ['Select Bluetooth Device', 'Scanning...', 'Unnamed device', 'Close', 'No devices found'];
    dialog.querySelector('h3').textContent = labels[0];
    dialog.querySelector('.dialog-content').setAttribute('aria-label', labels[0]);
    dialog.querySelector('.cancel-btn').setAttribute('aria-label', labels[3]);
    const list = dialog.querySelector('.device-list');
    list.textContent = labels[1];
    document.body.append(dialog);
    const devices = new Map(), rows = new Map();
    let pointerHeld = false, orderLocked = false;
    dialog.addEventListener('pointerdown', () => { pointerHeld = true; orderLocked = true; });
    const release = () => { pointerHeld = false; };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    return new Promise((resolve, reject) => {
        let settled = false, stopPromise;
        const stop = () => stopPromise ||= Promise.resolve().then(() => serial.bleClient.stopLEScan()).catch(() => {});
        const finish = async (device, error) => {
            if (settled) return;
            settled = true;
            clearInterval(updateTimer); clearTimeout(lockTimer); clearTimeout(scanTimer);
            document.removeEventListener('pointerup', release, true);
            document.removeEventListener('pointercancel', release, true);
            serial.cancelScan = null;
            dialog.remove();
            await stop();
            if (error) reject(error); else resolve(device);
        };
        serial.cancelScan = () => finish(null, selectionCancelled());
        dialog.querySelector('.cancel-btn').onclick = serial.cancelScan;
        const render = () => {
            if (settled || pointerHeld || !devices.size) return;
            const ordered = [...devices.values()];
            if (!orderLocked) ordered.sort((a, b) => b.rssi - a.rssi);
            if (!rows.size) list.replaceChildren();
            for (const device of ordered) {
                let row = rows.get(device.deviceId);
                if (!row) {
                    row = document.createElement('button'); row.type = 'button'; row.className = 'device-item';
                    row.innerHTML = '<span class="device-name"></span><span class="device-signal" aria-hidden="true"><span class="signal-bar"></span><span class="signal-bar"></span><span class="signal-bar"></span><span class="signal-bar"></span></span>';
                    row.onclick = () => void finish(devices.get(device.deviceId));
                    rows.set(device.deviceId, row); list.append(row);
                }
                const name = row.querySelector('.device-name'), label = device.name || labels[2];
                if (name.textContent !== label) name.textContent = label;
                const level = device.rssi >= -55 ? 4 : device.rssi >= -70 ? 3 : device.rssi >= -85 ? 2 : 1;
                row.querySelector('.device-signal').className = `device-signal signal-${level}`;
            }
            if (!orderLocked) ordered.forEach((device, i) => {
                const row = rows.get(device.deviceId);
                if (list.children[i] !== row) list.insertBefore(row, list.children[i] || null);
            });
        };
        const updateTimer = setInterval(render, 500);
        const lockTimer = setTimeout(() => { render(); orderLocked = true; }, 3000);
        const scanTimer = setTimeout(() => {
            clearInterval(updateTimer); render(); void stop();
            if (!devices.size) list.textContent = labels[4];
        }, 30000);
        serial.bleClient.requestLEScan({ services: [service], allowDuplicates: true }, result => {
            if (settled || !result.device?.deviceId) return;
            const old = devices.get(result.device.deviceId);
            devices.set(result.device.deviceId, { ...old, ...result.device, name: result.device.name || old?.name, rssi: Math.max(old?.rssi ?? -127, result.rssi ?? -127) });
        }).then(() => { if (settled) { stopPromise = null; void stop(); } }).catch(error => void finish(null, error));
    });
}

export function createBluetoothDialog() {
    const dialog = document.createElement('div'); dialog.className = 'ble-device-dialog';
    dialog.innerHTML = '<div class="dialog-overlay"><div class="dialog-content" role="dialog" aria-modal="true"><div class="dialog-header"><h3></h3><button type="button" class="cancel-btn">✕</button></div><div class="device-list"></div></div></div>';
    return dialog;
}
