import assert from 'node:assert/strict';
import test from 'node:test';
import {installEditorHistory} from '../src/jsEditorHistory.js';
import {sensorEditor} from './helpers/sensor-editor.mjs';

function fixture({limit = 100} = {}) {
    const env = sensorEditor();
    const project = env.run('MB_editor.project');
    const Project = env.run('MB_Project');
    let scripts = [], drafts = 0, syncs = 0;
    const connection = {port: {drain: async () => {}}, sendQueue: Promise.resolve(),
        isConnected: () => false, connectedToBoard: () => false, sendMsg: async () => {}};
    const editor = {project, saveNeeded: false,
        codeManager: env.run('MB_editor.codeManager'),
        updateProject() { this.project.main.setScripts(scripts); this.project.main.assignScriptIds(); },
        scriptChanged() { this.saveNeeded = true; }, interactionBlocked: () => false,
        removeAllScripts() { scripts = []; },
        addBlockToScriptsAt(block, x, y) { scripts.push([x, y, block]); },
        clearRunningHighlights() {}, updateProjectProperties() {}, updateLibraryList() {}};
    editor.codeManager.syncScripts = async () => { syncs++; };
    const world = {hand: {children: [], grab() {}, drop() {}}};
    const history = installEditorHistory({editor, world, connection, Project,
        closeInputs() {}, saveDraft() { drafts++; }, limit});
    const add = (source, x, y) => {
        const block = env.run(`MB_Parser.blockFor(${JSON.stringify(source)})`);
        scripts.push([x, y, block]); editor.scriptChanged(); return block;
    };
    const tick = () => new Promise(resolve => queueMicrotask(resolve));
    return {env, editor, world, history, add, tick, connection,
        remove(index) { scripts.splice(index, 1); editor.scriptChanged(); },
        clear() { scripts = []; editor.scriptChanged(); },
        get scripts() { return scripts; }, get drafts() { return drafts; }, get syncs() { return syncs; }};
}

test('separate deletion and clear steps restore stack structure, parameters, position and script IDs', async () => {
    const f = fixture();
    const stack = f.add([['whenStarted'], ['repeat', 3, [['waitMillis', 2500]]]], 40, 60);
    f.add(['waitMillis', 500], 160, 120); await f.tick();
    const original = f.editor.project.main.codeString(f.editor.project);
    const originalId = stack.mbScriptId;
    f.remove(1); await f.tick();
    const afterFirst = f.editor.project.main.codeString(f.editor.project);
    f.clear(); await f.tick();
    assert.equal(f.history.canUndo(), true);
    await f.history.undo();
    assert.equal(f.editor.project.main.codeString(f.editor.project), afterFirst);
    await f.history.undo();
    assert.equal(f.editor.project.main.codeString(f.editor.project), original);
    assert.equal(f.scripts[0][2].mbScriptId, originalId);
    assert.deepEqual(f.scripts.map(entry => entry.slice(0, 2)), [[40, 60], [160, 120]]);
    for (const entry of f.scripts) {
        f.env.context.restoredBlock = entry[2];
        assert.equal(f.env.run('new MB_Compiler(MB_editor.project,MB_editor.codeManager).instructionsFor(restoredBlock).length > 0'), true);
    }
    assert.equal(f.drafts, 2);
    assert.deepEqual(f.env.errors, []);
});

test('history ignores detached hand contents and snapshots a complete stack before a middle-block grab', async () => {
    const f = fixture();
    const stack = f.add([['whenStarted'], ['waitMillis', 1000], ['waitMillis', 2000]], 50, 70);
    await f.tick();
    const original = f.editor.project.main.codeString(f.editor.project);
    f.world.hand.grab(stack.nextBlock());
    f.world.hand.children.push(stack.nextBlock());
    stack.nextBlock().destroy(); stack.fixLayout();
    f.editor.scriptChanged(); await f.tick();
    assert.equal(f.history.depth, 1); // only the original addition, no half-dragged state
    f.world.hand.children = [];
    f.world.hand.drop();
    await f.history.undo();
    assert.equal(f.editor.project.main.codeString(f.editor.project), original);
});

test('undo keeps the connection and manager, drains uploads and preserves updated libraries', async () => {
    const f = fixture();
    f.add(['waitMillis', 1000], 30, 40); await f.tick();
    f.clear(); await f.tick();
    f.editor.project.addLibraryFromString("module 'Updated library'\nversion 9 1\nto 'updated helper' { return 7 }", 'Updated library', 'test');
    const library = f.editor.project.libraryNamed('Updated library');
    const manager = f.editor.codeManager, project = f.editor.project;
    let finish, stopped = [];
    manager.operationQueue = new Promise(resolve => { finish = resolve; });
    f.connection.isConnected = f.connection.connectedToBoard = () => true;
    f.connection.sendMsg = async message => stopped.push(message);
    const restoring = f.history.undo(); await f.tick();
    assert.equal(f.editor.interactionBlocked(), true);
    assert.equal(f.scripts.length, 0);
    assert.equal(await f.history.undo(), false);
    finish(); await restoring;
    assert.deepEqual(stopped, ['stopAllMsg', 'systemResetMsg']);
    assert.equal(f.editor.codeManager, manager);
    assert.equal(f.editor.project, project);
    assert.equal(f.editor.project.libraryNamed('Updated library'), library);
    assert.equal(f.syncs, 1);
    assert.equal(f.editor.interactionBlocked(), false);
});

test('history stays within its limit, branches after undo and resets for a different project', async () => {
    const f = fixture({limit: 2});
    const block = f.add(['waitMillis', 1000], 30, 40); await f.tick();
    for (const value of [2000, 3000, 4000]) { block.inputs()[0].setContents(value); f.editor.scriptChanged(); await f.tick(); }
    assert.equal(f.history.depth, 2);
    await f.history.undo(); await f.history.undo();
    assert.equal(f.scripts[0][2].inputs()[0].evaluate(), 2000);
    assert.equal(f.history.canUndo(), false);
    f.add(['waitMillis', 10], 60, 80); await f.tick();
    assert.equal(f.history.canUndo(), true);
    f.editor.project = new (f.env.run('MB_Project'))();
    f.clear(); await f.tick();
    assert.equal(f.history.canUndo(), false);
});
