// Snapshots are immutable GP source, not references to blocks being dragged.
// Restore the main module through the real parser and reuse the current library
// modules, connection and upload queue. History belongs to one open project.
export function installEditorHistory({editor, world, connection, Project, closeInputs, saveDraft, limit = 100}) {
    let project, states = [], busy = false;
    const snapshot = () => {
        editor.updateProject();
        return {code: editor.project.main.codeString(editor.project),
            signature: JSON.stringify(editor.project.main.scripts.map(([x, y, block]) =>
                [x, y, block.mbScriptId, block.codeString()]))};
    };
    const record = () => {
        if (busy || world.hand.children.length) return;
        const current = snapshot();
        if (project !== editor.project) { project = editor.project; states = [current]; return; }
        if (states.at(-1)?.signature === current.signature) {
            // Library preparation can update declarations without a user edit.
            states[states.length - 1] = current;
            return;
        }
        states.push(current);
        if (states.length > limit + 1) states.shift();
    };
    const changed = editor.scriptChanged;
    editor.scriptChanged = function (...args) {
        const result = changed.apply(this, args);
        // Some upstream operations notify before finishing their mutation.
        queueMicrotask(record);
        return result;
    };
    const grab = world.hand.grab;
    world.hand.grab = function (...args) {
        record(); // capture a complete stack before the hand detaches any part
        return grab.apply(this, args);
    };
    const drop = world.hand.drop;
    world.hand.drop = function (...args) {
        const result = drop.apply(this, args);
        record(); // includes deletion on either the shelf or its contents
        return result;
    };
    const blocked = editor.interactionBlocked;
    editor.interactionBlocked = function (...args) { return busy || blocked.apply(this, args); };
    const canUndo = () => {
        record();
        return !busy && !world.hand.children.length && !editor.interactionBlocked() && states.length > 1;
    };
    const undo = async () => {
        if (!canUndo()) return false;
        busy = true;
        let applied = false;
        const currentProject = editor.project, manager = editor.codeManager;
        try {
            const target = states.at(-2);
            const restored = new Project();
            const libraries = Array.from(currentProject.libraries.values())
                .map(library => library.codeString(currentProject)).join('\n');
            restored.loadFromString(target.code + '\n' + libraries);
            closeInputs();
            manager.runGeneration++;
            await manager.operationQueue;
            if (editor.project !== currentProject || editor.codeManager !== manager) return false;
            if (connection.isConnected()) {
                await connection.sendMsg('stopAllMsg');
                await connection.sendMsg('systemResetMsg');
                await connection.sendQueue;
                await connection.port?.drain?.();
            }
            editor.clearRunningHighlights();
            editor.removeAllScripts();
            currentProject.main = restored.main;
            currentProject.main.scripts.forEach(([x, y, block]) => editor.addBlockToScriptsAt(block, x, y));
            manager.compiler = null;
            manager.oldVarNames = null;
            manager.sourceMaps.clear();
            manager.recompileNeeded();
            editor.updateProjectProperties();
            editor.updateLibraryList();
            editor.scriptChanged();
            states.pop();
            states[states.length - 1] = snapshot();
            applied = true;
            saveDraft();
            if (connection.connectedToBoard()) {
                await manager.syncScripts(true);
                await connection.sendQueue;
                await connection.port?.drain?.();
            }
            return true;
        } finally {
            // Local recovery remains undoable even when a link fails mid-sync.
            if (applied) editor.saveNeeded = true;
            busy = false;
        }
    };
    record();
    return {record, canUndo, undo, get depth() { return Math.max(0, states.length - 1); }};
}
