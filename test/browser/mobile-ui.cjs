const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({channel:'chrome',headless:true});
    try {
        const page = await browser.newPage({viewport:{width:900,height:420},locale:'zh-CN',hasTouch:true});
        const errors=[]; page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`${process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4173'}/icon.html`);
        await page.waitForFunction(()=>!!window.CoCubeEditorShell && MB_editor.palette.contents.children.length===23);
        await page.locator('.app-preloader').waitFor({state:'hidden'});
        assert.equal(await page.locator('.cocube-editor-tools').count(),0);
        const shelf = await page.evaluate(() => ({height:MB_editor.palette.height(),reserved:MB_editor.paletteHeight,
            scale:MB_editor.palette.contents.children[0].scale,zoom:MB_Zoom.percent()/100,canvas:MB_editor.scriptsFrame.height(),world:world.height()}));
        assert(shelf.height < 104);
        assert.equal(shelf.scale,shelf.zoom);
        assert.equal(shelf.reserved,shelf.height+20);
        assert.equal(shelf.canvas,shelf.world-shelf.reserved);
        const fullTiles = await page.evaluate(() => MB_editor.palette.contents.children.filter(b => b.left() >= MB_editor.palette.left() && b.right() <= MB_editor.palette.right()).length);
        assert(fullTiles >= 8, 'phone shelf should retain usable browsing space');
        const card=page.locator('.icon-project-card');
        await card.click(); await page.waitForSelector('.cocube-child-menu');
        await card.click(); assert.equal(await page.locator('.cocube-child-menu').count(),0);
        await card.click(); await page.locator('.cocube-menu-overlay').click({position:{x:700,y:250}});
        assert.equal(await page.locator('.cocube-child-menu').count(),0);
        await card.click(); await page.getByRole('button',{name:'语言',exact:true}).click();
        const languages = await page.evaluate(async () => (await fetch('/js-editor/translations/locales.json')).json());
        assert.deepEqual(await page.locator('.cocube-language-menu .cocube-menu-grid button').allTextContents(), languages.map(entry => entry[0]));
        assert.equal(await page.getByRole('button',{name:'日本語',exact:true}).count(),1);
        const languageMenu = page.locator('.cocube-language-menu');
        assert(await languageMenu.evaluate(el => el.scrollHeight > el.clientHeight));
        const languageSession = await page.context().newCDPSession(page);
        await languageSession.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:200,y:330}]});
        for(let i=1;i<=10;i++) {
            await languageSession.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:200,y:330-i*12}]});
            await page.waitForTimeout(16);
        }
        await languageSession.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
        assert(await languageMenu.evaluate(el => el.scrollTop > 40));
        assert.equal(await languageMenu.count(),1,'swiping must not select a language');

        await page.getByRole('button',{name:'English',exact:true}).click();
        assert.equal(await page.locator('.cocube-child-menu').count(),0);
        await page.locator('.top-bar__controls-connect').click();
        const bounds = await page.evaluate(() => ({
            anchor: document.querySelector('.top-bar__controls-connect').getBoundingClientRect().toJSON(),
            menu: document.querySelector('.cocube-connection-menu').getBoundingClientRect().toJSON(),
            width: innerWidth, height: innerHeight
        }));
        assert(Math.abs(bounds.anchor.right - bounds.menu.right) < 2);
        assert(bounds.menu.top >= bounds.anchor.bottom && bounds.menu.bottom <= bounds.height);
        assert(bounds.menu.left > bounds.width / 2);
        assert.equal(await page.getByRole('button',{name:'USB cable',exact:true}).count(),1);
        assert.equal(await page.getByRole('button',{name:'Bluetooth',exact:true}).count(),1);
        await page.getByRole('button',{name:'Close',exact:true}).click();
        const session=await page.context().newCDPSession(page);
        const gesture=async(x,y,dx,dy)=>{
            await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
            for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y:y+dy*i/10}]});await page.waitForTimeout(20);}
            await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await page.waitForTimeout(200);
        };
        const start=await page.evaluate(()=>({x:MB_editor.palette.contents.left(),count:MB_editor.scripts.children.filter(b=>b instanceof BlockMorph).length}));
        await page.evaluate(() => {
            window.paletteTaps = [];
            MB_editor.toggleRunning = block => paletteTaps.push(block.selector);
            MB_connection.platformReady = true;
            MB_connection.platformState = 'ready';
        });
        const tapTile = await page.evaluate(() => {
            const block = MB_editor.palette.contents.children.find(b => b.selector === 'waitMillis');
            return { x: block.center().x, y: block.center().y };
        });
        await gesture(tapTile.x, tapTile.y, 0, 0);
        assert.deepEqual(await page.evaluate(() => paletteTaps), ['waitMillis']);
        await page.evaluate(() => { MB_connection.platformReady = false; });
        await gesture(tapTile.x, tapTile.y, 0, 0);
        assert.deepEqual(await page.evaluate(() => paletteTaps), ['waitMillis']);
        await page.evaluate(() => { MB_connection.platformReady = true; });
        await gesture(650,350,-180,0);
        assert.equal(await page.evaluate(()=>MB_editor.scripts.children.filter(b=>b instanceof BlockMorph).length),start.count);
        assert(await page.evaluate(x=>MB_editor.palette.contents.left()<x,start.x));
        assert(Math.abs(await page.evaluate(() => MB_editor.palette.contents.left()) - (start.x - 180)) < 1,
            'shelf must follow the complete finger displacement, including the initial decision distance');
        const tile=await page.evaluate(()=>{const b=MB_editor.palette.contents.children.find(b=>b.selector==='waitMillis');return{x:b.center().x,y:b.center().y};});
        await gesture(tile.x,tile.y,0,-160);
        assert(await page.evaluate(()=>MB_editor.scripts.children.some(b=>b.selector==='waitMillis')));
        const beforeDiagonal = await page.evaluate(() => ({
            count: MB_editor.scripts.children.filter(b => b instanceof BlockMorph).length,
            left: MB_editor.palette.contents.left(),
            tile: (() => { const b = MB_editor.palette.contents.children.find(b => b.selector === 'waitMillis'); return { x: b.center().x, y: b.center().y }; })()
        }));
        await gesture(beforeDiagonal.tile.x, beforeDiagonal.tile.y, 180, -120);
        assert.equal(await page.evaluate(() => MB_editor.scripts.children.filter(b => b instanceof BlockMorph).length), beforeDiagonal.count + 1);
        assert.equal(await page.evaluate(() => MB_editor.palette.contents.left()), beforeDiagonal.left);
        assert.deepEqual(await page.evaluate(() => paletteTaps), ['waitMillis'], 'scrolling and dragging must not run a palette block');
        await page.screenshot({path:'/tmp/cocube-mobile-ui.png'});
        assert.deepEqual(errors,[]);
        console.log('PASS menu toggle/outside close/language, icon connection choices, horizontal shelf scroll and upward block drag');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
