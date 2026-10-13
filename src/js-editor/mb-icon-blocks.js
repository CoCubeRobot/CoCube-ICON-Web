// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// mb-icon-blocks.js - Horizontal, icon-first presentation for SnapBlocks.
//
// The compiler continues to use nextBlock() as its ordered linked list. This
// adapter changes only presentation and manipulation: command chains flow from
// left to right, attach points live on the left and right edges, and textual
// labels are represented by compact symbols while argument slots remain live.

/* global MB_editor, Morph, BlockMorph, BlockLabelMorph, CommandBlockMorph, HatBlockMorph,
CommandSlotMorph, CSlotMorph, SyntaxElementMorph, ScriptsMorph, Point, Rectangle, Color */

// Shared visual language, in unscaled icon coordinates. Category-tinted ink,
// round joins and a single outline weight keep the small pictures consistent.
const MB_IconStyle = {
	ink: { event: '#806325', control: '#806325', motion: '#246f70', gripper: '#426d34', music: '#85527d', display: '#40527d' },
	lineWidth: 1.8,
	outline(ctx, ink) {
		ctx.strokeStyle = ink;
		ctx.lineWidth = this.lineWidth;
		ctx.lineJoin = ctx.lineCap = 'round';
	},
	paint(ctx, data, fill, ink) {
		this.outline(ctx, ink);
		const path = new Path2D(data);
		ctx.fillStyle = fill; ctx.fill(path); ctx.stroke(path);
	},
	dice(ctx, x, y, size, ink) {
		ctx.save(); ctx.translate(x, y); ctx.scale(size / 20, size / 20);
		this.outline(ctx, ink); ctx.fillStyle = '#fff';
		MB_IconInputs.roundRect(ctx, -10, -10, 20, 20, 4); ctx.fill(); ctx.stroke();
		ctx.fillStyle = ink;
		for (const [px, py] of [[-5,-5],[5,-5],[0,0],[-5,5],[5,5]]) {
			ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	},
	drawControl(ctx, selector, scale) {
		ctx.save(); ctx.scale(scale, scale);
		const ink = this.ink.control;
		this.outline(ctx, ink);
		if (selector.startsWith('wait')) {
			// Stopwatch: the highlighted sector and hand stay readable at shelf size.
			ctx.lineWidth = 2.6;
			ctx.beginPath(); ctx.moveTo(-3, -24); ctx.lineTo(3, -24);
			ctx.moveTo(0, -24); ctx.lineTo(0, -19);
			ctx.moveTo(14, -15); ctx.lineTo(17, -18); ctx.stroke();
			this.outline(ctx, ink); ctx.fillStyle = '#fff';
			ctx.beginPath(); ctx.arc(0, 2, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.fillStyle = '#ffda87'; ctx.beginPath(); ctx.moveTo(0, 2);
			ctx.arc(0, 2, 16, -Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = '#c1994b';
			for (let i = 0; i < 4; i++) {
				ctx.save(); ctx.translate(0, 2); ctx.rotate(i * Math.PI / 2);
				ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -12); ctx.stroke(); ctx.restore();
			}
			ctx.strokeStyle = ink; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(0, 2); ctx.stroke();
			ctx.lineWidth = this.lineWidth; ctx.fillStyle = '#fff';
			ctx.beginPath(); ctx.arc(0, 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		} else if (selector === 'forever') {
			// A continuous white ribbon; one arrow indicates repeated travel.
			ctx.translate(0, 3); ctx.scale(.9, .9);
			const ribbon = new Path2D('M 0 0 C -8 -11 -12 -14 -17 -12 C -28 -7 -23 13 -13 12 C -5 11 5 -11 13 -12 C 26 -15 28 11 16 12 C 10 13 5 6 0 0');
			ctx.lineWidth = 8; ctx.stroke(ribbon);
			ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.4; ctx.stroke(ribbon);
			this.paint(ctx, 'M 10 -21 L 23 -12 L 7 -7 L 11 -13 Z', '#fff', ink);
		} else {
			const arrow = 'M -21 -1 L -21 -7 Q -21 -18 -10 -18 L 7 -18 L 7 -24 L 22 -13 L 7 -2 L 7 -9 L -10 -9 Q -12 -9 -12 -7 L -12 -1 Q -12 3 -16.5 3 Q -21 3 -21 -1 Z';
			this.paint(ctx, arrow, '#fff', ink);
			ctx.rotate(Math.PI); this.paint(ctx, arrow, '#fff', ink);
		}
		ctx.restore();
	}
};

function MB_IconMorph(selector, scale) {
	this.init(selector, scale);
}

MB_IconMorph.prototype = new Morph();
MB_IconMorph.prototype.constructor = MB_IconMorph;
MB_IconMorph.uber = Morph.prototype;

MB_IconMorph.prototype.init = function (selector, scale) {
	MB_IconMorph.uber.init.call(this);
	this.selector = selector;
	this.scale = scale || 1;
	this.isDraggable = false;
	const size = (['sendBroadcast', 'whenBroadcastReceived', 'waitMillis', 'waitMicros', 'waitUntil', 'forever', 'repeat', 'repeatUntil', 'play tone', '[display:mbDisplay]', 'set display color', 'led_displayImage'].includes(selector) ||
		(typeof MB_IconColorMatrix !== 'undefined' && selector === MB_IconColorMatrix.selector) ||
		(typeof MB_IconCoCube !== 'undefined' && MB_IconCoCube.isMotion(selector)) ||
		(typeof MB_IconGripper !== 'undefined' && MB_IconGripper.selectors.includes(selector))) ? 56 : 46;
	this.setExtent(new Point(size, size).multiplyBy(this.scale));
};

MB_IconMorph.prototype.render = function (ctx) {
	// The 56-unit illustrations share a small inset so their rounded outlines
	// retain breathing room even at 50% zoom. Compact start/stop circles already
	// have the same inset in their 46-unit viewport.
	const s = this.scale * (this.width() > 50 * this.scale ? .92 : 1);
	const symbol = MB_IconBlocks.iconFor({ selector: this.selector });
	const parentColor = this.parent?.color || new Color(80, 80, 80);
	ctx.save();
	ctx.translate(this.width() / 2, this.height() / 2);

	if (this.selector === 'whenStarted') {
		ctx.fillStyle = '#08ae52';
		ctx.strokeStyle = '#087b3e';
		ctx.lineWidth = 2 * s;
		ctx.beginPath();
		ctx.arc(0, 0, 19 * s, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.moveTo(-5 * s, -10 * s);
		ctx.lineTo(11 * s, 0);
		ctx.lineTo(-5 * s, 10 * s);
		ctx.closePath();
		ctx.fill();
	} else if (this.selector === 'whenButtonPressed') {
		const label = String(this.parent?.inputs()[0]?.evaluate() || 'A').replace('+', '');
		ctx.fillStyle = '#fff6ca';
		ctx.strokeStyle = MB_IconStyle.ink.event;
		ctx.lineWidth = 2 * s;
		ctx.beginPath();
		ctx.arc(0, 0, 18 * s, 0, Math.PI * 2);
		ctx.fill(); ctx.stroke();
		ctx.fillStyle = '#765619';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `bold ${(label.length > 1 ? 17 : 23) * s}px Arial, sans-serif`;
		ctx.fillText(label, 0, s);
	} else if (['waitMillis', 'waitMicros', 'waitUntil', 'forever', 'repeat', 'repeatUntil'].includes(this.selector)) {
		MB_IconStyle.drawControl(ctx, this.selector, s);
	} else if (typeof MB_IconCoCube !== 'undefined' && MB_IconCoCube.isMotion(this.selector)) {
		MB_IconCoCube.drawIcon(ctx, this.parent, s);
	} else if (typeof MB_IconGripper !== 'undefined' && MB_IconGripper.selectors.includes(this.selector)) {
		MB_IconGripper.drawIcon(ctx, this.parent, s);
	} else if (typeof MB_IconColorMatrix !== 'undefined' && this.selector === MB_IconColorMatrix.selector) {
		MB_IconColorMatrix.drawIcon(ctx, this.parent, s);
	} else if (typeof MB_IconDisplay !== 'undefined' && MB_IconDisplay.selectors.includes(this.selector)) {
		MB_IconDisplay.drawIcon(ctx, this.parent, s);
	} else if (this.selector === 'play tone' && typeof MB_IconMusic !== 'undefined') {
		MB_IconMusic.drawIcon(ctx, this.parent, s);
	} else if (['sendBroadcast', 'whenBroadcastReceived'].includes(this.selector) &&
		typeof MB_IconInputs !== 'undefined') {
		MB_IconInputs.drawBroadcast(ctx, this.parent, s);
	} else if (['stopTask', 'stopAll', 'stopAllScripts'].includes(this.selector)) {
		ctx.fillStyle = '#f04d4e';
		ctx.strokeStyle = '#aa2428';
		ctx.lineWidth = 2 * s;
		ctx.beginPath();
		ctx.arc(0, 0, 19 * s, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#fff';
		MB_IconInputs.roundRect(ctx, -8 * s, -8 * s, 16 * s, 16 * s, 3 * s);
		ctx.fill();
	} else {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `bold ${28 * s}px Arial, sans-serif`;
		ctx.lineJoin = 'round';
		ctx.lineWidth = 5 * s;
		ctx.strokeStyle = parentColor.darker(35).toString();
		ctx.strokeText(symbol, 0, 1 * s);
		ctx.fillStyle = '#fff';
		ctx.fillText(symbol, 0, 1 * s);
	}
	ctx.restore();
};

// Seconds are a view of a waitMillis argument. Serialization, copying, compiler
// input and board readback continue to use milliseconds, including old projects.
function MB_SecondsSlotMorph() {}
MB_SecondsSlotMorph.prototype = Object.create(InputSlotMorph.prototype);
MB_SecondsSlotMorph.prototype.constructor = MB_SecondsSlotMorph;

MB_SecondsSlotMorph.prototype.setContents = function (millis) {
	const numeric = typeof millis === 'number' && Number.isFinite(millis);
	InputSlotMorph.prototype.setContents.call(this, numeric ? millis / 1000 : millis);
	this.mbValue = millis;
};

MB_SecondsSlotMorph.prototype.evaluate = function () {
	const text = this.acceptedText();
	if (text === this.mbValueText) return this.mbValue;
	const seconds = Number(text);
	return text.trim() !== '' && Number.isFinite(seconds) ? Math.round(seconds * 1000) : text;
};

const MB_IconBlocks = {
	enabled() {
		return (typeof MB_editor !== 'undefined') && MB_editor.iconLayout;
	},

	icons: {
		whenStarted: '▶',
		whenButtonPressed: '◉',
		whenCondition: '◇',
		whenBroadcastReceived: '✉',
		forever: '∞',
		repeat: '↻',
		repeatUntil: '↻',
		if: '◇',
		ifExpression: '◇',
		for: '⇥',
		waitMillis: '◷',
		waitMicros: '◷',
		waitUntil: '◷',
		return: '↩',
		exitLoop: '↪',
		stopTask: '■',
		stopAll: '■',
		stopAllScripts: '■',
		sendBroadcast: '✉',
		'play tone': '♪',
		comment: '✎',
		setUserLED: '☀',
		sayIt: '◉',
		graphIt: '▥',
		buttonA: 'A',
		buttonB: 'B',
		timer: '◴',
		resetTimer: '◴',
		digitalReadOp: '↓',
		analogReadOp: '∿',
		digitalWriteOp: '↑',
		analogWriteOp: '∿',
		'+': '+',
		'-': '−',
		'*': '×',
		'/': '÷',
		'%': '%',
		'<': '<',
		'<=': '≤',
		'==': '=',
		'!=': '≠',
		'>=': '≥',
		'>': '>',
		not: '¬',
		and: '∧',
		or: '∨',
		booleanConstant: '◉',
		random: '⚄',
		minimum: '↓',
		maximum: '↑',
		absoluteValue: '|x|',
		v: 'x',
		'=': '←',
		'+=': '+',
		local: 'x',
		at: '#',
		size: '#',
		newList: '≡'
	},

	iconFor(block) {
		let selector = block.selector || '';
		if (this.icons[selector]) return this.icons[selector];
		if (selector.startsWith('[display:')) return '▦';
		if (selector.startsWith('[sensors:')) return '◉';
		if (selector.startsWith('[radio:') || selector.startsWith('[ble:')) return '≋';
		if (selector.startsWith('[net:')) return '◌';
		if (selector.startsWith('[file:')) return '▤';
		if (selector.startsWith('[tft:')) return '▣';
		if (selector.startsWith('[serial:')) return '⇄';
		if (selector.startsWith('[data:')) return '≡';
		if (selector.startsWith('[io:')) return '⎍';
		if (selector.startsWith('[misc:')) return '◆';
		return '◆';
	},

	commandSlots(block) {
		return block.inputs().filter(input => input instanceof CommandSlotMorph);
	},
	bodyHeight(block) {
		return block.mbIconBodyHeight ??
			((!block.isTemplate && this.commandSlots(block).length ? 80 : 64) * block.scale);
	},
	connectionCenterOffset(block) {
		// Every command's bottom 64 units share a baseline. Each enclosing loop
		// adds its own rail above the tallest shell in its entire nested chain.
		return this.bodyHeight(block) - (32 * block.scale);
	},
	controlInset(block) { return 24 * block.scale; },
	emptyControlSlotWidth(block) { return 24 * block.scale; },
	bodyWidth(block) { return (block instanceof HatBlockMorph ? 76 : 72) * block.scale; },
	// Both side profiles are eight units deep. Using the same amount as the
	// overlap makes neighbouring profiles meet without a strip of canvas between
	// them.
	connectionOverlap(block) { return 8 * block.scale; },
	connectionStep(block) { return block.width() - this.connectionOverlap(block); },
	chainWidth(block) {
		return block ? this.measureChain(block, new Map()).width : 0;
	},

	measureChain(first, measurements) {
		let width = 0;
		let above = 0;
		let below = 0;
		for (let block = first; block; block = block.nextBlock()) {
			const s = block.scale;
			const slots = block.isTemplate ? [] : this.commandSlots(block);
			const lanes = slots.map(slot => slot.nestedBlock()
				? this.measureChain(slot.nestedBlock(), measurements)
				: { width: this.emptyControlSlotWidth(block), above: 32 * s, below: 32 * s });
			const height = slots.length
				? (16 * s) + Math.max(...lanes.map(lane => lane.above)) + (32 * s)
				: 64 * s;
			const bodyWidth = slots.length
				? this.controlInset(block) + lanes.reduce((sum, lane) => sum + lane.width, 0)
					+ ((slots.length - 1) * 8 * s) + (64 * s)
				: this.bodyWidth(block);
			const center = height - (32 * s);
			measurements.set(block, { width: bodyWidth, height, center, lanes });
			width += bodyWidth - (block.nextBlock() ? this.connectionOverlap(block) : 0);
			above = Math.max(above, center);
			below = Math.max(below, height - center);
		}
		return { width, above, below };
	},

	reflow(element) {
		if (this.isLayingOut) return;
		let root = element;
		while (root.parent instanceof CommandBlockMorph || root.parent instanceof CommandSlotMorph) {
			root = root.parent;
		}
		if (!(root instanceof CommandBlockMorph)) return;
		this.isLayingOut = true;
		try {
			const baseline = root.top() + this.connectionCenterOffset(root);
			const left = root.left();
			root.fullChanged();
			const measurements = new Map();
			this.measureChain(root, measurements);
			this.arrangeChain(root, left, baseline, measurements);
			root.fixHighlight();
			root.fullChanged();
			root.parent?.fixLayout();
		} finally {
			this.isLayingOut = false;
		}
	},

	arrangeChain(first, left, baseline, measurements) {
		for (let block = first; block; block = block.nextBlock()) {
			const metrics = measurements.get(block);
			block.mbIconBodyHeight = metrics.height;
			block.setPosition(new Point(left, baseline - metrics.center));
			this.layout(block, metrics, measurements);
			left += metrics.width - this.connectionOverlap(block);
		}
	},

	// The same 64-unit body and side-tab proportions used by the reference UI.
	outline(block, ctx, inset) {
		const s = block.scale;
		const h = this.bodyHeight(block) - inset;
		const w = block.width() - inset;
		const joinX = w - (8 * s);
		const r = Math.max((4 * s) - inset, 0);
		const middle = this.connectionCenterOffset(block);

		if (block instanceof HatBlockMorph) {
			ctx.moveTo(32 * s, inset);
			ctx.lineTo(joinX - r, inset);
		} else {
			ctx.moveTo(inset, 4 * s);
			ctx.arcTo(inset, inset, 4 * s, inset, r);
			ctx.lineTo(joinX - r, inset);
		}
		ctx.arcTo(joinX, inset, joinX, 4 * s, r);
		ctx.lineTo(joinX, middle - (18 * s));
		ctx.lineTo(joinX + (2 * s), middle - (14 * s));
		ctx.lineTo(w - (2 * s), middle - (10 * s));
		ctx.lineTo(w, middle - (6 * s));
		ctx.lineTo(w, middle + (6 * s));
		ctx.lineTo(w - (2 * s), middle + (10 * s));
		ctx.lineTo(joinX + (2 * s), middle + (14 * s));
		ctx.lineTo(joinX, middle + (18 * s));
		ctx.lineTo(joinX, h - (4 * s));
		ctx.arcTo(joinX, h, joinX - (4 * s), h, r);

		if (block instanceof HatBlockMorph) {
			ctx.lineTo(32 * s, h);
			ctx.arc(32 * s, 32 * s, Math.max((32 * s) - inset, 1),
				Math.PI / 2, -Math.PI / 2, false);
		} else {
			ctx.lineTo(4 * s, h);
			ctx.arcTo(inset, h, inset, h - (4 * s), r);
			ctx.lineTo(inset, middle + (18 * s));
			ctx.lineTo(2 * s, middle + (14 * s));
			ctx.lineTo(6 * s, middle + (10 * s));
			ctx.lineTo(8 * s, middle + (6 * s));
			ctx.lineTo(8 * s, middle - (6 * s));
			ctx.lineTo(6 * s, middle - (10 * s));
			ctx.lineTo(2 * s, middle - (14 * s));
			ctx.lineTo(inset, middle - (18 * s));
			ctx.lineTo(inset, 4 * s);
		}
	},

	layout(block, metrics, measurements) {
		const s = block.scale;
		const top = block.top();
		const left = block.left();
		const bodyHeight = metrics.height;
		const inputs = block.inputs();
		const commandSlots = this.commandSlots(block);
		const valueSlots = inputs.filter(input => !(input instanceof CommandSlotMorph) && !input.mbIconHiddenParameter);
		const bodyWidth = metrics.width;
		block.bounds.setExtent(new Point(bodyWidth, bodyHeight));

		// LEGO's flyout shows every template as one collapsed, equal-size tile.
		// Inputs and control bodies become visible only after a template is copied
		// onto the programming canvas.
		if (block.isTemplate) {
			inputs.forEach(input => input.hide());
			block.bounds.setExtent(new Point(bodyWidth, bodyHeight));
			block.parts().filter(part => part instanceof MB_IconMorph).forEach(icon => {
				icon.rerender();
				icon.setPosition(new Point(
					left + ((bodyWidth - icon.width()) / 2),
					top + ((bodyHeight - icon.height()) / 2)
				));
			});
			block.holes = [];
			block.rerender();
			return;
		}

		inputs.forEach(input => input.mbIconHiddenParameter ? input.hide() : input.show());

		// A control block becomes a horizontal container. Its body grows with the
		// nested chain while its own icon remains in a fixed-size end cell.
		if (commandSlots.length) {
			let cursor = left + this.controlInset(block);
			commandSlots.forEach((slot, index) => {
				const nested = slot.nestedBlock();
				const nestedWidth = metrics.lanes[index].width;
				slot.setPosition(new Point(cursor, top + (16 * s)));
				slot.bounds.setExtent(new Point(nestedWidth, bodyHeight - (16 * s)));
				if (nested) this.arrangeChain(nested, cursor, top + metrics.center, measurements);
				slot.fixHolesLayout();
				slot.rerender();
				cursor += nestedWidth;
				if (index < commandSlots.length - 1) cursor += 8 * s;
			});
		}

		block.bounds.setExtent(new Point(bodyWidth, bodyHeight));
		const iconCellLeft = left + bodyWidth - (72 * s);
		block.parts().filter(part => part instanceof MB_IconMorph).forEach(icon => {
			icon.rerender();
			icon.setPosition(new Point(
				iconCellLeft + ((72 * s - icon.width()) / 2),
				top + metrics.center - (icon.height() / 2)
			));
		});

		if (valueSlots.length) {
			const gap = 6 * s;
			const rowWidth = valueSlots.reduce((sum, slot) => sum + slot.width(), 0)
				+ gap * (valueSlots.length - 1);
			let x = iconCellLeft + ((72 * s - rowWidth) / 2);
			valueSlots.forEach(slot => {
				slot.setPosition(new Point(x, top + bodyHeight + (slot.mbIconParameter ? -9 : 5) * s));
				x += slot.width() + gap;
			});
		}

		block.holes = [];
		block.parts().forEach(part => {
			part.fixHolesLayout();
			block.holes.push(...part.holes.map(hole =>
				hole.translateBy(part.position().subtract(block.position()))
			));
		});
		block.rerender();
	}
};

const mbTextParseSpec = BlockMorph.prototype.parseSpec;
BlockMorph.prototype.parseSpec = function (spec) {
	if (!MB_IconBlocks.enabled()) return mbTextParseSpec.call(this, spec);

	this.iconAccessibleLabel = spec;
	const parts = mbTextParseSpec.call(this, spec);
	const slots = parts.filter(part =>
		(typeof part === 'string') && part.startsWith('%') && (part.length > 1)
	);
	return [MB_IconBlocks.iconFor(this)].concat(slots);
};

const mbTextSetSpec = BlockMorph.prototype.setSpec;
BlockMorph.prototype.setSpec = function (spec, definition) {
	mbTextSetSpec.call(this, spec, definition);
	if (!MB_IconBlocks.enabled()) return;
	this.parts().filter(part => part instanceof BlockLabelMorph).forEach(part => part.destroy());
	this.add(new MB_IconMorph(this.selector, this.scale));
	this.inputs().forEach(input => {
		const contents = input.contents?.();
		if (contents?.setFontSize) contents.setFontSize(17 * this.scale);
	});
	if (this.selector === 'waitMillis') {
		const input = this.inputs()[0];
		if (input instanceof InputSlotMorph && !(input instanceof MB_SecondsSlotMorph)) {
			const millis = input.evaluate();
			Object.setPrototypeOf(input, MB_SecondsSlotMorph.prototype);
			input.setContents(millis);
		}
		this.iconAccessibleLabel = 'wait (seconds)';
	}
	if (typeof MB_IconInputs !== 'undefined') MB_IconInputs.configure(this);
	if (typeof MB_IconGripper !== 'undefined' && MB_IconGripper.selectors.includes(this.selector)) {
		this.iconAccessibleLabel = this.selector === MB_IconGripper.selectors[0] ? '夹爪张开' : '夹爪闭合';
	}
	this.fixLayout();
	this.rerender();
};

const mbTextColorFor = BlockMorph.prototype.colorFor;
BlockMorph.prototype.colorFor = function (category) {
	if (!MB_IconBlocks.enabled()) return mbTextColorFor.call(this, category);
	if (this.selector === 'play tone') return new Color(233, 178, 220);
	if (typeof MB_IconCoCube !== 'undefined' && MB_IconCoCube.isMotion(this.selector)) return new Color(73, 183, 174);
	if (typeof MB_IconGripper !== 'undefined' && MB_IconGripper.selectors.includes(this.selector)) return new Color(131, 201, 107);
	if (typeof MB_IconColorMatrix !== 'undefined' && this.selector === MB_IconColorMatrix.selector) return new Color(130, 151, 221);
	if (typeof MB_IconDisplay !== 'undefined' && MB_IconDisplay.selectors.includes(this.selector)) return new Color(130, 151, 221);
	if (['whenStarted', 'whenButtonPressed', 'sendBroadcast', 'whenBroadcastReceived'].includes(this.selector)) {
		return new Color(255, 218, 101);
	}
	return {
		Output: new Color(124, 142, 226),
		Input: new Color(211, 139, 211),
		Pins: new Color(104, 187, 197),
		Comm: new Color(73, 183, 174),
		Control: new Color(255, 170, 38),
		Operators: new Color(104, 186, 93),
		Variables: new Color(239, 145, 79),
		Data: new Color(226, 133, 159),
		'My Blocks': new Color(91, 177, 231),
		Library: new Color(73, 183, 174),
		Obsolete: new Color(214, 77, 70)
	}[category] || new Color(91, 177, 231);
};

const mbTextTemplateCopy = BlockMorph.prototype.reactToTemplateCopy;
BlockMorph.prototype.reactToTemplateCopy = function () {
	mbTextTemplateCopy.call(this);
	if (!MB_IconBlocks.enabled()) return;
	const oldScale = this.scale;
	const icon = this.parts().find(part => part instanceof MB_IconMorph);
	const oldIconCenter = icon?.center();
	const hand = typeof world !== 'undefined' ? world.hand : null;
	const grab = hand?.morphToGrab?.isTemplate ? hand.grabPosition : null;
	if (typeof MB_Zoom !== 'undefined') MB_Zoom.resizeTree(this, SyntaxElementMorph.prototype.scale, oldScale);
	this.inputs().forEach(input => input.show());
	this.fixLayout();
	if (grab && icon) {
		// Keep the grabbed point relative to the icon under the finger, even when
		// a collapsed loop unfolds or a fixed-size palette copy changes scale.
		const offset = grab.subtract(oldIconCenter).multiplyBy(this.scale / oldScale);
		this.moveBy(grab.subtract(icon.center().add(offset)));
	}
	this.rerender();
};

const mbVerticalFixLayout = SyntaxElementMorph.prototype.fixLayout;
SyntaxElementMorph.prototype.fixLayout = function () {
	if (!MB_IconBlocks.enabled() || !(this instanceof CommandBlockMorph)) {
		return mbVerticalFixLayout.call(this);
	}
	// Do not propagate the temporary dimensions from the vertical text layout
	// to enclosing loops. Measure the complete command tree before positioning it.
	MB_IconBlocks.reflow(this);
};

const mbVerticalNextBlock = CommandBlockMorph.prototype.nextBlock;
CommandBlockMorph.prototype.nextBlock = function (block) {
	if (!block || !MB_IconBlocks.enabled()) return mbVerticalNextBlock.call(this, block);
	const next = this.nextBlock();
	this.add(block);
	if (next) block.bottomBlock().nextBlock(next);
	MB_IconBlocks.reflow(this);
};

const mbVerticalTopAttachPoint = CommandBlockMorph.prototype.topAttachPoint;
CommandBlockMorph.prototype.topAttachPoint = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalTopAttachPoint.call(this);
	return new Point(this.left(), this.top() + MB_IconBlocks.connectionCenterOffset(this));
};

const mbVerticalBottomAttachPoint = CommandBlockMorph.prototype.bottomAttachPoint;
CommandBlockMorph.prototype.bottomAttachPoint = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalBottomAttachPoint.call(this);
	return new Point(
		this.left() + MB_IconBlocks.connectionStep(this),
		this.top() + MB_IconBlocks.connectionCenterOffset(this)
	);
};

const mbVerticalSlotAttachPoint = CommandSlotMorph.prototype.slotAttachPoint;
CommandSlotMorph.prototype.slotAttachPoint = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalSlotAttachPoint.call(this);
	return new Point(
		this.left(),
		this.bottom() - (32 * this.scale)
	);
};

const mbVerticalWrapAttachPoint = CommandBlockMorph.prototype.wrapAttachPoint;
CommandBlockMorph.prototype.wrapAttachPoint = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalWrapAttachPoint.call(this);
	const slot = this.inputs().find(input => input instanceof CSlotMorph);
	return slot && !slot.nestedBlock() ? slot.slotAttachPoint() : null;
};

const mbVerticalAttachTargets = CommandBlockMorph.prototype.allAttachTargets;
CommandBlockMorph.prototype.allAttachTargets = function (newParent) {
	const targets = mbVerticalAttachTargets.call(this, newParent);
	if (!MB_IconBlocks.enabled()) return targets;
	// At equal distance an intentional connector insertion wins over wrapping
	// a deeper child. Both can coincide when dragging a loop into another loop.
	return targets.sort((a, b) => Number(a.loc === 'wrap') - Number(b.loc === 'wrap'));
};

const mbVerticalCSlotFixLayout = CSlotMorph.prototype.fixLayout;
CSlotMorph.prototype.fixLayout = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalCSlotFixLayout.call(this);
	MB_IconBlocks.reflow(this);
};

const mbVerticalCSlotHoles = CSlotMorph.prototype.fixHolesLayout;
CSlotMorph.prototype.fixHolesLayout = function () {
	if (!MB_IconBlocks.enabled()) return mbVerticalCSlotHoles.call(this);
	this.holes = [new Rectangle(0, 0, this.width(), this.height())];
};

const mbVerticalReactToGrab = SyntaxElementMorph.prototype.reactToGrabOf;
SyntaxElementMorph.prototype.reactToGrabOf = function (block) {
	if (!MB_IconBlocks.enabled()) return mbVerticalReactToGrab.call(this, block);
	MB_IconBlocks.reflow(this);
};

const mbVerticalOutlinePath = CommandBlockMorph.prototype.outlinePath;
CommandBlockMorph.prototype.outlinePath = function (ctx, inset) {
	if (!MB_IconBlocks.enabled()) return mbVerticalOutlinePath.call(this, ctx, inset);
	MB_IconBlocks.outline(this, ctx, inset);
};

const mbVerticalHatOutlinePath = HatBlockMorph.prototype.outlinePath;
HatBlockMorph.prototype.outlinePath = function (ctx, inset) {
	if (!MB_IconBlocks.enabled()) return mbVerticalHatOutlinePath.call(this, ctx, inset);
	MB_IconBlocks.outline(this, ctx, inset);
};

const mbTextBlockRender = BlockMorph.prototype.render;
BlockMorph.prototype.render = function (ctx) {
	const commandSlots = MB_IconBlocks.enabled() ? MB_IconBlocks.commandSlots(this) : [];
	if (!commandSlots.length || this.isTemplate) return mbTextBlockRender.call(this, ctx);

	// Morphic normally renders directly onto the world canvas. Use an even-odd
	// shell path: destination-out would erase the background and enclosing rails,
	// not just this block. The same path also works in cached images/drag shadows.
	const s = this.scale;
	const traceCavity = (slot) => {
		const x = slot.left() - this.left();
		const y = slot.top() - this.top();
		const right = x + slot.width();
		const rightJoin = right - (8 * s);
		const middle = MB_IconBlocks.connectionCenterOffset(this);
		const bottom = this.height() + (2 * s);
		const radius = 4 * s;

		ctx.moveTo(x, bottom);
		ctx.lineTo(x, middle + (18 * s));
		ctx.lineTo(x + (2 * s), middle + (14 * s));
		ctx.lineTo(x + (6 * s), middle + (10 * s));
		ctx.lineTo(x + (8 * s), middle + (6 * s));
		ctx.lineTo(x + (8 * s), middle - (6 * s));
		ctx.lineTo(x + (6 * s), middle - (10 * s));
		ctx.lineTo(x + (2 * s), middle - (14 * s));
		ctx.lineTo(x, middle - (18 * s));
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.lineTo(rightJoin - radius, y);
		ctx.quadraticCurveTo(rightJoin, y, rightJoin, y + radius);
		ctx.lineTo(rightJoin, middle - (18 * s));
		ctx.lineTo(rightJoin + (2 * s), middle - (14 * s));
		ctx.lineTo(right - (2 * s), middle - (10 * s));
		ctx.lineTo(right, middle - (6 * s));
		ctx.lineTo(right, middle + (6 * s));
		ctx.lineTo(right - (2 * s), middle + (10 * s));
		ctx.lineTo(rightJoin + (2 * s), middle + (14 * s));
		ctx.lineTo(rightJoin, middle + (18 * s));
		ctx.lineTo(rightJoin, bottom);
	};

	this.cachedClr = this.color.toString();
	this.cachedClrBright = this.bright();
	this.cachedClrDark = this.dark();
	const fillShell = (inset, color) => {
		ctx.fillStyle = color;
		ctx.save();
		// The open cavity extends beyond the bottom of the shell. Clip each
		// inset separately so even-odd fill cannot paint that exterior strip.
		ctx.beginPath();
		this.outlinePath(ctx, inset);
		ctx.closePath();
		ctx.clip();
		commandSlots.forEach(slot => {
			traceCavity(slot);
			ctx.closePath();
		});
		ctx.fill('evenodd');
		ctx.restore();
	};
	fillShell(0, this.cachedClrDark);
	fillShell(this.flatEdge, this.cachedClr);

	ctx.strokeStyle = this.color.darker(35).toString();
	ctx.lineWidth = 1.5 * s;
	commandSlots.forEach(slot => {
		ctx.beginPath();
		traceCavity(slot);
		ctx.stroke();
	});
};

const mbVerticalSnap = CommandBlockMorph.prototype.snap;
CommandBlockMorph.prototype.snap = function (hand) {
	if (!MB_IconBlocks.enabled()) return mbVerticalSnap.call(this, hand);
	// Remove the presentation-only gap before committing the real connection.
	this.parentThatIsA(ScriptsMorph)?.clearIconDropFeedback();

	const target = this.closestAttachTarget();
	if (target && target.loc === 'top' && target.type === 'block') {
		const scripts = this.parentThatIsA(ScriptsMorph);
		const last = this.bottomBlock();
		target.element.removeHighlight();
		this.moveBy(target.element.topAttachPoint().subtract(last.bottomAttachPoint()));
		last.nextBlock(target.element);
		this.fixBlockColor();
		if (this.snapSound) this.snapSound.play();
		if (scripts) scripts.changed();
		return;
	}
	return mbVerticalSnap.call(this, hand);
};

const mbVerticalDropFeedback = ScriptsMorph.prototype.showCommandDropFeedback;
ScriptsMorph.prototype.showCommandDropFeedback = function (block) {
	if (!MB_IconBlocks.enabled()) {
		this.clearIconDropFeedback();
		return mbVerticalDropFeedback.call(this, block);
	}

	const target = block.closestAttachTarget(this);
	if (!target) return this.clearIconDropFeedback();
	return this.showIconDropFeedback(block, target);
};

// A flat, translucent silhouette at the *landing* position, not a shadow offset
// from the pointer. Only command bodies are included: no icons, values or glow.
function MB_IconDropFeedbackMorph(preview) {
	Morph.call(this);
	this.cachedImage = preview.image;
	this.bounds.setExtent(preview.imageExtent);
	this.isCachingImage = true;
	this.shouldRerender = false;
	this.alpha = 0.24;
	this.offset = preview.offset;
	if (preview.layout) {
		this.layoutRoot = preview.layout.root;
		this.layoutOffset = preview.layout.offset;
		this.layoutMorph = new Morph();
		this.layoutMorph.cachedImage = preview.layout.image;
		this.layoutMorph.bounds.setExtent(preview.layout.extent);
		this.layoutMorph.isCachingImage = true;
		this.layoutMorph.shouldRerender = false;
	}
	this.holes = [new Rectangle(0, 0, this.width(), this.height())];
	this.acceptsDrops = false;
	this.isDraggable = false;
}
MB_IconDropFeedbackMorph.prototype = Object.create(Morph.prototype);
MB_IconDropFeedbackMorph.prototype.constructor = MB_IconDropFeedbackMorph;
MB_IconDropFeedbackMorph.prototype.topMorphAt = function () { return null; };
MB_IconDropFeedbackMorph.prototype.fullBounds = function () {
	// Repaint both the original and shifted tail on target changes/cancellation.
	return this.layoutMorph ? this.bounds.merge(this.layoutMorph.bounds).merge(this.layoutRoot.fullBounds()) : this.bounds;
};

const mbOriginalBlockFullDraw = BlockMorph.prototype.fullDrawOn;
BlockMorph.prototype.fullDrawOn = function (ctx, rect) {
	const feedback = this.parent instanceof ScriptsMorph ? this.parent.feedbackMorph : null;
	if (MB_IconBlocks.enabled() && feedback instanceof MB_IconDropFeedbackMorph &&
		feedback.parent && feedback.layoutRoot === this) {
		// Paint a detached, expanded layout in place of the original script. Its
		// program graph, positions, snap targets and saved coordinates stay intact.
		return feedback.layoutMorph.fullDrawOn(ctx, rect);
	}
	return mbOriginalBlockFullDraw.call(this, ctx, rect);
};

MB_IconBlocks.dropGeometryKey = function (root) {
	const geometry = [];
	root.forAllBlocks(block => {
		if (!(block instanceof CommandBlockMorph)) return;
		geometry.push(block.selector, block.scale, block.isTemplate,
			block.left() - root.left(), block.top() - root.top(), block.width(), block.height(),
			block.color.toString(), typeof MB_ExecutionHighlight !== 'undefined' &&
				MB_ExecutionHighlight.isEnabled() && MB_ExecutionHighlight.lit.has(block));
		this.commandSlots(block).forEach(slot => geometry.push(
			slot.left() - block.left(), slot.top() - block.top(), slot.width(), slot.height()));
	});
	return geometry.join(':');
};

MB_IconBlocks.dropPreview = function (block, target) {
	// Never snap, reparent, recolour or resize live blocks while hovering. Layout
	// detached copies, using the same recursive geometry as a completed drop.
	const copy = block.fullCopy();
	copy.removeShadow();
	copy.isTemplate = false;
	copy.fixLayout();
	const bodies = [];
	copy.forAllBlocks(child => {
		if (child instanceof CommandBlockMorph) bodies.push(child);
	});
	let anchor, layout;
	if (target.loc === 'bottom' && (target.type === 'slot' || target.element.nextBlock() ||
		target.element.parentThatIsA(CommandSlotMorph))) {
		// Lay out the *whole destination script*, not only the incoming shape.
		// Connecting the copies pushes the following commands to the right and
		// grows enclosing loop rails by exactly the space the real drop will use.
		// A loop's last child has no nextBlock, but its enclosing shell still
		// needs to make room (including every ancestor of a nested loop).
		const root = target.element.topBlock();
		const rootCopy = root.fullCopy();
		const syntax = m => m instanceof CommandBlockMorph || m instanceof CommandSlotMorph;
		const originals = root.allChildren().filter(syntax), copies = rootCopy.allChildren().filter(syntax);
		const destination = copies[originals.indexOf(target.element)];
		copies.forEach((item, i) => {
			if (item instanceof CommandBlockMorph) item.mbIconPreviewSource = originals[i];
		});
		if (target.type === 'slot') destination.nestedBlock(copy);
		else destination.nextBlock(copy);
		copy.fixBlockColor(); // same nested alternating colours as a committed snap
		anchor = copy.topAttachPoint();
		// Omit incoming icons/parameters/bodies from the coloured layout. Walk
		// their connections so the original tail still renders after the gap.
		bodies.forEach(body => {
			body.fullDrawOn = function (ctx, rect) {
				MB_IconBlocks.commandSlots(this).forEach(slot => slot.nestedBlock()?.fullDrawOn(ctx, rect));
				this.nextBlock()?.fullDrawOn(ctx, rect);
			};
		});
		const bounds = rootCopy.fullBounds();
		layout = {root, offset: bounds.origin.subtract(anchor),
			image: rootCopy.fullImage(), extent: bounds.extent()};
	}
	if (target.loc === 'wrap') {
		const slot = this.commandSlots(copy).find(slot => slot instanceof CSlotMorph && !slot.nestedBlock());
		if (!slot) return null;
		// The copied existing script expands the wrapper, but is NOT painted as
		// part of the incoming ghost. Its original colours stay visible on canvas.
		slot.nestedBlock(target.element.fullCopy());
		anchor = target.element.parent instanceof CommandBlockMorph ||
			target.element.parent instanceof CommandSlotMorph
			? copy.topAttachPoint() : slot.slotAttachPoint();
	} else if (!anchor) {
		anchor = target.loc === 'top' ? copy.bottomBlock().bottomAttachPoint() : copy.topAttachPoint();
	}
	const bounds = bodies.reduce((result, child) => result.merge(child.bounds), copy.bounds.copy());
	const imageExtent = new Point(Math.ceil(bounds.width()), Math.ceil(bounds.height()));
	const image = newCanvas(imageExtent);
	const ctx = image.getContext('2d');
	for (const child of bodies) {
		ctx.save();
		ctx.translate(child.left() - bounds.left(), child.top() - bounds.top());
		ctx.beginPath();
		ctx.rect(0, 0, child.width(), child.height());
		ctx.clip();
		child.render(ctx);
		ctx.restore();
	}
	// Recolour a separate mask canvas. Its transparent loop cavities remain
	// transparent; compositing must never erase pixels from the world canvas.
	ctx.globalCompositeOperation = 'source-in';
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, imageExtent.x, imageExtent.y);
	return { image, imageExtent, offset: bounds.origin.subtract(anchor), layout };
};

ScriptsMorph.prototype.clearIconDropFeedback = function () {
	if (!(this.feedbackMorph instanceof MB_IconDropFeedbackMorph)) return;
	this.feedbackMorph.destroy();
	this.feedbackMorph.parent = null;
	this.feedbackMorph = new BoxMorph();
};

ScriptsMorph.prototype.showIconDropFeedback = function (block, target) {
	const key = MB_IconBlocks.dropGeometryKey(block) + '|' +
		MB_IconBlocks.dropGeometryKey(target.element.topBlock());
	let feedback = this.feedbackMorph;
	if (!(feedback instanceof MB_IconDropFeedbackMorph) || feedback.source !== block ||
		feedback.target !== target.element || feedback.targetParent !== target.element.parent ||
		feedback.loc !== target.loc || feedback.geometryKey !== key) {
		const preview = MB_IconBlocks.dropPreview(block, target);
		if (!preview) return this.clearIconDropFeedback();
		this.feedbackMorph.destroy();
		this.feedbackMorph.parent = null;
		feedback = new MB_IconDropFeedbackMorph(preview);
		Object.assign(feedback, { source: block, target: target.element,
			targetParent: target.element.parent, loc: target.loc, geometryKey: key });
		this.feedbackMorph = feedback;
	}
	feedback.fullChanged();
	feedback.setPosition(target.point.add(feedback.offset));
	if (feedback.layoutMorph) feedback.layoutMorph.setPosition(target.point.add(feedback.layoutOffset));
	this.add(feedback);
	feedback.fullChanged();
	return feedback;
};

const mbOriginalWrapFeedback = ScriptsMorph.prototype.showCSlotWrapFeedback;
ScriptsMorph.prototype.showCSlotWrapFeedback = function (block, target) {
	if (!MB_IconBlocks.enabled()) {
		this.clearIconDropFeedback();
		return mbOriginalWrapFeedback.call(this, block, target);
	}
	return this.showIconDropFeedback(block, {
		element: target, point: target.topAttachPoint(), loc: 'wrap', type: 'block'
	});
};

const mbOriginalReporterFeedback = ScriptsMorph.prototype.showReporterDropFeedback;
ScriptsMorph.prototype.showReporterDropFeedback = function (block, hand) {
	this.clearIconDropFeedback();
	return mbOriginalReporterFeedback.call(this, block, hand);
};

const mbOriginalFeedbackStep = ScriptsMorph.prototype.step;
ScriptsMorph.prototype.step = function () {
	const result = mbOriginalFeedbackStep.call(this);
	// The original step removes feedback on drop, cancellation, leaving the
	// canvas or hovering without a target. Release cached source references too.
	if (!this.feedbackMorph.parent) this.clearIconDropFeedback();
	return result;
};
