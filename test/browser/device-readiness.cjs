// A protocol emulator exercises real ICON uploads and the actual Capacitor USB adapter.
// It acknowledges CRCs but does not simulate robot motion or claim hardware validation.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:900,height:420},locale:'en'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.androidBridge={};window.mockListeners=new Map();window.mockChunks=new Map();window.mockWire=[];window.mockRuns=[];window.mockFailUploads=false;let id=0,buffer=[];
   const headers={UsbSerial:['listDevices','requestPermission','open','close','write','setDTR','setRTS'],CoCubeFilePicker:['openFile','saveFile'],App:['exitApp'],StatusBar:['hide'],SplashScreen:['hide']};
   window.mockEmit=(bytes)=>{for(const listener of mockListeners.values())if(listener.plugin==='UsbSerial'&&listener.event==='usbSerialData')listener.callback({data:bytes});};
   const long=(op,id,body)=>[251,op,id,body.length&255,body.length>>8,...body];
   const respond=(op,chunk,body)=>{
    mockWire.push({op,chunk,body});
    if(op===26)mockEmit([250,26,chunk]);
    if(op===12)mockEmit(long(22,chunk,[2,...new TextEncoder().encode('v416 CoCube')]));
    if(op===14)mockChunks.clear();
    if(op===32&&!mockFailUploads){
     const crc=MB_editor.codeManager.computeCRC(body.slice(1));mockChunks.set(chunk,{body,crc});mockEmit(long(23,chunk,crc));
    }
    if(op===38)mockEmit(long(39,chunk,[...mockChunks].flatMap(([id,item])=>[id,...item.crc])));
    if(op===3){if(!mockChunks.has(chunk))throw new Error('start before upload');mockRuns.push(chunk);}
   };
   window.Capacitor={PluginHeaders:Object.entries(headers).map(([name,methods])=>({name,methods:[...methods.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]})),
    nativeCallback(plugin,method,args,callback){const key=String(++id);mockListeners.set(key,{plugin,event:args.eventName,callback});return key;},
    async nativePromise(plugin,method,args){
     if(method==='removeListener')mockListeners.delete(args.callbackId);
     if(method==='listDevices')return{devices:[{deviceId:'mock',productName:'Protocol emulator'}]};
     if(method==='write'){
      buffer.push(...args.data);
      while(buffer.length>=3){let count=buffer[0]===250?3:buffer[0]===251&&buffer.length>=5?5+buffer[3]+(buffer[4]<<8):Infinity;
       if(buffer.length<count)break;const packet=buffer.splice(0,count);respond(packet[1],packet[2],packet[0]===251?packet.slice(5,-1):[]);}
     }
     return{};
    }};
   // Catch wrong receivers that permissive desktop Chrome otherwise accepts.
   for(const name of ['requestAnimationFrame','cancelAnimationFrame','setInterval','clearInterval']){
    const fn=window[name];window[name]=function(...args){if(this!==window)throw new TypeError('Illegal invocation: '+name);return fn.apply(window,args);};
   }
  });
  await page.goto(`${process.env.COCUBE_TEST_URL||'http://127.0.0.1:4175'}/icon.html`);
  await page.waitForFunction(()=>window.CoCubeEditorShell&&MB_editor.palette.contents.children.length===23);
  await page.locator('.icon-project-card').click();
  assert.equal(await page.getByRole('button',{name:/Activities|活动/,exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:/Parent settings|家长设置/,exact:true}).count(),0);
  await page.locator('.icon-project-card').click();
  await page.evaluate(()=>MB_connection.connect('serial'));

  try { await page.waitForFunction(()=>MB_connection.platformReady,null,{timeout:60000}); } catch(e) { console.log(await page.evaluate(()=>({ready:MB_connection.platformState,version:MB_connection.vmVersion,port:MB_connection.portName,wire:mockWire.slice(-5),panel:document.querySelector('.icon-preparation')?.innerText})));throw e;}
  assert.equal(await page.locator('.icon-preparation').count(),0);
  const prepared=await page.evaluate(()=>({palette:MB_editor.codeManager.paletteBlocks.size,keys:[...MB_editor.codeManager.chunkIDs].filter(([k])=>k.startsWith('@ICON-palette/')).length,chunks:mockChunks.size}));
  assert.equal(prepared.palette,23);assert.equal(prepared.keys,23);assert(prepared.chunks>23);
  await page.evaluate(async()=>{const block=MB_editor.palette.contents.children.find(b=>b.selector==='play tone');await MB_editor.compileAndRun(block);});
  assert.equal(await page.evaluate(()=>mockRuns.length),1);
  // A just-dropped chunk is uploaded before start even when tapped immediately.
  await page.evaluate(async()=>{const template=MB_editor.palette.contents.children.find(b=>b.selector==='iconDisplayColorMatrix');const copy=template.fullCopy();copy.isTemplate=false;MB_editor.addBlockToScriptsAt(copy,100,100);await MB_editor.compileAndRun(copy);});
  assert.equal(await page.evaluate(()=>mockRuns.length),2);
  const portBefore=await page.evaluate(()=>{window.testPort=MB_connection.port;return mockChunks.size;});
  await page.evaluate(()=>CoCubeEditorShell.openFeatures());
  await page.frameLocator('iframe').locator('.back-btn').click();
  await page.waitForSelector('iframe',{state:'detached'});
  assert.equal(await page.evaluate(()=>MB_connection.port===testPort&&MB_connection.isConnected()),true);
  assert.equal(await page.evaluate(()=>mockChunks.size),portBefore);
  // Restore a replaced activity program without reopening the transport.
  await page.evaluate(()=>CoCubeEditorShell.openFeatures());
  await page.evaluate(()=>{mockChunks.clear();modalNavigator.setProgram('soccer');});
  await page.frameLocator('iframe').locator('.back-btn').click();
  await page.waitForFunction(()=>MB_connection.platformState==='ready' && !document.querySelector('iframe'));
  assert.equal(await page.evaluate(()=>MB_connection.port===testPort&&MB_connection.isConnected()),true);
  assert(await page.evaluate(()=>mockChunks.size>23));
  await page.evaluate(()=>MB_connection.disconnect());
  // Failed preparation stays blocked and retry uses the same transport.
  await page.evaluate(()=>{mockFailUploads=true;void MB_connection.connect('serial');});
  await page.waitForFunction(()=>MB_connection.platformState==='preparation-failed',null,{timeout:30000});
  assert.equal(await page.evaluate(()=>MB_editor.interactionBlocked()),true);
  const starts=await page.evaluate(()=>mockRuns.length);
  await page.evaluate(()=>MB_editor.compileAndRun(MB_editor.palette.contents.children.find(b=>b.selector==='play tone')));
  assert.equal(await page.evaluate(()=>mockRuns.length),starts);
  await page.evaluate(()=>{mockFailUploads=false;});
  await page.locator('.icon-preparation button').filter({hasText:/Retry|重试/}).click();
  await page.waitForFunction(()=>MB_connection.platformReady,null,{timeout:30000});
  await page.evaluate(()=>MB_connection.disconnect());
  assert.equal(await page.locator('.top-bar__controls-connect').getAttribute('data-state'),'disconnected');
  assert.deepEqual(errors,[]);
  console.log('PASS 23 palette preload/CRC confirmation, immediate tone and color-matrix runs, activity return with same connection, strict timer receiver, failed preparation/retry and activity program restoration');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
