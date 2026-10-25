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
        const open = async (selector, value) => page.evaluate(({selector, value}) => {
            MB_IconInputs.close();
            const block = MB_Parser.blockFor([selector, value]);
            window.numberPickerBlock = block;
            MB_editor.addBlockToScriptsAt(block, Math.min(innerWidth / 2, 400), 100);
            MB_IconInputs.open(block.inputs()[0]);
        }, {selector, value});

        for (const width of [850, 740, 320]) {
            await page.setViewportSize({width, height: 400});
            for (const [selector, max] of [['CoCube ICON forward', 5], ['CoCube ICON backward', 5],
                ['CoCube ICON left', 4], ['CoCube ICON right', 4]]) {
                await open(selector, 1);
                const panel = page.locator('.icon-parameter-popover');
                assert.equal(await panel.locator('input').count(), 0);
                assert.deepEqual(await panel.locator('button').allTextContents(),
                    Array.from({length: max}, (_, index) => String(index + 1)));
                assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
                const rect = await panel.boundingBox();
                assert(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= 400);
                await panel.getByRole('button', {name: String(max), exact: true}).click();
                assert.equal(await panel.count(), 0);
                assert.equal(await page.evaluate(() => window.numberPickerBlock.inputs()[0].evaluate()), max);
            }
        }

        await page.setViewportSize({width: 740, height: 360});
        await open('CoCube ICON forward', 3);
        await page.screenshot({path: '/tmp/cocube-icon-step-choices.png'});
        for (const [selector, value, mode] of [['repeat', 2, 'numeric'], ['waitMillis', 1000, 'decimal']]) {
            await open(selector, value);
            const input = page.locator('.icon-parameter-popover input');
            assert.equal(await input.getAttribute('inputmode'), mode);
            assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
            await input.focus();
            await page.evaluate(() => dispatchEvent(new CustomEvent('cocube-keyboard-insets',
                {detail: {height: 170, viewportHeight: 360}})));
            await page.waitForTimeout(100);
            const rect = await input.boundingBox();
            assert(rect.y >= 0 && rect.y + rect.height <= 190);
            await input.fill(selector === 'waitMillis' ? '2.5' : '12');
            await input.press('Enter');
            assert.equal(await page.evaluate(() => window.numberPickerBlock.inputs()[0].evaluate()),
                selector === 'waitMillis' ? 2500 : 12);
            await page.evaluate(() => dispatchEvent(new CustomEvent('cocube-keyboard-insets',
                {detail: {height: 0, viewportHeight: 360}})));
        }
        assert.deepEqual(errors, []);
        console.log('PASS small-range choices, selection values, narrow-screen layout, explicit numeric editing and keyboard bounds');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
