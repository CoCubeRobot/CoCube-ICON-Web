// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Reuse the original CoCube commands with a fixed settling wait after each
// action. Keep unrelated sensors/NeoPixels out of the child shelf/dependencies.
const MB_IconGripper = {
	selectors: ['ccmodule_gripper open', 'ccmodule_gripper close'],
	settleDelayMillis: 1000,
	sources: null, loading: null, pending: new WeakSet(), failed: new WeakSet(),

	addSettlingDelay(editor) {
		let changed = false;
		for (const name of this.selectors) {
			const fn = editor.project.functionNamed(name);
			if (!fn) continue;
			const tail = fn.cmdList?.blockSequence().at(-1);
			// The wait lives in the device function, not the canvas or a browser
			// timer. Saved projects/readback retain it; repeated imports never add
			// another wait. This also upgrades previously imported gripper blocks.
			if (tail?.selector === 'waitMillis' && tail.inputs()[0]?.evaluate() === this.settleDelayMillis) continue;
			const wait = MB_Parser.blockFor(['waitMillis', this.settleDelayMillis]);
			if (tail) tail.nextBlock(wait);
			else fn.cmdList = wait;
			changed = true;
		}
		if (changed) editor.codeManager.recompileNeeded();
	},

	install(project, name, commands, names, variables, path = null) {
		let library = project.libraryNamed(name);
		if (!library) {
			library = new MB_Module(name);
			library.loadAuthor(commands); library.loadVersion(commands);
			library.path = path;
			if (name === 'CoCube Gripper ICON') {
				library.description = 'CoCube Module gripper open/close commands with a fixed one-second settling wait and no angle controls.';
				library.dependencies = ['Servo'];
			}
			project.addLibrary(library);
		}
		variables.forEach(variable => library.addVariable(variable));
		const additions = commands.filter(cmd =>
			(cmd[0] === 'to' && names.includes(stringArg(cmd[1])) && !project.functionNamed(stringArg(cmd[1]))) ||
			(cmd[0] === 'spec' && names.includes(stringArg(cmd[2])) && !project.blockSpecs.has(stringArg(cmd[2]))));
		for (const [selector, spec] of parsedSpecs(additions)) {
			library.blockSpecs.set(selector, spec); project.recordBlockSpec(selector, spec);
			if (!library.blockList.includes(selector)) library.blockList.push(selector);
		}
		library.loadFunctions(additions);
		project.fixFunctionLocals();
	},

	ensureLibrary(editor) {
		const project = editor.project;
		const ready = () => this.selectors.every(name => project.functionNamed(name) && project.blockSpecs.has(name)) &&
			!!project.functionNamed('setServoAngle');
		if (ready()) { this.addSettlingDelay(editor); return true; }
		if (this.failed.has(project)) return false;
		if (this.sources) {
			if (!project.functionNamed('setServoAngle')) {
				const commands = MB_Parser.parse(this.sources.servo);
				this.install(project, 'Servo', commands,
					commands.filter(cmd => cmd[0] === 'to').map(cmd => stringArg(cmd[1])),
					commands.filter(cmd => cmd[0] === 'variables').flatMap(cmd => cmd.slice(1).map(stringArg)), 'Servo');
			}
			if (!this.selectors.every(name => project.functionNamed(name) && project.blockSpecs.has(name))) {
				this.install(project, 'CoCube Gripper ICON', MB_Parser.parse(this.sources.module),
					this.selectors, ['_cc_cam_init_flag']);
			}
			if (ready()) { this.addSettlingDelay(editor); return true; }
			return false;
		}
		if (this.pending.has(project) || typeof MB_Files === 'undefined') return false;
		this.pending.add(project);
		if (!this.loading) {
			this.loading = Promise.all([
				MB_Files.readFile('Libraries/Robots/CoCube Module.ubl'), MB_Files.readFile('Libraries/Servo.ubl')
			]).then(([module, servo]) => {
				if (!module?.startsWith("module 'CoCube Module'") || !servo?.startsWith('module Servo') ||
					!this.selectors.every(name => module.includes("to '" + name + "'"))) throw new Error('Gripper library is missing');
				return (this.sources = {module, servo});
			}).finally(() => { this.loading = null; });
		}
		this.loading.then(() => {
			if (editor.project === project && editor.iconLayout) editor.updatePalette();
		}).catch(error => {
			this.failed.add(project);
			if (editor.project === project) editor.inform('无法加载夹爪积木，请检查 CoCube Module 和 Servo 库文件。');
			console.warn('ICON gripper:', error);
		}).finally(() => this.pending.delete(project));
		return false;
	},

	drawIcon(ctx, block, scale) {
		const open = block.selector === this.selectors[0];
		ctx.save(); ctx.scale(scale, scale);
		ctx.fillStyle = '#609d4b'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
		ctx.lineJoin = ctx.lineCap = 'round';
		for (const side of [-1, 1]) {
			ctx.save(); ctx.scale(side, 1);
			const finger = new Path2D(open ? 'M 4 9 L 19 -5 L 19 -16 L 12 -21' : 'M 4 9 L 12 -3 L 12 -16 L 4 -21');
			ctx.strokeStyle = MB_IconStyle.ink.gripper; ctx.lineWidth = 6 + 2 * MB_IconStyle.lineWidth; ctx.stroke(finger);
			ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke(finger);
			ctx.restore();
		}
		ctx.fillStyle = '#fff'; MB_IconStyle.outline(ctx, MB_IconStyle.ink.gripper);
		MB_IconInputs.roundRect(ctx, -9, 7, 18, 16, 4); ctx.fill(); ctx.stroke();
		ctx.fillStyle = '#609d4b'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
};
