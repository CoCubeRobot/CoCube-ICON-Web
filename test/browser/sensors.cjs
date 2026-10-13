const assert=require('node:assert/strict');const{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:842,height:393},locale:'en'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.COCUBE_TEST_URL||'http://127.0.0.1:4184'}/icon.html`);
 await page.waitForFunction(()=>window.CoCubeEditorShell&&MB_editor.palette.contents.children.length===23);
 await page.locator('[data-ide=app-preloader]').waitFor({state:'hidden'});
 const result=await page.evaluate(()=>{
  const editor=MB_editor;const hats=editor.palette.contents.children.filter(b=>b.selector.startsWith('iconWhen'));
  const tail=editor.palette.contents.children.filter(b=>b instanceof BlockMorph).slice(-2).map(b=>b.selector);
  const out=[];
  for(const template of hats){const block=template.fullCopy();block.isTemplate=false;editor.addBlockToScriptsAt(block,100,120+out.length*100);
   block.nextBlock(MB_Parser.blockFor(['waitMillis',200]));
   const slot=block.inputs()[1],reference=MB_Parser.blockFor(['whenBroadcastReceived',"'_iconColor1'"]).inputs()[0];
   const assertSlot=slot.width()===reference.width()&&slot.height()===reference.height()&&slot.right()<block.nextBlock().left();
   const compiler=new MB_Compiler(editor.project,editor.codeManager);const instructions=compiler.instructionsFor(block);
   const bytes=compiler.bytesForInstructions(instructions,block,'test');const decompiler=new MB_Decompiler();
   for(const[name,id]of editor.codeManager.functionChunkIDs)decompiler.funcs.set(id,name);
   const restored=decompiler.decompile(100,5,Uint8Array.from(bytes));
   const trace=MB_ExecutionHighlight.owners.get(block);
   out.push({selector:block.selector,hat:block instanceof HatBlockMorph,compact:assertSlot,
    traced:trace?.tokens.has(block.nextBlock())&&trace.tokens.size===1,
    type:editor.codeManager.chunkTypeFor(block),restored:restored.selector,args:restored.args,body:restored.next?.selector});
  }
  const compiled=editor.project.allFunctions().filter(f=>f.functionName.startsWith('_icon')||f.functionName.startsWith('iconWhen')).map(f=>{
   const c=new MB_Compiler(editor.project,editor.codeManager);return c.bytesForInstructions(c.instructionsFor(f),f,f.functionName).length;});
  window.sensorTestBlock=editor.scripts.children.find(b=>b.selector==='iconWhenToF');
  MB_IconInputs.open(sensorTestBlock.inputs()[1]);
  return{out,tail,compiled,unused:editor.codeManager.unusedFunctions().filter(n=>n.startsWith('_iconRead')),source:editor.project.codeString()};
 });
 assert.deepEqual(result.tail,['iconWhenToF','iconWhenDLight']);
 for(const hat of result.out){assert(hat.hat);assert(hat.compact);assert(hat.traced);assert.equal(hat.type,5);assert.equal(hat.restored,hat.selector);assert.equal(hat.body,'waitMillis');assert.equal(hat.args.length,2);}
 assert.equal(result.unused.length,0);assert(result.compiled.every(n=>n>0));
 const panel=page.locator('.icon-parameter-popover.--sensor');await panel.getByRole('button',{name:/Greater than/}).click();await panel.locator('input').fill('250');await panel.getByRole('button',{name:'Done',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>sensorTestBlock.inputs().map(s=>s.evaluate())),['>',250]);
 await page.evaluate(()=>MB_IconInputs.open(sensorTestBlock.inputs()[1]));await panel.locator('input').fill('-1');assert(await panel.getByRole('button',{name:'Done',exact:true}).isDisabled());await panel.locator('input').fill('250');
 const bounds=await panel.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=842&&bounds.y+bounds.height<=393);
 assert.equal(await panel.evaluate(el=>el.scrollHeight<=el.clientHeight),true);
 await page.screenshot({path:'/tmp/cocube-sensor-ui.png'});
 await panel.getByRole('button',{name:'Done',exact:true}).click();
 await page.evaluate(()=>{CoCubeEditorShell.saveDraft();});await page.reload();await page.waitForFunction(()=>window.CoCubeEditorShell&&MB_editor.palette.contents.children.length===23);
 assert.deepEqual(await page.evaluate(()=>MB_editor.scripts.children.find(b=>b.selector==='iconWhenToF').inputs().map(s=>s.evaluate())),['>',250]);
 assert.deepEqual(errors,[]);console.log('PASS sensor hat shapes, compile/decompile, reachable sampling dependencies, parameter edits/validation, phone bounds and saved project restore');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
