// Checks the installed Android WebView directly, including older CDP versions.
const assert = require('node:assert/strict');
const path = require('node:path');
const { ws: WebSocket } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));
const endpoint = process.env.COCUBE_CDP_URL || 'http://127.0.0.1:9228';
(async () => {
 const pages = await fetch(endpoint + '/json').then(r => r.json());
 const target = pages.find(p => p.url.includes('/icon.html'));
 assert(target, 'Open ICON on the phone first');
 const socket = new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve, reject) => {socket.once('open', resolve);socket.once('error', reject);});
 let id=0;const pending=new Map();const errors=[];
 socket.on('message', raw => {const m=JSON.parse(raw);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const call=(method,params)=>new Promise((resolve,reject)=>{const n=++id;const timeout=setTimeout(()=>{pending.delete(n);reject(Error('CDP timed out: '+method));},10000);pending.set(n,m=>{clearTimeout(timeout);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=()=>new Promise(r=>setTimeout(r,150));
 const swipe=async(x,y,dy)=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/12}]});await new Promise(r=>setTimeout(r,16));}await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait();};
 try {
  await call('Runtime.enable',{});
  console.log('WebView:',await evaluate('({width:innerWidth,height:innerHeight,agent:navigator.userAgent})'));
  await evaluate(`MB_IconInputs.close();CoCubeEditorShell.menus.close();CoCubeEditorShell.menus.openProject();[...document.querySelectorAll('.cocube-menu-grid button')].find(b=>/Language|语言/.test(b.textContent)).click();`);await wait();
  const menu=await evaluate(`(()=>{const p=document.querySelector('.cocube-language-menu'),r=p.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:innerHeight,scroll:p.scrollHeight,client:p.clientHeight,count:p.querySelectorAll('.cocube-menu-grid button').length}})()`);
  assert.equal(menu.count,32);assert(menu.bottom<=menu.height);assert(menu.scroll>menu.client);
  await swipe(200,330,-140);
  assert(await evaluate('document.querySelector(".cocube-language-menu").scrollTop > 50'),'language finger swipe did not scroll');
  assert(await evaluate('!!document.querySelector(".cocube-language-menu")'),'language swipe accidentally selected a language');
  await evaluate('CoCubeEditorShell.menus.close()');
  console.log('PASS all 32 languages, bounded list and actual finger scroll');
  for (const selector of ['waitMillis','repeat','play tone','[display:mbDisplay]','set display color','led_displayImage','iconDisplayColorMatrix','CoCube ICON forward','CoCube ICON go to','CoCube ICON face']) {
   const quoted=JSON.stringify(selector);
   await evaluate(`(()=>{MB_IconInputs.close();if(window.auditBlock){auditBlock.destroy();MB_editor.updateProject();}const block=MB_editor.palette.contents.children.find(b=>b.selector===${quoted}).fullCopy();block.isTemplate=false;MB_editor.addBlockToScriptsAt(block,300,80);window.auditBlock=block;MB_IconInputs.open(block.inputs()[0]);})()`);await wait();
   const result=await evaluate(`(()=>{const p=MB_IconInputs.panel,r=p.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,inputs:p.querySelectorAll('input').length,buttons:p.querySelectorAll('button').length,scroll:p.scrollHeight,client:p.clientHeight}})()`);
   assert(result.left>=0&&result.right<=result.width+1&&result.top>=0&&result.bottom<=result.height+1,selector+' outside screen: '+JSON.stringify(result));
   if(selector==='iconDisplayColorMatrix'){
    const fit=await evaluate(`(()=>{const p=MB_IconInputs.panel,b=p.firstElementChild,d=p.querySelector('.icon-color-matrix-done').getBoundingClientRect();return{overflow:getComputedStyle(p).overflowY,bodyScroll:b.scrollHeight,bodyClient:b.clientHeight,done:d.bottom,screen:innerHeight,cells:p.querySelectorAll('.icon-color-matrix-grid button').length}})()`);
    assert.equal(fit.cells,25);assert(fit.bodyScroll<=fit.bodyClient+1&&fit.done<=fit.screen,'color actions require scrolling');
   }
   if(selector==='led_displayImage'){
    const bounds=await evaluate(`(()=>{const g=document.querySelector('.icon-led-presets'),r=g.getBoundingClientRect();return{x:r.left+r.width/2,y:Math.min(r.bottom-12,innerHeight-16),scroll:g.scrollHeight,client:g.clientHeight}})()`);
    assert(bounds.scroll>bounds.client);await swipe(bounds.x,bounds.y,-120);
    assert(await evaluate('document.querySelector(".icon-led-presets").scrollTop>20'),'preset finger scroll failed');
   }
   console.log('PASS picker',selector,result);
  }
  await evaluate(`MB_IconInputs.close();auditBlock.destroy();MB_editor.updateProject();CoCubeEditorShell.menus.openProject();`);await wait();
  await evaluate(`[...document.querySelectorAll('.cocube-menu-grid button')].find(b=>/Activities|活动/.test(b.textContent)).click()`);await wait();
  for(const file of ['soccer','cargo','track','music_buzzer','music_midi','maze']){
   await evaluate(`modalNavigator.open('features/${file}.html')`);await new Promise(r=>setTimeout(r,450));
   const result=await evaluate(`(()=>{const f=document.querySelector('iframe'),d=f.contentDocument,w=f.contentWindow,b=d.querySelector('.back-btn'),r=b?.getBoundingClientRect();return{url:w.location.pathname,back:d.querySelectorAll('.back-btn').length,extra:document.querySelectorAll('.cocube-feature-close').length,width:w.innerWidth,height:w.innerHeight,backRect:r?.toJSON()}})()`);
   assert.equal(result.back,1);assert.equal(result.extra,0);assert(result.backRect.left>=0&&result.backRect.right<=result.width);
   console.log('PASS activity/back',file);
   await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-btn').click()`);await wait();
  }
  await evaluate(`document.querySelector('iframe').contentDocument.querySelector('.back-btn').click()`);await wait();
  assert(await evaluate('!document.querySelector("iframe") && !MB_connection.platformPaused'));
  assert.deepEqual(errors,[]);
  console.log('PASS activity return, no uncaught exceptions');
 }finally{await evaluate('MB_IconInputs.close();CoCubeEditorShell.menus.close();').catch(()=>{});socket.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
