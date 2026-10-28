import { selectBluetoothDevice, createBluetoothDialog } from './bluetoothDevicePicker.js';
// TODO: implement in microblocks-app repo instead
// capacitorBLE.js
import { BleClient } from "@capacitor-community/bluetooth-le";
import './css/capacitorBLE.css';
import { SerialChannel } from './serialChannel.js';
import { SerialWriteQueue } from './serialWriteQueue.js';
import { isSelectionCancelled } from './selectionCancelled.js';

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


async scanAndSelectDevice() { return selectBluetoothDevice(this); }

createDeviceDialog() { return createBluetoothDialog(); }



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
