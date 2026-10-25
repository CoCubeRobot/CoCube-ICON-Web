import locales from './js-editor/translations/locales.json';

const paths = {
    usb: '<path d="M9 3v5m6-5v5M7 8h10v5a5 5 0 0 1-5 5v4m-5-9H5m12 0h2"/>',
    ble: '<path d="m7 7 10 10-5 4V3l5 4L7 17"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    new: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 14h8m-4-4v8"/>',
    open: '<path d="M3 7h7l2 3h9l-3 10H3V7Zm0 0V4h7l2 3h7v3"/>',
    save: '<path d="M4 3h14l3 3v15H3V3h1Zm3 0v7h10V3M7 21v-7h10v7"/>',
    undo: '<path d="M9 5 3 11l6 6M3 11h11a6 6 0 0 1 0 12"/>',
    clear: '<path d="M4 7h16M9 3h6l1 4H8l1-4Zm-3 4 1 14h10l1-14M10 11v6m4-6v6"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18Z"/>',
    activities: '<path d="M6 8h12c5 0 5 12 1 12l-4-4H9l-4 4C1 20 1 8 6 8Zm1 2v5m-2-2h4m7-1h.1m2 2h.1"/>',
    blocks: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M8 10v4m8-4v4"/>',
    back: '<path d="m14 5-7 7 7 7"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.settings}</svg>`;

export function installChildMenus({ editor, connection, actions, setState, native = false }) {
    const text = (zh, en) => (GetText.currentLocale || navigator.language).startsWith('zh') ? zh : en;
    let overlay, panel, active, removePositionListeners;
    const project = document.querySelector('.icon-project-card') || document.querySelector('[data-ide="main-menu"]');
    const connect = document.querySelector('.top-bar__controls-connect');
    const close = () => {
        removePositionListeners?.(); removePositionListeners = null;
        overlay?.remove(); overlay = panel = active = null;
        project?.setAttribute('aria-expanded', 'false');
        project?.classList.remove('cocube-menu-trigger-active');
    };
    const show = (name, title, items, back) => {
        close();
        active = name;
        overlay = document.createElement('div'); overlay.className = 'cocube-menu-overlay';
        overlay.onclick = event => { if (event.target === overlay) close(); };
        panel = document.createElement('section'); panel.className = 'cocube-child-menu';
        // Older Android WebViews ignore dvh. Bound the actual panel in pixels,
        // otherwise it grows beyond the screen and has nothing to scroll.
        const positionPanel = () => {
            if (!panel) return;
            const viewport = window.visualViewport;
            const bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
            const top = panel.getBoundingClientRect().top;
            panel.style.maxHeight = `${Math.max(80, bottom - top - 12)}px`;
        };
        if (name === 'project') panel.classList.add('cocube-project-menu');
        if (name === 'language') panel.classList.add('cocube-language-menu');
        if (name === 'connection') {
            panel.classList.add('cocube-connection-menu');
            const anchor = connect.getBoundingClientRect();
            panel.style.top = `${anchor.bottom + 12}px`;
            panel.style.right = `${Math.max(12, window.innerWidth - anchor.right)}px`;
        }
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
        const header = document.createElement('header');
        const heading = document.createElement('strong'); heading.textContent = title;
        const dismiss = document.createElement('button'); dismiss.innerHTML = icon(back ? 'back' : 'close');
        dismiss.setAttribute('aria-label', text(back ? '返回' : '关闭', back ? 'Back' : 'Close'));
        dismiss.onclick = back || close;
        header.append(heading, dismiss); panel.append(header);
        const grid = document.createElement('div'); grid.className = 'cocube-menu-grid';
        for (const item of items) {
            const button = document.createElement('button'); button.innerHTML = icon(item.icon);
            const label = document.createElement('span'); label.textContent = item.label; button.append(label);
            if (name === 'language') button.setAttribute('data-no-translate', '');
            button.setAttribute('aria-label', item.label);
            if (item.selected) button.classList.add('is-selected');
            button.disabled = typeof item.disabled === 'function' ? item.disabled() : !!item.disabled;
            button.onclick = () => { close(); Promise.resolve().then(item.action).catch(error => editor.reportError(error)); };
            grid.append(button);
        }
        panel.append(grid); overlay.append(panel); document.body.append(overlay);
        positionPanel();
        panel.onpointerdown = positionPanel;
        window.addEventListener('resize', positionPanel);
        window.visualViewport?.addEventListener('resize', positionPanel);
        removePositionListeners = () => {
            window.removeEventListener('resize', positionPanel);
            window.visualViewport?.removeEventListener('resize', positionPanel);
        };
        project?.setAttribute('aria-expanded', name === 'project' ? 'true' : 'false');
        project?.classList.add('cocube-menu-trigger-active');
    };
    const language = () => show('language', text('语言', 'Language'), locales.map(([label, locale]) => ({ icon: 'language', label, selected: GetText.currentLocale === locale,
        action: () => GetText.setLocale(locale) })), projectMenu);
    const projectMenu = () => show('project', text('我的项目', 'My project'), [
        {icon:'new',label:text('新建','New'),action:()=>editor.newProject()},
        {icon:'open',label:text('打开','Open'),action:()=>editor.openProjectMenu()},
        {icon:'save',label:text('保存','Save'),action:()=>editor.saveProject()},
        ...(editor.iconLayout ? [{icon:'undo',label:text('撤回','Undo'),action:actions.undo,disabled:()=>!actions.canUndo()}] : []),
        {icon:'clear',label:text('清空画布','Clear canvas'),action:actions.clearCanvas},
        ...(native ? [{icon:'activities',label:text('活动','Activities'),action:actions.openFeatures}] : []),
        {icon:'language',label:text('语言','Language'),action:language}
    ]);
    project.onclick = () => active === 'project' ? close() : projectMenu();
    project.setAttribute('aria-label', text('项目菜单','Project menu'));
    const connectionMenu = () => show('connection', text('连接小车','Connect robot'), connection.isConnected() ? [
        {icon:'close',label:text('断开连接','Disconnect'),action:()=>connection.disconnect()}
    ] : [
        {icon:'usb',label:text('数据线','USB cable'),action:async()=>{setState('connecting');await connection.connect('serial');}},
        {icon:'ble',label:text('蓝牙','Bluetooth'),action:async()=>{setState('connecting');await connection.connect('BLE');}}
    ]);
    connect.onclick = () => active === 'connection' ? close() : connectionMenu();
    const update = state => {
        connect.dataset.state = state;
        connect.innerHTML = icon(connection.portName === 'BLE' ? 'ble' : 'usb') +
            (state === 'ready' ? `<span class="cocube-connected-check">${icon('check')}</span>` : '') +
            (['connecting','syncing'].includes(state) ? '<span class="cocube-connection-spinner"></span>' : '');
        connect.setAttribute('aria-label', text(
            {ready:'已连接',connecting:'连接中',syncing:'同步中','preparation-failed':'准备失败',disconnected:'连接小车'}[state],
            {ready:'Connected',connecting:'Connecting',syncing:'Synchronizing','preparation-failed':'Preparation failed',disconnected:'Connect robot'}[state]));
        const run = document.querySelector('.icon-run-toggle');
        if (run) run.disabled = state !== 'ready' || !!IDE.scripts.runPending;
    };
    update(connection.platformReady ? 'ready' : 'disconnected');
    document.addEventListener('cocube-connection-state', event => update(event.detail));
    document.addEventListener('scripts.runPending', () => update(connection.platformState || 'disconnected'));
    document.addEventListener('board.connected', event => { if (!event.detail.value) update('disconnected'); });
    const oldTitle = document.querySelector('[data-ide="icon-project-title"]');
    if (oldTitle && oldTitle.textContent === 'My project') oldTitle.textContent = text('我的项目','My project');
    return { close, isOpen: () => !!overlay, openProject: projectMenu };
}
