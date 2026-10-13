const assert=require('node:assert/strict');const{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const p=await browser.newPage({viewport:{width:1024,height:768},locale:'zh-CN'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`${process.env.COCUBE_TEST_URL||'http://127.0.0.1:4173'}/icon.html`);await p.waitForFunction(()=>window.CoCubeEditorShell&&MB_editor.palette.contents.children.length===21);
await p.locator('.app-preloader').waitFor({state:'hidden'});await p.waitForTimeout(500);
for(const locale of ['en','es','ja']){
 await p.evaluate(locale=>GetText.setLocale(locale),locale);await p.waitForFunction(locale=>GetText.currentLocale===locale,locale);
 for(const [selector,index] of [['waitMillis',0],['CoCube ICON forward',0],['CoCube ICON go to',0],['CoCube ICON face',0],['play tone',0],['led_displayImage',0],['[display:mbDisplay]',0],['set display color',0],['iconDisplayColorMatrix',0]]){
 await p.evaluate(({selector,index})=>{MB_IconInputs.close();const template=MB_editor.palette.contents.children.find(b=>b.selector===selector);const block=template.fullCopy();block.isTemplate=false;MB_editor.addBlockToScriptsAt(block,250,100);MB_IconInputs.open(block.inputs()[index]);},{selector,index});await p.waitForTimeout(50);
 const chinese=await p.locator('.icon-parameter-popover').evaluate(el=>[el.innerText,...Array.from(el.querySelectorAll('*')).flatMap(n=>[n.getAttribute('title')||'',n.getAttribute('aria-label')||''])].filter(s=>/想去哪里|点一点|完成|减少|增加|坐标|选择|音阶|朝向|转一转|滑动查看更多|等待（秒）|重复次数|手绘|请输入|第 \d+ 行/.test(s)));
 assert.deepEqual(chinese,[],`${locale} ${selector} untranslated: ${chinese}`);
 }
 await p.evaluate(()=>MB_IconInputs.close());
}
await p.evaluate(()=>GetText.setLocale('zh-chs'));await p.waitForFunction(()=>GetText.currentLocale==='zh-chs');await p.locator('.icon-project-card').click();assert.equal(await p.getByRole('button',{name:'语言',exact:true}).count(),1);assert.deepEqual(errors,[]);console.log('PASS 8 parameter pickers in English/Spanish/Japanese with no Chinese residue, Chinese restoration');}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
