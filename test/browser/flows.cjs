const assert = require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:842,height:393},locale:'en'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.COCUBE_TEST_URL||'http://127.0.0.1:4184';
 await page.goto(base+'/icon.html');await page.waitForFunction(()=>window.CoCubeEditorShell&&MB_editor.palette.contents.children.length===23);
 await page.locator('.icon-project-card').click();
 assert.equal(await page.getByRole('button',{name:/Parent settings|家长设置/}).count(),0);
 assert.equal(await page.getByRole('button',{name:/Activities|活动/}).count(),0);
 await page.getByRole('button',{name:/Language|语言/,exact:true}).click();
 assert.equal(await page.locator('.cocube-language-menu .cocube-menu-grid button').count(),32);
 await page.evaluate(()=>{localStorage.setItem('cocube-editor-mode','blocks')});await page.goto(base+'/');
 await page.waitForFunction(()=>window.CoCubeEditorShell);assert.equal(await page.evaluate(()=>MB_editor.iconLayout),true);
 assert.deepEqual(errors,[]);console.log('PASS ICON-only startup, no parent IDE/activity entries on Web, 32 languages');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
