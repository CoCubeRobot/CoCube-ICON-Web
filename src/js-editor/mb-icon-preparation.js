// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Connection-scoped preparation gate. UI input is blocked, not queued, while
// libraries/code are being prepared. Cancel/disconnect always remains available.
const MB_IconPreparation = {
	state: null,
	isBlocking(editor) { return this.state?.editor === editor; },

	begin(editor) {
		this.close();
		const state = {editor, port:MB_connection.port, generation:MB_connection.sessionGeneration};
		this.state = state;
		MB_IconInputs.close();
		editor.scripts?.world()?.stopEditing?.();
		if (!document.body) return state;
		const overlay = document.createElement('div'); overlay.className = 'icon-preparation';
		overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
		overlay.setAttribute('aria-label','准备机器人积木');
		const card = document.createElement('div'); card.className = 'icon-preparation-card';
		const title = document.createElement('h2'); title.textContent = '正在准备积木';
		const message = document.createElement('p'); message.textContent = '正在确认设备，请稍等…';
		message.setAttribute('role','status'); message.setAttribute('aria-live','polite');
		const progress = document.createElement('progress'); progress.max = 1;
		progress.setAttribute('aria-label','积木写入进度');
		const note = document.createElement('p'); note.className = 'icon-preparation-note';
		note.textContent = '准备好后就能开始玩啦。请保持连接，暂时不要切换页面。';
		const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.hidden = true;
		retry.onclick = () => { if (this.state === state) MB_connection.justConnected(); };
		const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '断开连接';
		cancel.onclick = () => { if (this.state === state) MB_connection.disconnect(); };
		card.append(title,message,progress,note,retry,cancel); overlay.appendChild(card); document.body.appendChild(overlay);
		Object.assign(state,{overlay,title,message,progress,retry,previousFocus:document.activeElement});
		state.intercept = event => {
			if (this.state !== state) return;
			if (event.type === 'keydown' && event.key === 'Escape') {
				event.preventDefault(); event.stopImmediatePropagation(); MB_connection.disconnect(); return;
			}
			if (!overlay.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
		};
		state.events = ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','dblclick','contextmenu',
			'wheel','keydown','keyup','touchstart','touchmove','drop','dragstart'];
		for (const event of state.events) document.addEventListener(event,state.intercept,{capture:true,passive:false});
		cancel.focus({preventScroll:true});
		return state;
	},

	check(state) {
		if (this.state !== state || MB_connection.port !== state.port ||
			MB_connection.sessionGeneration !== state.generation || !MB_connection.connectedToBoard()) {
			const error = new Error('连接已取消'); error.name = 'AbortError'; throw error;
		}
	},

	progress(state, completed, total) {
		if (this.state !== state) return;
		if (state.message) state.message.textContent = completed < total ? `正在准备积木 ${completed} / ${total}` : '正在核对设备中的积木…';
		if (state.progress) { state.progress.max = total || 1; state.progress.value = completed; }
	},

	async loadLibraries(editor) {
		const state = this.state, project = editor.project;
		this.check(state);
		if (state.message) state.message.textContent = '正在加载声音、屏幕和机器人积木…';
		const modules = [[MB_IconMusic,'蜂鸣器'],[MB_IconDisplay,'屏幕'],[MB_IconColorMatrix,'彩色点阵'],
			[MB_IconCoCube,'CoCube 运动'],[MB_IconGripper,'夹爪']];
		await Promise.all(modules.map(async ([module,label]) => {
			module.failed?.delete(project); // an explicit preparation retry may fetch a repaired library
			if (module.ensureLibrary(editor)) return;
			if (!module.loading) throw new Error(label + '积木未能加载，请检查库文件。');
			let timer;
			try {
				await Promise.race([module.loading, new Promise((_,reject) => {
					timer = setTimeout(() => reject(new Error(label + '积木加载超时，请检查本地服务。')),20000);
				})]);
			} finally { clearTimeout(timer); }
			this.check(state);
			if (editor.project !== project) { const error = new Error('项目已改变'); error.name='AbortError'; throw error; }
			if (!module.ensureLibrary(editor)) throw new Error(label + '积木尚未准备完整。');
		}));
		this.check(state);
		editor.updatePalette();
		const blocks = editor.palette?.contents.children.filter(block => block instanceof BlockMorph) || [];
		if (!blocks.length) throw new Error('积木栏未加载，请刷新页面后重试。');
		editor.codeManager.setPaletteBlocks(blocks);
		editor.codeManager.preparationProgress = (done,total) => this.progress(state,done,total);
	},

	fail(state,error) {
		if (this.state !== state) return;
		if (!MB_connection.isConnected()) { this.close(state); return; }
		if (state.title) state.title.textContent = '积木准备未完成';
		if (state.message) state.message.textContent = error.message || String(error);
		if (state.progress) state.progress.hidden = true;
		if (state.retry) { state.retry.hidden = false; state.retry.focus({preventScroll:true}); }
	},

	close(state = this.state) {
		if (!state || this.state !== state) return;
		for (const event of state.events || []) document.removeEventListener(event,state.intercept,true);
		state.overlay?.remove();
		state.editor.codeManager.preparationProgress = null;
		this.state = null;
		state.previousFocus?.focus?.({preventScroll:true});
	}
};
