// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// A child-facing Stop command, distinct from the legacy "stop other tasks".
// Use existing VM primitives so stopping tasks does not require new firmware
// or a connected IDE. The IDE-only notification also invokes the toolbar's
// full stop/reset/sync path when connected; it never starts broadcast hats.
const MB_IconStop = {
	message: '_iconStopAllScripts_v4',
	gripperMessage: '_iconStopAllScripts_v3',
	previousMessage: '_iconStopAllScripts_v2',
	legacyMessage: '_iconStopAllScripts_v1',
	pending: null,

	brake() {
		// Match CoCube's existing 100 ms motor brake. Guard on the board itself,
		// not the browser's last connection, so saved programs also stop offline.
		return ['if', ['==', ['boardType'], "'CoCube'"], [
			...[9, 10, 26, 25].map(pin => ['digitalWriteOp', pin, true]),
			['waitMillis', 100],
			...[9, 10, 26, 25].map(pin => ['digitalWriteOp', pin, false])
		]];
	},

	expansion(legacy = false) {
		const version = legacy === true ? 1 : legacy === 2 ? 2 : legacy === 3 ? 3 : 4;
		const message = version === 1 ? this.legacyMessage : version === 2 ? this.previousMessage : version === 3 ? this.gripperMessage : this.message;
		return MB_Parser.blockFor([['stopAll'],
			...(version === 4 ? [['=', '_iconCoCubeBusy', false], ['=', '_cocube_move_flag', false], ['=', '_cocube_pid_flag', false]] : []),
			...(version === 1 ? [] : [this.brake()]),
			...(version >= 3 ? [['if', ['==', ['boardType'], "'CoCube'"], [
				['[io:setServo]', 22, 0], ['digitalWriteOp', 13, false]
			]]] : []),
			['[misc:broadcastToIDE]', "'" + message + "'"],
			['[io:playTone]', -1, 0], ['stopTask']]);
	},

	receive(message) {
		if (![this.message, this.gripperMessage, this.previousMessage, this.legacyMessage].includes(message)) return false;
		if (!this.pending) {
			this.pending = Promise.resolve().then(() => MB_editor.stopAll())
				.catch(error => MB_editor.reportError(error))
				.finally(() => { this.pending = null; });
		}
		return true;
	},

	restore(node) {
		// Collapse only our exact expansion on board readback. Preserve ordinary
		// stopAll/stopTask commands, following commands and all nested bodies.
		if (!node || typeof node !== 'object') return node;
		if (node.isFunction) {
			node.cmdList = this.restore(node.cmdList);
			return node;
		}
		const value = node => node?.selector === 'booleanConstant' ? node.args[0] : node && typeof node === 'object' && node.selector
			? [node.selector, node.args.map(value), node.next ? value(node.next) : null] : node;
		const matches = (cmd, expected) => cmd?.selector === expected.selector &&
			JSON.stringify(cmd.args.map(value)) === JSON.stringify(expected.args.map(value));
		for (let cmd = node; cmd; cmd = cmd.next) {
			if (cmd.selector === 'stopAll') for (const pattern of (this.readbackPatterns ||= [false, 3, 2, true]
				.map(legacy => this.expansion(legacy).blockSequence().map(block => block.expression())))) {
				let cursor = cmd;
				if (pattern.every(expected => {
					if (!matches(cursor, expected)) return false;
					cursor = cursor.next; return true;
				})) {
					cmd.selector = 'stopAllScripts'; cmd.next = cursor;
					break;
				}
			}
			if (cmd.args) cmd.args = cmd.args.map(arg => this.restore(arg));
		}
		return node;
	}
};
