// TODO: implement in microblocks-app repo instead
// capacitorBLE.js
import { BleClient } from "@capacitor-community/bluetooth-le";
import './css/capacitorBLE.css';
import { SerialChannel } from './serialChannel.js';
import { SerialWriteQueue } from './serialWriteQueue.js';
import { selectionCancelled, isSelectionCancelled } from './selectionCancelled.js';

const MICROBLOCKS_SERVICE_UUID = 'bb37a001-b922-4018-8e74-e14824b3a638'
const MICROBLOCKS_RX_CHAR_UUID = 'bb37a002-b922-4018-8e74-e14824b3a638' // board receive characteristic
const MICROBLOCKS_TX_CHAR_UUID = 'bb37a003-b922-4018-8e74-e14824b3a638' // board transmit characteristic

class CapacitorBLESerial extends SerialChannel {
    // class variables
    feature_SerialInputBuffers = [];

    constructor() {
        super();
        this.device = null;
        this.connected = false;
        this.sendInProgress = false;
        this.bleClient = null;
        this.writeQueue = null;
    }

    async initialize() {
        // Get BleClient from Capacitor
        this.bleClient = BleClient;
        await this.bleClient.initialize();
    }


async scanAndSelectDevice() {
    const dialog = this.createDeviceDialog();
    document.body.appendChild(dialog);
    const isZh = (window.GetText?.currentLocale || navigator.language || 'en').toLowerCase().startsWith('zh');
    dialog.querySelector('h3').textContent = isZh ? '选择蓝牙设备' : 'Select Bluetooth Device';
    const devices = new Map();
    const list = dialog.querySelector('.device-list');
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const finish = async (device, error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.cancelScan = null;
            dialog.remove();
            await this.bleClient.stopLEScan().catch(() => {});
            if (error) reject(error); else resolve(device);
        };
        this.cancelScan = () => finish(null, selectionCancelled());
        dialog.querySelector('.cancel-btn').onclick = this.cancelScan;
        list.textContent = isZh ? '扫描中...' : 'Scanning...';
        timer = setTimeout(() => finish(null, new Error(isZh ? '扫描超时，请重试' : 'Scan timed out; try again')), 30000);
        this.bleClient.requestLEScan(
            { services: [MICROBLOCKS_SERVICE_UUID], allowDuplicates: true },
            result => {
                if (settled || !result.device) return;
                devices.set(result.device.deviceId, result.device);
                list.replaceChildren();
                for (const device of devices.values()) {
                    const item = document.createElement('button');
                    item.className = 'device-item';
                    item.textContent = device.name || (isZh ? '未命名设备' : 'Unnamed device');
                    item.onclick = () => void finish(device);
                    list.append(item);
                }
            }
        ).then(() => { if (settled) void this.bleClient.stopLEScan(); })
            .catch(error => void finish(null, error));
    });
}

createDeviceDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'ble-device-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3></h3>
                    <button class="cancel-btn">✕</button>
                </div>
                <div class="device-list"></div>
            </div>
        </div>
    `;

    return dialog;
}



    async connect() {
        try {
            if (!this.bleClient) await this.initialize();

            // Request device
            this.device = await this.scanAndSelectDevice();

            // Connect to device
            await this.bleClient.connect(this.device.deviceId , (deviceId) => {
                // disconnect callback
                console.log("Disconnected from device: " + deviceId);
                this.disconnect();
            });

            // Start notifications
            await this.bleClient.startNotifications(
                this.device.deviceId,
                MICROBLOCKS_SERVICE_UUID,
                MICROBLOCKS_TX_CHAR_UUID,
                (data) => {
                    this.receive(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                }
            );

            this.connected = true;
            this.writeQueue = new SerialWriteQueue(async bytes => {
                for (let offset = 0; offset < bytes.length; offset += 63) {
                    const chunk = bytes.slice(offset, offset + 63);
                    await this.bleClient.writeWithoutResponse(
                        this.device.deviceId, MICROBLOCKS_SERVICE_UUID,
                        MICROBLOCKS_RX_CHAR_UUID,
                        new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                    );
                }
            }, error => { this.connected = false; this.stateChanged(error); });
            this.stateChanged();
            this.sendInProgress = false;
            console.log("Capacitor BLE connected");
        } catch (error) {
            if (!isSelectionCancelled(error)) console.error('BLE connection error:', error);
            await this.disconnect();
            throw error;
        }
    }

    cancelPendingConnect() { this.cancelScan?.(); }

    async disconnect() {
        this.cancelScan?.();
        const device = this.device;
        await this.writeQueue?.close().catch(() => {});
        this.device = null;
        this.connected = false;
        if (device) {
            try {
                await this.bleClient.stopNotifications(
                    device.deviceId,
                    MICROBLOCKS_SERVICE_UUID,
                    MICROBLOCKS_TX_CHAR_UUID
                );
                await this.bleClient.disconnect(device.deviceId);
            } catch (error) {
                console.error('BLE disconnect error:', error);
            }
        }
        this.device = null;
        this.connected = false;
        this.sendInProgress = false;
        this.feature_SerialInputBuffers = [];
        this.stateChanged();
    }

    drain() { return this.writeQueue?.drain() ?? Promise.resolve(); }

    isConnected() {
        return this.connected;
    }

    write_data(data) {
        if (!this.connected) return 0;
        return this.writeQueue?.write(data) ?? 0;
    }

}
window.CapacitorBLESerial = CapacitorBLESerial;
