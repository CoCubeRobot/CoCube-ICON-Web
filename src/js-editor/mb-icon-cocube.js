// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Four fixed-direction controls backed by a device-executed CoMaps library.
const MB_IconCoCube = {
	source: null, motionSources: null, loading: null, pending: new WeakSet(), failed: new WeakSet(),
	selectors: ['CoCube ICON forward', 'CoCube ICON backward', 'CoCube ICON left', 'CoCube ICON right'],
	targetSelector: 'CoCube ICON go to',
	headingSelector: 'CoCube ICON face',
	get paletteSelectors() { return [...this.selectors, this.targetSelector, this.headingSelector]; },
	legacySelectors: ['CoCube ICON move', 'CoCube ICON turn'],
	gridHelpers: ['Begin', 'Heading', 'Face', 'GoTo', 'Drive', 'Turn', 'CompassYaw'].map(name => '_iconCoCubeGrid' + name),
	gridVariables: ['_iconCoCubeBusy', '_iconCoCubeGridX', '_iconCoCubeGridY', '_iconCoCubeGridYaw'],
	edgeHelpers: ['_iconCoCubeCheckMat', '_iconCoCubeWatchMat', '_iconCoCubeReverseTo', '_iconCoCubeFinish', '_iconCoCubeAngleDelta', '_iconCoCubeInside', '_iconCoCubeFail'],
	currentVersion: [3, 0],
	// Migration reference only: compare exact stock bodies before replacing them.
	// Never execute or import this former controller in a new project.
	previousMotionSource: `module 'CoCube ICON'
author 'CoCube ICON'
version 2 3
description 'Four grid-navigation commands, exact XY targets and absolute compass headings for a 300 by 200 CoMaps mat. Grid directions use six columns by four rows of 50-unit cells, with centres X 25..275 and Y 25..175. Forward/backward visit the next cell centres using XY feedback, not fixed travel distance. Left/right turn in place to the next cardinal. Child compass angles are clockwise: up 0, right 90, down 180, left 270. CoCube raw yaw is counterclockwise from down: rawYaw=(180-compassAngle) mod 360. Exact XY moves retain their natural arrival direction; use the heading tile for a chosen direction afterwards. XY targets and heading turns allow the full map without an inset margin. UI origin is top left, X right, Y down. Normal grid/legacy commands retain their edge margins. v2.3 corrects stock XY bearing/projection math to the confirmed CoCube yaw convention. No obstacle avoidance. Stops within 2 units / 2 degrees before braking; hardware calibration is required. Uses existing CoCube firmware.'
variables _iconCoCubeBusy _iconCoCubeHeartbeat _iconCoCubeGridX _iconCoCubeGridY _iconCoCubeGridYaw _iconCoCubeFullMatTarget
choices iconCoCubeMoveMenu forward backward
choices iconCoCubeTurnMenu left right
spec ' ' 'CoCube ICON forward' 'forward _ steps' 'num' 1
spec ' ' 'CoCube ICON backward' 'backward _ steps' 'num' 1
spec ' ' 'CoCube ICON left' 'left _ quarter turns' 'num' 1
spec ' ' 'CoCube ICON right' 'right _ quarter turns' 'num' 1
spec ' ' 'CoCube ICON go to' 'move to X _ Y _' 'num num' 175 125
spec ' ' 'CoCube ICON face' 'face _ degrees' 'num' 0
advanced
spec ' ' 'CoCube ICON move' 'walk _ _ steps' 'menu.iconCoCubeMoveMenu num' forward 1
spec ' ' 'CoCube ICON turn' 'turn _ _ degrees' 'menu.iconCoCubeTurnMenu num' left 90

to 'CoCube ICON forward' steps {
  '_iconCoCubeGridDrive' 1 steps
}

to 'CoCube ICON backward' steps {
  '_iconCoCubeGridDrive' -1 steps
}

to 'CoCube ICON left' turns {
  '_iconCoCubeGridTurn' 1 turns
}

to 'CoCube ICON right' turns {
  '_iconCoCubeGridTurn' -1 turns
}

to 'CoCube ICON go to' targetX targetY {
  comment 'Exact XY target, not a relative step. Validate before any motor power.'
  if (not ('_iconCoCubeInside' targetX targetY 0)) {
    '_iconCoCubeFail' '目标超出地图：X 0～300，Y 0～200'
  }
  '_iconCoCubeGridBegin' 1
  local 'dx' ((targetX * 64) - _iconCoCubeGridX)
  local 'dy' ((targetY * 64) - _iconCoCubeGridY)
  comment 'Face the target first; do not spend the travel watchdog rotating.'
  if (((dx * dx) + (dy * dy)) > 16384) {
    '_iconCoCubeGridFace' (('[misc:atan2]' dy dx) / 100)
  }
  '_iconCoCubeGridGoTo' targetX targetY 1
  '_iconCoCubeBrake' 0
}

to 'CoCube ICON face' degrees {
  '_iconCoCubeGridBegin' 1
  '_iconCoCubeGridFace' ('_iconCoCubeGridCompassYaw' degrees)
  '_iconCoCubeBrake' 0
}

to '_iconCoCubeGridCompassYaw' degrees {
  comment 'Original CoCube point-towards uses atan2(dy,dx): raw yaw down=0, right=90, up=180, left=270.'
  comment 'The child compass is clockwise from up: 0,90,180,270. No position change.'
  return ((180 - (degrees % 360)) % 360)
}

to '_iconCoCubeGridBegin' fullMatTarget {
  '_iconCoCubeBegin' fullMatTarget
  _iconCoCubeGridX = ('[sensors:position_x]')
  _iconCoCubeGridY = ('[sensors:position_y]')
  _iconCoCubeGridYaw = ('[sensors:position_yaw]')
}

to '_iconCoCubeGridCheck' started progress timeout {
  '_iconCoCubeCheck' started progress timeout
  local 'x' ('[sensors:position_x]')
  local 'y' ('[sensors:position_y]')
  local 'yaw' ('[sensors:position_yaw]')
  if (or (or ((absoluteValue (x - _iconCoCubeGridX)) > 1280) ((absoluteValue (y - _iconCoCubeGridY)) > 1280)) ((absoluteValue ('_iconCoCubeAngleDelta' yaw _iconCoCubeGridYaw)) > 90)) {
    '_iconCoCubeFail' '定位变化过大，请重新放好小车'
  }
  _iconCoCubeGridX = x
  _iconCoCubeGridY = y
  _iconCoCubeGridYaw = yaw
}

to '_iconCoCubeGridHeading' yaw {
  return ((((yaw % 360) + 45) / 90) % 4)
}

to '_iconCoCubeGridPause' unused {
  comment 'Brake between phases without releasing the motor lease to another script.'
  _iconCoCubeHeartbeat = (millisOp)
  digitalWriteOp 9 true
  digitalWriteOp 10 true
  digitalWriteOp 26 true
  digitalWriteOp 25 true
  waitMillis 100
  digitalWriteOp 9 false
  digitalWriteOp 10 false
  digitalWriteOp 26 false
  digitalWriteOp 25 false
}

to '_iconCoCubeGridFace' heading {
  local 'started' (millisOp)
  local 'progress' started
  local 'best' 361
  forever {
    '_iconCoCubeGridCheck' started progress 6000
    local 'error' ('_iconCoCubeAngleDelta' (heading % 360) _iconCoCubeGridYaw)
    local 'remaining' (absoluteValue error)
    if (remaining <= 2) {
      '_iconCoCubeGridPause' 0
      '_iconCoCubeGridCheck' started progress 6000
      error = ('_iconCoCubeAngleDelta' (heading % 360) _iconCoCubeGridYaw)
      remaining = (absoluteValue error)
      if (remaining <= 2) { exitLoop }
    }
    if (remaining < (best - 1)) {
      best = remaining
      progress = (millisOp)
    }
    local 'speed' (maximum 8 (minimum 18 (remaining / 3)))
    if (error < 0) { speed = (0 - speed) }
    '_iconCoCubeWheels' (0 - speed) speed
    waitMillis 20
  }
}

to '_iconCoCubeGridGoTo' targetX targetY sign {
  local 'started' (millisOp)
  local 'progress' started
  local 'best' 100000
  forever {
    '_iconCoCubeGridCheck' started progress 8000
    local 'dx' ((targetX * 64) - _iconCoCubeGridX)
    local 'dy' ((targetY * 64) - _iconCoCubeGridY)
    local 'distance' ('[misc:sqrt]' ((dx * dx) + (dy * dy)))
    if (distance <= 128) {
      '_iconCoCubeGridPause' 0
      '_iconCoCubeGridCheck' started progress 8000
      dx = ((targetX * 64) - _iconCoCubeGridX)
      dy = ((targetY * 64) - _iconCoCubeGridY)
      distance = ('[misc:sqrt]' ((dx * dx) + (dy * dy)))
      if (distance <= 128) { exitLoop }
    }
    if (distance < (best - 32)) {
      best = distance
      progress = (millisOp)
    }
    comment 'VM atan2 takes X then Y; swapping dy,dx matches the original CoCube raw yaw convention.'
    local 'heading' (('[misc:atan2]' dy dx) / 100)
    if (sign < 0) { heading += 180 }
    local 'error' ('_iconCoCubeAngleDelta' (heading % 360) _iconCoCubeGridYaw)
    local 'speed' (sign * (maximum 8 (minimum 20 (distance / 64))))
    if ((absoluteValue error) > 35) { speed = 0 }
    local 'correction' (maximum -18 (minimum 18 (error / 2)))
    '_iconCoCubeWheels' (speed - correction) (speed + correction)
    waitMillis 20
  }
}

to '_iconCoCubeGridDrive' sign steps {
  if (or (steps < 1) (steps > 5)) { '_iconCoCubeFail' '请选择 1 到 5 格' }
  '_iconCoCubeGridBegin' 0
  local 'heading' (90 * ('_iconCoCubeGridHeading' _iconCoCubeGridYaw))
  comment 'Raw CoMaps units are 1/64. Cell ties select the higher index; targets stay integer centres.'
  local 'x' (25 + ((_iconCoCubeGridX / 3200) * 50))
  local 'y' (25 + ((_iconCoCubeGridY / 3200) * 50))
  local 'dx' ((sign * (50 * ('[misc:sin]' (heading * 100)))) / 16384)
  local 'dy' ((sign * (50 * ('[misc:sin]' ((heading + 90) * 100)))) / 16384)
  comment 'Check the entire requested route before any motor power, including initial alignment.'
  if (not ('_iconCoCubeInside' (x + (steps * dx)) (y + (steps * dy)) 25)) {
    '_iconCoCubeFail' '前面超出地图了，请减少格数或转个弯'
  }
  '_iconCoCubeGridFace' heading
  repeat steps {
    x += dx
    y += dy
    '_iconCoCubeGridGoTo' x y sign
    '_iconCoCubeGridFace' heading
  }
  '_iconCoCubeBrake' 0
}

to '_iconCoCubeGridTurn' sign turns {
  if (or (turns < 1) (turns > 4)) { '_iconCoCubeFail' '请选择 1 到 4 次转弯' }
  '_iconCoCubeGridBegin' 0
  local 'heading' (90 * ('_iconCoCubeGridHeading' _iconCoCubeGridYaw))
  repeat turns {
    heading = ((heading + (sign * 90)) % 360)
    '_iconCoCubeGridFace' heading
  }
  '_iconCoCubeBrake' 0
}

to '_iconCoCubeStepSize' unused {
  return 50
}

to '_iconCoCubeAngleDelta' angle previous {
  local 'delta' (angle - previous)
  if (delta > 180) { delta += -360 }
  if (delta < -180) { delta += 360 }
  return delta
}

to '_iconCoCubeInside' x y margin {
  return (and (and (x >= margin) (x <= (300 - margin))) (and (y >= margin) (y <= (200 - margin))))
}

to '_iconCoCubeWheel' positivePin negativePin speed {
  local 'power' (minimum 132 ((4 * (absoluteValue speed)) + 36))
  if (speed == 0) {
    digitalWriteOp positivePin false
    digitalWriteOp negativePin false
  } (speed > 0) {
    digitalWriteOp negativePin false
    analogWriteOp positivePin power
  } else {
    digitalWriteOp positivePin false
    analogWriteOp negativePin power
  }
}

to '_iconCoCubeWheels' left right {
  '_iconCoCubeWheel' 9 10 left
  '_iconCoCubeWheel' 26 25 right
}

to '_iconCoCubeBrake' unused {
  if ((boardType) == 'CoCube') {
    digitalWriteOp 9 true
    digitalWriteOp 10 true
    digitalWriteOp 26 true
    digitalWriteOp 25 true
    waitMillis 100
    digitalWriteOp 9 false
    digitalWriteOp 10 false
    digitalWriteOp 26 false
    digitalWriteOp 25 false
  }
  _iconCoCubeBusy = false
}

to '_iconCoCubeFail' reason {
  stopAll
  '_iconCoCubeBrake' 0
  '[io:playTone]' -1 0
  sayIt reason
  '[misc:broadcastToIDE]' ('[data:join]' '_iconCoCubeFault:' reason)
  stopTask
}

to '_iconCoCubeBegin' fullMatTarget {
  if ((boardType) != 'CoCube') { '_iconCoCubeFail' '请连接 CoCube 小车' }
  comment 'Serialize overlapping motion scripts. A short lease also recovers after an individual task is stopped.'
  waitUntil (or (_iconCoCubeBusy != true) ((millisSince _iconCoCubeHeartbeat) > 500))
  _iconCoCubeBusy = true
  _iconCoCubeHeartbeat = (millisOp)
  comment 'Set only after acquiring the motor lease; other scripts cannot change this mode while waiting.'
  _iconCoCubeFullMatTarget = (fullMatTarget == 1)
  if (not ('[sensors:cube_status]')) { '_iconCoCubeFail' '请把小车放在 CoMaps 定位垫上' }
  if (and (not _iconCoCubeFullMatTarget) (not ('_iconCoCubeInside' (('[sensors:position_x]') / 64) (('[sensors:position_y]') / 64) 25))) {
    '_iconCoCubeFail' '请把小车放在格子中心，离边缘远一点'
  }
}

to '_iconCoCubeCheck' started progress timeout {
  _iconCoCubeHeartbeat = (millisOp)
  if (not ('[sensors:cube_status]')) { '_iconCoCubeFail' '定位丢失，请把小车放回定位垫' }
  if (and (not _iconCoCubeFullMatTarget) (not ('_iconCoCubeInside' (('[sensors:position_x]') / 64) (('[sensors:position_y]') / 64) 20))) {
    '_iconCoCubeFail' '快到地图边缘了，请调整路线'
  }
  if ((millisSince started) > timeout) { '_iconCoCubeFail' '运动超时，请检查小车和定位垫' }
  if ((millisSince progress) > 1500) { '_iconCoCubeFail' '小车走不动了，请检查前方是否有障碍' }
}

to 'CoCube ICON move' direction steps {
  if (or (steps < 1) (steps > 5)) { '_iconCoCubeFail' '请选择 1 到 5 步' }
  if (not (or (direction == 'forward') (direction == 'backward'))) { '_iconCoCubeFail' '请选择前进或后退' }
  '_iconCoCubeBegin' 0
  local 'target' (steps * ('_iconCoCubeStepSize' 0))
  local 'sign' 1
  if (direction == 'backward') { sign = -1 }
  local 'x' ('[sensors:position_x]')
  local 'y' ('[sensors:position_y]')
  local 'heading' ('[sensors:position_yaw]')
  local 'started' (millisOp)
  local 'progress' started
  local 'best' 0
  local 'distance' 0
  local 'cosine' ('[misc:sin]' (heading * 100))
  local 'sine' ('[misc:sin]' ((heading + 90) * 100))
  local 'targetX' ((x / 64) + (((sign * target) * cosine) / 16384))
  local 'targetY' ((y / 64) + (((sign * target) * sine) / 16384))
  if (not ('_iconCoCubeInside' targetX targetY 25)) { '_iconCoCubeFail' '前面超出地图了，请减少步数或转个弯' }
  forever {
    '_iconCoCubeCheck' started progress ((steps * 6000) + 2000)
    local 'dx' ((('[sensors:position_x]') - x) / 64)
    local 'dy' ((('[sensors:position_y]') - y) / 64)
    comment 'Signed displacement along the initial heading, not elapsed motor time.'
    distance = ((sign * ((dx * cosine) + (dy * sine))) / 16384)
    if (distance >= (target - 1)) { exitLoop }
    if (distance > (best + 1)) {
      best = distance
      progress = (millisOp)
    }
    local 'speed' (sign * (maximum 10 (minimum 24 (target - distance))))
    local 'error' ('_iconCoCubeAngleDelta' heading ('[sensors:position_yaw]'))
    local 'correction' (maximum -8 (minimum 8 error))
    '_iconCoCubeWheels' (speed - correction) (speed + correction)
    waitMillis 20
  }
  '_iconCoCubeBrake' 0
}

to 'CoCube ICON turn' direction degrees {
  if (not (or (degrees == 90) (or (degrees == 180) (degrees == 360)))) { '_iconCoCubeFail' '请选择转弯、掉头或转一圈' }
  if (not (or (direction == 'left') (direction == 'right'))) { '_iconCoCubeFail' '请选择左转或右转' }
  '_iconCoCubeBegin' 0
  local 'sign' 1
  if (direction == 'right') { sign = -1 }
  local 'previous' ('[sensors:position_yaw]')
  local 'turned' 0
  local 'best' 0
  local 'started' (millisOp)
  local 'progress' started
  forever {
    '_iconCoCubeCheck' started progress 12000
    local 'angle' ('[sensors:position_yaw]')
    local 'delta' ('_iconCoCubeAngleDelta' angle previous)
    if ((absoluteValue delta) > 90) { '_iconCoCubeFail' '定位变化过大，请重新放好小车' }
    turned += (sign * delta)
    previous = angle
    if (turned >= (degrees - 2)) { exitLoop }
    if (turned > (best + 1)) {
      best = turned
      progress = (millisOp)
    }
    local 'speed' (maximum 10 (minimum 20 ((degrees - turned) / 3)))
    '_iconCoCubeWheels' (0 - (sign * speed)) (sign * speed)
    waitMillis 20
  }
  '_iconCoCubeBrake' 0
}`,
	// Stock v2.1 functions: upgrade only exact bodies (comments/wrapping ignored).
	// Shared guards gain an action-scoped mode; legacy/grid commands keep theirs.
	previousTargetSource: `
to 'CoCube ICON go to' targetX targetY {
  if (not ('_iconCoCubeInside' targetX targetY 25)) { '_iconCoCubeFail' '目标超出安全范围：X 25～275，Y 25～175' }
  '_iconCoCubeGridBegin' 0
  local 'heading' (90 * ('_iconCoCubeGridHeading' _iconCoCubeGridYaw))
  local 'dx' ((targetX * 64) - _iconCoCubeGridX)
  local 'dy' ((targetY * 64) - _iconCoCubeGridY)
  if (((dx * dx) + (dy * dy)) > 16384) { '_iconCoCubeGridFace' (('[misc:atan2]' dx dy) / 100) }
  '_iconCoCubeGridGoTo' targetX targetY 1
  '_iconCoCubeGridFace' heading
  '_iconCoCubeBrake' 0
}
to '_iconCoCubeGridBegin' unused {
  '_iconCoCubeBegin' 0
  _iconCoCubeGridX = ('[sensors:position_x]')
  _iconCoCubeGridY = ('[sensors:position_y]')
  _iconCoCubeGridYaw = ('[sensors:position_yaw]')
}
to '_iconCoCubeBegin' unused {
  if ((boardType) != 'CoCube') { '_iconCoCubeFail' '请连接 CoCube 小车' }
  waitUntil (or (_iconCoCubeBusy != true) ((millisSince _iconCoCubeHeartbeat) > 500))
  _iconCoCubeBusy = true
  _iconCoCubeHeartbeat = (millisOp)
  if (not ('[sensors:cube_status]')) { '_iconCoCubeFail' '请把小车放在 CoMaps 定位垫上' }
  if (not ('_iconCoCubeInside' (('[sensors:position_x]') / 64) (('[sensors:position_y]') / 64) 25)) {
    '_iconCoCubeFail' '请把小车放在格子中心，离边缘远一点'
  }
}
to '_iconCoCubeCheck' started progress timeout {
  _iconCoCubeHeartbeat = (millisOp)
  if (not ('[sensors:cube_status]')) { '_iconCoCubeFail' '定位丢失，请把小车放回定位垫' }
  if (not ('_iconCoCubeInside' (('[sensors:position_x]') / 64) (('[sensors:position_y]') / 64) 20)) {
    '_iconCoCubeFail' '快到地图边缘了，请调整路线'
  }
  if ((millisSince started) > timeout) { '_iconCoCubeFail' '运动超时，请检查小车和定位垫' }
  if ((millisSince progress) > 1500) { '_iconCoCubeFail' '小车走不动了，请检查前方是否有障碍' }
}`,
	maxSteps: 5, // longest centre-to-centre straight route on the 6 × 4 grid
	maxTurns: 4,
	faultPrefix: '_iconCoCubeFault:',
	turns: [{value: 90, label: '转个弯'}, {value: 180, label: '掉头'}, {value: 360, label: '转一圈'}],

	isMotion(selector) { return this.paletteSelectors.includes(selector) || this.legacySelectors.includes(selector); },

	stockV22Functions() {
		// Reconstruct only the exact previous stock bodies by reversing the v2.3
		// coordinate-basis fixes and removed post-arrival rotation. Compare whole
		// parsed bodies below: a user's customized controller is never patched.
		const source = this.previousMotionSource.replaceAll("('[misc:atan2]' dy dx)", "('[misc:atan2]' dx dy)")
			.replace("  '_iconCoCubeGridBegin' 1\n  local 'dx'", "  '_iconCoCubeGridBegin' 1\n  local 'heading' (90 * ('_iconCoCubeGridHeading' _iconCoCubeGridYaw))\n  local 'dx'")
			.replace("  '_iconCoCubeGridGoTo' targetX targetY 1\n  '_iconCoCubeBrake'", "  '_iconCoCubeGridGoTo' targetX targetY 1\n  '_iconCoCubeGridFace' heading\n  '_iconCoCubeBrake'")
			.replace("local 'dx' ((sign * (50 * ('[misc:sin]' (heading * 100))))", "local 'dx' ((sign * (50 * ('[misc:sin]' ((heading + 90) * 100))))")
			.replace("local 'dy' ((sign * (50 * ('[misc:sin]' ((heading + 90) * 100))))", "local 'dy' ((sign * (50 * ('[misc:sin]' (heading * 100))))")
			.replace("local 'cosine' ('[misc:sin]' (heading * 100))", "local 'cosine' ('[misc:sin]' ((heading + 90) * 100))")
			.replace("local 'sine' ('[misc:sin]' ((heading + 90) * 100))", "local 'sine' ('[misc:sin]' (heading * 100))");
		return MB_Parser.parse(source).filter(cmd => cmd[0] === 'to' &&
			[this.targetSelector, '_iconCoCubeGridGoTo', '_iconCoCubeGridDrive', this.legacySelectors[0]].includes(stringArg(cmd[1])));
	},

	upgradeLibrary(editor, library) {
		const project = editor.project;
		// Only the four exact stock v1 wrappers change semantics. Keep legacy
		// relative commands, customized functions and all user scripts intact.
		const oldSource = `
to 'CoCube ICON forward' steps { 'CoCube ICON move' 'forward' steps }
to 'CoCube ICON backward' steps { 'CoCube ICON move' 'backward' steps }
to 'CoCube ICON left' turns {
  if (or (turns < 1) (turns > 4)) { '_iconCoCubeFail' '请选择 1 到 4 次转弯' }
  repeat turns { 'CoCube ICON turn' 'left' 90 }
}
to 'CoCube ICON right' turns {
  if (or (turns < 1) (turns > 4)) { '_iconCoCubeFail' '请选择 1 到 4 次转弯' }
  repeat turns { 'CoCube ICON turn' 'right' 90 }
}`;
		const priorCommands = [...MB_Parser.parse(oldSource), ...MB_Parser.parse(this.previousMotionSource),
			...MB_Parser.parse(this.previousTargetSource), ...this.stockV22Functions()];
		const sourceCommands = MB_Parser.parse(this.source);
		const canonical = body => body && JSON.stringify(MB_Parser.parse(body.codeString().split('\n').filter(line => !line.trimStart().startsWith('comment ')).join('\n')));
		const matches = (fn, cmd) => cmd && JSON.stringify(fn.argNames) === JSON.stringify(cmd.slice(2, -1)) &&
			canonical(fn.cmdList) === canonical(MB_Parser.blockFor(cmd.at(-1)));
		const replacements = new Set(), custom = [];
		for (const cmd of sourceCommands.filter(cmd => cmd[0] === 'to')) {
			const name = stringArg(cmd[1]), fn = project.functionNamed(name);
			if (!fn || matches(fn, cmd)) continue;
			if (library.functionNamed(name) === fn && priorCommands.some(old => old[0] === 'to' && stringArg(old[1]) === name && matches(fn, old))) replacements.add(name);
			else custom.push(name);
		}
		const additions = sourceCommands.filter(cmd =>
			(cmd[0] === 'to' && (!project.functionNamed(stringArg(cmd[1])) || replacements.has(stringArg(cmd[1])))) ||
			(cmd[0] === 'spec' && this.paletteSelectors.includes(stringArg(cmd[2])) && !project.blockSpecs.has(stringArg(cmd[2]))));
		for (const [name, spec] of parsedSpecs(additions)) {
			library.blockSpecs.set(name, spec); project.recordBlockSpec(name, spec);
			if (!library.blockList.includes(name)) library.blockList.push(name);
		}
		this.gridVariables.forEach(name => library.addVariable(name));
		library.functions = library.functions.filter(fn => !replacements.has(fn.functionName));
		library.loadFunctions(additions);
		library.version = [...this.currentVersion];
		library.loadDescription(sourceCommands);
		project.fixFunctionLocals();
		if (replacements.size || additions.length) editor.codeManager.recompileNeeded();
		if (custom.length) editor.inform('发现自定义的 CoCube 导航函数，已保留原实现；这些函数不会自动更新：' + custom.join('、'));
	},

	// Import the original motion bodies verbatim, including their encoder PID
	// worker (invoked by broadcast). No unrelated TFT/emoji/module dependencies.
	// Existing CoCube/PID functions in a user's project are reused, never replaced.
	nativeNames: ['CoCube move to', 'CoCube point towards', 'CoCube rotate to angle',
		'CoCube set wheel', 'CoCube wheels break', 'CoCube wheels stop', 'CoCube on the mat',
		'CoCube position_X', 'CoCube position_Y', 'CoCube direction',
		'_cocube_calculate_angle_error_', '_cocube_calculate_distance_error target_x _ target_y _',
		'_cocube_motors_speed', '_cocube_pid_control'],
	pidNames: ['pid_computePID', 'pid_resetPID', 'pid_applySign', '_pid_extendPIDLists', '_pid_initLibrary'],

	installNative(project, name, source, names) {
		const commands = MB_Parser.parse(source);
		let library = project.libraryNamed(name);
		if (!library) {
			library = new MB_Module(name);
			library.loadAuthor(commands); library.loadVersion(commands);
			library.description = 'Unmodified motion functions from the bundled CoCube/PID libraries; the ICON shelf remains unchanged.';
			if (name === 'CoCube Motion ICON') library.dependencies = ['Motors/PID'];
			project.addLibrary(library);
		}
		const additions = commands.filter(cmd =>
			(cmd[0] === 'to' && names.includes(stringArg(cmd[1])) && !project.functionNamed(stringArg(cmd[1]))) ||
			(cmd[0] === 'spec' && names.includes(stringArg(cmd[2])) && !project.blockSpecs.has(stringArg(cmd[2]))));
		for (const [selector, spec] of parsedSpecs(additions)) {
			library.blockSpecs.set(selector, spec); project.recordBlockSpec(selector, spec);
			if (!library.blockList.includes(selector)) library.blockList.push(selector);
		}
		for (const cmd of commands.filter(cmd => cmd[0] === 'variables')) cmd.slice(1).map(stringArg).forEach(v => library.addVariable(v));
		library.loadFunctions(additions);
		project.fixFunctionLocals();
	},

	validateSource(source, path, moduleName, required) {
		const fail = reason => { throw new Error(path + '：' + reason); };
		if (typeof source !== 'string' || !source.trim()) fail('无法读取库文件，请检查本地运行目录中是否包含此文件');
		// A BOM, CRLF, indentation and quoted identifiers are valid library text.
		// Validate parsed declarations, not spellings such as "to pid_computePID".
		const text = source.trimStart();
		let commands;
		try { commands = MB_Parser.parse(text, path); }
		catch (_) { fail('库文件格式无法解析'); }
		const modules = commands.filter(cmd => cmd[0] === 'module');
		if (modules.length !== 1 || stringArg(modules[0][1]) !== moduleName) {
			fail('不是有效的 ' + moduleName + ' 库文件（可能返回了网页或其他文件）');
		}
		if (moduleName === 'CoCube ICON') {
			const version = commands.find(cmd => cmd[0] === 'version')?.slice(1, 3);
			if (!version || version.length !== 2 || !version.every(Number.isInteger)) fail('缺少有效的版本号');
			if (!this.isCurrent(version)) fail('版本为 ' + version.join('.') + '，需要 ' + this.currentVersion.join('.') + ' 或更新版本；请更新本地运行目录中的此文件');
			const specs = parsedSpecs(commands);
			const missingSpecs = this.paletteSelectors.filter(name => !specs.has(name));
			if (missingSpecs.length) fail('缺少积木定义：' + missingSpecs.join('、'));
			const variables = new Set(commands.filter(cmd => cmd[0] === 'variables').flatMap(cmd => cmd.slice(1).map(stringArg)));
			const missingVariables = this.gridVariables.filter(name => !variables.has(name));
			if (missingVariables.length) fail('缺少运动变量：' + missingVariables.join('、'));
		}
		const functions = new Set(commands.filter(cmd => cmd[0] === 'to').map(cmd => stringArg(cmd[1])));
		const missing = required.filter(name => !functions.has(name));
		if (missing.length) fail('缺少运动函数：' + missing.join('、'));
		return text;
	},

	async readSource(path, moduleName, required, cached) {
		let source = cached;
		if (!source) {
			// A versioned URL also avoids an older unversioned response when a
			// cached mb-files.js does not yet forward the fetch options argument.
			const url = path + '?icon-motion=' + this.currentVersion.join('.');
			try { source = await MB_Files.readFile(url, {cache: 'no-store'}); }
			catch (_) { throw new Error(path + '：读取失败，请检查本地服务器和库文件'); }
		}
		return this.validateSource(source, path, moduleName, required);
	},

	ensureLibrary(editor) {
		const project = editor.project;
		const nativeReady = () => [...this.nativeNames, ...this.pidNames].every(name => project.functionNamed(name));
		const ready = () => nativeReady() && this.isCurrent(project.libraryNamed('CoCube ICON')?.version) &&
			this.paletteSelectors.every(name => project.functionNamed(name) && project.blockSpecs.has(name)) &&
			[...this.gridHelpers, ...this.edgeHelpers].every(name => project.functionNamed(name)) &&
			this.gridVariables.every(name => project.allVariableNames().includes(name));
		if (ready()) return true;
		if (this.failed.has(project)) return false;
		if (this.source && (this.motionSources || nativeReady())) {
			if (!nativeReady()) {
				if (!this.pidNames.every(name => project.functionNamed(name))) this.installNative(project, 'PID', this.motionSources.pid, this.pidNames);
				if (!this.nativeNames.every(name => project.functionNamed(name))) this.installNative(project, 'CoCube Motion ICON', this.motionSources.cocube, this.nativeNames);
			}
			const existing = project.libraryNamed('CoCube ICON');
			if (!existing) project.addLibraryFromString(this.source, 'CoCube ICON', '//Libraries/Robots/CoCube ICON.ubl');
			else this.upgradeLibrary(editor, existing);
			editor.codeManager.recompileNeeded();
			return ready();
		}
		if (this.pending.has(project) || typeof MB_Files === 'undefined') return false;
		this.pending.add(project);
		if (!this.loading) {
			this.loading = Promise.all([
				this.readSource('Libraries/Robots/CoCube ICON.ubl', 'CoCube ICON',
					[...this.paletteSelectors, ...this.gridHelpers, ...this.edgeHelpers], this.source),
				this.readSource('Libraries/Robots/CoCube.ubl', 'CoCube', this.nativeNames, this.motionSources?.cocube),
				this.readSource('Libraries/Motors/PID.ubl', 'PID', this.pidNames, this.motionSources?.pid)
			]).then(([source, cocube, pid]) => {
				// Publish only after all three files pass validation. A missing
				// dependency must never leave a partially installed motion library.
				this.source = source; this.motionSources = {cocube, pid};
			}).finally(() => { this.loading = null; });
		}
		this.loading.then(() => {
			if (editor.project === project && editor.iconLayout) editor.updatePalette();
		}).catch(error => {
			this.failed.add(project);
			if (editor.project === project) editor.inform('无法加载 CoCube 运动积木。\n' + error.message);
			console.warn('ICON CoCube:', error);
		}).finally(() => this.pending.delete(project));
		return false;
	},

	isCurrent(version) { return version && (version[0] > this.currentVersion[0] || (version[0] === this.currentVersion[0] && version[1] >= this.currentVersion[1])); },

	configure(block) {
		if (!this.isMotion(block.selector)) return false;
		if (block.selector === this.targetSelector) return MB_IconTarget.configure(block);
		if (block.selector === this.headingSelector) return MB_IconHeading.configure(block);
		const inputs = block.inputs();
		if (this.selectors.includes(block.selector)) {
			if (inputs.length !== 1 || !(inputs[0] instanceof InputSlotMorph)) return false;
			inputs[0].mbIconParameter = this.selectors.indexOf(block.selector) < 2 ? 'cocube-steps' : 'cocube-turns';
			Object.setPrototypeOf(inputs[0], MB_IconParameterSlotMorph.prototype);
			inputs[0].fixLayout();
			return true;
		}
		// Retain editable legacy scripts; new palettes never offer these selectors.
		if (inputs.length !== 2 || !inputs.every(input => input instanceof InputSlotMorph)) return false;
		const move = block.selector === this.legacySelectors[0];
		const visible = inputs[move ? 1 : 0];
		inputs[move ? 0 : 1].mbIconHiddenParameter = true;
		visible.mbIconParameter = move ? 'cocube-steps' : 'cocube-turn';
		Object.setPrototypeOf(visible, MB_IconParameterSlotMorph.prototype);
		visible.fixLayout();
		return true;
	},

	set(block, index, value) {
		const move = block.selector === this.legacySelectors[0];
		const allowed = index === 0 ? (move ? ['forward', 'backward'] : ['left', 'right']) : this.turns.map(t => t.value);
		if (!allowed.includes(value)) return false;
		const slot = block.inputs()[index];
		if (slot.evaluate() !== value) { slot.setContents(value); slot.scriptChanged(); }
		block.parts().filter(p => p instanceof MB_IconMorph).forEach(p => p.rerender());
		block.fullChanged();
		return true;
	},

	// Vector paths shared by Canvas icons and their popup choices, no font glyphs.
	path(direction, degrees = 90) {
		if (direction === 'forward') return 'M -4 18 Q -4 22 0 22 Q 4 22 4 18 L 4 -8 L 10 -8 L 0 -22 L -10 -8 L -4 -8 Z';
		if (direction === 'backward') return 'M -4 -18 Q -4 -22 0 -22 Q 4 -22 4 -18 L 4 8 L 10 8 L 0 22 L -10 8 L -4 8 Z';
		if (degrees === 180) return 'M 14 20 L 14 -4 C 14 -25 -15 -25 -15 -4 L -15 3 M -24 -6 L -15 3 L -6 -6';
		if (degrees === 360) return 'M -17 -9 A 20 20 0 1 0 0 -20 L -10 -20 M 0 -29 L -10 -20 L 0 -11';
		return 'M -8 -16 L -4 -16 Q 22 -16 22 6 L 22 18 Q 22 22 18 22 Q 14 22 14 18 L 14 6 Q 14 -8 -4 -8 L -8 -8 L -8 -2 L -22 -12 L -8 -22 Z';
	},

	drawIcon(ctx, block, scale) {
		if (block.selector === this.targetSelector) { MB_IconTarget.drawIcon(ctx, block, scale); return; }
		if (block.selector === this.headingSelector) { MB_IconHeading.drawIcon(ctx, block, scale); return; }
		const index = this.selectors.indexOf(block.selector);
		const direction = index >= 0 ? ['forward', 'backward', 'left', 'right'][index] : block.inputs()[0]?.evaluate() || 'forward';
		const move = ['forward', 'backward'].includes(direction);
		const degrees = index >= 0 ? 90 : Number(block.inputs()[1]?.evaluate()) || 90;
		const solid = move || degrees === 90;
		const size = scale * (solid ? 1 : .78);
		ctx.save(); ctx.scale(size, size);
		ctx.fillStyle = '#368e8e'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
		if (!move && direction === 'right') ctx.scale(-1, 1);
		if (solid) MB_IconStyle.paint(ctx, this.path(direction, degrees), '#fff', MB_IconStyle.ink.motion);
		else {
			// Legacy U-turn/full-circle scripts remain editable, but are not on
			// the four-direction child shelf.
			const path = new Path2D(this.path(direction, degrees));
			MB_IconStyle.outline(ctx, MB_IconStyle.ink.motion); ctx.lineWidth = 11; ctx.stroke(path);
			ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke(path);
		}
		ctx.restore();
	},

	svg(direction, degrees = 90) {
		const move = ['forward', 'backward'].includes(direction);
		const solid = move || degrees === 90;
		return `<svg viewBox="${solid ? '-28 -28 56 56' : '-35 -35 70 70'}" aria-hidden="true"><g transform="scale(${!move && direction === 'right' ? -1 : 1} 1)"><path d="${this.path(direction, degrees)}" fill="${solid ? '#fff' : 'none'}" stroke="${MB_IconStyle.ink.motion}" stroke-width="${solid ? MB_IconStyle.lineWidth : 11}" stroke-linejoin="round" stroke-linecap="round"/>${solid ? '' : `<path d="${this.path(direction, degrees)}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`}</g></svg>`;
	},

	buildPicker(panel, slot) {
		const block = slot.parentThatIsA(BlockMorph), move = block.selector === this.legacySelectors[0];
		if (block.selector === this.targetSelector) { MB_IconTarget.buildPicker(panel, slot); return; }
		if (block.selector === this.headingSelector) { MB_IconHeading.buildPicker(panel, slot); return; }
		if (this.selectors.includes(block.selector)) { MB_IconInputs.buildStepper(panel, slot); return; }
		panel.classList.add('--cocube');
		const directionRow = document.createElement('div'); directionRow.className = 'icon-cocube-directions';
		const directions = move ? [['forward', '前进'], ['backward', '后退']] : [['left', '左转'], ['right', '右转']];
		const directionButtons = [], turnButtons = [];
		const refresh = () => {
			directionButtons.forEach(([button, value]) => button.setAttribute('aria-pressed', String(block.inputs()[0].evaluate() === value)));
			turnButtons.forEach(([button, choice]) => {
				button.innerHTML = this.svg(block.inputs()[0].evaluate(), choice.value) + `<span>${choice.label}</span>`;
				button.setAttribute('aria-pressed', String(block.inputs()[1].evaluate() === choice.value));
			});
		};
		for (const [value, label] of directions) {
			const button = document.createElement('button'); button.type = 'button';
			button.setAttribute('aria-label', label);
			button.innerHTML = this.svg(value) + `<span>${label}</span>`;
			button.onclick = () => { this.set(block, 0, value); refresh(); };
			directionRow.appendChild(button); directionButtons.push([button, value]);
		}
		panel.appendChild(directionRow);
		if (move) {
			const controls = document.createElement('div'); controls.className = 'icon-cocube-stepper';
			MB_IconInputs.buildStepper(controls, slot); panel.appendChild(controls);
		} else {
			const choices = document.createElement('div'); choices.className = 'icon-cocube-turns';
			for (const choice of this.turns) {
				const button = document.createElement('button'); button.type = 'button';
				button.setAttribute('aria-label', choice.label + ' ' + choice.value + '°');
				button.onclick = () => { this.set(block, 1, choice.value); refresh(); MB_IconInputs.close(); };
				choices.appendChild(button); turnButtons.push([button, choice]);
			}
			panel.appendChild(choices);
		}
		refresh();
	},

	receive(message) {
		if (!message.startsWith(this.faultPrefix)) return false;
		const editor = MB_editor;
		const pending = MB_IconStop.pending;
		MB_IconStop.receive(MB_IconStop.message);
		if (!pending) MB_IconStop.pending.then(() => editor.inform(message.slice(this.faultPrefix.length)));
		return true;
	},

	usesMotion(root, project, visited = new Set()) {
		if (!root?.forAllBlocks) return false;
		let found = false;
		root.forAllBlocks(block => {
			if (this.isMotion(block.selector)) { found = true; return; }
			if (visited.has(block.selector)) return;
			visited.add(block.selector);
			const fn = project.functionNamed(block.selector);
			if (fn && this.usesMotion(fn.cmdList, project, visited)) found = true;
		});
		return found;
	}
};
