// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// A visual editor for two ordinary, portable MicroBlocks numeric arguments.
// Picking a point edits the program only; it never sends a motor command.
const MB_IconTarget = {
	limits: [[0, 300], [0, 200]],
	values(block) { return [0, 1].map(axis => Number(block.inputs()[axis]?.evaluate())); },
	valid(value, axis) { return Number.isInteger(value) && value >= this.limits[axis][0] && value <= this.limits[axis][1]; },
	clamp(value, axis) { return Math.max(this.limits[axis][0], Math.min(this.limits[axis][1], value)); },

	configure(block) {
		const inputs = block.inputs();
		if (inputs.length !== 2 || !inputs.every(input => input instanceof InputSlotMorph)) return false;
		inputs[1].mbIconHiddenParameter = true;
		inputs[0].mbIconParameter = 'cocube-target';
		Object.setPrototypeOf(inputs[0], MB_IconTargetSlotMorph.prototype);
		inputs[0].fixLayout();
		block.iconAccessibleLabel = '移动到目标点 X、Y';
		return true;
	},

	set(block, values) {
		if (values.length !== 2 || !values.every((value, axis) => this.valid(value, axis))) return false;
		const inputs = block.inputs();
		if (values.every((value, axis) => value === Number(inputs[axis].evaluate()))) return true;
		values.forEach((value, axis) => { if (Number(inputs[axis].evaluate()) !== value) inputs[axis].setContents(value); });
		inputs[0].rerender(); inputs[0].scriptChanged();
		block.parts().filter(part => part instanceof MB_IconMorph).forEach(part => part.rerender());
		block.fullChanged();
		return true;
	},

	drawIcon(ctx, block, scale) {
		const values = this.values(block).map((value, axis) => this.clamp(Number.isFinite(value) ? value : 125, axis));
		ctx.save(); ctx.scale(scale, scale);
		ctx.fillStyle = '#eafaf6'; MB_IconStyle.outline(ctx, MB_IconStyle.ink.motion);
		MB_IconInputs.roundRect(ctx, -23, -19, 46, 38, 4); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = '#a6d5cc'; ctx.lineWidth = .8;
		for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-23 + i * 46/6, -18); ctx.lineTo(-23 + i * 46/6, 18); ctx.stroke(); }
		for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-22, -19 + i * 38/4); ctx.lineTo(22, -19 + i * 38/4); ctx.stroke(); }
		// Keep the entire marker inside a centred frame at every coordinate. This
		// is thumbnail padding only, not a restriction on the full-map target.
		ctx.translate(-14 + values[0] / 300 * 28, -9 + values[1] / 200 * 18);
		MB_IconStyle.paint(ctx, 'M 0 8 C -2 5 -6 1 -6 -2 A 6 6 0 0 1 6 -2 C 6 1 2 5 0 8 Z', '#ffd760', MB_IconStyle.ink.motion);
		ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -2, 2.2, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	},

	buildPicker(panel, slot) {
		panel.classList.add('--target');
		const block = slot.parentThatIsA(BlockMorph);
		const node = (tag, className, text) => {
			const element = document.createElement(tag); element.className = className;
			if (text) element.textContent = text;
			return element;
		};
		const body = node('div', 'icon-target-body'); panel.appendChild(body);
		const title = node('div', 'icon-target-title', '想去哪里？');
		const subtitle = node('div', 'icon-target-subtitle', '点一点，或拖动小旗标');
		body.append(title, subtitle);
		const mapWrap = node('div', 'icon-target-map-wrap'), map = node('div', 'icon-target-map');
		map.tabIndex = 0; map.setAttribute('role', 'group');
		const crossX = node('div', 'icon-target-cross --x'), crossY = node('div', 'icon-target-cross --y');
		const marker = node('div', 'icon-target-marker');
		marker.innerHTML = '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 40C13 35 2 25 2 16a14 14 0 0 1 28 0c0 9-11 19-14 24Z" fill="#ffd760" stroke="#246f70" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="white"/></svg>';
		map.append(crossX, crossY, marker);
		mapWrap.append(map, node('span', 'icon-target-y', 'Y ↓ 200'), node('span', 'icon-target-origin', '(0, 0)'), node('span', 'icon-target-x', 'X → 300'));
		body.appendChild(mapWrap);
		const controls = node('div', 'icon-target-controls');
		const fields = [], minusButtons = [], plusButtons = [];
		const note = node('div', 'icon-target-note'); note.setAttribute('role', 'status');
		const done = node('button', 'icon-target-done', '完成'); done.type = 'button';
		const parse = field => /^\d+$/.test(field.value.trim()) ? Number(field.value) : NaN;
		const validate = () => {
			let valid = true;
			fields.forEach((field, axis) => {
				const ok = this.valid(parse(field), axis); field.setAttribute('aria-invalid', String(!ok)); valid = valid && ok;
			});
			done.disabled = !valid;
			note.textContent = valid ? '' : '请输入整数：X 0–300，Y 0–200';
			note.hidden = valid;
			note.classList.toggle('--invalid', !valid);
			return valid;
		};
		const refresh = (keepFields = false) => {
			const values = this.values(block);
			fields.forEach((field, axis) => {
				if (!keepFields) field.value = String(values[axis]);
				minusButtons[axis].disabled = values[axis] <= this.limits[axis][0];
				plusButtons[axis].disabled = values[axis] >= this.limits[axis][1];
			});
			const x = this.clamp(values[0], 0) / 3 + '%', y = this.clamp(values[1], 1) / 2 + '%';
			marker.style.left = crossX.style.left = x; marker.style.top = crossY.style.top = y;
			map.setAttribute('aria-label', `目标 X ${values[0]}，Y ${values[1]}。方向键微调，Shift 加速；Home 回到默认目标。`);
			validate();
		};
		const commitFields = () => {
			if (!validate()) return false;
			this.set(block, fields.map(parse));
			// Preserve the caret and partially typed field; the paired value has
			// already been validated as a unit. Never coerce an invalid input.
			refresh(true);
			return true;
		};
		for (const [axis, name] of ['X', 'Y'].entries()) {
			const row = node('div', 'icon-target-axis'), label = node('span', '', name);
			const minus = node('button', '', '−'), input = node('input', ''), plus = node('button', '', '+');
			minus.type = plus.type = 'button'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 3;
			input.setAttribute('aria-label', `${name} 坐标（${this.limits[axis].join('–')}）`);
			minus.setAttribute('aria-label', name + ' 减少 1'); plus.setAttribute('aria-label', name + ' 增加 1');
			input.oninput = commitFields; input.onblur = validate;
			input.onkeydown = event => {
				if (event.key === 'Enter') { event.preventDefault(); if (commitFields()) MB_IconInputs.close(); }
			};
			const adjust = delta => {
				const values = fields.map(parse);
				values[axis] = this.clamp((Number.isFinite(values[axis]) ? values[axis] : this.values(block)[axis]) + delta, axis);
				input.value = String(values[axis]); commitFields();
			};
			minus.onclick = () => adjust(-1); plus.onclick = () => adjust(1);
			fields.push(input); minusButtons.push(minus); plusButtons.push(plus);
			row.append(label, minus, input, plus); controls.appendChild(row);
		}
		body.append(controls, note, done);
		done.onclick = () => { if (validate()) { this.set(block, fields.map(parse)); MB_IconInputs.close(); } };
		let pointer = null;
		const pick = event => {
			const rect = map.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			const values = [(event.clientX - rect.left) / rect.width * 300, (event.clientY - rect.top) / rect.height * 200]
				.map((value, axis) => this.clamp(Math.round(value), axis));
			this.set(block, values); refresh();
		};
		map.onpointerdown = event => {
			if (pointer !== null || (event.button != null && event.button !== 0)) return;
			event.preventDefault(); map.focus({preventScroll: true}); pointer = event.pointerId;
			map.setPointerCapture(pointer); map.classList.add('--dragging'); pick(event);
		};
		map.onpointermove = event => { if (event.pointerId === pointer) pick(event); };
		const release = () => {
			const id = pointer; pointer = null; map.classList.toggle('--dragging', false);
			if (id !== null && map.hasPointerCapture(id)) map.releasePointerCapture(id);
		};
		map.onpointerup = event => { if (event.pointerId === pointer) { pick(event); release(); } };
		map.onpointercancel = map.onlostpointercapture = release;
		panel.mbIconCleanup = release;
		map.onkeydown = event => {
			const deltas = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
			if (event.key !== 'Home' && !deltas[event.key]) return;
			event.preventDefault();
			const values = event.key === 'Home' ? [175, 125] : this.values(block).map((value, axis) =>
				this.clamp(value + deltas[event.key][axis] * (event.shiftKey ? 10 : 1), axis));
			this.set(block, values); refresh();
		};
		panel.mbIconInitialFocus = map; refresh();
	}
};

function MB_IconTargetSlotMorph() {}
MB_IconTargetSlotMorph.prototype = Object.create(MB_IconParameterSlotMorph.prototype);
MB_IconTargetSlotMorph.prototype.constructor = MB_IconTargetSlotMorph;
MB_IconTargetSlotMorph.prototype.fixLayout = function () {
	this.contents().hide(); this.contents().isEditable = false; this.arrow()?.hide();
	this.bounds.setExtent(new Point(64 * this.scale, 38 * this.scale));
	if (this.parent?.fixLayout) this.parent.fixLayout();
};
MB_IconTargetSlotMorph.prototype.render = function (ctx) {
	const s = this.scale, color = this.parent?.color || new Color(73, 183, 174);
	ctx.save(); ctx.lineWidth = 1.2 * s; ctx.fillStyle = '#fff'; ctx.strokeStyle = color.darker(45).toString();
	MB_IconInputs.roundRect(ctx, s, s, this.width() - 2*s, this.height() - 2*s, this.height()/2 - s); ctx.fill(); ctx.stroke();
	ctx.fillStyle = '#174f50'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${12.5*s}px Arial, sans-serif`;
	ctx.fillText(MB_IconTarget.values(this.parent).join(', '), this.width()/2, this.height()/2, this.width() - 10*s);
	ctx.restore();
};
