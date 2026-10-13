import assert from 'node:assert/strict';
import test from 'node:test';
import { installEditorRuntime } from '../src/jsEditorRuntime.js';

test('native write completion remains bound and device ready waits for successful preparation', async () => {
    const calls=[];
    class Editor {step(){}reportError(error){calls.push(error.message);}}
    class Connection {
        constructor(){this.port={drain:async()=>calls.push('drain')};this.sessionGeneration=1;this.sendQueue=Promise.resolve();this.vmVersion=416;}
        justConnected(){calls.push('upstream');return Promise.resolve();}
        connectedToBoard(){return true;}
        disconnect(){}
        handleMessage(){}
        async writeMsgBytes(bytes,port){assert.equal(this,connection);assert.equal(port,this.port);calls.push('write');}
    }
    const editor=new Editor(),connection=new Connection();
    const preparation={isBlocking:()=>false};
    installEditorRuntime({editor,connection,Editor,Connection,preparation,setState:s=>calls.push(s)});
    await connection.writeMsgBytes(new Uint8Array([1]));
    await connection.justConnected();
    assert.equal(connection.platformReady,true);
    assert.deepEqual(calls,['write','drain','syncing','upstream','drain','ready']);
});

test('preparation failure does not report ready or override upstream retry gate', async () => {
    class Editor {step(){}reportError(){throw new Error('unexpected dialog');}}
    class Connection {
        constructor(){this.port={drain:async()=>{}};this.sessionGeneration=1;this.sendQueue=Promise.resolve();this.vmVersion=416;}
        justConnected(){return Promise.resolve();} connectedToBoard(){return true;}disconnect(){}handleMessage(){}writeMsgBytes(){}
    }
    const editor=new Editor(),connection=new Connection(),states=[];
    installEditorRuntime({editor,connection,Editor,Connection,preparation:{isBlocking:()=>true},setState:s=>states.push(s)});
    await connection.justConnected();
    assert.equal(connection.platformReady,false);
    assert.deepEqual(states,['syncing','preparation-failed']);
});
