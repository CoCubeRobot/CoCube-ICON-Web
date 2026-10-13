import { registerPlugin } from '@capacitor/core';
import './css/capacitorBLE.css';
import { SerialChannel } from './serialChannel.js';
import { SerialWriteQueue } from './serialWriteQueue.js';
import { selectionCancelled } from './selectionCancelled.js';

const UsbSerial = registerPlugin('UsbSerial');
window.CapacitorUSBSerialPlugin = UsbSerial;

const hexId = (value) => Number(value || 0).toString(16).padStart(4, '0').toUpperCase();
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[char]);

class CapacitorUSBSerial extends SerialChannel {
    feature_SerialInputBuffers = [];

    constructor() {
        super();
        this.connected = false;
        this.device = null;
        this.listenersAdded = false;
        this.ioQueue = Promise.resolve();
        this.usbSerial = UsbSerial;
        this.listenerHandles = [];
        this.writeQueue = null;
    }

    async initialize() {
        if (this.listenersAdded) return;

        this.listenerHandles.push(await this.usbSerial.addListener('usbSerialData', (event) => {
            const value = new Uint8Array(event.data || []);
            this.receive(value);
        }));

        this.listenerHandles.push(await this.usbSerial.addListener('usbSerialDisconnected', () => {
            this.connected = false;
            this.device = null;
            this.stateChanged();
        }));

        this.listenerHandles.push(await this.usbSerial.addListener('usbSerialError', (event) => {
            console.error('USB serial error:', event.message || event);
            this.connected = false;
            this.device = null;
            this.stateChanged();
        }));

        this.listenersAdded = true;
    }

    async connect(options = {}) {
        await this.initialize();

        const selectedDevice = await this.selectDevice(options.deviceId || options.device);
        if (!selectedDevice) {
            throw new Error('No USB serial device selected');
        }

        await this.usbSerial.requestPermission({ deviceId: selectedDevice.deviceId });
        await this.usbSerial.open({
            deviceId: selectedDevice.deviceId,
            baudRate: options.baudRate || 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 0
        });

        this.device = selectedDevice;
        this.connected = true;
        this.ioQueue = Promise.resolve();
        this.writeQueue = new SerialWriteQueue(
            bytes => this.usbSerial.write({ data: Array.from(bytes) }),
            error => { this.connected = false; this.device = null; this.stateChanged(error); }
        );
        this.stateChanged();
    }

    async disconnect() {
        try {
            await this.writeQueue?.close().catch(() => {});
            await this.ioQueue.catch(() => {});
            await this.usbSerial.close();
        } catch (error) {
            console.error('USB serial disconnect error:', error);
        }
        this.device = null;
        this.connected = false;
        this.feature_SerialInputBuffers = [];
        for (const handle of this.listenerHandles.splice(0)) await handle.remove();
        this.listenersAdded = false;
        this.stateChanged();
    }

    drain() { return this.writeQueue?.drain() ?? Promise.resolve(); }

    cancelPendingConnect() { this.cancelDeviceSelection?.(); }

    isConnected() {
        return this.connected;
    }

    write_data(data) {
        if (!this.connected) return 0;
        return this.writeQueue?.write(data) ?? 0;
    }

    async setDTR(value) {
        if (!this.connected) return;
        await this.enqueueControlSignal(() => this.usbSerial.setDTR({ value: Boolean(value) }));
    }

    async setRTS(value) {
        if (!this.connected) return;
        await this.enqueueControlSignal(() => this.usbSerial.setRTS({ value: Boolean(value) }));
    }

    enqueueControlSignal(action) {
        this.ioQueue = this.ioQueue
            .catch(() => {})
            .then(async () => { await this.drain(); await action(); })
            .catch((error) => {
                console.error('USB serial control signal error:', error);
                this.connected = false;
            });
        return this.ioQueue;
    }

    async selectDevice(preferredDevice) {
        const result = await this.usbSerial.listDevices();
        const devices = result.devices || [];

        if (preferredDevice && typeof preferredDevice === 'object') {
            const selected = devices.find((device) => device.deviceId === preferredDevice.deviceId);
            if (selected) return selected;
        }

        if (preferredDevice && typeof preferredDevice === 'string') {
            const selected = devices.find((device) => device.deviceId === preferredDevice || device.deviceName === preferredDevice);
            if (selected) return selected;
        }

        if (devices.length === 0) {
            throw new Error('No USB serial devices found');
        }

        if (devices.length === 1) {
            return devices[0];
        }

        return this.showDeviceDialog(devices);
    }

    showDeviceDialog(devices) {
        const dialog = document.createElement('div');
        dialog.className = 'ble-device-dialog';

        const lang = (window.GetText?.currentLocale || navigator.language || navigator.userLanguage || 'en').toLowerCase();
        const isZh = lang.startsWith('zh');
        const title = isZh ? '选择 USB 串口设备' : 'Select USB Serial Device';
        const cancel = isZh ? '取消' : 'Cancel';

        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>${title}</h3>
                        <button class="cancel-btn">✕</button>
                    </div>
                    <div class="device-list">
                        ${devices.map((device) => `
                            <div class="device-item" data-device-id="${device.deviceId}">
                                <span class="device-name">${this.escapeHTML(this.deviceLabel(device))}</span>
                                <span class="device-signal">${this.hexId(device.vendorId)}:${this.hexId(device.productId)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        return new Promise((resolve, reject) => {
            this.cancelDeviceSelection = () => {
                this.cancelDeviceSelection = null;
                dialog.remove();
                reject(selectionCancelled());
            };
            dialog.querySelector('.cancel-btn').setAttribute('aria-label', cancel);
            dialog.querySelector('.cancel-btn').onclick = this.cancelDeviceSelection;

            dialog.querySelectorAll('.device-item').forEach((item) => {
                item.onclick = () => {
                    const deviceId = item.getAttribute('data-device-id');
                    const selected = devices.find((device) => device.deviceId === deviceId);
                    this.cancelDeviceSelection = null;
                    dialog.remove();
                    resolve(selected);
                };
            });
        });
    }

    deviceLabel(device) {
        return device.productName || device.manufacturerName || device.deviceName || 'USB Serial';
    }

    hexId(value) {
        return hexId(value);
    }

    escapeHTML(value) {
        return escapeHTML(value);
    }
}

window.CapacitorUSBSerial = CapacitorUSBSerial;
