import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translateUI} from '../src/jsEditorI18n.js';

test('every bundled CoCube navigation fault has a non-Chinese display translation',async()=>{
 const old=globalThis.window;globalThis.window={GetText:{currentLocale:'en',localize:text=>text}};
 try {
  for(const path of ['src/js-editor/Libraries/Robots/CoCube ICON.ubl','src/js-editor/mb-icon-cocube.js']){
   const source=await readFile(path,'utf8');
   const faults=[...source.matchAll(/'_iconCoCubeFail' '([^']+)'/g)].map(x=>x[1]);
   assert(faults.length>0);
   for(const text of faults)assert(!/\p{Script=Han}/u.test(translateUI(text)),text);
  }
 }finally{globalThis.window=old;}
});
