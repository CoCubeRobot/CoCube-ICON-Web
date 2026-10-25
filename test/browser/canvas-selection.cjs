const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 900, height: 420}, hasTouch: true});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const base = process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4195';
        await page.goto(`${base}/icon.html`);
        await page.waitForFunction(() => !!window.CoCubeEditorShell && MB_IconCoCube.source);
        await page.locator('.app-preloader').waitFor({state: 'hidden'});
        assert.equal(await page.locator('#world-canvas').evaluate(canvas => getComputedStyle(canvas).userSelect), 'none');
        await page.evaluate(() => {
            // Model WKWebView's missing iframe selectionchange notification.
            window.selectionNoticeBlocker = event => event.stopImmediatePropagation();
            document.addEventListener('selectionchange', selectionNoticeBlocker, true);
            const range = document.createRange();
            range.selectNode(document.getElementById('world-canvas'));
            document.getSelection().addRange(range);
        });
        await page.waitForFunction(() => document.getSelection().rangeCount === 0);
        await page.evaluate(() => document.removeEventListener('selectionchange', selectionNoticeBlocker, true));
        const point = await page.evaluate(() => {
            const text = new StringMorph('Legacy editable text', 24);
            text.isEditable = true;
            MB_editor.scripts.add(text);
            text.setPosition(new Point(350, 150));
            window.selectionTestText = text;
            world.edit(text);
            return {x: text.center().x, y: text.center().y};
        });
        assert.equal(await page.evaluate(() => !!world.cursor), false);
        await page.mouse.dblclick(point.x, point.y);
        assert.equal(await page.evaluate(() => !!world.cursor), false);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 700, y: 180}]});
        await page.waitForTimeout(650);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await page.evaluate(() => {
            world.keyboardHandler.focus();
            selectionTestText.destroy();
        });
        assert.equal(await page.evaluate(() => document.activeElement === world.keyboardHandler), false);
        assert.equal(await page.locator('#morphic_keyboard').getAttribute('aria-hidden'), 'true');
        assert.equal(await page.locator('#morphic_keyboard').evaluate(input => input.readOnly), true);

        // Explicit parameter editing retains native text selection and typing.
        await page.evaluate(() => {
            const block = MB_Parser.blockFor(['CoCube ICON face', 90]);
            MB_editor.addBlockToScriptsAt(block, 400, 100);
            window.selectionHeadingBlock = block;
            MB_IconInputs.open(block.inputs()[0]);
        });
        const input = page.locator('.icon-parameter-popover input');
        assert.equal(await input.evaluate(element => getComputedStyle(element).userSelect), 'text');
        await input.focus();
        await input.evaluate(element => element.select());
        await page.waitForTimeout(50);
        assert.deepEqual(await input.evaluate(element => [element.selectionStart, element.selectionEnd]), [0, 2]);
        await input.fill('180');
        await page.locator('.icon-heading-done').click();
        assert.equal(await page.evaluate(() => selectionHeadingBlock.inputs()[0].evaluate()), 180);
        assert.equal(await page.evaluate(() => !!world.cursor), false);
        await page.screenshot({path: '/tmp/cocube-icon-selection-guard.png'});

        await page.goto(`${base}/blocks.html`);
        await page.waitForFunction(() => !!window.CoCubeEditorShell);
        await page.locator('.app-preloader').waitFor({state: 'hidden'});
        assert.equal(await page.evaluate(() => MB_editor.iconLayout), false);
        const canEdit = await page.evaluate(() => {
            const text = new StringMorph('MicroBlocks editable text', 24);
            text.isEditable = true;
            MB_editor.scripts.add(text);
            world.edit(text);
            const hasCursor = !!world.cursor;
            world.stopEditing(); text.destroy();
            return hasCursor;
        });
        assert.equal(canEdit, true);
        assert.deepEqual(errors, []);
        console.log('PASS ICON selection recovery, rapid taps, no canvas caret, explicit numeric input and MicroBlocks editing');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
