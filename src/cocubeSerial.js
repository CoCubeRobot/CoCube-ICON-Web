import { isSelectionCancelled } from './selectionCancelled.js';

export class CapacitorCoCubeSerial {
    constructor() {
        this.transport = null;
        this.feature_SerialInputBuffers = [];
        this.disconnectPromise = Promise.resolve();
    }

    async connect(options = {}) {
        await this.disconnectPromise.catch(() => {});
        if (this.isConnected()) return;

        if (options.transport === 'usb') {
            await this.connectUSB(options);
            return;
        }

        if (options.transport !== 'ble') {
            const usbConnected = await this.tryConnectUSB();
            if (usbConnected) return;
        }

        if (!window.CapacitorBLESerial) {
            throw new Error('No CoCube serial transport is available');
        }

        const bleSerial = new window.CapacitorBLESerial();
        await bleSerial.connect();
        if (bleSerial.isConnected()) {
            this.setTransport(bleSerial);
        }
    }

    disconnect() {
        const transport = this.transport;
        this.transport = null;
        this.feature_SerialInputBuffers = [];

        this.disconnectPromise = this.disconnectPromise
            .catch(() => {})
            .then(() => transport ? transport.disconnect() : undefined);
        return this.disconnectPromise;
    }

    isConnected() {
        return Boolean(this.transport && this.transport.isConnected());
    }

    write_data(data) {
        if (!this.transport) return 0;
        return this.transport.write_data(data);
    }

    async setDTR(value) {
        if (this.transport && this.transport.setDTR) {
            await this.transport.setDTR(value);
        }
    }

    async setRTS(value) {
        if (this.transport && this.transport.setRTS) {
            await this.transport.setRTS(value);
        }
    }

    async tryConnectUSB() {
        if (!window.CapacitorUSBSerial) return false;

        try {
            await this.connectUSB();
            return true;
        } catch (error) {
            if (isSelectionCancelled(error)) throw error;
            return false;
        }
    }

    async connectUSB(options = {}) {
        if (!window.CapacitorUSBSerial) {
            throw new Error('USB serial transport is not available');
        }

        const usbSerial = new window.CapacitorUSBSerial();
        try {
            await usbSerial.connect(options);
        } catch (error) {
            await usbSerial.disconnect();
            throw error;
        }
        if (!usbSerial.isConnected()) {
            throw new Error('USB serial connection failed');
        }

        this.setTransport(usbSerial);
    }

    setTransport(transport) {
        this.transport = transport;
        this.feature_SerialInputBuffers = transport.feature_SerialInputBuffers;
    }
}

if (typeof window !== 'undefined') {
    window.CapacitorCoCubeSerial = CapacitorCoCubeSerial;
}
