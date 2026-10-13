export function visibleEditorBounds(viewport, width, height, keyboardHeight = 0, fullHeight = height) {
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || width);
    // Keyboard insets are converted to CSS pixels by the native bridge.
    const bottom = Math.min(top + (viewport?.height || height), fullHeight - keyboardHeight);
    return { left, top, right, bottom: Math.max(top, bottom) };
}

export function installKeyboardLayout(picker) {
    let keyboardHeight = 0;
    let fullHeight;
    const bounds = () => visibleEditorBounds(window.visualViewport, innerWidth, innerHeight, keyboardHeight, fullHeight || innerHeight);
    const position = picker.position;
    picker.position = function () {
        position.call(this);
        const panel = this.panel;
        if (!panel) return;
        const view = bounds();
        panel.style.maxHeight = `${Math.max(48, view.bottom - view.top - 16)}px`;
        panel.style.maxWidth = `${Math.max(48, view.right - view.left - 16)}px`;
        const rect = panel.getBoundingClientRect();
        panel.style.left = `${Math.max(view.left + 8, Math.min(rect.left, view.right - rect.width - 8))}px`;
        panel.style.top = `${Math.max(view.top + 8, Math.min(rect.top, view.bottom - rect.height - 8))}px`;
    };
    const revealInput = () => {
        picker.position();
        const view = bounds();
        document.documentElement.style.setProperty('--cocube-visible-height', `${view.bottom - view.top}px`);
        document.documentElement.style.setProperty('--cocube-visible-top', `${view.top}px`);
        const input = document.activeElement;
        if (!input?.matches('input, textarea, [contenteditable="true"]')) return;
        const rect = input.getBoundingClientRect();
        const panel = input.closest('.icon-parameter-popover, .window, .cocube-dialog');
        if (panel && (rect.bottom > view.bottom - 12 || rect.top < view.top + 12)) {
            input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            // Scroll the dialog's own contents instead of moving the canvas.
            const delta = rect.bottom > view.bottom - 12 ? rect.bottom - view.bottom + 12 : rect.top - view.top - 12;
            panel.scrollTop += delta;
        }
    };
    window.visualViewport?.addEventListener('resize', revealInput);
    window.visualViewport?.addEventListener('scroll', revealInput);
    window.addEventListener('resize', revealInput);
    window.addEventListener('cocube-keyboard-insets', event => {
        keyboardHeight = event.detail.height || 0;
        fullHeight = event.detail.viewportHeight;
        revealInput();
    });
    document.addEventListener('focusin', () => {
        requestAnimationFrame(revealInput);
        setTimeout(revealInput, 300);
    });
    revealInput();
}

// Morphic focuses a hidden textarea after ordinary canvas clicks and gives it
// autofocus on creation. Mobile keyboards must only open for explicit editing.
export function installCanvasKeyboardGuard(World, Editor) {
    const configure = world => {
        const handler = world.keyboardHandler;
        if (!handler) return;
        handler.autofocus = false;
        handler.removeAttribute('autofocus');
        handler.readOnly = !world.cursor;
        handler.setAttribute('inputmode', world.cursor ? 'text' : 'none');
        handler.focus = function (options) {
            if ((!world.allowTextFocus && !world.cursor) || GP.delegateKeyboardEvents) return;
            this.readOnly = false;
            this.setAttribute('inputmode', 'text');
            HTMLTextAreaElement.prototype.focus.call(this, options);
        };
        if (!world.cursor && document.activeElement === handler) handler.blur();
    };
    const init = World.prototype.initKeyboardHandler;
    World.prototype.initKeyboardHandler = function (...args) {
        init.apply(this, args);
        configure(this);
    };
    const open = Editor.prototype.open;
    Editor.prototype.open = function (world, ...args) {
        const result = open.call(this, world, ...args);
        configure(world); // open() installs its own focus override upstream.
        return result;
    };
    const edit = World.prototype.edit;
    World.prototype.edit = function (...args) {
        this.allowTextFocus = true;
        try { return edit.apply(this, args); }
        finally { this.allowTextFocus = false; configure(this); }
    };
    const stop = World.prototype.stopEditing;
    World.prototype.stopEditing = function (...args) {
        const result = stop.apply(this, args);
        configure(this);
        if (document.activeElement === this.keyboardHandler) this.keyboardHandler.blur();
        return result;
    };
}
