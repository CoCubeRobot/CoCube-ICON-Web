const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 850, height: 400}, hasTouch: true});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4195'}/icon.html`);
        await page.waitForFunction(() => !!window.CoCubeEditorShell?.history && MB_IconCoCube.source);
        await page.locator('.app-preloader').waitFor({state: 'hidden'});
        await page.evaluate(() => GetText.setLocale('en'));
        const menu = async () => page.locator('.icon-project-card').click();
        await menu();
        assert.equal(await page.getByRole('button', {name: 'Undo', exact: true}).isDisabled(), true);
        await page.evaluate(() => CoCubeEditorShell.menus.close());
        await page.evaluate(() => {
            const block = MB_Parser.blockFor([['whenStarted'], ['repeat', 3, [['waitMillis', 2500]]]]);
            MB_editor.addBlockToScriptsAt(block, 350, 90);
            window.historyDragBlock = block;
            MB_editor.addBlockToScriptsAt(MB_Parser.blockFor(['CoCube ICON forward', 3]), 550, 90);
            MB_editor.scriptChanged();
        });
        await page.waitForTimeout(300);
        const original = await page.evaluate(() => { MB_editor.updateProject(); return MB_editor.project.main.codeString(MB_editor.project); });
        const point = await page.evaluate(() => ({x: historyDragBlock.center().x, y: historyDragBlock.top() + 18}));
        const destination = await page.evaluate(() => ({x: MB_editor.palette.right() - 25, y: MB_editor.palette.top() + 20}));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
        for (let i = 1; i <= 4; i++) {
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{
                x: point.x + (destination.x - point.x) * i / 4,
                y: point.y + (destination.y - point.y) * i / 4}]});
        }
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await page.waitForTimeout(100);
        const deleted = await page.evaluate(() => { MB_editor.updateProject(); return MB_editor.project.main.codeString(MB_editor.project); });
        assert.notEqual(deleted, original);
        assert.equal(await page.evaluate(() => MB_editor.project.main.scripts.some(entry => entry[2] === historyDragBlock)), false);

        await menu();
        await page.getByRole('button', {name: 'Clear canvas', exact: true}).click();
        const beforeCancel = await page.evaluate(() => CoCubeEditorShell.history.depth);
        await page.locator('.cocube-dialog-secondary').click();
        assert.equal(await page.evaluate(() => CoCubeEditorShell.history.depth), beforeCancel);
        await menu();
        await page.getByRole('button', {name: 'Clear canvas', exact: true}).click();
        await page.locator('.cocube-dialog-primary').click();
        await page.waitForFunction(() => MB_editor.scripts.children.every(block => !(block instanceof BlockMorph)));
        await menu();
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(() => !MB_editor.interactionBlocked());
        assert.equal(await page.evaluate(() => { MB_editor.updateProject(); return MB_editor.project.main.codeString(MB_editor.project); }), deleted);
        await menu();
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(() => !MB_editor.interactionBlocked());
        assert.equal(await page.evaluate(() => { MB_editor.updateProject(); return MB_editor.project.main.codeString(MB_editor.project); }), original);
        for (const [locale, label] of [['zh-chs', '撤回'], ['es', 'Deshacer'], ['zh-cht', '復原']]) {
            await page.evaluate(locale => GetText.setLocale(locale), locale);
            await menu();
            await page.getByRole('button', {name: label, exact: true}).waitFor();
            await page.evaluate(() => CoCubeEditorShell.menus.close());
        }
        await page.evaluate(() => GetText.setLocale('zh-chs'));
        await page.setViewportSize({width: 740, height: 360});
        await menu();
        await page.getByRole('button', {name: '撤回', exact: true}).waitFor();
        const panel = page.locator('.cocube-project-menu');
        assert.equal(await panel.evaluate(element => element.scrollHeight <= element.clientHeight + 1), true);
        await page.screenshot({path: '/tmp/cocube-icon-history-menu.png'});
        if (await page.locator('[data-editor-switch]').count()) {
            await page.evaluate(() => { window.openedHistoryUrls = []; window.open = url => openedHistoryUrls.push(url); });
            await page.locator('[data-editor-switch]').click();
            assert.deepEqual(await page.evaluate(() => openedHistoryUrls), ['https://cocube.fun/blocks/']);
            await menu();
            await page.getByRole('button', {name: '入口页', exact: true}).click();
            assert.deepEqual(await page.evaluate(() => openedHistoryUrls),
                ['https://cocube.fun/blocks/', 'https://cocube.fun/?choose=1']);
        }
        assert.deepEqual(errors, []);
        console.log('PASS shelf deletion, cancelled clear, confirmed clear, multi-step menu undo and localized labels');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
