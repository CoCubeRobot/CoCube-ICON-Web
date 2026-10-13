// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Resize the existing morph tree, not the program. Block identity is important
// for live execution markers, undo records, function definitions and chunk IDs.
const MB_Zoom = {
	levels: [50, 75, 100, 125, 150, 200, 250],
	percent() { return Math.round(SyntaxElementMorph.prototype.scale * 100); },

	change(editor, action, value) {
		const current = this.percent();
		if (action === 'scripts.zoomIn') value = this.levels.find(n => n > current) || 250;
		if (action === 'scripts.zoomOut') value = this.levels.slice().reverse().find(n => n < current) || 50;
		if (action === 'scripts.restoreZoom') value = 100;
		this.set(editor, Number(value));
	},

	restorePreference(editor) {
		let percent = 100;
		try { percent = Number(IDE.userPreference('blockSizePercent')) || 100; } catch (_) { /* no chrome */ }
		this.set(editor, percent);
	},

	resizeTree(root, scale, oldScale = root.scale) {
		const ratio = scale / oldScale, origin = root.position();
		const parts = root.allChildren();
		const layingOut = MB_IconBlocks.isLayingOut;
		MB_IconBlocks.isLayingOut = true;
		try {
			// Pin *all* geometry metrics, not just `scale`, on each syntax element.
			// Palette templates therefore stay at 100% even when the shared defaults
			// change for newly parsed canvas blocks. Copies can then be resized safely.
			parts.forEach(part => {
				if (part instanceof SyntaxElementMorph) SyntaxElementMorph.prototype.setScale.call(part, scale);
			});
			for (const part of parts.reverse()) {
				if (part instanceof MB_IconMorph) {
					part.scale = scale;
					part.setExtent(part.extent().multiplyBy(ratio));
				} else if (part instanceof StringMorph || part instanceof TextMorph) {
					part.setFontSize(part.fontSize * ratio);
				} else if (part instanceof SyntaxElementMorph) part.fixLayout();
				part.rerender();
			}
		} finally { MB_IconBlocks.isLayingOut = layingOut; }
		root.fixLayout();
		root.setPosition(origin);
	},

	set(editor, percent) {
		if (!Number.isFinite(percent) || !editor.scripts || world.hand?.children.length) return;
		percent = Math.max(50, Math.min(250, Math.round(percent)));
		const scale = percent / 100, oldScale = SyntaxElementMorph.prototype.scale;
		if (scale !== oldScale) {
			MB_IconInputs.close();
			world.stopEditing?.();
			const pane = editor.scripts, origin = pane.position(), ratio = scale / oldScale;
			const roots = pane.children.filter(m => m instanceof BlockMorph);
			const positions = roots.map(root => root.position().subtract(origin).multiplyBy(ratio));
			pane.fullChanged();
			SyntaxElementMorph.prototype.setScale(scale);
			roots.forEach((root, i) => {
				this.resizeTree(root, scale, oldScale);
				root.setPosition(origin.add(positions[i]));
			});
			// ICON frame dimensions are independent of block scale. Relaying out a
			// ScrollFrame, even at the same size, can reset its content position.
			if (!editor.iconLayout) editor.fixLayout();
			pane.adjustBounds(); pane.fullChanged();
			if (!editor.iconLayout) editor.updatePalette();
			// The ICON shelf is neither resized nor rebuilt, preserving its scroll
			// position, template identities and cached images throughout zooming.
			// No scriptChanged or board sync: only presentation has changed.
		}
		try {
			IDE.setUserPreference('blockSizePercent', percent);
			IDE.recreateScriptControls();
		} catch (_) { /* private browsing or standalone test page */ }
	}
};
