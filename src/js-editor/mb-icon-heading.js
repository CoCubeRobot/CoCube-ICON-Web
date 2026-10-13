// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Child-facing compass: up 0°, right 90°, down 180°, left 270°.
// Editing changes one ordinary numeric argument, never a running motor.
const MB_IconHeading = {
	normalize(value) { return ((value % 360) + 360) % 360; },
	value(block) { return this.normalize(Number(block.inputs()[0]?.evaluate()) || 0); },
	arrow: 'M 0 -21 L 11 0 L 4 -2 L 4 16 Q 4 20 0 20 Q -4 20 -4 16 L -4 -2 L -11 0 Z',

	configure(block) {
		const inputs = block.inputs();
		if (inputs.length !== 1 || !(inputs[0] instanceof InputSlotMorph)) return false;
		inputs[0].mbIconParameter = 'cocube-heading';
		Object.setPrototypeOf(inputs[0], MB_IconHeadingSlotMorph.prototype);
		inputs[0].fixLayout(); block.iconAccessibleLabel = '朝向角度（上 0°、右 90°、下 180°、左 270°）';
		return true;
	},

	set(block, value) {
		if (!Number.isInteger(value) || value < 0 || value > 360) return false;
		value = this.normalize(value);
		const slot = block.inputs()[0];
		if (slot.evaluate() === value) return true;
		slot.setContents(value); slot.scriptChanged();
		block.parts().filter(part => part instanceof MB_IconMorph).forEach(part => part.rerender());
		block.fullChanged(); return true;
	},

	drawIcon(ctx, block, scale) {
		ctx.save(); ctx.scale(scale, scale);
		ctx.fillStyle = '#eafaf6'; MB_IconStyle.outline(ctx, MB_IconStyle.ink.motion);
		ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = '#79b4a9'; ctx.lineWidth = 1.3;
		for (let i = 0; i < 12; i++) {
			const a = i * Math.PI / 6, inner = i % 3 ? 21 : 19;
			ctx.beginPath(); ctx.moveTo(Math.sin(a) * inner, -Math.cos(a) * inner);
			ctx.lineTo(Math.sin(a) * 23, -Math.cos(a) * 23); ctx.stroke();
		}
		ctx.rotate(this.value(block) * Math.PI / 180);
		MB_IconStyle.paint(ctx, this.arrow, '#fff', MB_IconStyle.ink.motion);
		ctx.fillStyle = '#ffd760'; ctx.beginPath(); ctx.arc(0, 3, 3, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	},

	buildPicker(panel, slot) {
		panel.classList.add('--heading');
		const block = slot.parentThatIsA(BlockMorph);
		const node = (tag, className, text) => {
			const el = document.createElement(tag); el.className = className;
			if (text) el.textContent = text;
			return el;
		};
		const body = node('div', 'icon-heading-body'); panel.appendChild(body);
		body.append(node('div', 'icon-heading-title', '朝向哪里？'), node('div', 'icon-heading-subtitle', '转一转箭头'));
		const dial = node('div', 'icon-heading-dial'); dial.tabIndex = 0;
		dial.setAttribute('role', 'slider'); dial.setAttribute('aria-label', '朝向角度');
		dial.setAttribute('aria-valuemin', '0'); dial.setAttribute('aria-valuemax', '359');
		const arrow = node('div', 'icon-heading-arrow');
		arrow.innerHTML = `<svg viewBox="-28 -28 56 56" aria-hidden="true"><path d="${this.arrow}" fill="white" stroke="#246f70" stroke-width="1.5" stroke-linejoin="round"/><circle cx="0" cy="3" r="3" fill="#ffd760"/></svg>`;
		dial.appendChild(arrow);
		for (const [angle, side] of [[0,'up'],[90,'right'],[180,'down'],[270,'left']]) {
			dial.appendChild(node('span', 'icon-heading-mark --' + side, angle + '°'));
		}
		const row = node('div', 'icon-heading-value'), input = node('input', ''), unit = node('span', '', '°');
		input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 3; input.autocomplete = 'off';
		input.setAttribute('aria-label', '角度（0～359）'); row.append(input, unit);
		const note = node('div', 'icon-heading-note'); note.setAttribute('role', 'status');
		const done = node('button', 'icon-heading-done', '完成'); done.type = 'button';
		body.append(dial, row, note, done);
		const valid = () => /^\d+$/.test(input.value.trim()) && Number(input.value) <= 360;
		const refresh = (keepField = false) => {
			const angle = this.value(block); if (!keepField) input.value = String(angle);
			arrow.style.transform = `rotate(${angle}deg)`;
			dial.setAttribute('aria-valuenow', String(angle)); dial.setAttribute('aria-valuetext', angle + ' 度');
			const ok = valid(); input.setAttribute('aria-invalid', String(!ok)); done.disabled = !ok;
			note.hidden = ok; note.textContent = ok ? '' : '请输入 0～359 的整数';
		};
		const commit = () => {
			const ok = valid(); if (ok) this.set(block, Number(input.value)); refresh(true); return ok;
		};
		input.oninput = commit;
		input.onblur = () => { if (commit()) refresh(); };
		input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); if (commit()) MB_IconInputs.close(); } };
		done.onclick = () => { if (commit()) MB_IconInputs.close(); };
		let pointer = null;
		const pick = event => {
			const rect = dial.getBoundingClientRect(), x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
			if (Math.hypot(x, y) < 8) return; // The centre has no meaningful direction.
			this.set(block, this.normalize(Math.round(Math.atan2(x, -y) * 180 / Math.PI))); refresh();
		};
		dial.onpointerdown = event => {
			if (pointer !== null || (event.button != null && event.button !== 0)) return;
			event.preventDefault(); dial.focus({preventScroll: true}); pointer = event.pointerId;
			dial.setPointerCapture(pointer); pick(event);
		};
		dial.onpointermove = event => { if (event.pointerId === pointer) pick(event); };
		const release = () => { const id = pointer; pointer = null; if (id !== null && dial.hasPointerCapture(id)) dial.releasePointerCapture(id); };
		dial.onpointerup = event => { if (event.pointerId === pointer) { pick(event); release(); } };
		dial.onpointercancel = dial.onlostpointercapture = release; panel.mbIconCleanup = release;
		dial.onkeydown = event => {
			const delta = {ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1}[event.key];
			if (delta === undefined && !['Home', 'End'].includes(event.key)) return;
			event.preventDefault();
			this.set(block, event.key === 'Home' ? 0 : event.key === 'End' ? 359 : this.normalize(this.value(block) + delta * (event.shiftKey ? 10 : 1))); refresh();
		};
		panel.mbIconInitialFocus = dial; refresh();
	}
};

function MB_IconHeadingSlotMorph() {}
MB_IconHeadingSlotMorph.prototype = Object.create(MB_IconParameterSlotMorph.prototype);
MB_IconHeadingSlotMorph.prototype.constructor = MB_IconHeadingSlotMorph;
MB_IconHeadingSlotMorph.prototype.fixLayout = function () {
	this.contents().hide(); this.contents().isEditable = false; this.arrow()?.hide();
	this.bounds.setExtent(new Point(56 * this.scale, 38 * this.scale));
	if (this.parent?.fixLayout) this.parent.fixLayout();
};
MB_IconHeadingSlotMorph.prototype.render = function (ctx) {
	const s = this.scale, color = this.parent?.color || new Color(73, 183, 174);
	ctx.save(); ctx.lineWidth = 1.2*s; ctx.fillStyle = '#fff'; ctx.strokeStyle = color.darker(45).toString();
	MB_IconInputs.roundRect(ctx, s, s, this.width()-2*s, this.height()-2*s, this.height()/2-s); ctx.fill(); ctx.stroke();
	ctx.fillStyle = '#174f50'; ctx.font = `${18*s}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillText(MB_IconHeading.value(this.parent) + '°', this.width()/2, this.height()/2); ctx.restore();
};
