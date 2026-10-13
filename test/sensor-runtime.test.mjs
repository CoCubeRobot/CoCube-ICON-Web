import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sensorEditor} from './helpers/sensor-editor.mjs';

function fixture(options) {
    const env = sensorEditor(options);
    const code = readFileSync(new URL('../src/jsEditorSensors.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/m, '').replace(/\bexport /g, '');
    env.context.translateUI = text => text;
    env.context.moduleSource = env.module; env.context.servoSource = env.servo;
    vm.runInContext(code, env.context);
    env.context.MB_Files = {allFilesIn: () => [], readFile: async path => path.endsWith('Servo.ubl') ? env.servo : env.module};
    return env;
}

test('sensor hats are last on every shelf rebuild and remain registered for device preparation', async () => {
    const env = fixture({icons: true});
    env.run(`MB_editor.iconLayout=true; MB_IconGripper.ensureLibrary=()=>false;
        MB_editor.palette={contents:new Morph()};
        MB_editor.paletteX=18; MB_editor.paletteY=16;
        MB_editor.addIconPaletteBlocks();
        var originalOrder=MB_editor.palette.contents.children.map(block=>block.selector);`);
    const originalOrder = Array.from(env.run('originalOrder'));
    await env.run('installSensorHats()');
    for (let rebuild = 0; rebuild < 3; rebuild++) {
        env.run(`MB_editor.palette.contents.children.slice().forEach(block=>block.destroy());
            MB_editor.paletteX=18; MB_editor.paletteY=16;
            var prepared=[];
            var register=MB_editor.codeManager.setPaletteBlocks;
            MB_editor.codeManager.setPaletteBlocks=function(blocks){prepared=blocks; return register.call(this,blocks);};
            MB_editor.addIconPaletteBlocks();
            MB_editor.codeManager.setPaletteBlocks=register;`);
        assert.deepEqual(Array.from(env.run('MB_editor.palette.contents.children.map(block=>block.selector)')),
            [...originalOrder, 'iconWhenToF', 'iconWhenDLight']);
        assert.deepEqual(Array.from(env.run('prepared.slice(-2).map(block=>block.selector)')),
            ['iconWhenToF', 'iconWhenDLight']);
        assert.equal(env.run('prepared.slice(-2).every(block=>block.isTemplate && MB_editor.codeManager.chunkTypeFor(block)===1)'), true);
        assert.equal(env.run('prepared.at(-2).right() < prepared.at(-1).left()'), true);
    }
    assert.deepEqual(env.errors, []);
});

test('sensor actions trace original canvas blocks, including identical and nested commands', async () => {
    const env = fixture({icons: true, execution: true});
    await env.run('installSensorHats()');
    env.run('MB_editor.iconLayout=true; ensureSensorLibrary(MB_editor,moduleSource,servoSource); var canvas=new ScriptsMorph();');
    for (const selector of ['iconWhenToF', 'iconWhenDLight']) {
        env.run(`var hat=MB_Parser.blockFor(['${selector}', "'>'", 100]);
            var first=MB_Parser.blockFor(['waitMillis',1000]);
            var second=MB_Parser.blockFor(['waitMillis',1000]);
            var loop=MB_Parser.blockFor(['repeat',2]);
            var nested=MB_Parser.blockFor(['waitMillis',1000]);
            loop.inputs()[1].nestedBlock(nested);
            var last=MB_Parser.blockFor(['waitMillis',1000]);
            canvas.add(hat); hat.nextBlock(first); first.nextBlock(second);
            second.nextBlock(loop); loop.nextBlock(last);
            var source=hat.codeString();
            var compiler=new MB_Compiler(MB_editor.project,MB_editor.codeManager);
            var instructions=compiler.instructionsFor(hat);
            var trace=MB_ExecutionHighlight.owners.get(hat);`);
        assert.equal(env.run('!!compiler.executionTrace'), true);
        assert.equal(env.run('trace.tokens.size'), 4, 'hidden rearm wait must not acquire an action token');
        assert.equal(env.run('[first,second,nested,last].every(action=>trace.tokens.has(action))'), true);
        assert.equal(env.run('new Set(trace.tokens.values()).size'), 4, 'identical commands need distinct tokens');
        assert.equal(env.run('instructions.filter(i=>typeof i==="string"&&i.startsWith("~mbi:")).length'), 5);
        assert.equal(env.run('hat.codeString() === source'), true, 'no hidden wait or tracing data in user source');
        env.run(`var bytes=compiler.bytesForInstructions(instructions,hat,'sensor-trace-test');
            var decoder=new MB_Decompiler();
            for(const [name,id] of MB_editor.codeManager.functionChunkIDs) decoder.funcs.set(id,name);
            var restored=decoder.decompile(100,5,Uint8Array.from(bytes));`);
        assert.equal(env.run('restored.selector'), selector);
        assert.equal(env.run('JSON.stringify(restored).includes("~mbi:")'), false);
        assert.equal(env.run('restored.next.next.next.selector'), 'repeat');
        assert.equal(env.run('compiler.sourceMap.some(site=>site[2]==="sensor-trace-test/s3.a1.s0")'), true);

        // Simulate the device's real output messages, not a program timeline.
        env.run('MB_ExecutionHighlight.setRunning(100,true);');
        assert.equal(env.run('MB_ExecutionHighlight.lit.size'), 0, 'polling alone must not light an action');
        for (const action of ['first', 'second', 'nested', 'last']) {
            assert.equal(env.run(`MB_ExecutionHighlight.consumeOutput(100, '~mbi:' + MB_ExecutionHighlight.session + ':' + trace.tokens.get(${action}))`), true);
            assert.equal(env.run(`MB_ExecutionHighlight.lit.has(${action})`), true);
            assert.equal(env.run('MB_ExecutionHighlight.lit.size'), 1);
            env.run('MB_ExecutionHighlight.consumeOutput(100,MB_ExecutionHighlight.endMarker());');
        }
        env.run('MB_ExecutionHighlight.setRunning(100,false);');
        assert.equal(env.run('MB_ExecutionHighlight.lit.size'), 0, 'stopping removes action feedback');
        // Edits invalidate stale device markers.
        env.run(`var oldMarker='~mbi:'+MB_ExecutionHighlight.session+':'+trace.tokens.get(first);
            hat.inputs()[1].setContents(250); MB_ExecutionHighlight.setRunning(100,true);
            MB_ExecutionHighlight.consumeOutput(100,oldMarker);`);
        assert.equal(env.run('MB_ExecutionHighlight.lit.size'), 0);
        env.run('MB_ExecutionHighlight.setRunning(100,false);');
        env.run('compiler.disableExecutionTrace=true; var plain=compiler.instructionsFor(hat);');
        assert.equal(env.run('plain.some(i=>typeof i==="string"&&i.startsWith("~mbi:"))'), false);
        env.run('compiler.disableExecutionTrace=false; canvas.removeChild(hat); compiler.instructionsFor(hat);');
        assert.equal(env.run('compiler.executionTrace'), null, 'detached/shelf scripts are not traced');
    }
    // Reusing a compiler for an ordinary hat must clear the expansion mapping.
    env.run(`var start=MB_Parser.blockFor(['whenStarted']); canvas.add(start);
        var wait=MB_Parser.blockFor(['waitMillis',1000]); start.nextBlock(wait);
        compiler.instructionsFor(start);`);
    assert.equal(env.run('MB_ExecutionHighlight.owners.get(start).tokens.has(wait)'), true);
    env.run('MB_ExecutionHighlight.clearAll();');
    assert.deepEqual(env.errors, []);
});

test('sensor pickers match existing chevron footprints and preserve editable thresholds at every zoom', async () => {
    const env = fixture({icons: true});
    await env.run('installSensorHats()');
    env.run('MB_editor.iconLayout=true; ensureSensorLibrary(MB_editor,moduleSource,servoSource);');
    for (const scale of [0.5, 1, 2]) {
        env.run(`SyntaxElementMorph.prototype.scale=${scale};`);
        for (const selector of ['iconWhenToF', 'iconWhenDLight']) {
            env.run(`var hat=MB_Parser.blockFor(['${selector}', "'>'", 65535]);
                hat.nextBlock(MB_Parser.blockFor(['waitMillis',1000]));
                var slot=hat.inputs()[1];
                var reference=MB_Parser.blockFor(['whenBroadcastReceived', "'_iconColor1'"]).inputs()[0];
                var icon=hat.parts().find(part=>part instanceof MB_IconMorph);`);
            assert.equal(env.run('slot.width()'), env.run('reference.width()'));
            assert.equal(env.run('slot.height()'), env.run('reference.height()'));
            assert.equal(env.run('slot.right() < hat.nextBlock().left()'), true, 'picker must not overlap adjacent block');
            assert.equal(env.run('hat.inputs()[0].isVisible'), false);
            assert.equal(env.run('slot.isVisible'), true);
            assert.equal(env.run('slot.render === MB_IconParameterSlotMorph.prototype.render'), true);
            env.run('var drawn=[]; var ctx=icon.getImage().getContext("2d"); ctx.fillText=(text)=>drawn.push(text); icon.render(ctx);');
            assert.deepEqual(Array.from(env.run('drawn')), ['> 65535']);
            env.run('slot.setContents(250); drawn=[]; icon.render(ctx);');
            assert.deepEqual(Array.from(env.run('drawn')), ['> 250']);
            assert.equal(env.run('slot.evaluate()'), 250);
            assert.equal(env.run('hat.expression().args[1]'), 250);
            env.run(`var compiler=new MB_Compiler(MB_editor.project,MB_editor.codeManager);
                var decoder=new MB_Decompiler();
                var bytes=compiler.bytesForInstructions(compiler.instructionsFor(hat),hat,'sensor-ui-test');
                for(const [name,id] of MB_editor.codeManager.functionChunkIDs) decoder.funcs.set(id,name);
                var restored=decoder.decompile(100,5,Uint8Array.from(bytes));`);
            assert.equal(env.run('restored.selector'), selector, `${selector} at ${scale}: ${JSON.stringify(env.run('restored'))}`);
            assert.equal(env.run('restored.args[0]'), '>');
            assert.equal(env.run('restored.args[1]'), 250);
            env.run('var opened=null; MB_IconInputs.open=(value)=>opened=value; slot.mouseClickLeft();');
            assert.equal(env.run('opened === slot'), true);
            env.run('hat.isTemplate=true; hat.fixLayout(); drawn=[]; icon.render(ctx);');
            assert.equal(env.run('slot.isVisible'), false);
            assert.equal(env.run('drawn.length'), 0, 'shelf icons stay uncluttered');
        }
    }
    // Standard textual IDE inputs must remain normal input slots.
    env.run('MB_editor.iconLayout=false; var textHat=MB_Parser.blockFor(["iconWhenToF", "\'<\'", 100]);');
    assert.equal(env.run('!!textHat.inputs()[1].mbIconParameter'), false);
    assert.deepEqual(env.errors, []);
});

test('sensor source parses cleanly, updates both caches and calls original Module reporters', () => {
    const env = fixture();
    env.run('ensureSensorLibrary(MB_editor, moduleSource, servoSource)');
    assert.deepEqual(env.errors, [], 'syntax errors must fail the sensor regression');
    for (const [name, reporter] of [['_iconReadToF', 'ccmodule_ToF distance'], ['_iconReadLight', 'ccmodule_DLight level']]) {
        assert.equal(env.run(`MB_editor.project.functionNamed('${name}').cmdList.nextBlock().inputs()[0].selector`), 'or');
        assert.equal(env.run(`new MB_Compiler(MB_editor.project, MB_editor.codeManager).instructionsFor(MB_editor.project.functionNamed('${name}')).some(i=>i[0]==='jmpOr')`), true);
        const sample = name === '_iconReadToF' ? '_iconSampleToF' : '_iconSampleLight';
        assert.equal(env.run(`MB_editor.project.functionNamed('${sample}').allCalls().includes('${reporter}')`), true);
    }
    // Every imported original body is byte-for-byte unchanged at source level.
    env.run(`const stock = new MB_Module(); stock.loadFromCmds(MB_Parser.parse(moduleSource));`);
    for (const name of ['ccmodule_ToF distance', 'ccmodule_ToF connected', 'ccmodule_DLight level', '_ccmodule_check_camera']) {
        assert.equal(env.run(`MB_editor.project.functionNamed('${name}').equalsFunction(stock.functionNamed('${name}'))`), true);
    }
    assert.equal(env.run("!!MB_editor.project.functionNamed('stopServo')"), true);
    assert.equal(env.run("MB_editor.project.blockSpecs.get('iconWhenToF').blockType"), 'h');
});

test('broken v1 projects upgrade in place, preserve customized bodies and do not repeat upgrades', () => {
    const env = fixture();
    // Reproduce the exact stored outcome of the old parser without emitting errors.
    env.run(`const broken = legacySensorSource
        .replace('if ((_iconToFReady != true) or ((millisSince _iconToFTime) >= 100))', 'if false')
        .replace('if ((_iconLightReady != true) or ((millisSince _iconLightTime) >= 100))', 'if false');
        MB_editor.project.addLibraryFromString(broken, 'ICON Sensor Events');
        const before = MB_editor.project.functionNamed('_iconReadToF');
        const customized = MB_editor.project.functionNamed('_iconSensorPower');
        customized.cmdList = MB_Parser.blockFor(['sayIt', "'my customization'"]);
        const hat = MB_Parser.blockFor(['iconWhenToF', "'>'", 40]);
        hat.mbScriptId = 'my-script'; hat.setPosition(new Point(688,257));
        MB_editor.project.main.scripts = [[688,257,hat]];
        ensureSensorLibrary(MB_editor,moduleSource,servoSource);`);
    assert.equal(env.run("before === MB_editor.project.functionNamed('_iconReadToF')"), true);
    assert.equal(env.run("before.cmdList.nextBlock().inputs()[0].selector"), 'or');
    assert.equal(env.run("customized.cmdList.selector"), 'sayIt');
    assert.equal(env.run("hat.inputs()[0].evaluate()"), '>');
    assert.equal(env.run("hat.inputs()[1].evaluate()"), 40);
    assert.equal(env.run("hat.mbScriptId"), 'my-script');
    assert.equal(env.run("hat.left()"), 688);
    env.run("const upgradedBody=before.cmdList; ensureSensorLibrary(MB_editor,moduleSource,servoSource);");
    assert.equal(env.run('before.cmdList === upgradedBody'), true);
    assert.deepEqual(env.errors, []);
});

test('hats use whenCondition chunks, keep dependencies and preserve board readback', async () => {
    const env = fixture();
    await env.run('installSensorHats()');
    env.run('ensureSensorLibrary(MB_editor,moduleSource,servoSource)');
    for (const selector of ['iconWhenToF', 'iconWhenDLight']) {
        env.run(`var hat=MB_Specs.blockForSpec(MB_Specs.selectorToSpec.get('${selector}'),'Control');
            hat.isTemplate=false; hat.nextBlock(MB_Parser.blockFor(['waitMillis',200]));
            var compiler=new MB_Compiler(MB_editor.project,MB_editor.codeManager);
            var instructions=compiler.instructionsFor(hat);
            var decoder=new MB_Decompiler();
            for(const [name,id] of MB_editor.codeManager.functionChunkIDs) decoder.funcs.set(id,name);
            var restored=decoder.decompile(100,5,Uint8Array.from(compiler.bytesForInstructions(instructions,hat,'test')));`);
        assert.equal(env.run('hat instanceof HatBlockMorph'), true);
        assert.equal(env.run('MB_editor.codeManager.chunkTypeFor(hat)'), 5);
        assert.equal(env.run('instructions.some(i=>i[0]==="waitUntil")'), true);
        assert.equal(env.run('restored.selector'), selector);
        assert.equal(env.run('restored.next.selector'), 'waitMillis');
        const reporter = selector === 'iconWhenToF' ? 'ccmodule_ToF distance' : 'ccmodule_DLight level';
        assert.equal(env.run(`MB_editor.project.unusedFunctions(hat).includes('${reporter}')`), false);
        env.run('hat.isTemplate=true; MB_editor.codeManager.setPaletteBlocks([hat]);');
        assert.equal(env.run('MB_editor.codeManager.chunkTypeFor(hat)'), 1, 'shelf previews never auto-start');
    }
    for (const fn of env.run('MB_editor.project.allFunctions()')) {
        env.context.testFunction = fn;
        assert(env.run('MB_editor.codeManager.compiledBytesFor(testFunction).length') < 1000, fn.functionName);
    }
    assert.deepEqual(env.errors, []);
});
