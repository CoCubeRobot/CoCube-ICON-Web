import { SerialChannel } from './serialChannel.js';
import { SerialWriteQueue } from './serialWriteQueue.js';
import { selectionCancelled } from './selectionCancelled.js';

const serviceUUID = 'bb37a001-b922-4018-8e74-e14824b3a638';
const rxUUID = 'bb37a002-b922-4018-8e74-e14824b3a638';
const txUUID = 'bb37a003-b922-4018-8e74-e14824b3a638';
// Match the CoCube MicroBlocks USB chooser. IDs identify the serial chip;
// the connected board's firmware is checked during the ICON handshake.
const usbFilters = [0x0403, 0x0d28, 0x10c4, 0x1a86, 0x239a, 0x2a03, 0x2341,
    0x03eb, 0x1366, 0x16c0, 0x2e8a, 0x303a, 0x28e9].map(usbVendorId => ({usbVendorId}));
const selected = promise => promise.catch(error => {
    if (error.name === 'NotFoundError') throw selectionCancelled();
    throw error;
});

class BrowserSerial extends SerialChannel {
    constructor() {
        super();
        this.connected = false;
        this.feature_SerialInputBuffers = [];
    }
    isConnected() { return this.connected; }
    write_data(bytes) { return this.queue?.write(bytes) || 0; }
    drain() { return this.queue?.drain() || Promise.resolve(); }
    failed(error) {
        this.connected = false;
        this.stateChanged(error);
    }
}

export class BrowserUSBSerial extends BrowserSerial {
    async connect() {
        // The request must happen directly in the user gesture; await only after it.
        this.port = await selected(navigator.serial.requestPort({ filters: usbFilters }));
        await this.port.open({ baudRate: 115200 });
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
        this.queue = new SerialWriteQueue(bytes => this.writer.write(bytes), error => this.failed(error));
        this.connected = true;
        this.stateChanged();
        this.reading = this.readLoop();
    }
    async readLoop() {
        try {
            while (this.connected) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) this.receive(value);
            }
        } catch (error) { if (this.connected) this.failed(error); }
        finally { this.connected = false; this.reader?.releaseLock(); this.stateChanged(); }
    }
    async disconnect() {
        this.connected = false;
        await this.reader?.cancel().catch(() => {});
        await this.reading;
        await this.queue?.close().catch(() => {});
        this.writer?.releaseLock();
        await this.port?.close().catch(() => {});
        this.reader = this.writer = this.port = this.queue = null;
        this.stateChanged();
    }
    setDTR(value) { return this.port?.setSignals({ dataTerminalReady: value }); }
    setRTS(value) { return this.port?.setSignals({ requestToSend: value }); }
}

export class BrowserBLESerial extends BrowserSerial {
    async connect() {
        this.device = await selected(navigator.bluetooth.requestDevice({ filters: [{ services: [serviceUUID] }] }));
        this.onDisconnect = () => { this.connected = false; this.stateChanged(); };
        this.device.addEventListener('gattserverdisconnected', this.onDisconnect);
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService(serviceUUID);
        const rx = await service.getCharacteristic(rxUUID);
        this.tx = await service.getCharacteristic(txUUID);
        this.onRead = event => this.receive(new Uint8Array(event.target.value.buffer,
            event.target.value.byteOffset, event.target.value.byteLength));
        this.tx.addEventListener('characteristicvaluechanged', this.onRead);
        await this.tx.startNotifications();
        this.queue = new SerialWriteQueue(async bytes => {
            for (let offset = 0; offset < bytes.length; offset += 63) {
                await rx.writeValueWithoutResponse(bytes.subarray(offset, offset + 63));
            }
        }, error => this.failed(error));
        this.connected = true;
        this.stateChanged();
    }
    async disconnect() {
        this.connected = false;
        await this.queue?.close().catch(() => {});
        if (this.tx) this.tx.removeEventListener('characteristicvaluechanged', this.onRead);
        if (this.device) {
            this.device.removeEventListener('gattserverdisconnected', this.onDisconnect);
            this.device.gatt.disconnect();
        }
        this.tx = this.device = this.queue = null;
        this.stateChanged();
    }
}
