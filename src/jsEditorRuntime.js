// The upstream ICON code owns preparation, upload transactions and execution.
// Android adds status/diagnostics only; do not create a second upload queue.
export function installEditorRuntime({ editor, connection, Editor, Connection, preparation, setState }) {
    connection.platformReady = false;
    const initialized = Connection.prototype.justConnected;
    Connection.prototype.justConnected = function () {
        if (this.initialization) return this.initialization;
        const port = this.port, generation = this.sessionGeneration;
        this.platformReady = false;
        this.connectionStartTime = null;
        setState('syncing');
        this.initialization = initialized.call(this).then(async () => {
            if (this.port !== port || this.sessionGeneration !== generation) return;
            await this.sendQueue;
            await port?.drain?.();
            if (preparation.isBlocking(editor)) { setState('preparation-failed'); return; }
            if (!this.connectedToBoard() || this.vmVersion == null) { setState('disconnected'); return; }
            this.platformReady = true;
            setState('ready');
        }).catch(error => {
            if (this.port !== port || this.sessionGeneration !== generation) return;
            setState('preparation-failed');
            editor.reportError(error);
        }).finally(() => { this.initialization = null; });
        return this.initialization;
    };
    const disconnect = Connection.prototype.disconnect;
    Connection.prototype.disconnect = function (...args) {
        this.platformReady = false;
        setState('disconnected');
        return disconnect.apply(this, args);
    };
    const write = Connection.prototype.writeMsgBytes;
    Connection.prototype.writeMsgBytes = async function (bytes, port = this.port, generation = this.sessionGeneration) {
        await write.call(this, bytes, port, generation);
        if (this.port === port && this.sessionGeneration === generation) await port?.drain?.();
    };
    const step = Editor.prototype.step;
    Editor.prototype.step = function () {
        if (!connection.platformPaused && !connection.initialization) return step.call(this);
    };
    const handle = Connection.prototype.handleMessage;
    Connection.prototype.handleMessage = function (message) {
        if (message[1] === this.msgNameToID('taskErrorMsg')) {
            this.platformErrors ??= [];
            this.platformErrors.push({ time: Date.now(), packet: Array.from(message), version: this.vmVersion,
                transport: this.portName, functions: Array.from(editor.codeManager.functionChunkIDs.entries()) });
            if (this.platformErrors.length > 20) this.platformErrors.shift();
        }
        return handle.call(this, message);
    };
}
