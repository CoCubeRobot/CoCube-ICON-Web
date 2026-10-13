// Byte delivery shared by the native transports, GP and the JavaScript editor.
export class SerialChannel {
    constructor() {
        this.dataListeners = new Set();
        this.stateListeners = new Set();
    }

    onData(listener) {
        this.dataListeners.add(listener);
        return () => this.dataListeners.delete(listener);
    }

    onState(listener) {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }

    receive(data) {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        for (const listener of this.dataListeners) listener(bytes);
        if (!this.dataListeners.size && typeof window !== 'undefined') {
            window.GP_serialInputBuffers?.push(bytes);
            // Old feature pages consume their own queue; JS subscribers do not.
            this.feature_SerialInputBuffers.push(bytes);
        }
    }

    stateChanged(error) {
        for (const listener of this.stateListeners) listener(this.isConnected(), error);
    }
}
