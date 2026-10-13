// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// One child-facing tile backed by the existing, portable Tone library. No new
// firmware opcode, hidden browser playback of programs, or rewritten old notes.
const MB_IconMusic = {
	source: null,
	loading: null,
	pending: new WeakSet(),
	failed: new WeakSet(),
	minOctave: -2,
	maxOctave: 3,
	// Display common enharmonic names while retaining the Tone library's
	// existing note values, so old files, device playback and pitches are unchanged.
	notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((pitch, index) => ({
		label: ({'D#': 'Eb', 'A#': 'Bb'})[pitch] || pitch, index, value: 'nt;' + pitch.toLowerCase()
	})),

	ensureLibrary(editor) {
		const project = editor.project;
		if (project.functionNamed('play tone')) return true; // preserve a project's existing Tone version
		if (this.failed.has(project)) return false;
		if (this.source) {
			project.addLibraryFromString(this.source, 'Tone', '//Libraries/Tone.ubl');
			return !!project.functionNamed('play tone');
		}
		if (this.pending.has(project) || typeof MB_Files === 'undefined') return false;
		this.pending.add(project);
		if (!this.loading) {
			this.loading = MB_Files.readFile('Libraries/Tone.ubl').then(source => {
				if (!source || !source.startsWith('module Tone')) throw new Error('Tone library is missing');
				this.source = source;
				return source;
			}).finally(() => { this.loading = null; });
		}
		this.loading.then(() => {
			// Opening a different project while the file is loading must not import
			// into the old project or overwrite libraries in the new one.
			if (editor.project !== project || !editor.iconLayout) return;
			editor.updatePalette();
		}).catch(error => {
			this.failed.add(project);
			if (editor.project === project) editor.inform('无法加载蜂鸣器积木，请确认 Libraries/Tone.ubl 文件存在后刷新页面。');
			console.warn('ICON music:', error);
		}).finally(() => this.pending.delete(project));
		return false;
	},

	configure(block) {
		const inputs = block.inputs();
		if (inputs.length !== 3 || !inputs.every(input => input instanceof InputSlotMorph)) return;
		inputs[0].mbIconParameter = 'note';
		Object.setPrototypeOf(inputs[0], MB_IconParameterSlotMorph.prototype);
		// Keep the real octave/duration arguments for compiler, save and readback.
		// Only the note's chevron is on the canvas; octave lives in its piano panel.
		inputs[1].mbIconHiddenParameter = inputs[2].mbIconHiddenParameter = true;
		inputs[0].fixLayout();
	},

	noteFor(value) {
		const label = String(value).replace(/^nt;/i, '').toUpperCase();
		return this.notes.find(note => note.value.slice(3).toUpperCase() === label || note.label.toUpperCase() === label);
	},

	octave(block) {
		const value = Number(block.inputs()[1]?.evaluate());
		return Number.isFinite(value) ? value : 0;
	},

	setOctave(block, value) {
		if (!Number.isFinite(value)) return false;
		const slot = block.inputs()[1];
		const octave = Math.max(this.minOctave, Math.min(this.maxOctave, Math.round(value)));
		if (slot.evaluate() !== octave) { slot.setContents(octave); slot.scriptChanged(); }
		return true;
	},

	preview(block) {
		const note = this.noteFor(block.inputs()[0].evaluate());
		if (note && typeof MB_UISounds !== 'undefined') {
			const frequency = 440 * Math.pow(2, (note.index - 9 + 12 * this.octave(block)) / 12);
			MB_UISounds.playPitch(frequency);
		}
	},

	drawIcon(ctx, block, scale) {
		const note = this.noteFor(block.inputs()[0]?.evaluate());
		ctx.save(); ctx.scale(scale, scale);
		const ink = MB_IconStyle.ink.music;
		MB_IconStyle.outline(ctx, ink);
		// Draw the music note and keyboard as vectors, independent of installed fonts.
		ctx.fillStyle = '#b67aaa';
		ctx.beginPath(); ctx.ellipse(-16, -15, 4, 3, -.4, 0, Math.PI * 2); ctx.fill();
		ctx.fillRect(-14, -25, 2, 10);
		ctx.beginPath(); ctx.moveTo(-12, -25); ctx.lineTo(-6, -23); ctx.lineTo(-6, -18); ctx.lineTo(-12, -20); ctx.fill();
		ctx.fillStyle = '#fff';
		MB_IconInputs.roundRect(ctx, -23, -13, 44, 34, 3); ctx.fill(); ctx.stroke();
		// Three white keys and two black keys on the tile only. The interactive
		// picker still exposes all twelve pitches and the full octave range.
		for (let i = 1; i < 3; i++) {
			const x = -23 + i * 44 / 3;
			ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, 20); ctx.stroke();
		}
		ctx.fillStyle = ink;
		for (const i of [1, 2]) {
			MB_IconInputs.roundRect(ctx, -23 + i * 44 / 3 - 4, -12, 8, 19, 1.5); ctx.fill();
		}
		ctx.beginPath(); ctx.arc(16, 15, 9.5, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = '#714768'; ctx.stroke();
		ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.font = 'bold ' + (note?.label.length > 1 ? 10 : 14) + 'px Arial, sans-serif';
		ctx.fillText(note?.label || '?', 16, 16);
		ctx.restore();
	},

	buildPicker(panel, slot) {
		const block = slot.parentThatIsA(BlockMorph);
		panel.classList.add('--piano');
		panel.setAttribute('aria-label', '蜂鸣器：选择音符和音阶');
		const keyboard = document.createElement('div');
		keyboard.className = 'icon-piano-keyboard';
		keyboard.setAttribute('role', 'group'); keyboard.setAttribute('aria-label', '钢琴键盘');
		const keys = [], whiteNotes = [0, 2, 4, 5, 7, 9, 11];
		for (const note of this.notes) {
			const key = document.createElement('button'); key.type = 'button';
			const white = whiteNotes.indexOf(note.index);
			key.className = 'icon-piano-key ' + (white < 0 ? '--black' : '--white');
			key.setAttribute('aria-label', note.label);
			key.style.left = (white < 0 ? (whiteNotes.indexOf(note.index - 1) + 1) * 100 / 7 - 4 : white * 100 / 7) + '%';
			const label = document.createElement('span'); label.textContent = note.label;
			key.appendChild(label);
			key.onclick = () => { MB_IconInputs.select(slot, note.value); refresh(); this.preview(block); };
			keyboard.appendChild(key); keys.push([key, note]);
		}
		const footer = document.createElement('div'); footer.className = 'icon-piano-octave';
		const label = document.createElement('span'); label.textContent = '音阶';
		label.title = '0 为中音区，负数更低，正数更高';
		const minus = document.createElement('button'), plus = document.createElement('button');
		minus.type = plus.type = 'button'; minus.textContent = '−'; plus.textContent = '+';
		minus.setAttribute('aria-label', '降低音阶'); plus.setAttribute('aria-label', '升高音阶');
		const value = document.createElement('output'); value.setAttribute('aria-label', '音阶'); value.setAttribute('aria-live', 'polite');
		const refresh = () => {
			const current = this.noteFor(slot.evaluate());
			keys.forEach(([key, note]) => key.setAttribute('aria-pressed', String(current?.index === note.index)));
			const octave = this.octave(block);
			value.textContent = octave > 0 ? '+' + octave : String(octave);
			minus.disabled = octave <= this.minOctave; plus.disabled = octave >= this.maxOctave;
		};
		minus.onclick = () => { this.setOctave(block, this.octave(block) - 1); refresh(); this.preview(block); };
		plus.onclick = () => { this.setOctave(block, this.octave(block) + 1); refresh(); this.preview(block); };
		footer.append(label, minus, value, plus);
		panel.append(keyboard, footer); refresh();
	}
};
