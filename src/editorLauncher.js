const entries = { icon: 'icon.html', blocks: 'blocks.html' };
let mode = 'icon';
try { mode = localStorage.getItem('cocube-editor-mode') || mode; } catch (_) {}
window.location.replace(new URL(entries[mode] || entries.icon, window.location.href));
