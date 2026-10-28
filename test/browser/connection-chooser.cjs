const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
 const browser = await chromium.launch({channel:'chrome', headless:true});
 try {
  for (const locale of ['zh-CN', 'en', 'es']) for (const transport of ['usb', 'ble']) {
   const page = await browser.newPage({viewport:{width:850,height:400}, locale, hasTouch:true});
   const errors = [], dialogs = [];
   page.on('pageerror', error => errors.push(error.message));
   page.on('dialog', async dialog => {dialogs.push(dialog.message()); await dialog.accept();});
   await page.addInitScript(() => {
    window.chooserCalls = [];
    const cancel = (type, options) => {
     chooserCalls.push({type, options, active:navigator.userActivation.isActive});
     return Promise.reject(new DOMException('User cancelled', 'NotFoundError'));
    };
    Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:options=>cancel('usb',options)}});
    Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{requestDevice:options=>cancel('ble',options)}});
   });
   await page.goto(`${process.env.COCUBE_TEST_URL || 'http://127.0.0.1:4217'}/icon.html`);
   await page.waitForFunction(() => !!window.CoCubeEditorShell);
   await page.locator('.app-preloader').waitFor({state:'hidden'});
   await page.locator('.top-bar__controls-connect').click();
   await page.locator('.cocube-connection-menu .cocube-menu-grid button').nth(transport==='usb'?0:1).click();
   await page.waitForFunction(() => MB_connection.platformState === 'disconnected');
   const calls = await page.evaluate(() => chooserCalls);
   assert.equal(calls.length,1); assert.equal(calls[0].type,transport); assert(calls[0].active);
   if (transport==='usb') assert.deepEqual(calls[0].options.filters.map(f=>f.usbVendorId),
    [0x0403,0x0d28,0x10c4,0x1a86,0x239a,0x2a03,0x2341,0x03eb,0x1366,0x16c0,0x2e8a,0x303a,0x28e9]);
   else assert.deepEqual(calls[0].options.filters,[{services:['bb37a001-b922-4018-8e74-e14824b3a638']}]);
   assert.deepEqual(errors,[]); assert.deepEqual(dialogs,[]);
   // The shared picker must keep buttons stable while repeated scan results arrive.
   if (transport==='ble') {
    await page.evaluate(() => {
     window.scanStops=0;
     window.pickerSerial={bleClient:{stopLEScan:async()=>{scanStops++;},requestLEScan:async(options,callback)=>{window.scanResult=callback;}}};
     window.pickerSelection=window.CapacitorBLESerial.prototype.scanAndSelectDevice.call(pickerSerial)
      .then(device=>{window.selectedDevice=device.deviceId;},error=>{window.pickerError=error.code;});
     scanResult({device:{deviceId:'first',name:'First robot'},rssi:-60});
     scanResult({device:{deviceId:'second',name:'Second robot'},rssi:-65});
    });
    await page.locator('.ble-device-dialog .device-item').nth(1).waitFor();
    await page.evaluate(() => {window.originalRow=document.querySelectorAll('.device-item')[1];
     originalRow.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
     for(let i=0;i<20;i++)scanResult({device:{deviceId:'second',name:'Second robot'},rssi:-40});});
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => document.querySelectorAll('.device-item')[1]===originalRow));
    await page.locator('.ble-device-dialog .device-item').nth(1).click();
    await page.evaluate(() => pickerSelection); assert.equal(await page.evaluate(()=>selectedDevice),'second');
    assert.equal(await page.locator('.ble-device-dialog').count(),0);
    await page.evaluate(() => {window.pickerSelection=window.CapacitorBLESerial.prototype.scanAndSelectDevice.call(pickerSerial).catch(error=>{window.pickerError=error.code;});});
    await page.locator('.ble-device-dialog .cancel-btn').click(); await page.evaluate(() => pickerSelection);
    assert.equal(await page.evaluate(() => pickerError),'SELECTION_CANCELLED');
    assert.equal(await page.locator('.ble-device-dialog').count(),0);
   }
   await page.close();
  }
  console.log('PASS localized Web USB/BLE menus, filtered choosers, user activation, silent cancellation and stable shared BLE picker');
 } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode=1;});
