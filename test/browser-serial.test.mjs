import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserUSBSerial, BrowserBLESerial } from '../src/browserSerial.js';

test('browser USB delivers exact bytes, awaits writes and releases locks on disconnect', async () => {
 const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator');const events=[];let pending;let reads=0;
 const reader={read:async()=> ++reads===1?{value:Uint8Array.of(1,2),done:false}:new Promise(r=>pending=r),cancel:async()=>pending?.({done:true}),releaseLock:()=>events.push('reader released')};
 const port={open:async()=>{},readable:{getReader:()=>reader},writable:{getWriter:()=>({write:async b=>events.push([...b]),releaseLock:()=>events.push('writer released')})},close:async()=>events.push('closed'),setSignals:async s=>events.push(s)};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:async options=>{
  assert.deepEqual(options.filters.map(filter=>filter.usbVendorId),
   [0x0403,0x0d28,0x10c4,0x1a86,0x239a,0x2a03,0x2341,0x03eb,0x1366,0x16c0,0x2e8a,0x303a,0x28e9]);
  return port;
 }}}});
 try {const usb=new BrowserUSBSerial();let bytes;usb.onData(b=>bytes=[...b]);await usb.connect();assert.deepEqual(bytes,[1,2]);usb.write_data(Uint8Array.of(3,4));await usb.drain();await usb.disconnect();assert.deepEqual(events,[[3,4],'reader released','writer released','closed']);assert.equal(usb.isConnected(),false);}
 finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}
});

test('browser BLE sends ordered 63-byte packets and respects DataView offsets',async()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator');const sent=[];let onRead;
 const tx={addEventListener:(n,f)=>onRead=f,removeEventListener:()=>{},startNotifications:async()=>{}};
 const rx={writeValueWithoutResponse:async b=>sent.push([...b])};
 const device={addEventListener:()=>{},removeEventListener:()=>{},gatt:{connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async id=>id.includes('a003')?tx:rx})}),disconnect:()=>{}}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>device}}});
 try{const ble=new BrowserBLESerial();let bytes;ble.onData(b=>bytes=[...b]);await ble.connect();onRead({target:{value:new DataView(Uint8Array.of(9,1,2,9).buffer,1,2)}});assert.deepEqual(bytes,[1,2]);ble.write_data(Uint8Array.from({length:130},(_,i)=>i));await ble.drain();assert.deepEqual(sent.map(b=>b.length),[63,63,4]);assert.deepEqual(sent.flat(),Array.from({length:130},(_,i)=>i));await ble.disconnect();assert.equal(ble.isConnected(),false);}
 finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}
});

test('cancelled browser choosers return the shared silent cancellation sentinel',async()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator');const cancel=async()=>{throw Object.assign(new Error('cancelled'),{name:'NotFoundError'})};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{requestPort:cancel},bluetooth:{requestDevice:cancel}}});
 try{await assert.rejects(new BrowserUSBSerial().connect(),{code:'SELECTION_CANCELLED'});await assert.rejects(new BrowserBLESerial().connect(),{code:'SELECTION_CANCELLED'});}
 finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}
});
