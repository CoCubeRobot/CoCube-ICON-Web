// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Child-friendly parameter pills and anchored pickers. Values remain standard
// MicroBlocks values/expressions; the browser never simulates program execution.
const MB_IconInputs = {
	colors: [
		{value: '_iconColor1', label: 'Red', color: '#e51c28'},
		{value: '_iconColor2', label: 'Yellow', color: '#ffd400'},
		{value: '_iconColor3', label: 'Blue', color: '#057abc'},
		{value: '_iconColor4', label: 'Turquoise', color: '#00a19c'},
		{value: '_iconColor5', label: 'Green', color: '#00b653'},
		{value: '_iconColor6', label: 'Purple', color: '#a779bb'}
	],
	randomChoice: '$iconRandomColor',
	diceSVG: '<svg viewBox="0 0 80 56" aria-hidden="true"><g transform="translate(26 3) rotate(16 22 22)"><rect x="5" y="3" width="36" height="36" rx="5"/><circle cx="23" cy="21" r="3"/></g><g transform="translate(5 13) rotate(-13 20 20)"><rect x="2" y="2" width="36" height="36" rx="5"/><circle cx="11" cy="11" r="3"/><circle cx="29" cy="11" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="11" cy="29" r="3"/><circle cx="29" cy="29" r="3"/></g></svg>',
	panel: null,
	slot: null,

	// A portable expression using existing firmware primitives. Both file save
	// and board readback retain a real random choice made on *every* execution.
	randomExpression() {
		return MB_Parser.blockFor(['[data:join]', "'_iconColor'",
			['at', ['random', 1, 6], "'123456'"]], true);
	},

	isRandomExpression(value) {
		if (!(value instanceof ReporterBlockMorph)) return false;
		return JSON.stringify(value.expression()) === JSON.stringify(this.randomExpression().expression());
	},

	configure(block) {
		if (!MB_IconBlocks.enabled()) return;
		if (typeof MB_IconColorMatrix !== 'undefined' && MB_IconColorMatrix.configure(block)) return;
		if (typeof MB_IconCoCube !== 'undefined' && MB_IconCoCube.configure(block)) return;
		if (typeof MB_IconDisplay !== 'undefined' && MB_IconDisplay.configure(block)) return;
		if (block.selector === 'play tone' && typeof MB_IconMusic !== 'undefined') return MB_IconMusic.configure(block);
		const slot = block.inputs()[0];
		if (!(slot instanceof InputSlotMorph)) return;
		let kind;
		if (block.selector === 'waitMillis') kind = 'seconds';
		else if (block.selector === 'repeat') kind = 'repeat';
		else if (block.selector === 'whenButtonPressed') kind = 'button';
		else if (block.selector === 'sendBroadcast') kind = 'send';
		else if (block.selector === 'whenBroadcastReceived') kind = 'receive';
		else return;
		slot.mbIconParameter = kind;
		Object.setPrototypeOf(slot, kind === 'seconds' ? MB_IconSecondsSlotMorph.prototype : MB_IconParameterSlotMorph.prototype);
		slot.fixLayout();
	},

	options(slot) {
		if (slot.mbIconParameter === 'note') return MB_IconMusic.notes;
		if (slot.mbIconParameter === 'button') {
			return ['A', 'B', 'A+B'].map(value => ({value, label: value.replace('+', '')}));
		}
		return this.colors.concat(slot.mbIconParameter === 'send' ? [{value: this.randomChoice, label: 'Random'}] : []);
	},

	isNumber(slot) { return ['seconds', 'repeat', 'cocube-steps', 'cocube-turns'].includes(slot.mbIconParameter); },
	value(slot) { return InputSlotMorph.prototype.evaluate.call(slot); },
	number(slot) {
		const value = Number(slot.evaluate());
		return Number.isFinite(value) ? value / (slot.mbIconParameter === 'seconds' ? 1000 : 1) : 0;
	},

	setNumber(slot, value) {
		if (String(value).trim() === '' || !Number.isFinite(Number(value))) return false;
		let number = Math.max(0, Number(value));
		// MicroBlocks uses signed 31-bit integers; never wrap a large UI value.
		const factor = slot.mbIconParameter === 'seconds' ? 1000 : 1;
		number = Math.min(1073741823, Math.round(number * factor));
		if (slot.mbIconParameter === 'cocube-steps') number = Math.max(1, Math.min(MB_IconCoCube.maxSteps, number));
		if (slot.mbIconParameter === 'cocube-turns') number = Math.max(1, Math.min(MB_IconCoCube.maxTurns, number));
		if (slot.evaluate() === number) return true;
		slot.setContents(number);
		slot.scriptChanged();
		return true;
	},

	select(slot, value) {
		if (!this.options(slot).some(option => option.value === value)) return false;
		if (this.value(slot) === value) return true;
		slot.setContents(value);
		slot.scriptChanged();
		return true;
	},

	roundRect(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.arcTo(x + width, y, x + width, y + height, radius);
		ctx.arcTo(x + width, y + height, x, y + height, radius);
		ctx.arcTo(x, y + height, x, y, radius);
		ctx.arcTo(x, y, x + width, y, radius);
		ctx.closePath();
	},

	drawBroadcast(ctx, block, scale) {
		const incoming = block.selector === 'whenBroadcastReceived';
		const slot = block.inputs()[0];
		const value = slot instanceof MB_IconParameterSlotMorph ? this.value(slot) : null;
		const color = this.colors.find(item => item.value === value)?.color;
		ctx.save(); ctx.scale(scale, scale);
		const ink = MB_IconStyle.ink.event;
		MB_IconStyle.outline(ctx, ink);
		if (incoming) {
			ctx.strokeStyle = '#b59a4d';
			for (const [x, y] of [[-18,-22],[-9,-26],[9,-26],[18,-22]]) {
				ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * .8, y + 4); ctx.stroke();
			}
			// Open flap behind a protruding letter, not a closed envelope with a roof.
			MB_IconStyle.paint(ctx, 'M -20 -5 L 0 -22 L 20 -5 L 20 18 L -20 18 Z', '#d6b450', ink);
			ctx.fillStyle = '#fff'; this.roundRect(ctx, -14, -14, 28, 27, 2); ctx.fill(); ctx.stroke();
			MB_IconStyle.paint(ctx, 'M -20 -5 L 0 9 L 20 -5 L 20 16 Q 20 18 18 18 L -18 18 Q -20 18 -20 16 Z', '#fff', ink);
			ctx.beginPath(); ctx.moveTo(-19, 17); ctx.lineTo(0, 4); ctx.lineTo(19, 17); ctx.stroke();
		} else {
			ctx.strokeStyle = '#b59a4d';
			for (const y of [-9, -2, 5]) { ctx.beginPath(); ctx.moveTo(-26, y); ctx.lineTo(-20, y); ctx.stroke(); }
			ctx.strokeStyle = ink; ctx.fillStyle = '#fff';
			this.roundRect(ctx, -18, -15, 38, 31, 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(-17, 15); ctx.lineTo(1, 1); ctx.lineTo(19, 15); ctx.stroke();
			MB_IconStyle.paint(ctx, 'M -17 -14 L 19 -14 L 1 1 Z', '#fff', ink);
		}
		if (value === this.randomChoice) {
			MB_IconStyle.dice(ctx, 16, 15, 19, ink);
		} else {
			ctx.fillStyle = color || '#bbb'; ctx.strokeStyle = ink;
			ctx.beginPath(); ctx.arc(16, 15, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(13, 11, 2.3, 0, Math.PI * 2); ctx.fill();
			if (!color) { ctx.fillStyle = '#333'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText('?',16,20); }
		}
		ctx.restore();
	},

	label(slot) {
		return {button: 'Button', seconds: 'Wait (seconds)', repeat: 'Repeat count', send: 'Send broadcast', receive: 'Receive broadcast', note: 'Buzzer note',
			'led-draw': '手绘 5×5 LED 图案', 'led-color': 'LED 显示颜色', 'led-preset': '5×5 表情', 'color-matrix': '绘制 5×5 彩色点阵',
			'cocube-steps': '移动格数（驶向格子中心）', 'cocube-turns': '转向次数（原地转到下一个正方向）',
			'cocube-target': '移动到目标点：选择 X、Y 坐标',
			'cocube-heading': '朝向：上 0°、右 90°、下 180°、左 270°',
			'cocube-turn': '转个弯：选择方向和转弯大小'}[slot.mbIconParameter];
	},

	open(slot) {
		if (!MB_IconBlocks.enabled() || slot.parentThatIsA(BlockMorph)?.isTemplate) return;
		if (this.slot === slot) { this.close(); return; }
		this.close();
		const world = slot.world();
		if (!world?.worldCanvas || !document.body) return;
		world.stopEditing();
		if (typeof GP === 'object') {
			this.previousKeyboardDelegation = GP.delegateKeyboardEvents;
			GP.delegateKeyboardEvents = true;
		}
		this.slot = slot;
		this.world = world;
		const panel = document.createElement('div');
		this.panel = panel;
		panel.className = 'icon-parameter-popover';
		panel.setAttribute('role', 'dialog');
		panel.setAttribute('aria-label', this.label(slot));
		panel.addEventListener('keydown', event => event.stopPropagation());
		panel.style.setProperty('--picker-color', slot.parent.color.toString());
		panel.style.setProperty('--picker-border', slot.parent.color.darker(45).toString());
		const rows = slot.mbIconParameter === 'led-color' ? 4 : slot.mbIconParameter === 'send' ? 3 : slot.mbIconParameter === 'receive' ? 2 : 1;
		const tileSize = Math.max(36, Math.min(80, Math.max(56, 56 * slot.scale),
			(window.innerWidth - 56) / 3, (window.innerHeight - 56) / rows));
		panel.style.setProperty('--picker-size', tileSize + 'px');
		if (slot.mbIconParameter === 'color-matrix') MB_IconColorMatrix.buildPicker(panel, slot);
		else if (slot.mbIconParameter?.startsWith('cocube-')) MB_IconCoCube.buildPicker(panel, slot);
		else if (slot.mbIconParameter?.startsWith('led-')) MB_IconDisplay.buildPicker(panel, slot);
		else if (slot.mbIconParameter === 'note') MB_IconMusic.buildPicker(panel, slot);
		else if (this.isNumber(slot)) this.buildStepper(panel, slot);
		else this.buildChoices(panel, slot);
		document.body.appendChild(panel);
		this.outside = event => { if (!panel.contains(event.target)) this.close(); };
		this.escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); } };
		document.addEventListener('pointerdown', this.outside, true);
		document.addEventListener('wheel', this.outside, true);
		document.addEventListener('keydown', this.escape, true);
		this.position();
		const follow = () => { if (this.panel) { this.position(); if (this.panel) this.frame = requestAnimationFrame(follow); } };
		if (typeof requestAnimationFrame === 'function') this.frame = requestAnimationFrame(follow);
		// Opening a picker must not summon the software keyboard. Text entry
		// starts only when the child explicitly taps a numeric field.
		(panel.mbIconInitialFocus || panel.querySelector('[aria-pressed="true"]') || panel.querySelector('button:not(:disabled)'))?.focus({preventScroll: true});
	},

	buildStepper(panel, slot) {
		if (['cocube-steps', 'cocube-turns'].includes(slot.mbIconParameter)) {
			this.buildNumberChoices(panel, slot);
			return;
		}
		panel.classList.add('--number');
		const minus = document.createElement('button'), input = document.createElement('input'), plus = document.createElement('button');
		minus.type = plus.type = 'button';
		minus.textContent = '−'; plus.textContent = '+';
		minus.setAttribute('aria-label', 'Decrease'); plus.setAttribute('aria-label', 'Increase');
		input.type = 'number'; input.min = '0'; input.step = slot.mbIconParameter === 'seconds' ? '.001' : '1';
		input.inputMode = slot.mbIconParameter === 'seconds' ? 'decimal' : 'numeric';
		input.setAttribute('aria-label', this.label(slot));
		const motion = ['cocube-steps', 'cocube-turns'].includes(slot.mbIconParameter);
		const max = motion ? (slot.mbIconParameter === 'cocube-steps' ? MB_IconCoCube.maxSteps : MB_IconCoCube.maxTurns) : Infinity;
		if (motion) { input.min = '1'; input.max = String(max); }
		const refresh = () => {
			input.value = String(this.number(slot)); minus.disabled = this.number(slot) <= (motion ? 1 : 0);
			plus.disabled = this.number(slot) >= max;
		};
		const commit = value => { this.setNumber(slot, value); refresh(); this.position(); };
		const current = () => String(input.value).trim() !== '' && Number.isFinite(Number(input.value)) ? Number(input.value) : this.number(slot);
		minus.onclick = () => commit(current() - 1);
		plus.onclick = () => commit(current() + 1);
		input.onchange = () => commit(input.value);
		input.onkeydown = event => { if (event.key === 'Enter') { commit(input.value); this.close(); } };
		panel.append(minus, input, plus); refresh();
	},

	buildNumberChoices(panel, slot) {
		const max = slot.mbIconParameter === 'cocube-steps' ? MB_IconCoCube.maxSteps : MB_IconCoCube.maxTurns;
		panel.classList.add('--number-choices');
		panel.style.setProperty('--number-count', String(max));
		for (let value = 1; value <= max; value++) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = String(value);
			button.setAttribute('aria-label', String(value));
			button.setAttribute('aria-pressed', String(this.number(slot) === value));
			button.onclick = () => { this.setNumber(slot, value); this.close(); };
			panel.appendChild(button);
		}
	},

	buildChoices(panel, slot) {
		panel.classList.add('--choices');
		const value = this.value(slot);
		for (const option of this.options(slot)) {
			const button = document.createElement('button');
			button.type = 'button'; button.setAttribute('aria-label', option.label);
			button.setAttribute('aria-pressed', String(value === option.value));
			if (option.color) {
				const swatch = document.createElement('span'); swatch.className = 'icon-color-swatch';
				swatch.style.setProperty('--swatch', option.color); button.appendChild(swatch);
			} else if (option.value === this.randomChoice) {
				button.className = 'icon-random-choice';
				button.innerHTML = this.diceSVG;
			} else {
				const symbol = document.createElement('span'); symbol.className = 'icon-button-choice';
				symbol.textContent = option.label; button.appendChild(symbol);
			}
			button.onclick = () => { this.select(slot, option.value); this.close(); };
			panel.appendChild(button);
		}
	},

	position() {
		if (!this.panel) return;
		const slot = this.slot, root = slot.topBlock();
		if (!(root.parent instanceof ScriptsMorph) || !root.parent.children.includes(root)) { this.close(); return; }
		const rect = this.world.worldCanvas.getBoundingClientRect();
		const sx = rect.width / this.world.width(), sy = rect.height / this.world.height();
		const x = rect.left + (slot.center().x - this.world.left()) * sx;
		const top = rect.top + (slot.top() - this.world.top()) * sy;
		const bottom = rect.top + (slot.bottom() - this.world.top()) * sy;
		const width = this.panel.offsetWidth, height = this.panel.offsetHeight;
		const above = bottom + height + 18 > window.innerHeight && top > height + 18;
		const left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8));
		this.panel.classList.toggle('--above', above);
		this.panel.style.left = left + 'px';
		this.panel.style.top = Math.max(8, Math.min(above ? top - height - 14 : bottom + 14, window.innerHeight - height - 8)) + 'px';
		this.panel.style.setProperty('--pointer-left', Math.max(20, Math.min(width - 20, x - left)) + 'px');
	},

	close() {
		this.panel?.mbIconCleanup?.();
		if (this.slot?.mbIconParameter === 'note' && typeof MB_UISounds !== 'undefined') MB_UISounds.stopPitch();
		if (this.frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
		if (this.outside) {
			document.removeEventListener('pointerdown', this.outside, true);
			document.removeEventListener('wheel', this.outside, true);
			document.removeEventListener('keydown', this.escape, true);
		}
		this.panel?.remove();
		if (this.panel && typeof GP === 'object') GP.delegateKeyboardEvents = this.previousKeyboardDelegation;
		this.panel = this.slot = this.world = this.outside = this.escape = this.frame = null;
	}
};

function MB_IconParameterSlotMorph() {}
MB_IconParameterSlotMorph.prototype = Object.create(InputSlotMorph.prototype);
MB_IconParameterSlotMorph.prototype.constructor = MB_IconParameterSlotMorph;
MB_IconParameterSlotMorph.prototype.contents = function () {
	return this.children.find(child => child instanceof StringMorph || child instanceof TextMorph);
};
MB_IconParameterSlotMorph.prototype.setContents = function (value) {
	InputSlotMorph.prototype.setContents.call(this, value);
	this.fixLayout(); this.rerender();
};
MB_IconParameterSlotMorph.prototype.evaluate = function () {
	const value = InputSlotMorph.prototype.evaluate.call(this);
	return this.mbIconParameter === 'send' && value === MB_IconInputs.randomChoice ? MB_IconInputs.randomExpression() : value;
};
MB_IconParameterSlotMorph.prototype.fixLayout = function () {
	this.contents().hide(); this.contents().isEditable = false; this.arrow()?.hide();
	this.bounds.setExtent(new Point(MB_IconInputs.isNumber(this) ? Math.max(56 * this.scale, this.contents().width() + 24 * this.scale) : 54 * this.scale, 38 * this.scale));
	if (this.parent?.fixLayout) this.parent.fixLayout();
};
MB_IconParameterSlotMorph.prototype.render = function (ctx) {
	const s = this.scale, color = this.parent?.color || new Color(255, 218, 101);
	ctx.save(); ctx.lineWidth = 1.2 * s;
	ctx.fillStyle = MB_IconInputs.isNumber(this) ? '#fff' : color.toString();
	ctx.strokeStyle = color.darker(45).toString();
	MB_IconInputs.roundRect(ctx, s, s, this.width() - 2 * s, this.height() - 2 * s, this.height() / 2 - s);
	ctx.fill(); ctx.stroke();
	if (MB_IconInputs.isNumber(this)) {
		ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = `${19 * s}px Arial, sans-serif`;
		ctx.fillText(this.contents().text || '0', this.width() / 2, this.height() / 2);
	} else {
		ctx.lineCap = ctx.lineJoin = 'round';
		ctx.beginPath(); ctx.moveTo(this.width()/2 - 8*s, 15*s); ctx.lineTo(this.width()/2, 23*s); ctx.lineTo(this.width()/2 + 8*s, 15*s);
		ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 7 * s; ctx.stroke();
		ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5 * s; ctx.stroke();
	}
	ctx.restore();
};
MB_IconParameterSlotMorph.prototype.mouseDownLeft = function () {};
MB_IconParameterSlotMorph.prototype.mouseClickLeft = function () { MB_IconInputs.open(this); };

function MB_IconSecondsSlotMorph() {}
MB_IconSecondsSlotMorph.prototype = Object.create(MB_SecondsSlotMorph.prototype);
MB_IconSecondsSlotMorph.prototype.constructor = MB_IconSecondsSlotMorph;
for (const method of ['fixLayout', 'render', 'mouseDownLeft', 'mouseClickLeft']) {
	MB_IconSecondsSlotMorph.prototype[method] = MB_IconParameterSlotMorph.prototype[method];
}
MB_IconSecondsSlotMorph.prototype.setContents = function (value) {
	MB_SecondsSlotMorph.prototype.setContents.call(this, value);
	this.fixLayout(); this.rerender();
};

const mbNormalExpressionForArg = BlockMorph.prototype.expressionForArg;
BlockMorph.prototype.expressionForArg = function (arg) {
	if (arg instanceof MB_IconParameterSlotMorph && arg.mbIconParameter === 'send' && MB_IconInputs.value(arg) === MB_IconInputs.randomChoice) {
		return MB_IconInputs.randomExpression().expression();
	}
	return mbNormalExpressionForArg.call(this, arg);
};
const mbNormalCodeStringForArg = BlockMorph.prototype.addCodeStringForArg;
BlockMorph.prototype.addCodeStringForArg = function (arg, indent, result) {
	if (arg instanceof MB_IconParameterSlotMorph && arg.mbIconParameter === 'send' && MB_IconInputs.value(arg) === MB_IconInputs.randomChoice) {
		return mbNormalCodeStringForArg.call(this, MB_IconInputs.randomExpression(), indent, result);
	}
	return mbNormalCodeStringForArg.call(this, arg, indent, result);
};
const mbNormalSetBlockArg = MB_Parser.prototype.setBlockArg;
MB_Parser.prototype.setBlockArg = function (block, arg, index) {
	if (MB_IconBlocks.enabled() && block.selector === 'sendBroadcast' && index === 0 &&
		block.inputs()[0] instanceof MB_IconParameterSlotMorph && MB_IconInputs.isRandomExpression(arg)) {
		block.inputs()[0].setContents(MB_IconInputs.randomChoice);
		return;
	}
	return mbNormalSetBlockArg.call(this, block, arg, index);
};
