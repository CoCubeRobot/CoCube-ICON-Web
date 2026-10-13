// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// A separate, portable colour-picture command. c1: is a versioned, row-major
// string of 25 palette indices: 0 = off; 1..9 = the fixed colours below.
// Keep this mapping stable: saved projects and board readback use it too.
const MB_IconColorMatrix = {
	selector: 'iconDisplayColorMatrix',
	defaultPicture: 'c1:0101012221033300040000000',
	colors: [
		['熄灭', '#000000'], ['红色', '#e51c28'], ['橙色', '#ff8a00'],
		['黄色', '#ffd400'], ['绿色', '#00ff00'], ['青色', '#00c9bc'],
		['蓝色', '#057abc'], ['紫色', '#a779bb'], ['粉色', '#ff72b0'], ['白色', '#ffffff']
	].map(([label, color]) => ({label, color, value: parseInt(color.slice(1), 16)})),

	ensureLibrary(editor) {
		const project = editor.project;
		if (project.functionNamed(this.selector) && project.blockSpecs.has(this.selector)) return true;
		// Embed a normal MicroBlocks function in the project: no asynchronous
		// dependency download, compiler-only opcode or firmware update is needed.
		project.addLibraryFromString(this.librarySource(), 'ICON Color Display');
		return !!project.functionNamed(this.selector);
	},

	librarySource() {
		return `module 'ICON Color Display' Output
author 'MicroBlocks ICON'
version 1 0
description 'A 5x5 colour picture for TFT screens. c1: followed by 25 palette digits, top-left to bottom-right. Colours are independent of the monochrome display colour.'
spec ' ' '${this.selector}' '彩色点阵 _' 'str' '${this.defaultPicture}'

to ${this.selector} picture {
  picture = ('[data:convertType]' picture 'string')
  if ((size picture) != 28) { return }
  if (('[data:copyFromTo]' picture 1 3) != 'c1:') { return }
  local 'width' ('[tft:getWidth]')
  local 'height' ('[tft:getHeight]')
  local 'side' (minimum width height)
  if (side < 11) { return }
  local 'gap' 1
  if (side > 60) { gap = 3 }
  local 'cell' ((side - (6 * gap)) / 5)
  local 'left' ((width - side) / 2)
  local 'top' ((height - side) / 2)
  local 'palette' ('[data:makeList]' ${this.colors.map(c => c.value).join(' ')})
  local 'i' 0
  '[display:mbDisplayOff]'
  repeat 25 {
    local 'digit' ('[data:convertType]' (at (i + 4) picture) 'number')
    digit = (maximum 0 (minimum 9 digit))
    '[tft:rect]' (left + (gap + ((i % 5) * (cell + gap)))) (top + (gap + ((i / 5) * (cell + gap)))) cell cell (at (digit + 1) palette) true
    i += 1
  }
}
`;
	},

	decode(value) {
		const digits = typeof value === 'string' && /^c1:[0-9]{25}$/.test(value) ? value.slice(3) : '0'.repeat(25);
		return [...digits].map(Number);
	},
	encode(pixels) { return 'c1:' + pixels.map(n => Math.max(0, Math.min(9, Math.trunc(n) || 0))).join(''); },
	configure(block) {
		if (block.selector !== this.selector) return false;
		const slot = block.inputs()[0];
		if (!(slot instanceof InputSlotMorph)) return false;
		slot.mbIconParameter = 'color-matrix';
		Object.setPrototypeOf(slot, MB_IconParameterSlotMorph.prototype);
		slot.fixLayout();
		return true;
	},

	drawIcon(ctx, block, scale) {
		ctx.save(); ctx.scale(scale, scale);
		MB_IconStyle.outline(ctx, MB_IconStyle.ink.display);
		ctx.fillStyle = '#edf2ff';
		MB_IconInputs.roundRect(ctx, -24, -24, 48, 48, 5); ctx.fill(); ctx.stroke();
		ctx.fillStyle = '#283764';
		MB_IconInputs.roundRect(ctx, -21, -21, 42, 42, 3); ctx.fill();
		this.decode(block.inputs()[0]?.evaluate()).forEach((color, i) => {
			ctx.fillStyle = color ? this.colors[color].color : '#465887';
			MB_IconInputs.roundRect(ctx, -19 + i % 5 * 8, -19 + Math.floor(i / 5) * 8, 6, 6, 1); ctx.fill();
		});
		ctx.restore();
	},

	buildPicker(panel, slot) {
		panel.classList.add('--color-matrix');
		const body = document.createElement('div'); body.className = 'icon-color-matrix-body';
		const heading = document.createElement('div'); heading.className = 'icon-color-matrix-title'; heading.textContent = '画一幅彩色图案';
		const hint = document.createElement('div'); hint.className = 'icon-color-matrix-hint'; hint.textContent = '先选颜色，再点一点或拖动涂色';
		const workspace = document.createElement('div'); workspace.className = 'icon-color-matrix-workspace';
		const grid = document.createElement('div'); grid.className = 'icon-color-matrix-grid';
		grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '5×5 彩色画板');
		const palette = document.createElement('div'); palette.className = 'icon-color-matrix-palette';
		palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', '画笔颜色与橡皮擦');
		const cells = [], brushes = [];
		let brush = 1, pointer = null, previous = null;
		const refresh = () => {
			const pixels = this.decode(slot.evaluate());
			cells.forEach((cell, i) => {
				cell.style.setProperty('--pixel-color', pixels[i] ? this.colors[pixels[i]].color : '#465887');
				cell.setAttribute('aria-label', `第 ${Math.floor(i / 5) + 1} 行，第 ${i % 5 + 1} 列，${this.colors[pixels[i]].label}`);
			});
			brushes.forEach(([button, color]) => button.setAttribute('aria-pressed', String(color === brush)));
		};
		const commit = pixels => {
			const value = this.encode(pixels);
			if (value !== slot.evaluate()) MB_IconDisplay.changed(slot, value);
			refresh();
		};
		const paint = index => {
			const pixels = this.decode(slot.evaluate());
			const from = previous === null ? index : previous;
			const x = from % 5, y = Math.floor(from / 5);
			const dx = index % 5 - x, dy = Math.floor(index / 5) - y;
			const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
			for (let step = 0; step <= steps; step++) {
				pixels[Math.round(y + dy * step / steps) * 5 + Math.round(x + dx * step / steps)] = brush;
			}
			previous = index; commit(pixels);
		};
		for (let i = 0; i < 25; i++) {
			const cell = document.createElement('button'); cell.type = 'button';
			cell.onpointerdown = event => {
				if (pointer !== null || (event.button != null && event.button !== 0)) return;
				event.preventDefault(); pointer = event.pointerId; previous = null;
				grid.setPointerCapture?.(pointer); paint(i);
			};
			cell.onclick = event => {
				// Keyboard / assistive clicks have no preceding pointer stroke.
				if (!event || event.detail === 0) { previous = null; paint(i); previous = null; }
			};
			cells.push(cell); grid.appendChild(cell);
		}
		grid.onpointermove = event => {
			if (pointer !== event.pointerId) return;
			const index = cells.indexOf(document.elementFromPoint(event.clientX, event.clientY));
			if (index >= 0) paint(index); else previous = null;
		};
		const endStroke = event => {
			if (event && event.pointerId !== pointer) return;
			const captured = pointer; pointer = previous = null;
			if (captured !== null && grid.hasPointerCapture?.(captured)) grid.releasePointerCapture(captured);
		};
		grid.onpointerup = grid.onpointercancel = grid.onlostpointercapture = endStroke;
		panel.mbIconCleanup = () => endStroke();
		for (const color of [1,2,3,4,5,6,7,8,9,0]) {
			const button = document.createElement('button'); button.type = 'button';
			button.title = color ? this.colors[color].label : '橡皮擦';
			button.setAttribute('aria-label', button.title);
			if (color) {
				const swatch = document.createElement('span'); swatch.className = 'icon-color-swatch';
				swatch.style.setProperty('--swatch', this.colors[color].color); button.appendChild(swatch);
			} else {
				button.className = 'icon-color-matrix-eraser';
				button.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 19 17 5q2-2 4 0l7 7q2 2 0 4L16 28H9l-5-5q-2-2 0-4Z" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="m10 13 12 11M16 28h13" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>橡皮擦</span>';
			}
			button.onclick = () => { endStroke(); brush = color; refresh(); };
			brushes.push([button, color]); palette.appendChild(button);
		}
		const actions = document.createElement('div'); actions.className = 'icon-color-matrix-actions';
		for (const [label, action] of [['涂满', () => commit(Array(25).fill(brush))], ['清空', () => commit(Array(25).fill(0))]]) {
			const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
			button.onclick = () => { endStroke(); action(); }; actions.appendChild(button);
		}
		const done = document.createElement('button'); done.type = 'button'; done.className = 'icon-color-matrix-done'; done.textContent = '完成';
		done.onclick = () => MB_IconInputs.close();
		workspace.append(grid, palette); body.append(heading, hint, workspace, actions, done); panel.appendChild(body);
		panel.mbIconInitialFocus = brushes[0][0];
		refresh();
	}
};
