import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import './capacitorBLE.js';
import './capacitorUSBSerial.js';
import './capacitorFilePicker.js';
import { installNativePort, installConnectionLifecycle } from './jsEditorNativePort.js';
import { installEditorShell } from './jsEditorShell.js';
import './css/jsEditorPlatform.css';
import { installEditorRuntime } from './jsEditorRuntime.js';
import { installShelfGestures } from './jsEditorGestures.js';
import { installKeyboardLayout, installCanvasKeyboardGuard } from './jsEditorKeyboard.js';
import { installInterfaceTranslations } from './jsEditorI18n.js';
import { installChildDialogs } from './jsEditorDialogs.js';
import { BrowserUSBSerial, BrowserBLESerial } from './browserSerial.js';

const native = Capacitor.isNativePlatform();
if (native) Capacitor.Plugins.CoCubeFilePicker = registerPlugin('CoCubeFilePicker');
const mode = /\/blocks(?:\.html)?\/?$/.test(location.pathname) ? 'blocks' : 'icon';
document.body.classList.toggle('cocube-icon-page', mode === 'icon');
const storageKey = `cocube-js-${mode}-prefs`;
const isZh = navigator.language.toLowerCase().startsWith('zh');

// These globals are defined by the unbundled, upstream classic scripts.
const editor = MB_editor;
const connection = MB_connection;
const setState = state => {
    connection.platformState = state;
    document.dispatchEvent(new CustomEvent('cocube-connection-state', { detail: state }));
};
window.CoCubeEditorReady = (async () => {
    installInterfaceTranslations();
    installChildDialogs();
    installKeyboardLayout(MB_IconInputs);
    installCanvasKeyboardGuard(WorldMorph, MB_Editor);
    installNativePort({
        Port: MB_CommPort, Connection: MB_Connection, native: true,
        createUSB: native ? () => new window.CapacitorUSBSerial() : navigator.serial ? () => new BrowserUSBSerial() : null,
        createBLE: native ? () => new window.CapacitorBLESerial() : navigator.bluetooth ? () => new BrowserBLESerial() : null,
        reportError: error => editor.reportError(error)
    });
    installConnectionLifecycle(MB_Connection, {
        requestAnimationFrame: callback => window.requestAnimationFrame(callback),
        cancelAnimationFrame: id => window.cancelAnimationFrame(id),
        setInterval: (callback, ms) => window.setInterval(callback, ms),
        clearInterval: id => window.clearInterval(id),
        hidden: () => document.hidden
    });
    IDE.readUserPreferences = () => {
        try {
            const prefs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (!prefs.locale) prefs.locale = isZh
                ? (/tw|hk|hant/i.test(navigator.language) ? 'zh-cht' : 'zh-chs') : 'en';
            return prefs;
        } catch (_) { return { locale: isZh ? 'zh-chs' : 'en' }; }
    };
    IDE.setUserPreference = function (name, value) {
        const prefs = this.readUserPreferences();
        prefs[name] = value;
        localStorage.setItem(storageKey, JSON.stringify(prefs));
        this.applyUserPreferences();
    };

    // Shared upstream chrome still exposes several unimplemented GP endpoints.
    // Keep those controls out of both JS modes until an implementation exists.
    const unsupported = /board\.(installVM|downloadFile|uploadFile|toggleBLE)|scripts\.(copyToClipboard|paste|saveImage|setExportedScriptScale)|locale\.loadCustomFile/;
    for (const menu of Object.values(Menus)) {
        if (!Array.isArray(menu.items)) continue;
        menu.items = menu.items.filter(item => !unsupported.test(String(item.action)) &&
            !String(item.action).includes("['Boardie']"));
    }
    const scriptControls = IDE.populateScriptControls;
    IDE.populateScriptControls = function (container) {
        scriptControls.call(this, container);
        container.querySelectorAll('.--undo, .--redo').forEach(button => button.remove());
    };
    const apiCall = GP.apiCall;
    GP.apiCall = function (endpoint, params, callback) {
        if (connection.platformPaused && endpoint === 'ide.updateConnection') return callback?.(0);
        if (endpoint === 'ide.showLibraryDialog') return new MB_FilePicker(path => editor.installLibraryNamed(path).catch(error => editor.reportError(error)), 'Libraries', ['.ubl']).open(world);
        return apiCall.call(this, endpoint, params, callback);
    };
    const updateConnection = MB_Connection.prototype.updateConnection;
    MB_Connection.prototype.updateConnection = function (...args) {
        if (this.platformPaused) return this.isConnected() ? 'connected' : 'not connected';
        return updateConnection.apply(this, args);
    };

    MB_Editor.prototype.installLibraryNamed = async function (name) {
        const path = name.startsWith('Libraries/') ? name : `Libraries/${name.replace(/\.ubl$/, '')}.ubl`;
        const source = await MB_Files.readFile(path);
        if (!source) throw new Error(`Could not read: ${path}`);
        this.project.addLibraryFromString(source, name, '//' + path);
        this.librariesChanged();
        this.updateLibraryList();
        this.codeManager.recompileNeeded();
    };
    const droppedFile = MB_Editor.prototype.processDroppedFile;
    MB_Editor.prototype.processDroppedFile = async function (name, source) {
        if (/\.ubl(?:\.txt)?$/i.test(name)) {
            this.project.addLibraryFromString(source, name);
            this.librariesChanged();
            this.updateLibraryList();
            this.codeManager.recompileNeeded();
        } else await droppedFile.call(this, name, source);
    };
    const setLocale = GetText.setLocale;
    GetText.setLocale = function (locale) {
        setLocale.call(this, locale);
        if (typeof locale === 'string') {
            const prefs = IDE.readUserPreferences();
            prefs.locale = locale;
            localStorage.setItem(storageKey, JSON.stringify(prefs));
            localStorage.setItem('cocube-ui-locale', locale);
        }
    };

    if (native) {
        const browserImport = MB_Editor.prototype.importLocalFile;
        MB_Editor.prototype.importLocalFile = async function (callback) {
            if (!window.CoCubeFilePicker.hasNativeFilePicker()) return browserImport.call(this, callback);
            try {
                const file = await window.CoCubeFilePicker.openNativeFile('ubp');
                if (file) await callback(file.name, new TextDecoder().decode(file.contents));
            } catch (error) { this.reportError(error); }
        };
        MB_Editor.prototype.browserReadFile = async function (extension) {
            try {
                const file = await window.CoCubeFilePicker.openNativeFile(extension);
                if (file) await this.processDroppedFile(file.name, new TextDecoder().decode(file.contents));
            } catch (error) { this.reportError(error); }
        };
        MB_Editor.prototype.saveTextAsFile = async function (text, name) {
            try { await window.CoCubeFilePicker.saveNativeFile(name, text); }
            catch (error) { this.reportError(error); }
        };
        await Promise.allSettled([StatusBar.hide(), SplashScreen.hide()]);
        await App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) window.CoCubeEditorShell?.saveDraft();
            else if (!connection.platformPaused && connection.port) connection.updateConnection();
        });
    }

    // Touch cancellation must release the hand just as a normal touchend does.
    document.getElementById('world-canvas').addEventListener('touchcancel', event => {
        window.world?.hand.processTouchEnd(event);
    });
    installEditorRuntime({ editor, connection, Editor: MB_Editor, Connection: MB_Connection, preparation: MB_IconPreparation, setState });
    // Mobile defaults use less space without shrinking the actual touch targets.
    const mobile = () => Math.min(innerWidth, innerHeight) < 600;
    const shelfMetrics = () => {
        const zoom = MB_Zoom.percent() / 100;
        const gap = 14 * zoom;
        return {scale: zoom, gap, height: Math.ceil(96 * zoom)};
    };
    const fixLayout = MB_Editor.prototype.fixLayout;
    MB_Editor.prototype.fixLayout = function () {
        if (!this.iconLayout) return fixLayout.call(this);
        const cardHeight = mobile() ? shelfMetrics().height : Math.ceil(104 * MB_Zoom.percent() / 100);
        const margin = 10;
        this.paletteHeight = cardHeight + margin * 2;
        document.querySelector('[data-ide="ide"]')?.style.setProperty('--icon-palette-height', `${this.paletteHeight}px`);
        const scriptsHeight = Math.max(100, world.height() - this.paletteHeight);
        this.scriptsFrame.setPosition(world.position());
        this.scriptsFrame.setExtent(new Point(world.width(), scriptsHeight));
        this.palette.setPosition(world.position().add(new Point(12, scriptsHeight + margin)));
        this.palette.setExtent(new Point(Math.max(1, world.width() - 24), cardHeight));
    };
    const preferences = IDE.readUserPreferences;
    IDE.readUserPreferences = () => {
        const prefs = preferences();
        if (prefs.blockSizePercent === undefined && mobile()) prefs.blockSizePercent = 75;
        return prefs;
    };
    const addPalette = MB_Editor.prototype.addPaletteBlock;
    MB_Editor.prototype.addPaletteBlock = function (block) {
        const resize = MB_Zoom.resizeTree;
        if (this.iconLayout) MB_Zoom.resizeTree = (root, scale, ...args) => resize.call(MB_Zoom, root, scale === 1 ? (mobile() ? shelfMetrics().scale : MB_Zoom.percent()/100) : scale, ...args);
        try {
            const result = addPalette.call(this, block);
            if (this.iconLayout && mobile()) this.paletteX -= 18 - shelfMetrics().gap;
            return result;
        }
        finally { MB_Zoom.resizeTree = resize; }
    };
    // Scale templates in place so preload IDs, pending actions and scroll position survive.
    const setZoom = MB_Zoom.set;
    MB_Zoom.set = function (editor, percent) {
        if (!editor.iconLayout) return setZoom.call(this, editor, percent);
        if (!Number.isFinite(percent) || !editor.scripts || world.hand?.children.length || editor.interactionBlocked()) return;
        const palette = editor.palette;
        const blocks = palette.contents.children.filter(b => b instanceof BlockMorph);
        const oldScale = blocks[0]?.scale || shelfMetrics().scale;
        const oldOffset = palette.contents.left() - palette.left();
        const panePosition = editor.scripts.position();
        setZoom.call(this, editor, percent);
        const scale = mobile() ? shelfMetrics().scale : this.percent() / 100;
        const gap = mobile() ? shelfMetrics().gap : 18 * this.percent() / 100;
        blocks.forEach(block => this.resizeTree(block, scale, block.scale));
        editor.fixLayout();
        editor.scripts.setPosition(panePosition);
        palette.contents.setPosition(palette.position());
        let x = palette.left() + 18;
        const y = palette.top() + Math.max(8, (palette.height() - Math.max(...blocks.map(b => b.height()), 0)) / 2);
        for (const block of blocks) {
            block.setPosition(new Point(x, y)); x += block.width() + gap;
        }
        palette.contents.adjustBounds();
        palette.scrollX(oldOffset * scale / oldScale);
        palette.adjustScrollBars(); palette.fullChanged();
    };
    const connect = MB_Connection.prototype.connect;
    let opening = null;
    MB_Connection.prototype.connect = function (...args) {
        if (opening) return opening;
        opening = (async () => {
            if (this.port) await this.disconnect();
            this.platformPaused = false;
            setState('connecting');
            await connect.apply(this, args);
            await this.port?.nativeSession?.opening;
            if (!this.isConnected()) setState('disconnected');
        })().finally(() => { opening = null; });
        return opening;
    };
    window.addEventListener('cocube-editor-ready', async () => {
        window.CoCubeEditorShell = await installEditorShell({ editor, connection, mode, native, App, setState });
        installShelfGestures({ canvas: document.getElementById('world-canvas'), getEditor: () => editor, getWorld: () => world,
            onTap: block => { if (!editor.interactionBlocked() && connection.platformReady && !connection.platformPaused && connection.platformState === 'ready') editor.toggleRunning(block); } });
    }, { once: true });
})();
