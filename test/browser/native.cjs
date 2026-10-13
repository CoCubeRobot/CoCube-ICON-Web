const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
window.androidBridge={};window.nativeCalls=[];window.nativeListeners={};
const names={UsbSerial:['listDevices','requestPermission','open','close','write','setDTR','setRTS'],CoCubeFilePicker:['openFile','saveFile'],App:['exitApp','getInfo'],StatusBar:['hide'],SplashScreen:['hide']};
window.Capacitor={PluginHeaders:Object.entries(names).map(([name,methods])=>({name,methods:[...methods.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]})),
nativePromise:async(plugin,method,args)=>{nativeCalls.push({plugin,method,args});if(method==='listDevices')return{devices:[{deviceId:'test',productName:'CoCube'}]};if(method==='openFile')return{name:'原生测试.ubp',data:btoa("projectName 'test'\nmodule 'main'\n")};return{}},
nativeCallback:(plugin,method,args,cb)=>{nativeListeners[plugin+':'+args.eventName]=cb;return 'listener'}};
});
await page.goto(`${process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4173'}/icon.html`);await page.waitForFunction(()=>!!window.CoCubeEditorShell);
assert.equal(await page.evaluate(()=>MB_connection.hasWebSerial()),true);
await page.evaluate(async()=>{const port=new MB_CommPort();window.testPort=port;await port.connect('serial');window.nativeListeners['UsbSerial:usbSerialData']({data:[250,26,0]});window.testBytes=[...port.read()];await port.write(Uint8Array.of(250,26,0));await port.drain();await port.disconnect();await MB_editor.saveTextAsFile('中文数据','中文项目.ubp')});
assert.deepEqual(await page.evaluate(()=>testBytes),[250,26,0]);const calls=await page.evaluate(()=>nativeCalls);assert(calls.some(c=>c.method==='open'));assert(calls.some(c=>c.method==='write'&&c.args.data[0]===250));assert(calls.some(c=>c.method==='saveFile'&&c.args.text==='中文数据'));await page.evaluate(async()=>{
 const port = new MB_CommPort();await port.connect('serial');
 MB_connection.port=port;MB_connection.portName='serial';MB_connection.platformReady=true;
 MB_connection.sendMsg=async()=>{};MB_connection.startMessageProcessing=()=>{};
 MB_connection.lastPingRecvMSecs=Date.now();
 window.connectedPort=port;
 document.dispatchEvent(new CustomEvent('cocube-connection-state',{detail:'ready'}));
});
assert.equal(await page.locator('.top-bar__controls-connect').getAttribute('data-state'),'ready');
const closesBefore=await page.evaluate(()=>nativeCalls.filter(c=>c.method==='close').length);
await page.evaluate(()=>CoCubeEditorShell.openFeatures());
await page.frameLocator('iframe').locator('.back-btn').click();
await page.waitForSelector('iframe',{state:'detached'});
assert.equal(await page.evaluate(()=>MB_connection.port===connectedPort&&MB_connection.isConnected()),true);
assert.equal(await page.evaluate(()=>nativeCalls.filter(c=>c.method==='close').length),closesBefore);
await page.evaluate(()=>MB_connection.disconnect());
assert.deepEqual(errors,[]);console.log('PASS native plugin registration, USB selection/open/read/write/close and Unicode save');await browser.close()})().catch(e=>{console.error(e);process.exitCode=1});
