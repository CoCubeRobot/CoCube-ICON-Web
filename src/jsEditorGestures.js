export function classifyShelfGesture(dx, dy, threshold = 12) {
    if (Math.hypot(dx, dy) < threshold) return 'pending';
    // Upward pickup includes diagonals >= roughly 20 degrees above horizontal.
    // Leave an undecided band instead of eagerly locking a shallow diagonal.
    if (dy <= -threshold && -dy >= Math.abs(dx) * 0.36) return 'drag';
    // Respond promptly to clearly horizontal travel, retaining the diagonal band.
    if (Math.abs(dx) >= threshold && Math.abs(dx) >= Math.abs(dy) * 3 && dy >= -threshold / 2) return 'scroll';
    return 'pending';
}

export function installShelfGestures({ canvas, getEditor, getWorld, onTap }) {
    let gesture;
    const touch = event => event.touches[0] || event.changedTouches[0];
    const blockAt = (palette, point) => {
        let morph = palette.topMorphAt(point);
        while (morph && !morph.isTemplate) morph = morph.parent;
        return morph?.isTemplate ? morph : null;
    };
    const takeBlock = () => {
        if (!gesture?.block) return;
        const hand = getWorld().hand;
        const copy = gesture.block.fullCopy();
        copy.isTemplate = false;
        copy.isDraggable = true;
        copy.reactToTemplateCopy?.();
        hand.setPosition(gesture.start);
        hand.grab(copy);
        hand.grabOrigin = gesture.block.situation();
        gesture.kind = 'drag';
        canvas.classList.add('cocube-taking-block');
    };
    canvas.addEventListener('touchstart', event => {
        const editor = getEditor(), world = getWorld();
        if (!editor?.iconLayout || !world || gesture || editor.interactionBlocked?.()) return;
        const t = touch(event), point = new Point(t.pageX, t.pageY);
        if (!editor.palette.bounds.containsPoint(point)) return;
        world.stopEditing();
        if (document.activeElement?.matches('input, textarea')) document.activeElement.blur();
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.touches.length !== 1) return;
        gesture = { start: point, last: point, scrollLast: point, kind: 'pending', block: blockAt(editor.palette, point), startedAt: performance.now(), maxDistance: 0 };
        gesture.timer = setTimeout(takeBlock, 320);
    }, { capture: true, passive: false });
    canvas.addEventListener('touchmove', event => {
        if (!gesture) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.touches.length !== 1) { clearTimeout(gesture.timer); gesture.kind = 'cancelled'; return; }
        const t = touch(event), point = new Point(t.pageX, t.pageY);
        gesture.maxDistance = Math.max(gesture.maxDistance, point.distanceTo(gesture.start));
        if (gesture.kind === 'pending') {
            const kind = classifyShelfGesture(point.x - gesture.start.x, point.y - gesture.start.y);
            if (kind !== 'pending') {
                clearTimeout(gesture.timer);
                if (kind === 'drag') takeBlock(); else gesture.kind = 'scroll';
            } else if (point.distanceTo(gesture.start) > 8) clearTimeout(gesture.timer);
        }
        // A child may start horizontally then turn towards the canvas. Once
        // clearly upward, allow pickup; a picked-up block never becomes scrolling.
        if (gesture.kind === 'scroll' && gesture.block &&
            classifyShelfGesture(point.x - gesture.start.x, point.y - gesture.start.y, 24) === 'drag') {
            takeBlock();
        }
        if (gesture.kind === 'scroll') {
            const palette = getEditor().palette;
            // Include movement accumulated while deciding the gesture. Dropping
            // that distance makes the shelf trail behind the finger throughout.
            palette.scrollX(point.x - gesture.scrollLast.x);
            gesture.scrollLast = point;
            palette.adjustScrollBars();
        } else if (gesture.kind === 'drag') getWorld().hand.processMouseMove(t);
        gesture.last = point;
    }, { capture: true, passive: false });
    const end = event => {
        if (!gesture) return;
        event.preventDefault(); event.stopImmediatePropagation();
        clearTimeout(gesture.timer);
        if (event.type === 'touchend' && gesture.kind === 'pending' && gesture.block &&
            gesture.maxDistance <= 8 && performance.now() - gesture.startedAt < 320) {
            onTap?.(gesture.block);
        }
        if (gesture.kind === 'drag') {
            if (event.type === 'touchcancel') getWorld().hand.children.slice().forEach(block => block.destroy());
            else getWorld().hand.processMouseUp({ button: 0 });
        }
        getWorld().hand.mouseButton = null;
        canvas.classList.remove('cocube-taking-block');
        gesture = null;
    };
    canvas.addEventListener('touchend', end, { capture: true, passive: false });
    canvas.addEventListener('touchcancel', end, { capture: true, passive: false });
}
