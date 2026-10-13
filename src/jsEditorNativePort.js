// The same port adapter serves ICON and the ordinary all-JavaScript editor.
import { isSelectionCancelled } from './selectionCancelled.js';
export function installNativePort({ Port, Connection, native, createUSB, createBLE, reportError }) {
    if (!native) return;
    const original = Object.fromEntries(
        ['connect', 'disconnect', 'isConnected', 'read', 'write', 'setDTR', 'setRTS', 'setDTRandRTS']
            .map(name => [name, Port.prototype[name]])
    );
    let previousClose = Promise.resolve();
    Connection.prototype.hasWebSerial = () => Boolean(createUSB);
    Connection.prototype.hasWebBluetooth = () => Boolean(createBLE);

    Port.prototype.connect = function (type, frame) {
        this.portType = type;
        if (type === 'boardie') return original.connect.call(this, type, frame);
        const serial = type === 'BLE' ? createBLE() : createUSB();
        const session = { serial, cancelled: false, off: [] };
        this.nativeSession = session;
        session.off.push(serial.onData(bytes => {
            if (this.nativeSession === session && !session.cancelled && !this.inputPaused) this.inputBuffers.push(bytes);
        }));
        session.off.push(serial.onState((connected, error) => {
            if (error && !session.cancelled) reportError(error);
        }));
        session.opening = previousClose.catch(() => {}).then(async () => {
            if (session.cancelled) return;
            await serial.connect();
            if (session.cancelled) await serial.disconnect();
        }).catch(async error => {
            const wasCancelled = session.cancelled;
            session.cancelled = true;
            session.off.splice(0).forEach(off => off());
            await serial.disconnect().catch(() => {});
            if (!wasCancelled && !isSelectionCancelled(error)) reportError(error);
        });
        return session.opening;
    };

    Port.prototype.disconnect = function () {
        const session = this.nativeSession;
        if (!session) return original.disconnect.call(this);
        session.cancelled = true;
        session.serial.cancelPendingConnect?.();
        session.off.splice(0).forEach(off => off());
        this.inputBuffers = [];
        previousClose = session.opening.then(() => session.serial.disconnect());
        this.nativeSession = null;
        return previousClose;
    };
    Port.prototype.isConnected = function () {
        return this.nativeSession
            ? !this.nativeSession.cancelled && this.nativeSession.serial.isConnected()
            : original.isConnected.call(this);
    };
    Port.prototype.write = function (bytes) {
        return this.nativeSession ? this.nativeSession.serial.write_data(bytes) : original.write.call(this, bytes);
    };
    Port.prototype.drain = function () {
        return this.nativeSession?.serial.drain() ?? Promise.resolve();
    };
    for (const name of ['setDTR', 'setRTS']) {
        Port.prototype[name] = function (value) {
            return this.nativeSession ? this.nativeSession.serial[name]?.(value) : original[name].call(this, value);
        };
    }
    Port.prototype.setDTRandRTS = async function (dtr, rts) {
        if (!this.nativeSession) return original.setDTRandRTS.call(this, dtr, rts);
        await this.setDTR(dtr);
        await this.setRTS(rts);
    };
}

// Upstream starts a new RAF and hidden-page timer on every connect. Bind both
// to the current connection and stop them on disconnect or feature handoff.
export function installConnectionLifecycle(Connection, environment) {
    Connection.prototype.stopMessageProcessing = function () {
        if (this.processingFrame != null) environment.cancelAnimationFrame(this.processingFrame);
        if (this.processingTimer != null) environment.clearInterval(this.processingTimer);
        this.processingFrame = this.processingTimer = null;
    };
    Connection.prototype.startMessageProcessing = function () {
        this.stopMessageProcessing();
        const port = this.port;
        const process = () => {
            if (this.port !== port || this.platformPaused) return;
            if (port.isConnected()) this.updateConnection();
            if (this.port !== port || this.platformPaused) return;
            this.processingFrame = environment.requestAnimationFrame(process);
        };
        this.processingFrame = environment.requestAnimationFrame(process);
        this.processingTimer = environment.setInterval(() => {
            if (this.port === port && !this.platformPaused && environment.hidden() && port.isConnected()) {
                this.updateConnection();
            }
        }, 50);
    };
    const disconnect = Connection.prototype.disconnect;
    Connection.prototype.disconnect = function () {
        const port = this.port;
        this.stopMessageProcessing();
        const result = port?.disconnect();
        // The upstream close is synchronous. Avoid invoking the native close twice.
        const ownClose = port && Object.getOwnPropertyDescriptor(port, 'disconnect');
        if (port) port.disconnect = () => {};
        try { disconnect.call(this); } finally {
            if (port) {
                if (ownClose) Object.defineProperty(port, 'disconnect', ownClose);
                else delete port.disconnect;
            }
        }
        this.connectionStartTime = this.portOpenedTime = null;
        this.recvBuf = new Uint8Array(0);
        this.sendQueue = Promise.resolve();
        return result;
    };
}
