import { translateUI } from './jsEditorI18n.js';

export const sensorSelectors = ['iconWhenToF', 'iconWhenDLight'];
export function sensorMatch(value, operator, threshold, release = false) {
    if (!Number.isFinite(value) || value < 0) return false;
    const margin = Math.max(1, Math.ceil(threshold * 0.05));
    return release ? (operator === '<' ? value >= threshold + margin : value <= Math.max(0, threshold - margin))
        : (operator === '<' ? value < threshold : value > threshold);
}

export const legacySensorSource = `module 'ICON Sensor Events'
category 'Control'
version 1 0
author 'CoCube'
specs {
 spec 'h' 'iconWhenToF' 'when ToF distance _ _ mm' 'str num' '<' 100
 spec 'h' 'iconWhenDLight' 'when DLight level _ _' 'str num' '<' 1000
}
variables _cc_cam_init_flag _iconToFValue _iconToFTime _iconToFReady _iconToFBusy _iconLightValue _iconLightTime _iconLightReady _iconLightBusy

to '_iconReadToF' {
 if (_iconToFBusy == true) {
  if ((millisSince _iconToFTime) < 250) { return -1 }
  _iconToFBusy = false
  _iconToFReady = false
 }
 if ((_iconToFReady != true) or ((millisSince _iconToFTime) >= 100)) {
  _iconToFBusy = true
  _iconToFTime = (millisOp)
  _iconToFValue = -1
  _iconToFValue = ('_iconSampleToF')
  _iconToFTime = (millisOp)
  _iconToFReady = true
  _iconToFBusy = false
 }
 return _iconToFValue
}
to '_iconReadLight' {
 if (_iconLightBusy == true) {
  if ((millisSince _iconLightTime) < 250) { return -1 }
  _iconLightBusy = false
  _iconLightReady = false
 }
 if ((_iconLightReady != true) or ((millisSince _iconLightTime) >= 100)) {
  _iconLightBusy = true
  _iconLightTime = (millisOp)
  _iconLightValue = -1
  _iconLightValue = ('_iconSampleLight')
  _iconLightTime = (millisOp)
  _iconLightReady = true
  _iconLightBusy = false
 }
 return _iconLightValue
}
to '_iconSensorPower' {
 if (_cc_cam_init_flag == 1) {
  '[sensors:i2cWrite]' 88 ('[data:asByteArray]' ('[data:makeList]' 3 255))
 } else { digitalWriteOp 13 true }
}
to '_iconSampleToF' {
 '_iconSensorPower'
 if ((i2cGet 41 192) != 238) { return -1 }
 i2cSet 41 0 1
 waitMillis 70
 if (((i2cGet 41 20) & 1) != 1) { return -2 }
 '[sensors:i2cWrite]' 41 ('[data:makeList]' 20)
 local 'buf' (newList 12)
 '[sensors:i2cRead]' 41 buf
 if ((at 1 buf) != 95) { return -1 }
 return (((at 11 buf) << 8) | (at 12 buf))
}
to '_iconSampleLight' {
 '_iconSensorPower'
 if (not ('[sensors:i2cExists]' 35)) { return -1 }
 i2cSet 35 23 33
 local 'buf' (newList 2)
 '[sensors:i2cRead]' 35 buf
 return (((at 1 buf) << 8) | (at 2 buf))
}
to '_iconSensorMatch' value operator threshold release {
 if (value < 0) { return false }
 local 'margin' (maximum 1 ((threshold + 19) / 20))
 if release {
  if (operator == '<') { return (value >= (threshold + margin)) }
  return (value <= (maximum 0 (threshold - margin)))
 }
 if (operator == '<') { return (value < threshold) }
 return (value > threshold)
}
to 'iconWhenToF' operator threshold release {
 return ('_iconSensorMatch' ('_iconReadToF') operator threshold release)
}
to 'iconWhenDLight' operator threshold release {
 return ('_iconSensorMatch' ('_iconReadLight') operator threshold release)
}
`;

// Keep the v1.0 source only as a migration fingerprint. It is never installed.
// Logical operators in GP source use prefix form: (or condition condition).
export const sensorSource = legacySensorSource
    .replace('version 1 0', 'version 1 1')
    .replace('specs {\n', '').replace(" 1000\n}", " 1000")
    .replace('((_iconToFReady != true) or ((millisSince _iconToFTime) >= 100))',
        '(or (_iconToFReady != true) ((millisSince _iconToFTime) >= 100))')
    .replace('((_iconLightReady != true) or ((millisSince _iconLightTime) >= 100))',
        '(or (_iconLightReady != true) ((millisSince _iconLightTime) >= 100))')
    .replace(/to '_iconSensorPower' \{[\s\S]*?\n}\nto '_iconSampleToF'/,
        "to '_iconSensorPower' {\n '_ccmodule_check_camera'\n}\nto '_iconSampleToF'")
    .replace(/to '_iconSampleToF' \{[\s\S]*?\n}\nto '_iconSampleLight'/,
        "to '_iconSampleToF' {\n if (not ('ccmodule_ToF connected')) { return -1 }\n return ('ccmodule_ToF distance')\n}\nto '_iconSampleLight'")
    .replace(/to '_iconSampleLight' \{[\s\S]*?\n}\nto '_iconSensorMatch'/,
        "to '_iconSampleLight' {\n '_ccmodule_check_camera'\n if (not ('[sensors:i2cExists]' 35)) { return -1 }\n return ('ccmodule_DLight level')\n}\nto '_iconSensorMatch'");

const preparedProjects = new WeakMap();
export function ensureSensorLibrary(editor, moduleSource, servoSource) {
    const project = editor.project;
    const names = ['ccmodule_ToF connected', 'ccmodule_ToF distance', 'ccmodule_DLight level', '_ccmodule_check_camera'];
    const existing = project.libraryNamed('ICON Sensor Events');
    if (existing && preparedProjects.get(project) === existing &&
        [...names, ...sensorSelectors, 'stopServo'].every(name => project.functionNamed(name))) return;
    const commands = MB_Parser.parse(moduleSource);
    if (!names.every(name => commands.some(cmd => cmd[0] === 'to' && stringArg(cmd[1]) === name))) {
        throw new Error('CoCube Module sensor functions are missing.');
    }
    // Import selected original bodies, with their servo dependency. Reuse existing
    // functions (including user customizations); never import unrelated modules.
    const servo = MB_Parser.parse(servoSource);
    if (!servo.some(cmd => cmd[0] === 'to' && stringArg(cmd[1]) === 'stopServo')) {
        throw new Error('Servo library is missing stopServo.');
    }
    MB_IconGripper.install(project, 'Servo', servo,
        servo.filter(cmd => cmd[0] === 'to').map(cmd => stringArg(cmd[1])),
        servo.filter(cmd => cmd[0] === 'variables').flatMap(cmd => cmd.slice(1).map(stringArg)), 'Servo');
    MB_IconGripper.install(project, 'CoCube Sensor Module', commands, names, ['_cc_cam_init_flag']);
    project.libraryNamed('CoCube Sensor Module').dependencies = ['Servo'];

    const updated = new MB_Module();
    updated.loadFromCmds(MB_Parser.parse(sensorSource));
    let library = project.libraryNamed('ICON Sensor Events');
    if (!library) {
        project.addLibraryFromString(sensorSource, 'ICON Sensor Events');
        library = project.libraryNamed('ICON Sensor Events');
        library.dependencies = ['CoCube Sensor Module'];
        preparedProjects.set(project, library);
        return;
    }
    // Parse the old reference in valid prefix form, then reproduce the two
    // broken conditions that the old parser stored. No syntax errors on startup.
    const fixedLegacy = legacySensorSource.replace(/\(\((_icon(?:ToF|Light)Ready != true)\) or \(\(millisSince (_icon(?:ToF|Light)Time)\) >= 100\)\)/g,
        '(or ($1) ((millisSince $2) >= 100))');
    const reference = new MB_Module(); reference.loadFromCmds(MB_Parser.parse(fixedLegacy));
    const brokenReference = new MB_Module();
    brokenReference.loadFromCmds(MB_Parser.parse(fixedLegacy
        .replace('if (or (_iconToFReady != true) ((millisSince _iconToFTime) >= 100))', 'if false')
        .replace('if (or (_iconLightReady != true) ((millisSince _iconLightTime) >= 100))', 'if false')));
    let changed = false;
    for (const next of updated.functions) {
        const current = library.functionNamed(next.functionName);
        const old = reference.functionNamed(next.functionName);
        const matchesFixed = current && old && current.equalsFunction(old);
        const broken = brokenReference.functionNamed(next.functionName);
        if (!current || matchesFixed || (broken && current.equalsFunction(broken))) {
            if (current && current.equalsFunction(next)) continue;
            if (current) {
                // Preserve function identity, definition hats and script IDs.
                current.cmdList = next.cmdList; current.argNames = next.argNames;
                current.localVars = current.collectLocalVars();
            } else library.addFunction(next);
            changed = true;
        }
    }
    updated.variableNames.forEach(name => library.addVariable(name));
    for (const [name, spec] of updated.blockSpecs) {
        library.blockSpecs.set(name, spec); project.recordBlockSpec(name, spec);
        if (!library.blockList.includes(name)) library.blockList.push(name);
    }
    library.dependencies = ['CoCube Sensor Module'];
    library.version = [1, 1];
    if (changed) editor.codeManager.recompileNeeded();
    preparedProjects.set(project, library);
}

export async function installSensorHats() {
    // These are ordinary embedded library functions. The board evaluates them;
    // JavaScript only supplies the child-facing hat and parameter picker.
    const [moduleSource, servoSource] = await Promise.all([
        MB_Files.readFile('Libraries/Robots/CoCube Module.ubl'), MB_Files.readFile('Libraries/Servo.ubl')
    ]);
    if (!moduleSource || !servoSource) throw new Error('Cannot load CoCube Module / Servo sensor libraries.');
    MB_Specs.initialize();
    for (const [selector, label, value] of [[sensorSelectors[0], 'when ToF distance _ _ mm', 100],
        [sensorSelectors[1], 'when DLight level _ _', 1000]]) {
        MB_Specs.selectorToSpec.set(selector, ['h', selector, label, 'str num', '<', value]);
        MB_Specs.selectorToCategory.set(selector, 'Control');
    }
    const palette = MB_Editor.prototype.addIconPaletteBlocks;
    MB_Editor.prototype.addIconPaletteBlocks = function () {
        ensureSensorLibrary(this, moduleSource, servoSource);
        const result = palette.call(this);
        if (this.iconLayout) {
            for (const selector of sensorSelectors) {
                this.addPaletteBlockForSpec(MB_Specs.selectorToSpec.get(selector), 'Control');
            }
            // The upstream shelf registers previews before these final hats
            // are appended. Include them in device preparation as well.
            this.codeManager.setPaletteBlocks(this.palette.contents.children.filter(block => block instanceof BlockMorph));
        }
        return result;
    };
    const compile = MB_Compiler.prototype.instructionsFor;
    MB_Compiler.prototype.instructionsFor = function (block) {
        if (!sensorSelectors.includes(block?.selector)) return compile.call(this, block);
        if (block.isFunctionDefinition()) return compile.call(this, block);
        const [operator, threshold] = block.inputs().map(slot => slot.evaluate());
        const literal = "'" + operator + "'";
        const trigger = [block.selector, literal, threshold, false];
        const release = [block.selector, literal, threshold, true];
        const expanded = MB_Parser.blockFor(['whenCondition', trigger]);
        const body = block.nextBlock()?.fullCopy();
        // Match by structural position before appending the hidden rearm wait.
        // Equal-looking commands must still map to separate original blocks.
        const originals = new Map();
        if (body) {
            const visible = new Map(Array.from(this.nodePathsFor(block.nextBlock(), 'body'),
                ([original, path]) => [path, original]));
            for (const [copy, path] of this.nodePathsFor(body, 'body')) {
                originals.set(copy, visible.get(path));
            }
        }
        const rearm = MB_Parser.blockFor(['waitUntil', release]);
        if (body) {
            expanded.nextBlock(body);
            body.blockSequence().at(-1).nextBlock(rearm);
        } else expanded.nextBlock(rearm);
        const code = compile.call(this, expanded, {owner: block, originals});
        code.forEach(instruction => { if (instruction.producer) instruction.producer = originals.get(instruction.producer) || block; });
        return code;
    };
    const type = MB_CodeManager.prototype.chunkTypeFor;
    MB_CodeManager.prototype.chunkTypeFor = function (block) {
        if (sensorSelectors.includes(block?.selector) && !(block instanceof MB_Function) && !block.isTemplate && !block.isFunctionDefinition()) return 5;
        return type.call(this, block);
    };
    const restore = MB_IconStop.restore;
    MB_IconStop.restore = function (node) {
        node = restore.call(this, node);
        restoreSensorNode(node);
        return node;
    };
    const configure = MB_IconInputs.configure;
    MB_IconInputs.configure = function (block) {
        if (!MB_IconBlocks.enabled() || !sensorSelectors.includes(block.selector)) return configure.call(this, block);
        const [op, number] = block.inputs();
        if (!(op instanceof InputSlotMorph) || !(number instanceof InputSlotMorph)) return;
        op.mbIconHiddenParameter = true;
        number.mbIconParameter = 'sensor-threshold';
        Object.setPrototypeOf(number, SensorSlot.prototype);
        number.fixLayout();
    };
    function SensorSlot() {}
    SensorSlot.prototype = Object.create(MB_IconParameterSlotMorph.prototype);
    SensorSlot.prototype.constructor = SensorSlot;
    SensorSlot.prototype.fixLayout = function () {
        this.contents().hide(); this.contents().isEditable = false; this.arrow()?.hide();
        // Same footprint and chevron as the display/message parameter picker.
        // The threshold is previewed inside the hat, not in an oversized pill.
        this.bounds.setExtent(new Point(54 * this.scale, 38 * this.scale));
        this.parent?.fixLayout();
    };
    SensorSlot.prototype.render = MB_IconParameterSlotMorph.prototype.render;
    const label = MB_IconInputs.label;
    MB_IconInputs.label = function (slot) { return slot.mbIconParameter === 'sensor-threshold'
        ? translateUI(slot.parent.selector === sensorSelectors[0] ? '距离触发' : '光线触发') : label.call(this, slot); };
    // Existing positioning, outside dismissal and keyboard protection remain in charge.
    const choices = MB_IconInputs.buildChoices;
    MB_IconInputs.buildChoices = function (panel, slot) {
        if (slot.mbIconParameter !== 'sensor-threshold') return choices.call(this, panel, slot);
        buildPicker(panel, slot);
    };
    const render = MB_IconMorph.prototype.render;
    MB_IconMorph.prototype.render = function (ctx) {
        if (!sensorSelectors.includes(this.selector)) return render.call(this, ctx);
        ctx.save();ctx.translate(this.width()/2,this.height()/2);ctx.scale(this.scale*.92,this.scale*.92);
        const ink = MB_IconStyle.ink.event;
        MB_IconStyle.outline(ctx, ink);
        ctx.save(); ctx.translate(0, this.parent?.isTemplate ? 0 : -6);
        if (this.selector === sensorSelectors[0]) {
            // A distance probe facing a wall; the two-headed arrow measures
            // their separation instead of suggesting a smiling robot face.
            ctx.fillStyle = '#fff';
            MB_IconInputs.roundRect(ctx, -22, -13, 18, 26, 4); ctx.fill(); ctx.stroke();
            for (const x of [-17, -9]) {
                ctx.beginPath(); ctx.arc(x, -4, 3, 0, Math.PI*2);
                ctx.fillStyle = '#54bfc6'; ctx.fill(); ctx.stroke();
            }
            ctx.fillStyle = ink;
            MB_IconInputs.roundRect(ctx, -16, 5, 6, 2, 1); ctx.fill();
            ctx.fillStyle = '#fff';
            MB_IconInputs.roundRect(ctx, 17, -14, 5, 28, 2); ctx.fill(); ctx.stroke();
            ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(-1, -4); ctx.lineTo(15, -4); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(-1, 8); ctx.lineTo(14, 8);
            ctx.moveTo(2, 5); ctx.lineTo(-1, 8); ctx.lineTo(2, 11);
            ctx.moveTo(11, 5); ctx.lineTo(14, 8); ctx.lineTo(11, 11); ctx.stroke();
        } else {
            // A clear sun silhouette matches the outlined, category-tinted
            // illustrations already used by the clock and display blocks.
            ctx.fillStyle = '#fff8d8';
            ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffd760';
            ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI/2, Math.PI/2); ctx.fill();
            for (let i = 0; i < 8; i++) {
                const a = i*Math.PI/4;
                ctx.beginPath(); ctx.moveTo(Math.cos(a)*12, Math.sin(a)*12);
                ctx.lineTo(Math.cos(a)*16, Math.sin(a)*16); ctx.stroke();
            }
        }
        ctx.restore();
        if (this.parent && !this.parent.isTemplate) {
            const [operator, threshold] = this.parent.inputs();
            ctx.fillStyle = '#fff'; ctx.lineWidth = 1;
            MB_IconInputs.roundRect(ctx, -22, 10, 44, 12, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = ink; ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`${operator.evaluate()} ${threshold.evaluate()}`, 0, 16, 38);
        }
        ctx.restore();
    };
    const color = BlockMorph.prototype.colorFor;
    BlockMorph.prototype.colorFor = function (category) { return MB_IconBlocks.enabled() && sensorSelectors.includes(this.selector)
        ? new Color(255,218,101) : color.call(this, category); };
}

function buildPicker(panel, slot) {
    const block = slot.parent, tof = block.selector === sensorSelectors[0];
    const t = translateUI;
    panel.classList.add('--sensor');
    const title = document.createElement('strong');title.textContent=t(tof?'距离触发':'光线触发');
    const ops = document.createElement('div');ops.className='icon-sensor-operators';
    const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.autocomplete='off';
    input.value=String(slot.evaluate());input.setAttribute('aria-label',t('触发阈值'));
    const unit=document.createElement('span');unit.textContent=tof?'mm':t('光线读数');
    const row=document.createElement('div');row.className='icon-sensor-value';row.append(input,unit);
    const note=document.createElement('p');note.textContent=t('满足条件时触发一次，恢复后可再次触发');
    const status=document.createElement('p');status.setAttribute('role','status');
    const done=document.createElement('button');done.type='button';done.textContent=t('完成');
    let operator=block.inputs()[0].evaluate();
    const buttons=['<','>'].map(op=>{const button=document.createElement('button');button.type='button';
        button.textContent=`${op}  ${t(op==='<'?'小于':'大于')}`;button.onclick=()=>{operator=op;refresh();};ops.append(button);return button;});
    const max=tof?4000:65535;
    const refresh=()=>{buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(operator===['<','>'][i])));
        const ok=/^\d+$/.test(input.value.trim())&&Number(input.value)<=max;
        done.disabled=!ok;status.textContent=ok?'':t('请输入范围内的整数')+` (0–${max})`;};
    input.oninput=refresh;done.onclick=()=>{if(done.disabled)return;block.inputs()[0].setContents(operator);slot.setContents(Number(input.value));
        slot.scriptChanged();slot.rerender();
        block.parts().filter(part => part instanceof MB_IconMorph).forEach(icon => icon.rerender());
        block.fullChanged();MB_IconInputs.close();};
    panel.append(title,ops,row,note,status,done);panel.mbIconInitialFocus=done;refresh();
}

function restoreSensorNode(node) {
    if (!node || typeof node !== 'object') return;
    if (node.isFunction) { restoreSensorNode(node.cmdList); return; }
    for (let cmd = node; cmd; cmd = cmd.next) {
        const condition = cmd.selector === 'whenCondition' ? cmd.args?.[0] : null;
        if (sensorSelectors.includes(condition?.selector)) {
            let previous = cmd, last = cmd.next;
            while (last?.next) { previous = last; last = last.next; }
            const release = last?.selector === 'waitUntil' ? last.args?.[0] : null;
            const bool = value => value?.selector === 'booleanConstant' ? value.args[0] : value;
            if (release?.selector === condition.selector && condition.args.length === 3 &&
                bool(condition.args[2]) === false && bool(release.args[2]) === true &&
                JSON.stringify(condition.args.slice(0,2)) === JSON.stringify(release.args.slice(0,2))) {
                cmd.selector = condition.selector; cmd.args = condition.args.slice(0,2);
                previous.next = null;
            }
        }
        cmd.args?.forEach(restoreSensorNode);
    }
}
