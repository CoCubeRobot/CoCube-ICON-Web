const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 850, height: 400}, hasTouch: true});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4195'}/icon.html`);
        await page.waitForFunction(() => !!window.CoCubeEditorShell && MB_IconCoCube.source);
        await page.locator('.app-preloader').waitFor({state: 'hidden'});
        await page.evaluate(() => {
            const block = MB_Parser.blockFor(['CoCube ICON forward', 1]);
            MB_editor.addBlockToScriptsAt(block, 350, 100);
            window.touchTestBlock = block;
        });
        await page.waitForTimeout(200);
        let point = await page.evaluate(() => ({x: touchTestBlock.center().x, y: touchTestBlock.top() + 18}));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
        await page.waitForTimeout(650);
        assert.equal(await page.locator('[data-ide="menu-container"] .menu').count(), 0);
        assert.equal(await page.evaluate(() => world.hand.mouseButton), 'left');
        // Continue dragging after the former menu deadline, then drop normally.
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x + 40, y: point.y - 20}]});
        assert.equal(await page.evaluate(() => world.hand.children.includes(window.touchTestBlock)), true);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        assert.equal(await page.evaluate(() => world.hand.children.length), 0);
        point = await page.evaluate(() => ({x: touchTestBlock.center().x, y: touchTestBlock.top() + 18}));

        // The same block still supports the desktop right-click menu.
        await page.mouse.click(point.x, point.y, {button: 'right'});
        await page.locator('[data-ide="menu-container"] .menu').waitFor();
        await page.touchscreen.tap(700, 200);
        assert.equal(await page.locator('[data-ide="menu-container"] .menu').count(), 0);

        // Shelf touch handlers stop propagation, so dismissal must happen first.
        await page.mouse.click(point.x, point.y, {button: 'right'});
        await page.locator('[data-ide="menu-container"] .menu').waitFor();
        const shelfPoint = await page.evaluate(() => ({x: MB_editor.palette.right() - 12,
            y: MB_editor.palette.top() + 10}));
        await page.touchscreen.tap(shelfPoint.x, shelfPoint.y);
        assert.equal(await page.locator('[data-ide="menu-container"] .menu').count(), 0);

        assert.deepEqual(errors, []);
        console.log('PASS no ICON long-press menu, held drag, desktop right-click and outside canvas/shelf touch dismissal');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
