// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Visual arguments for the standard LED Display library. Pictures remain
// ordinary 25-bit integers, presets remain names, and colours remain RGB values.
const MB_IconDisplay = {
	source: null,
	loading: null,
	pending: new WeakSet(),
	failed: new WeakSet(),
	selectors: ['[display:mbDisplay]', 'set display color', 'led_displayImage'],
	presets: [
		['happy', '开心', 15237440], ['sad', '难过', 18284864],
		['surprised', '惊讶', 4526090], ['silly', '调皮', 25984017],
		['angry', '生气', 23036241], ['asleep', '睡觉', 459616],
		['heart', '爱心', 4685802], ['small heart', '小爱心', 145728],
		['yes', '对勾', 2269696], ['no', '叉号', 18157905],
		['ghost', '小幽灵', 23068334], ['meh', '平静', 2236443],
		['confused', '疑惑', 22348096], ['fabulous', '神气', 15008639],
		['t-shirt', 'T恤', 15154043], ['roller skate', '溜冰鞋', 11534104],
		['duck', '鸭子', 489702], ['house', '房子', 10976708],
		['tortoise', '乌龟', 359872], ['butterfly', '蝴蝶', 29332475],
		['stick figure', '小人', 18158564], ['sword', '宝剑', 4657284],
		['giraffe', '长颈鹿', 10946627], ['skull', '骷髅', 15171246],
		['umbrella', '雨伞', 6460398], ['snake', '蛇', 469859],
		['rabbit', '兔子', 16104613], ['cow', '奶牛', 4685361],
		['quarter note', '四分音符', 7573636], ['eight note', '八分音符', 7590276],
		['pitchfork', '草叉', 4357813], ['target', '靶心', 4681156],
		['triangle', '三角形', 1026176], ['left triangle', '左三角形', 32805985],
		['chess board', '棋盘', 11184810], ['diamond', '菱形', 4539716],
		['small diamond', '小菱形', 141440], ['square', '正方形', 33080895],
		['small square', '小正方形', 469440], ['scissors', '剪刀', 20287859]
	].map(([value, label, bits]) => ({value, label, bits})),
	colors: [
		['红色', '#e51c28'], ['橙色', '#ff8a00'], ['黄色', '#ffd400'],
		['绿色', '#00ff00'], ['青色', '#00c9bc'], ['蓝色', '#057abc'],
		['紫色', '#a779bb'], ['粉色', '#ff72b0'], ['白色', '#ffffff']
	].map(([label, color]) => ({label, color, value: parseInt(color.slice(1), 16)})),
	randomChoice: '$iconRandomLEDColor',

	// A normal MicroBlocks expression: the board chooses afresh on every call,
	// including each loop iteration. No new opcode or browser-side random value.
	randomExpression() {
		return MB_Parser.blockFor(['at', ['random', 1, this.colors.length],
			['[data:makeList]', ...this.colors.map(color => color.value)]], true);
	},
	isRandomExpression(value) {
		return value instanceof ReporterBlockMorph &&
			JSON.stringify(value.expression()) === JSON.stringify(this.randomExpression().expression());
	},
	colorValue(slot) {
		return slot instanceof ColorSlotMorph ? ColorSlotMorph.prototype.evaluate.call(slot) : slot?.evaluate?.();
	},
	isRandomSlot(slot) {
		return slot instanceof MB_IconColorSlotMorph && this.colorValue(slot) === this.randomChoice;
	},

	ensureLibrary(editor) {
		const project = editor.project;
		if (project.functionNamed('led_displayImage') && project.functionNamed('set display color')) return true;
		if (this.failed.has(project)) return false;
		if (this.source) {
			project.addLibraryFromString(this.source, 'LED Display', '//Libraries/LED Display.ubl');
			return !!project.functionNamed('led_displayImage');
		}
		if (this.pending.has(project) || typeof MB_Files === 'undefined') return false;
		this.pending.add(project);
		if (!this.loading) {
			this.loading = MB_Files.readFile('Libraries/LED Display.ubl').then(source => {
				if (!source?.startsWith("module 'LED Display'")) throw new Error('LED Display library is missing');
				this.source = source;
			}).finally(() => { this.loading = null; });
		}
		this.loading.then(() => {
			if (editor.project === project && editor.iconLayout) editor.updatePalette();
		}).catch(error => {
			this.failed.add(project);
			if (editor.project === project) editor.inform('无法加载 LED 积木，请确认 Libraries/LED Display.ubl 文件存在后刷新页面。');
			console.warn('ICON display:', error);
		}).finally(() => this.pending.delete(project));
		return false;
	},

	configure(block) {
		if (!this.selectors.includes(block.selector)) return false;
		const slot = block.inputs()[0];
		if (block.selector === '[display:mbDisplay]' && slot instanceof MicroBitDisplaySlotMorph) {
			slot.mbIconParameter = 'led-draw';
			Object.setPrototypeOf(slot, MB_IconMatrixSlotMorph.prototype);
		} else if (block.selector === 'set display color' && slot instanceof ColorSlotMorph) {
			slot.mbIconParameter = 'led-color';
			Object.setPrototypeOf(slot, MB_IconColorSlotMorph.prototype);
		} else if (block.selector === 'led_displayImage' && slot instanceof InputSlotMorph) {
			slot.mbIconParameter = 'led-preset';
			Object.setPrototypeOf(slot, MB_IconParameterSlotMorph.prototype);
			// ICON uses a centred 5×5 image. The hidden origin is (1,1), not
			// (0,0); other explicit offsets are retained for existing programs.
			block.inputs().slice(1).forEach(input => { input.mbIconHiddenParameter = true; });
			block.expander?.hide();
		} else return false;
		slot.fixLayout();
		return true;
	},

	packedColor(value) {
		return value instanceof Color ? (value.r << 16) | (value.g << 8) | value.b : value;
	},
	hex(value) { return '#' + (Number(value) & 0xffffff).toString(16).padStart(6, '0'); },
	bits(block) {
		const value = block.inputs()[0]?.evaluate();
		return typeof value === 'number' ? value : this.presets.find(p => p.value === value)?.bits || 0;
	},
	previewColor(block) {
		// A static preview of the nearest preceding colour command in this chain,
		// never a claim about scheduling between concurrently executing scripts.
		for (let parent = block.parent; parent; parent = parent.parent) {
			if (parent instanceof BlockMorph && parent.selector === 'set display color') {
				if (this.isRandomSlot(parent.inputs()[0])) return null; // multicolour editing preview
				const value = this.packedColor(this.colorValue(parent.inputs()[0]));
				if (typeof value === 'number') return this.hex(value);
			}
		}
		return '#00ff00';
	},

	changed(slot, value) {
		slot.setContents(value);
		slot.scriptChanged();
		const root = slot.topBlock();
		root.forAllBlocks(block => block.parts().filter(p => p instanceof MB_IconMorph).forEach(icon => icon.rerender()));
		root.fullChanged();
	},

	drawIcon(ctx, block, scale) {
		ctx.save(); ctx.scale(scale, scale);
		const ink = MB_IconStyle.ink.display;
		MB_IconStyle.outline(ctx, ink);
		if (block.selector === 'set display color') {
			const random = this.isRandomSlot(block.inputs()[0]);
			const color = random ? '#b578cb' : this.hex(this.packedColor(this.colorValue(block.inputs()[0])));
			// A painter's palette with a thumb opening. The brush tip is the
			// selected colour; the paint wells no longer masquerade as a selector.
			const palette = new Path2D('M 23 -5 C 25 -16 13 -23 0 -23 C -15 -23 -24 -13 -24 0 C -24 15 -11 23 0 22 C 8 22 10 16 5 12 C 0 7 5 1 12 3 C 19 5 22 1 23 -5 Z');
			palette.moveTo(14, -5); palette.arc(10, -5, 4, 0, Math.PI * 2); palette.closePath();
			ctx.fillStyle = '#fff9ec'; ctx.fill(palette, 'evenodd'); ctx.stroke(palette);
			for (const [x, y, fill] of [[-11,-12,'#e94858'],[2,-15,'#ffd760'],[-15,1,'#20b881'],[-8,12,'#4c9fe0']]) {
				ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x,y,3.7,0,Math.PI*2); ctx.fill();
			}
			ctx.save(); ctx.translate(15, 13); ctx.rotate(.6);
			MB_IconStyle.paint(ctx, 'M -2 -16 Q 0 -20 2 -16 L 3 0 L -3 0 Z', '#fff', ink);
			MB_IconStyle.paint(ctx, 'M -3 0 L 3 0 C 7 7 3 12 -3 12 C -1 8 -6 7 -3 0 Z', color, ink);
			ctx.restore();
			if (random) MB_IconStyle.dice(ctx, 15, 15, 18, ink);
		} else {
			// A light bezel ties the display tiles to the other outlined icons.
			ctx.fillStyle = '#edf2ff';
			MB_IconInputs.roundRect(ctx, -24, -24, 48, 48, 5); ctx.fill(); ctx.stroke();
			ctx.fillStyle = '#283764'; MB_IconInputs.roundRect(ctx, -21, -21, 42, 42, 3); ctx.fill();
			const bits = this.bits(block), color = this.previewColor(block);
			for (let i = 0; i < 25; i++) {
				ctx.fillStyle = bits & (1 << i) ? (color || this.colors[i % this.colors.length].color) : '#465887';
				MB_IconInputs.roundRect(ctx, -19 + (i % 5) * 8, -19 + Math.floor(i / 5) * 8, 6, 6, 1);
				ctx.fill();
			}
			if (block.selector === '[display:mbDisplay]') {
				// Pencil badge distinguishes drawing from the preset-face tile.
				ctx.translate(16,16); ctx.rotate(Math.PI / 4);
				ctx.fillStyle = '#ffdb67'; ctx.strokeStyle = '#785d25';
				ctx.fillRect(-3,-10,6,16); ctx.strokeRect(-3,-10,6,16);
				ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3,6); ctx.lineTo(0,11); ctx.lineTo(3,6); ctx.fill(); ctx.stroke();
			}
		}
		ctx.restore();
	},

	svg(bits, color) {
		let result = '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="6" fill="#283764"/>';
		for (let i = 0; i < 25; i++) {
			result += `<rect x="${5 + i % 5 * 9}" y="${5 + Math.floor(i / 5) * 9}" width="6" height="6" rx="1" fill="${bits & (1 << i) ? (color || this.colors[i % this.colors.length].color) : '#465887'}"/>`;
		}
		return result + '</svg>';
	},

	buildPicker(panel, slot) {
		panel.classList.add('--led');
		if (slot.mbIconParameter === 'led-draw') return this.buildDrawing(panel, slot);
		const presets = slot.mbIconParameter === 'led-preset';
		panel.classList.add(presets ? '--led-presets' : '--led-color');
		panel.setAttribute('aria-label', presets ? '选择 5×5 表情' : '选择 LED 显示颜色');
		const grid = document.createElement('div');
		grid.className = presets ? 'icon-led-presets' : 'icon-led-colors';
		const value = presets ? slot.evaluate() : this.packedColor(this.colorValue(slot));
		const choices = presets ? this.presets : this.colors.concat([{value: this.randomChoice, label: '随机颜色'}]);
		for (const choice of choices) {
			const button = document.createElement('button'); button.type = 'button';
			button.setAttribute('aria-label', choice.label); button.title = choice.label;
			button.setAttribute('aria-pressed', String(value === choice.value));
			if (presets) {
				button.innerHTML = this.svg(choice.bits, this.previewColor(slot.parent));
			} else if (choice.value === this.randomChoice) {
				button.className = 'icon-random-choice';
				button.innerHTML = MB_IconInputs.diceSVG;
			} else {
				const swatch = document.createElement('span'); swatch.className = 'icon-color-swatch';
				swatch.style.setProperty('--swatch', choice.color); button.appendChild(swatch);
			}
			button.onclick = () => { this.changed(slot, choice.value); MB_IconInputs.close(); };
			grid.appendChild(button);
		}
		panel.appendChild(grid);
		if (presets) {
			const hint = document.createElement('div'); hint.className = 'icon-led-scroll-hint';
			hint.textContent = '↕ 上下滑动查看更多'; panel.appendChild(hint);
		}
	},

	buildDrawing(panel, slot) {
		panel.classList.add('--led-draw'); panel.setAttribute('aria-label', '手绘 5×5 LED 图案');
		const grid = document.createElement('div'); grid.className = 'icon-led-grid';
		grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '点击或拖动点亮、擦除像素');
		const previewColor = this.previewColor(slot.parent);
		grid.style.setProperty('--led-color', previewColor || '#00ff00');
		const cells = [];
		let pointer = null, paintOn = true;
		const refresh = () => cells.forEach((cell, i) => cell.setAttribute('aria-pressed', String(!!(slot.evaluate() & (1 << i)))));
		const paint = i => {
			const bits = Number(slot.evaluate()) & 0x1ffffff;
			const next = paintOn ? bits | (1 << i) : bits & ~(1 << i);
			if (bits !== next) this.changed(slot, next);
			refresh();
		};
		for (let i = 0; i < 25; i++) {
			const cell = document.createElement('button'); cell.type = 'button';
			if (!previewColor) cell.style.setProperty('--led-color', this.colors[i % this.colors.length].color);
			cell.setAttribute('aria-label', `第 ${Math.floor(i / 5) + 1} 行，第 ${i % 5 + 1} 列`);
			cell.onpointerdown = event => {
				event.preventDefault(); pointer = event.pointerId;
				paintOn = !(slot.evaluate() & (1 << i)); paint(i);
				cell.setPointerCapture?.(event.pointerId);
			};
			cell.onclick = event => {
				if (!event || event.detail === 0) { paintOn = !(slot.evaluate() & (1 << i)); paint(i); }
			};
			grid.appendChild(cell); cells.push(cell);
		}
		grid.onpointermove = event => {
			if (pointer !== event.pointerId) return;
			const cell = document.elementFromPoint(event.clientX, event.clientY), index = cells.indexOf(cell);
			if (index >= 0) paint(index);
		};
		grid.onpointerup = grid.onpointercancel = () => { pointer = null; };
		const actions = document.createElement('div'); actions.className = 'icon-led-actions';
		for (const [label, action] of [['清空', () => { this.changed(slot, 0); refresh(); }],
			['完成', () => MB_IconInputs.close()]]) {
			const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
			button.onclick = action; actions.appendChild(button);
		}
		panel.append(grid, actions); refresh();
	}
};

// Keep the native slot classes (and thus their compiler/printer/copy behaviour),
// but replace their inline editor with the same compact chevron pill.
function MB_IconMatrixSlotMorph() {}
MB_IconMatrixSlotMorph.prototype = Object.create(MicroBitDisplaySlotMorph.prototype);
MB_IconMatrixSlotMorph.prototype.constructor = MB_IconMatrixSlotMorph;
MB_IconMatrixSlotMorph.prototype.copy = function () {
	const clone = MicroBitDisplaySlotMorph.prototype.copy.call(this);
	clone.display = this.display.slice(); // editing a duplicate must never repaint its source
	return clone;
};
function MB_IconColorSlotMorph() {}
MB_IconColorSlotMorph.prototype = Object.create(ColorSlotMorph.prototype);
MB_IconColorSlotMorph.prototype.constructor = MB_IconColorSlotMorph;
for (const [type, base] of [[MB_IconMatrixSlotMorph, MicroBitDisplaySlotMorph], [MB_IconColorSlotMorph, ColorSlotMorph]]) {
	type.prototype.fixLayout = function () {
		this.bounds.setExtent(new Point(54 * this.scale, 38 * this.scale));
		this.parent?.fixLayout();
	};
	type.prototype.render = MB_IconParameterSlotMorph.prototype.render;
	type.prototype.mouseDownLeft = function () {};
	type.prototype.mouseMove = function () {};
	type.prototype.mouseClickLeft = MB_IconParameterSlotMorph.prototype.mouseClickLeft;
	type.prototype.setContents = function (value) {
		base.prototype.setContents.call(this, value);
		this.parent?.fixLayout();
	};
}

MB_IconColorSlotMorph.prototype.evaluate = function () {
	const value = MB_IconDisplay.colorValue(this);
	return value === MB_IconDisplay.randomChoice ? MB_IconDisplay.randomExpression() : value;
};

// Represent random as a compact colour-picker choice while retaining a portable
// expression for the compiler, source files, text mode and device readback.
const mbDisplayExpressionForArg = BlockMorph.prototype.expressionForArg;
BlockMorph.prototype.expressionForArg = function (arg) {
	if (MB_IconDisplay.isRandomSlot(arg)) return MB_IconDisplay.randomExpression().expression();
	return mbDisplayExpressionForArg.call(this, arg);
};
const mbDisplayCodeStringForArg = BlockMorph.prototype.addCodeStringForArg;
BlockMorph.prototype.addCodeStringForArg = function (arg, indent, result) {
	if (MB_IconDisplay.isRandomSlot(arg)) return mbDisplayCodeStringForArg.call(this, MB_IconDisplay.randomExpression(), indent, result);
	return mbDisplayCodeStringForArg.call(this, arg, indent, result);
};
const mbDisplaySetBlockArg = MB_Parser.prototype.setBlockArg;
MB_Parser.prototype.setBlockArg = function (block, arg, index) {
	if (MB_IconBlocks.enabled() && block.selector === 'set display color' && index === 0 &&
		block.inputs()[0] instanceof MB_IconColorSlotMorph && MB_IconDisplay.isRandomExpression(arg)) {
		block.inputs()[0].setContents(MB_IconDisplay.randomChoice);
		return;
	}
	return mbDisplaySetBlockArg.call(this, block, arg, index);
};

// The original ICON shelf dropped the library's optional X/Y defaults when
// overriding the picture name, producing literal (0,0) arguments on every drag.
// Repair that exact hidden-origin signature when loading/pasting/reading back
// named ICON presets. Do not shift image bits or alter the firmware/library:
// omitted arguments already default to (1,1), and scrolling/raw images, dynamic
// coordinates, other explicit offsets and all text-mode calls stay unchanged.
const mbDisplayBlockWithArgs = MB_Parser.prototype.blockWithArgs;
MB_Parser.prototype.blockWithArgs = function (selector, args, ...options) {
	if (MB_IconBlocks.enabled() && selector === 'led_displayImage' && args.length === 3 &&
		args[1] === 0 && args[2] === 0 && MB_IconDisplay.presets.some(preset => preset.value === args[0])) {
		args = [args[0], 1, 1];
	}
	return mbDisplayBlockWithArgs.call(this, selector, args, ...options);
};
