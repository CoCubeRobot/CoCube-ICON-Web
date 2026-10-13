// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* global MB_IconBlocks, HandMorph, BlockMorph, CommandBlockMorph,
SyntaxElementMorph, ScriptsMorph */

// Original, short plastic-click sounds. No downloaded assets or network requests.
const MB_UISounds = {
	enabled: true,
	context: null,
	output: null,
	buffers: new Map(),
	voices: new Set(),

	active() { return this.enabled && MB_IconBlocks.enabled(); },

	prepare() {
		if (!this.active()) return null;
		try {
			if (!this.context || this.context.state === 'closed') {
				const AudioContext = window.AudioContext || window.webkitAudioContext;
				if (!AudioContext) return null;
				this.context = new AudioContext({ latencyHint: 'interactive' });
				this.output = this.context.createGain();
				this.output.gain.value = 0.38;
				this.output.connect(this.context.destination);
				this.buffers.clear();
				this.voices.clear();
			}
			if (this.context.state === 'suspended' || this.context.state === 'interrupted') {
				// Called from a pointer/keyboard gesture. Do not queue sounds to play
				// later if the browser has paused or blocked audio.
				this.context.resume().catch(() => {});
			}
			return this.context;
		} catch (_) {
			return null; // Audio is optional; editing must always keep working.
		}
	},

	samples(kind, sampleRate) {
		if (kind === 'delete') {
			// A soft falling object followed by a short, hollow bin/lid rattle.
			// Synthesised locally; intentionally distinct from the two snap clicks.
			const duration = 0.23, result = new Float32Array(Math.ceil(duration * sampleRate));
			let seed = 0x54524153, previous = 0;
			for (let i = 0; i < result.length; i++) {
				const t = i / sampleRate;
				seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
				const noise = seed / 0x80000000 - 1;
				const fall = 0.16 * Math.sin(2 * Math.PI * (650 * t - 1600 * t * t)) * Math.exp(-t / .03);
				const hitTime = Math.max(0, t - .055);
				const hit = t < .055 ? 0 : Math.min(1, hitTime / .002) * (
					0.28 * Math.sin(2 * Math.PI * 185 * hitTime) * Math.exp(-hitTime / .032) +
					0.13 * (noise - previous) * Math.exp(-hitTime / .017));
				const lidTime = Math.max(0, t - .12);
				const lid = t < .12 ? 0 : Math.min(1, lidTime / .001) * .13 *
					Math.sin(2 * Math.PI * 1150 * lidTime) * Math.exp(-lidTime / .012);
				result[i] = (fall + hit + lid) * Math.min(1, t / .001, (duration - t) / .012);
				previous = noise;
			}
			return result;
		}
		const joining = kind === 'connect';
		const duration = joining ? 0.055 : 0.085;
		const samples = new Float32Array(Math.ceil(sampleRate * duration));
		const pulses = joining ? [[0, 1], [0.009, 0.3]] : [[0, 0.7], [0.026, 0.5]];
		const frequency = joining ? 1550 : 920;
		let seed = 0x4d425549;
		for (const [delay, level] of pulses) {
			let previousNoise = 0;
			for (let i = Math.round(delay * sampleRate); i < samples.length; i++) {
				const t = i / sampleRate - delay;
				if (t < 0) continue;
				seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
				const noise = seed / 0x80000000 - 1;
				const transient = (noise - previousNoise) * Math.exp(-t / 0.0035);
				previousNoise = noise;
				const ring = (Math.sin(2 * Math.PI * frequency * t)
					+ 0.45 * Math.sin(2 * Math.PI * frequency * 2.37 * t)) * Math.exp(-t / 0.009);
				const attack = Math.min(1, t / 0.0007);
				const release = Math.min(1, (duration - i / sampleRate) / 0.005);
				samples[i] += level * attack * release * (0.25 * transient + 0.32 * ring);
			}
		}
		return samples;
	},

	play(kind) {
		if (!this.active() || !['connect', 'disconnect', 'delete'].includes(kind)) return;
		try {
			const context = this.prepare();
			if (!context || context.state !== 'running' || this.voices.size >= 8) return;
			if (!this.buffers.has(kind)) {
				const samples = this.samples(kind, context.sampleRate);
				const buffer = context.createBuffer(1, samples.length, context.sampleRate);
				buffer.getChannelData(0).set(samples);
				this.buffers.set(kind, buffer);
			}
			const source = context.createBufferSource();
			source.buffer = this.buffers.get(kind);
			source.connect(this.output);
			source.onended = () => { source.disconnect(); this.voices.delete(source); };
			source.start();
			this.voices.add(source);
		} catch (_) {
			// Missing devices and browser autoplay restrictions must not break a drop.
		}
	},

	stopPitch() {
		try { this.previewVoice?.stop(); } catch (_) { /* already stopped */ }
		this.previewVoice = null;
	},

	playPitch(frequency) {
		// Audition only after a piano gesture; programs still run on the board.
		if (!Number.isFinite(frequency) || frequency < 16 || frequency > 10000) return;
		try {
			const context = this.prepare();
			if (!context || context.state !== 'running') return;
			this.stopPitch();
			if (this.voices.size >= 8) return;
			const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) {
				const t = i / context.sampleRate;
				const triangle = 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * frequency * t));
				data[i] = .3 * triangle * Math.min(1, t / .008, (1 - t) / .04);
			}
			const source = context.createBufferSource();
			source.buffer = buffer; source.connect(this.output);
			source.onended = () => {
				source.disconnect(); this.voices.delete(source);
				if (this.previewVoice === source) this.previewVoice = null;
			};
			source.start(); this.voices.add(source); this.previewVoice = source;
		} catch (_) { /* optional audition must never prevent note selection */ }
	}
};

// Unlock audio at the start of an editor gesture, before the drag threshold.
for (const event of ['pointerdown', 'keydown']) {
	document.addEventListener(event, e => {
		if (e.target?.id === 'world-canvas') MB_UISounds.prepare();
	}, { capture: true, passive: true });
}

const mbGrabWithoutClick = HandMorph.prototype.grab;
HandMorph.prototype.grab = function (block) {
	const oldParent = block?.parent;
	const separating = MB_UISounds.active() && block instanceof BlockMorph && !block.isTemplate &&
		(oldParent instanceof SyntaxElementMorph ||
			(this.world.currentKey === 16 && block instanceof CommandBlockMorph && block.nextBlock()));
	const result = mbGrabWithoutClick.call(this, block);
	// Test after the grab: a rejected grab, palette copy, or whole-script move
	// must not sound like a connection breaking. Deleting/relayout never calls this.
	if (separating && block.parent === this && oldParent !== this) MB_UISounds.play('disconnect');
	return result;
};

const mbDropWithoutClick = ScriptsMorph.prototype.reactToDropOf;
ScriptsMorph.prototype.reactToDropOf = function (block, hand) {
	if (!hand || !MB_UISounds.active() || !(block instanceof BlockMorph)) {
		return mbDropWithoutClick.call(this, block, hand);
	}
	const oldParent = block.parent;
	const tail = block instanceof CommandBlockMorph ? block.bottomBlock() : null;
	const slots = MB_IconBlocks.commandSlots(block);
	const bodies = slots.map(slot => slot.nestedBlock());
	const ownSound = Object.getOwnPropertyDescriptor(block, 'snapSound');
	block.snapSound = null; // Suppress the older optional one-sound feedback.
	let result;
	try {
		result = mbDropWithoutClick.call(this, block, hand);
	} finally {
		if (ownSound) Object.defineProperty(block, 'snapSound', ownSound);
		else delete block.snapSound;
	}
	// Appending/inserting, snapping before a script, or wrapping a script in a
	// loop each changes a different edge. Count the completed gesture only once.
	if (block.parent !== oldParent || tail?.nextBlock() ||
		slots.some((slot, i) => slot.nestedBlock() !== bodies[i])) {
		MB_UISounds.play('connect');
	}
	return result;
};
