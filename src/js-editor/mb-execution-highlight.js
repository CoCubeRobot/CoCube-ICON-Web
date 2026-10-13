// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// ICON execution feedback. Positions come from commands executed by the VM,
// never from a browser-side simulation of the user's program. The existing
// sayIt protocol works without a firmware update (at some tracing overhead).
const MB_ExecutionHighlight = {
	enabled: true,
	session: Math.random().toString(36).slice(2, 8),
	serial: 0,
	project: null,
	owners: new WeakMap(),
	records: new Map(),
	tasks: new Map(),
	activeTasks: new Set(),
	lit: new Set(),
	stackColor: new Color(255, 216, 55),

	isEnabled() {
		return this.enabled && MB_IconBlocks.enabled();
	},

	isAction(block) {
		return block instanceof CommandBlockMorph && !(block instanceof HatBlockMorph) &&
			!block.isTemplate && !MB_IconBlocks.commandSlots(block).length &&
			!['if', 'forever', 'repeat', 'repeatUntil', 'for', 'exitLoop', 'return',
				'stopTask', 'stopAll', 'stopAllScripts', 'halt', 'noop', 'ignoreArgs', 'comment'].includes(block.selector);
	},

	isOnCanvas(root) {
		// removeChild may leave a stale parent pointer in Morphic.
		return root.parent instanceof ScriptsMorph && root.parent.children.includes(root);
	},

	beginCompilation(owner, project) {
		if (!this.isEnabled()) return null;
		if (project !== this.project) {
			this.clearAll();
			this.project = project;
			this.owners = new WeakMap();
			this.records.clear();
		}
		const block = owner instanceof MB_Function ? owner.cmdList : owner;
		if (!(block instanceof BlockMorph) || !block.parentThatIsA(ScriptsMorph)) return null;
		const root = block.topBlock();
		if (!this.isOnCanvas(root)) return null;
		const source = root.codeString();
		let record = this.owners.get(root);
		if (!record || record.source !== source) {
			if (record) for (const token of record.tokens.values()) this.records.delete(token);
			record = { root, source, project, tokens: new Map() };
			this.owners.set(root, record);
		}
		return record;
	},

	markerFor(record, block) {
		let token = record.tokens.get(block);
		if (!token) {
			token = (++this.serial).toString(36);
			record.tokens.set(block, token);
			this.records.set(token, { block, owner: record });
		}
		return '~mbi:' + this.session + ':' + token;
	},

	endMarker() {
		return '~mbi:' + this.session + ':-';
	},

	isCurrent(record) {
		return record && record.owner.project === MB_editor.project &&
			this.isOnCanvas(record.owner.root) &&
			record.block.topBlock() === record.owner.root &&
			record.owner.root.codeString() === record.owner.source;
	},

	consumeOutput(chunkID, value) {
		// Swallow old-session markers too: board readback/reconnection must never
		// expose internal tracing strings as user "say" bubbles.
		const match = typeof value === 'string' && /^~mbi:([a-z0-9]+):([a-z0-9]+|-)$/.exec(value);
		if (!match) return false;
		if (!this.isEnabled() || match[1] !== this.session || !this.activeTasks.has(chunkID)) return true;
		let task = this.tasks.get(chunkID);
		if (match[2] === '-') {
			if (!task) return true;
			task.stack.pop();
			if (task.stack.length) {
				task.block = task.stack[task.stack.length - 1];
				this.refresh();
			} else {
				// Keep very short, genuinely executed actions visible for one brief
				// pulse. A new action immediately replaces it; no replay queue.
				task.timer = setTimeout(() => this.clearTask(chunkID), Math.max(0, 60 - (Date.now() - task.since)));
			}
			return true;
		}
		const record = this.records.get(match[2]);
		if (!this.isCurrent(record)) {
			this.clearTask(chunkID);
			return true;
		}
		if (!task) {
			task = { stack: [], timer: null };
			this.tasks.set(chunkID, task);
		}
		clearTimeout(task.timer);
		task.stack.push(record.block);
		task.block = record.block;
		task.since = Date.now();
		this.refresh();
		return true;
	},

	refresh() {
		const next = new Set(Array.from(this.tasks.values(), task => task.block));
		const changed = new Set([...this.lit, ...next]);
		const previous = this.lit;
		this.lit = next;
		for (const block of changed) {
			if (previous.has(block) !== next.has(block)) block.rerender();
		}
	},

	clearTask(chunkID) {
		const task = this.tasks.get(chunkID);
		if (task) clearTimeout(task.timer);
		this.tasks.delete(chunkID);
		this.refresh();
	},

	setRunning(chunkID, running) {
		this.clearTask(chunkID);
		if (running) this.activeTasks.add(chunkID);
		else this.activeTasks.delete(chunkID);
	},

	clearAll(stopped = true) {
		for (const task of this.tasks.values()) clearTimeout(task.timer);
		this.tasks.clear();
		if (stopped) this.activeTasks.clear();
		this.refresh();
	}
};

// Whole-script state comes from taskStarted/taskDone, not execution markers.
// Keep it visible during loops, library calls and waits between short actions.
// Reuse Morphic's cached, untouchable highlight child so layout changes and
// zoom rebuild its outline, and stopping/copying uses the existing cleanup.
const mbPlainStackHighlight = BlockMorph.prototype.highlight;
BlockMorph.prototype.highlight = function (color, blur, border) {
	if (!MB_IconBlocks.enabled() || this.isTemplate ||
		!(color.eq(this.activeHighlight) || color.eq(MB_ExecutionHighlight.stackColor))) {
		return mbPlainStackHighlight.call(this, color, blur, border);
	}
	color = MB_ExecutionHighlight.stackColor;
	const bounds = this.fullBounds(), edge = Math.ceil(14 * this.scale);
	const rim = Math.max(1, Math.round(2 * this.scale));
	const image = this.highlightImageBlurred(color, edge);
	const ctx = image.getContext('2d');
	ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .5;
	ctx.drawImage(this.highlightImage(color, rim), edge - rim, edge - rim);
	ctx.restore();
	const halo = new BlockHighlightMorph();
	halo.bounds.setExtent(bounds.extent().add(edge * 2));
	halo.holes = [halo.bounds]; // pointer events pass through the glow
	halo.color = color;
	halo.cachedImage = image;
	halo.setPosition(bounds.origin.subtract(new Point(edge, edge)));
	return halo;
};

const mbUnlitIconRender = BlockMorph.prototype.render;
BlockMorph.prototype.render = function (ctx) {
	// A detached insertion preview follows its real block's execution state;
	// it is never registered as another running command or persisted in a file.
	const source = this.mbIconPreviewSource || this;
	if (!MB_ExecutionHighlight.isEnabled() || !MB_ExecutionHighlight.lit.has(source) ||
		!MB_ExecutionHighlight.isAction(source)) return mbUnlitIconRender.call(this, ctx);
	const base = this.color;
	try {
		this.color = base.lighter(55);
		return mbUnlitIconRender.call(this, ctx);
	} finally {
		this.color = base; // Do not save/copy the execution tint as a block's colour.
	}
};
