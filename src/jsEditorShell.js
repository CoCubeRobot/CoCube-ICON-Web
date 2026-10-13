import { installChildMenus, icon } from './jsEditorMenus.js';
const isZh = () => (GetText.currentLocale || navigator.language).toLowerCase().startsWith('zh');
const label = (zh, en) => isZh() ? zh : en;

export async function installEditorShell({ editor, connection, mode, native, App, setState }) {
    const key = `cocube-js-${mode}-draft`;
    let leaving = false;
    let featureOpen = false;
    const saveDraft = () => {
        if (leaving || world.hand.children.length) return;
        editor.updateProject();
        try {
            localStorage.setItem(key, JSON.stringify({
                name: editor.projectName, code: editor.project.codeString(),
                zoom: MB_Zoom.percent()
            }));
        } catch (error) { editor.reportError(error); throw error; }
    };
    let lastDraft = '';
    const timer = setInterval(() => {
        if (leaving || featureOpen || world.hand.children.length) return;
        editor.updateProject();
        const code = editor.project.codeString();
        if (code !== lastDraft) {
            try { saveDraft(); lastDraft = code; } catch (_) {}
        }
    }, 2000);
    try {
        const draft = JSON.parse(localStorage.getItem(key) || 'null');
        if (draft?.code) {
            // Startup is disconnected and the empty starter is disposable.
            editor.canReplaceCurrentProject = async () => true;
            try { await editor.openProjectFromString(draft.code, draft.name); }
            finally { delete editor.canReplaceCurrentProject; }
            MB_Zoom.set(editor, draft.zoom || 100);
        }
    } catch (error) { editor.reportError(error); }

    const stopForHandoff = async () => {
        saveDraft();
        MB_IconInputs.close();
        if (editor.interactionBlocked()) return;
        editor.codeManager.runGeneration++;
        await editor.codeManager.operationQueue;
        if (connection.isConnected()) {
            await connection.sendMsg('stopAllMsg');
            await connection.sendMsg('systemResetMsg');
            await connection.sendQueue;
            await connection.port.drain?.();
        }
        connection.platformPaused = true;
        connection.stopMessageProcessing();
        editor.clearRunningHighlights();
    };
    const navigate = async (targetMode) => {
        if (leaving) return;
        try {
            await stopForHandoff();
            await connection.disconnect();
            leaving = true;
            localStorage.setItem('cocube-editor-mode', targetMode);
            const page = { icon: 'icon.html', blocks: 'blocks.html' }[targetMode];
            location.href = `/${page}`;
        } catch (error) {
            connection.platformPaused = false;
            if (connection.port) connection.startMessageProcessing();
            editor.reportError(error);
        }
    };
    const openFeatures = async () => {
        if (featureOpen || editor.interactionBlocked()) return;
        await stopForHandoff();
        // Feature pages reuse this facade. Only their own reader gets data while
        // the editor's protocol consumer and synchronization are paused.
        const port = connection.port;
        const serial = port?.nativeSession?.serial;
        if (port) { port.inputPaused = true; port.inputBuffers = []; }
        let activityChanged = false;
        let off;
        const buffers = [];
        if (serial) off = serial.onData(bytes => buffers.push(bytes));
        window.bleSerial = serial ? {
            isConnected: () => serial.isConnected(),
            connect: async () => { if (!serial.isConnected()) throw new Error(label('请返回编辑器重新连接设备', 'Reconnect from the editor')); },
            disconnect: () => serial.disconnect(),
            write_data: async bytes => {
                let offset = 0;
                while (offset < bytes.length) {
                    const accepted = serial.write_data(bytes.subarray(offset));
                    offset += accepted;
                    await serial.drain();
                    if (!accepted && !serial.isConnected()) throw new Error('Device disconnected');
                }
                return offset;
            },
            feature_SerialInputBuffers: buffers
        } : undefined;
        featureOpen = true;
        const panel = document.createElement('div');
        panel.className = 'cocube-feature-panel';
        const frame = document.createElement('iframe');
        frame.src = '/features.html';
        const close = document.createElement('button');
        close.className = 'cocube-feature-close';
        close.innerHTML = icon('back');
        close.setAttribute('aria-label', label('返回编程', 'Back to coding'));
        panel.append(frame);
        document.body.append(panel);
        const closeFeatures = async () => {
            if (close.disabled) return;
            close.disabled = true;
            if (activityChanged) { connection.platformReady = false; setState('syncing'); }
            try {
                panel.remove();
                off?.();
                window.bleSerial = undefined;
                featureOpen = false;
                if (serial) await serial.drain();
                editor.codeManager.runGeneration++;
                if (activityChanged && connection.isConnected()) {
                    await connection.sendMsg('stopAllMsg');
                    await connection.sendMsg('systemResetMsg');
                    await connection.sendQueue;
                    await port.drain?.();
                }
                if (port) { port.inputPaused = false; port.inputBuffers = []; }
                connection.recvBuf = new Uint8Array(0);
                connection.platformPaused = false;
                if (connection.isConnected()) {
                    connection.lastPingRecvMSecs = Date.now();
                    if (activityChanged) {
                        setState('syncing');
                        await connection.clearBoardIfConnected();
                        await editor.codeManager.saveAllChunksAfterLoad();
                        await connection.sendQueue;
                        await port.drain?.();
                    }
                    connection.startMessageProcessing();
                    connection.platformReady = true;
                    setState('ready');
                } else setState('disconnected');
            } catch (error) {
                connection.platformPaused = false;
                if (connection.port) { connection.port.inputPaused = false; connection.startMessageProcessing(); }
                connection.platformReady = false;
                setState('preparation-failed');
                editor.reportError(error);
            }
        };
        const history = [];
        const modalNavigator = {
            open(url) { history.push(frame.src); frame.src = new URL(url, location.origin + '/').href; },
            goBack() { if (history.length) frame.src = history.pop(); else void closeFeatures(); },
            close: closeFeatures, isModalOpen: () => featureOpen,
            getProgram: () => activityChanged || 'editor', setProgram(name) { activityChanged = name; }
        };
        window.modalNavigator = modalNavigator;
        frame.onload = () => {
            try {
                const doc = frame.contentDocument;
                const header = doc.querySelector('.header');
                if (header && !doc.querySelector('.back-btn')) {
                    const back = doc.createElement('button'); back.className = 'back-btn';
                    back.innerHTML = icon('back'); back.setAttribute('aria-label', label('返回编程', 'Back to coding'));
                    header.prepend(back);
                }
                doc.addEventListener('click', event => {
                    const back = event.target.closest('.back-btn');
                    if (back) { event.preventDefault(); event.stopImmediatePropagation(); modalNavigator.goBack(); }
                }, true);
            } catch (_) {}
        };
        close.onclick = closeFeatures;
    };

    const clearCanvas = async () => {
        if (editor.interactionBlocked()) return;
        if (!(await editor.confirm(label('清空画布上的所有积木？', 'Clear all blocks from the canvas?')))) return;
        if (connection.initialization) await connection.initialization;
        editor.codeManager.runGeneration++;
        await editor.codeManager.operationQueue;
        if (connection.isConnected()) {
            await connection.sendMsg('stopAllMsg');
            await connection.sendMsg('systemResetMsg');
            await connection.sendQueue;
            await connection.port.drain?.();
        }
        editor.clearRunningHighlights();
        editor.removeAllScripts();
        editor.updateProject();
        editor.scriptChanged();
        if (connection.connectedToBoard()) {
            await editor.codeManager.syncScripts(true);
            await connection.sendQueue;
            await connection.port.drain?.();
        }
        saveDraft();
    };
    const menus = installChildMenus({ editor, connection, native, actions: { navigate, openFeatures, clearCanvas }, setState });
    // Save without attempting native I/O during browser teardown.
    window.addEventListener('pagehide', () => { try { saveDraft(); } finally { clearInterval(timer); } });
    let lastBack = 0;
    if (native) await App.addListener('backButton', async () => {
        if (featureOpen) return window.modalNavigator.goBack();
        if (window.CoCubeActiveDialog) { window.CoCubeActiveDialog.close(); return; }
        if (MB_IconPreparation.isBlocking(editor)) { await connection.disconnect(); return; }
        if (MB_IconInputs.panel) { MB_IconInputs.close(); return; }
        const dialog = document.querySelector('.ble-device-dialog .cancel-btn, .window__close');
        if (dialog) { dialog.click(); return; }
        const picker = MB_FilePicker.findOpen(world);
        if (picker) { picker.removeFromOwner(); return; }
        if (menus.isOpen()) { menus.close(); return; }
        if (Menus.current()) { Menus.close(); return; }
        if (Date.now() - lastBack < 2000) {
            try { await stopForHandoff(); await connection.disconnect(); await App.exitApp(); }
            catch (error) { editor.reportError(error); }
        } else {
            lastBack = Date.now();
            const toast = document.createElement('div');
            toast.className = 'cocube-toast';
            toast.textContent = label('再按一次退出应用', 'Press back again to exit');
            document.body.append(toast);
            setTimeout(() => toast.remove(), 1800);
        }
    });
    return { saveDraft, navigate, openFeatures, clearCanvas, menus };
}
