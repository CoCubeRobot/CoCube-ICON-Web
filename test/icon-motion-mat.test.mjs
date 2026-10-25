import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {sensorEditor} from './helpers/sensor-editor.mjs';

const read=path=>readFileSync(new URL('../src/js-editor/'+path,import.meta.url),'utf8');
const current=read('Libraries/Robots/CoCube ICON.ubl');
function fixture(){
 const env=sensorEditor();
 env.run(read('mb-icon-cocube.js'));
 env.context.currentMotion=current;
 env.context.nativeMotion=read('Libraries/Robots/CoCube.ubl');
 env.context.nativePid=read('Libraries/Motors/PID.ubl');
 env.run(`MB_IconCoCube.source=currentMotion;
  MB_IconCoCube.motionSources={cocube:nativeMotion,pid:nativePid};
  var notices=[]; MB_editor.inform=message=>notices.push(message);`);
 return env;
}

function loadPrevious(env){
 env.run(`var oldMotion=currentMotion.replace('version 3 1','version 3 0');
  var start=oldMotion.indexOf("to '_iconCoCubeGridBegin' unused {");
  var end=oldMotion.indexOf("to '_iconCoCubeGridFace' heading {");
  oldMotion=oldMotion.slice(0,start)+MB_IconCoCube.previousMatSource+oldMotion.slice(end);
  MB_editor.project.addLibraryFromString(oldMotion,'CoCube ICON','old-motion');`);
}

test('ICON motion delegates mat decisions to unchanged native CoCube functions',()=>{
 const env=fixture();
 assert.equal(env.run('MB_IconCoCube.ensureLibrary(MB_editor)'),true);
 env.run(`var baseline=new MB_Module('baseline'); baseline.loadFunctions(MB_Parser.parse(nativeMotion));`);
 for(const name of env.run('MB_IconCoCube.nativeNames')){
  env.context.name=name;
  assert.equal(env.run('MB_editor.project.functionNamed(name).equalsFunction(baseline.functionNamed(name))'),true,name+' must remain native');
 }
 // Follow the actual compiled call graph, including private helper functions.
 // A transient false mat state must not reach an ICON-added stop-all guard.
 env.run(`var visited=new Set();
  function visit(name){if(visited.has(name))return;visited.add(name);
   var fn=MB_editor.project.functionNamed(name); if(!fn?.cmdList)return;
   fn.cmdList.forAllBlocks(block=>{if(MB_editor.project.functionNamed(block.selector))visit(block.selector);});
  }
  MB_IconCoCube.paletteSelectors.forEach(visit);`);
 assert.equal(env.run("visited.has('_iconCoCubeWatchMat') || visited.has('_iconCoCubeCheckMat')"),false);
 for(const name of env.run('MB_IconCoCube.paletteSelectors')){
  env.context.name=name;
  assert.equal(env.run('new MB_Compiler(MB_editor.project,MB_editor.codeManager).instructionsFor(MB_editor.project.functionNamed(name).cmdList).length > 0'),true);
 }
 assert.deepEqual(env.errors,[]);
});

test('saved 3.0 projects upgrade their stock guards and preserve user scripts',()=>{
 const env=fixture(); loadPrevious(env);
 env.run(`var script=MB_Parser.blockFor(['CoCube ICON forward',2]); MB_editor.project.main.scripts.push([20,30,script]);
  var savedScript=script.codeString();`);
 assert.equal(env.run('MB_IconCoCube.ensureLibrary(MB_editor)'),true);
 assert.deepEqual(Array.from(env.run("MB_editor.project.libraryNamed('CoCube ICON').version")),[3,1]);
 env.run(`var expected=new MB_Module('current');expected.loadFunctions(MB_Parser.parse(currentMotion));`);
 for(const name of ['_iconCoCubeGridBegin','_iconCoCubeCheckMat','_iconCoCubeWatchMat']){
  env.context.name=name;
  assert.equal(env.run('MB_editor.project.functionNamed(name).equalsFunction(expected.functionNamed(name))'),true,name+' did not upgrade');
 }
 assert.equal(env.run('script.codeString()===savedScript'),true);
 assert.equal(env.run('MB_editor.project.main.scripts[0][2]===script'),true);
 assert.equal(env.run('notices.length'),0);
 assert.deepEqual(env.errors,[]);
});

test('migration preserves a deliberately customized localization function',()=>{
 const env=fixture(); loadPrevious(env);
 env.run(`var library=MB_editor.project.libraryNamed('CoCube ICON');
  library.functions=library.functions.filter(fn=>fn.functionName!=='_iconCoCubeCheckMat');
  library.loadFunctions(MB_Parser.parse("to '_iconCoCubeCheckMat' unused { return 42 }"));
  var custom=library.functionNamed('_iconCoCubeCheckMat');`);
 assert.equal(env.run('MB_IconCoCube.ensureLibrary(MB_editor)'),true);
 assert.equal(env.run("MB_editor.project.functionNamed('_iconCoCubeCheckMat')===custom"),true);
 assert.equal(env.run("notices.some(message=>message.includes('_iconCoCubeCheckMat'))"),true);
 assert.deepEqual(env.errors,[]);
});
