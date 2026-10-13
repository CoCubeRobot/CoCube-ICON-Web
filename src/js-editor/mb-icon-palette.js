// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// The shelf is still a real Morphic scroll/drop surface, clipped to a floating
// card. No DOM overlay intercepts dragging, horizontal scrolling or deletion.
class MB_IconPaletteMorph extends ScrollFrameMorph {
	constructor() {
		super(null, 7, new Color(188, 192, 203));
		this.color = new Color(255, 255, 255);
		this.contents.color = this.color;
		this.contents.render = () => {}; // never paint a rectangular backing
		this.hBar.color = new Color(240, 241, 245);
		this.acceptsDrops = true;
	}

	cardPath(ctx) {
		const radius = Math.min(12, this.width() / 2, this.height() / 2);
		MB_IconInputs.roundRect(ctx, this.left(), this.top(), this.width(), this.height(), radius);
	}

	fullBounds() { return this.bounds.expandBy(10); }

	fullDrawOn(ctx, rect) {
		if (!this.isVisible || !this.fullBounds().intersects(rect)) return;
		ctx.save();
		ctx.beginPath(); ctx.rect(rect.left(), rect.top(), rect.width(), rect.height()); ctx.clip();
		this.cardPath(ctx);
		ctx.shadowColor = 'rgba(42, 51, 72, .16)';
		ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
		ctx.fillStyle = '#fff'; ctx.fill();
		ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
		ctx.strokeStyle = '#e0e3eb'; ctx.lineWidth = 1; ctx.stroke();
		this.cardPath(ctx); ctx.clip();
		const clipped = this.bounds.intersect(rect);
		this.children.forEach(child => child.fullDrawOn(ctx, clipped));
		ctx.restore();
	}

	topMorphAt(point) {
		// Transparent card corners must behave like the canvas beneath them.
		const radius = Math.min(12, this.width() / 2, this.height() / 2);
		const x = Math.max(this.left() + radius, Math.min(point.x, this.right() - radius));
		const y = Math.max(this.top() + radius, Math.min(point.y, this.bottom() - radius));
		if (point.distanceTo(new Point(x, y)) > radius) return null;
		return super.topMorphAt(point);
	}
}
