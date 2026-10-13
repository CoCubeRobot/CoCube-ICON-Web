import assert from 'node:assert/strict';
import test from 'node:test';
import { SerialWriteQueue } from '../src/serialWriteQueue.js';
import { SerialChannel } from '../src/serialChannel.js';
import { installNativePort, installConnectionLifecycle } from '../src/jsEditorNativePort.js';

test('native writes respect backpressure, preserve order, and surface asynchronous failure', async () => {
    const sent = [];
    let release;
    const queue = new SerialWriteQueue(async bytes => {
        sent.push([...bytes]);
        if (bytes[0] === 1) await new Promise(resolve => { release = resolve; });
    }, error => { throw error; }, 4);
    assert.equal(queue.write(Uint8Array.of(1, 2, 3)), 3);
    assert.equal(queue.write(Uint8Array.of(4, 5)), 1);
    assert.equal(queue.write(Uint8Array.of(6)), 0);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent, [[1, 2, 3]]);
    release();
    await queue.drain();
    assert.deepEqual(sent, [[1, 2, 3], [4]]);
    assert.equal(queue.pendingBytes, 0);
    let failure;
    const failed = new SerialWriteQueue(async () => { throw new Error('USB unplugged'); }, error => { failure = error; });
    assert.equal(failed.write(Uint8Array.of(9)), 1);
    await assert.rejects(failed.drain(), /USB unplugged/);
    assert.match(failure.message, /USB unplugged/);
    assert.equal(failed.write(Uint8Array.of(10)), 0);
});

test('JS receives exact DataView bytes independently of the GP and feature buffers', () => {
    const previous = globalThis.window;
    globalThis.window = { GP_serialInputBuffers: [] };
    try {
        const channel = new SerialChannel();
        channel.feature_SerialInputBuffers = [];
        const received = [];
        const off = channel.onData(bytes => received.push([...bytes]));
        channel.receive(new Uint8Array(Uint8Array.of(99, 1, 2, 88).buffer, 1, 2));
        assert.deepEqual(received, [[1, 2]]);
        assert.deepEqual(window.GP_serialInputBuffers, []);
        assert.deepEqual(channel.feature_SerialInputBuffers, []);
        off();
        channel.receive(Uint8Array.of(3));
        assert.deepEqual([...window.GP_serialInputBuffers[0]], [3]);
    } finally { globalThis.window = previous; }
});

function fixture() {
    class Port {
        constructor() { this.inputBuffers = []; }
        isConnected() { return false; }
        connect() {}
        disconnect() {}
        write() { return 0; }
        read() { const bytes = Uint8Array.from(this.inputBuffers.flatMap(b => [...b])); this.inputBuffers = []; return bytes; }
        setDTR() {}
        setRTS() {}
        setDTRandRTS() {}
    }
    class Connection {
        disconnect() { this.port?.disconnect(); this.port = null; }
    }
    class Serial extends SerialChannel {
        constructor() { super(); this.connected = false; }
        async connect() { this.connected = true; }
        async disconnect() { this.connected = false; }
        isConnected() { return this.connected; }
        write_data(bytes) { return bytes.length; }
        drain() { return Promise.resolve(); }
    }
    return { Port, Connection, Serial };
}

test('one adapter exposes USB and BLE, cleans subscriptions, and awaits close before reconnect', async () => {
    const { Port, Connection, Serial } = fixture();
    let transport;
    const create = () => (transport = new Serial());
    installNativePort({ Port, Connection, native: true, createUSB: create, createBLE: create, reportError: error => { throw error; } });
    const port = new Port();
    await port.connect('serial');
    assert.equal(port.isConnected(), true);
    transport.receive(Uint8Array.of(250, 26, 0));
    assert.deepEqual([...port.read()], [250, 26, 0]);
    assert.equal(port.write(Uint8Array.of(1, 2)), 2);
    const first = transport;
    let release;
    first.disconnect = () => new Promise(resolve => { release = () => { first.connected = false; resolve(); }; });
    const closing = port.disconnect();
    const next = new Port();
    const opening = next.connect('BLE');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(next.isConnected(), false);
    assert.equal(first.dataListeners.size, 0);
    release();
    await Promise.all([closing, opening]);
    assert.equal(next.isConnected(), true);
    assert.equal(first.connected, false);
});

test('disconnect while native chooser is pending closes the eventual connection', async () => {
    const { Port, Connection, Serial } = fixture();
    let finish;
    const serial = new Serial();
    serial.connect = () => new Promise(resolve => { finish = () => { serial.connected = true; resolve(); }; });
    installNativePort({ Port, Connection, native: true, createUSB: () => serial, reportError: error => { throw error; } });
    const port = new Port();
    void port.connect('serial');
    await new Promise(resolve => setImmediate(resolve));
    const closing = port.disconnect();
    finish();
    await closing;
    assert.equal(serial.connected, false);
    assert.equal(serial.dataListeners.size, 0);
});

test('disconnect cancels a native chooser immediately and releases all subscriptions', async () => {
    const { Port, Connection, Serial } = fixture();
    const serial = new Serial();
    let cancel;
    serial.connect = () => new Promise((resolve, reject) => { cancel = () => reject(new Error('cancelled')); });
    serial.cancelPendingConnect = () => cancel();
    const errors = [];
    installNativePort({ Port, Connection, native: true, createUSB: () => serial, reportError: error => errors.push(error) });
    const port = new Port();
    void port.connect('serial');
    await new Promise(resolve => setImmediate(resolve));
    await port.disconnect();
    assert.equal(serial.dataListeners.size, 0);
    assert.equal(serial.stateListeners.size, 0);
    assert.equal(port.isConnected(), false);
    assert.deepEqual(errors, []);
});

test('activity data bypasses the paused editor input buffer', async () => {
    const { Port, Connection, Serial } = fixture();
    const serial = new Serial();
    installNativePort({ Port, Connection, native: true, createUSB: () => serial, reportError: error => { throw error; } });
    const port = new Port();
    await port.connect('serial');
    port.inputPaused = true;
    let received = 0;
    const off = serial.onData(bytes => { received += bytes.length; });
    for (let i = 0; i < 1000; i++) serial.receive(Uint8Array.of(250, 26, 0));
    assert.equal(received, 3000);
    assert.equal(port.inputBuffers.length, 0);
    off();
    await port.disconnect();
});

test('reconnect and handoff leave no stale message loops or hidden-page timers', () => {
    const { Connection } = fixture();
    const frames = new Map(), timers = new Map();
    let id = 0, processed = 0;
    installConnectionLifecycle(Connection, {
        requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
        cancelAnimationFrame: handle => frames.delete(handle),
        setInterval: callback => { timers.set(++id, callback); return id; },
        clearInterval: handle => timers.delete(handle), hidden: () => true
    });
    const connection = new Connection();
    connection.port = { isConnected: () => true, disconnect() {} };
    connection.updateConnection = () => processed++;
    connection.startMessageProcessing();
    connection.startMessageProcessing();
    assert.equal(frames.size, 1);
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    assert.equal(processed, 1);
    connection.disconnect();
    assert.equal(frames.size, 0);
    assert.equal(timers.size, 0);
    assert.equal(connection.port, null);
});

test('shelf direction locks horizontal browsing separately from upward block pickup', async () => {
    const { classifyShelfGesture } = await import('../src/jsEditorGestures.js');
    assert.equal(classifyShelfGesture(3, -4), 'pending');
    assert.equal(classifyShelfGesture(-40, 5), 'scroll');
    assert.equal(classifyShelfGesture(8, -40), 'drag');
    assert.equal(classifyShelfGesture(20, -20), 'drag');
    assert.equal(classifyShelfGesture(40, -20), 'drag');
    assert.equal(classifyShelfGesture(-40, -20), 'drag');
    assert.equal(classifyShelfGesture(30, -12), 'drag');
    assert.equal(classifyShelfGesture(40, -12), 'pending');
    assert.equal(classifyShelfGesture(40, -7), 'pending');
    assert.equal(classifyShelfGesture(40, -5), 'scroll');
    assert.equal(classifyShelfGesture(18, -2), 'scroll');
    assert.equal(classifyShelfGesture(10, -2), 'pending');
    assert.equal(classifyShelfGesture(0, 30), 'pending');
});

test('keyboard layout clamps popovers to viewport and fullscreen native IME insets', async () => {
    const { visibleEditorBounds } = await import('../src/jsEditorKeyboard.js');
    assert.deepEqual(visibleEditorBounds({ offsetLeft: 0, offsetTop: 0, width: 850, height: 210 }, 850, 400),
        {left:0,top:0,right:850,bottom:210});
    assert.equal(visibleEditorBounds({width:850,height:400},850,400,180).bottom,220);
    assert.equal(visibleEditorBounds({width:850,height:220},850,220,0).bottom,220);
});

test('user selection cancellation is silent while genuine native failures are reported', async () => {
    const { selectionCancelled } = await import('../src/selectionCancelled.js');
    for (const cancelled of [true, false]) {
        const { Port, Connection, Serial } = fixture();
        const serial = new Serial();
        serial.connect = async () => { throw cancelled ? selectionCancelled() : new Error('Permission denied'); };
        const errors = [];
        installNativePort({ Port, Connection, native: true, createUSB: () => serial, reportError: error => errors.push(error) });
        const port = new Port();
        await port.connect('serial');
        assert.equal(port.isConnected(), false);
        assert.equal(serial.dataListeners.size, 0);
        assert.equal(serial.stateListeners.size, 0);
        assert.equal(errors.length, cancelled ? 0 : 1);
        if (!cancelled) assert.match(errors[0].message, /Permission denied/);
    }
});
