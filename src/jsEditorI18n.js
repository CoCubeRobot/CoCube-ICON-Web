// Display-only translations: never rewrite selectors, program source or wire messages.
const english = {
    '距离触发':'Distance trigger','光线触发':'Light trigger','触发阈值':'Trigger threshold','光线读数':'Light reading','小于':'Less than','大于':'Greater than','满足条件时触发一次，恢复后可再次触发':'Triggers once when the condition is met; resets after recovery','请输入范围内的整数':'Enter an integer within the range',
    '确认':'Confirm','提示':'Information','输入':'Input','确定':'Ok','示例':'Examples','积木库':'Libraries','本机文件':'Computer',
    '定位丢失，请把小车放回 CoMaps 定位垫':'Position lost. Place the robot back on the CoMaps mat.',
    '请选择 1 到 5 步':'Choose 1 to 5 steps','请选择前进或后退':'Choose forward or backward',
    '前面超出地图了，请减少步数或转个弯':'The target is outside the mat. Reduce steps or turn.',
    '请选择转弯、掉头或转一圈':'Choose a quarter turn, half turn or full turn','请选择左转或右转':'Choose left or right',
    '目标超出安全范围：X 25～275，Y 25～175':'Target outside the safe range: X 25–275, Y 25–175',
    '小车走不动了，请检查前方是否有障碍':'The robot cannot move. Check for obstructions ahead.',
    '我的项目':'My project','新建':'New','打开':'Open','保存':'Save','清空画布':'Clear canvas','撤回':'Undo','活动':'Activities','语言':'Language','家长设置':'Parent settings','积木编程':'Blocks','图标编程':'Icons','项目菜单':'Project menu','连接小车':'Connect robot','数据线':'USB cable','蓝牙':'Bluetooth','断开连接':'Disconnect','已连接':'Connected','连接中':'Connecting','同步中':'Synchronizing','返回':'Back','关闭':'Close',
    '清空画布上的所有积木？':'Clear all blocks from the canvas?','请返回编辑器重新连接设备':'Reconnect from the editor','再按一次退出应用':'Press back again to exit','返回编程':'Back to coding',
    '选择蓝牙设备':'Select Bluetooth Device','选择 USB 串口设备':'Select USB Serial Device','扫描中...':'Scanning...','扫描超时，请重试':'Scan timed out; try again','未命名设备':'Unnamed device','取消':'Cancel',
    '手绘 5×5 LED 图案':'Draw a 5×5 LED pattern','LED 显示颜色':'LED display color','5×5 表情':'5×5 patterns','选择 5×5 表情':'Choose a 5×5 pattern','选择 LED 显示颜色':'Choose an LED color','点击或拖动点亮、擦除像素':'Tap or drag to draw and erase pixels','↕ 上下滑动查看更多':'↕ Scroll for more patterns','随机颜色':'Random color','清空':'Clear','完成':'Done',
    '移动格数（驶向格子中心）':'Move steps (grid centers)','转向次数（原地转到下一个正方向）':'Quarter turns','移动到目标点：选择 X、Y 坐标':'Choose target X and Y','朝向：上 0°、右 90°、下 180°、左 270°':'Heading: up 0°, right 90°, down 180°, left 270°','转个弯：选择方向和转弯大小':'Choose turn direction and angle','朝向角度（上 0°、右 90°、下 180°、左 270°）':'Heading: up 0°, right 90°, down 180°, left 270°','移动到目标点 X、Y':'Move to target X, Y',
    '想去哪里？':'Where to go?','点一点，或拖动小旗标':'Tap or drag the flag','请输入整数：X 0–300，Y 0–200':'Enter whole numbers: X 0–300, Y 0–200','朝向哪里？':'Which direction?','转一转箭头':'Turn the arrow','朝向角度':'Heading angle','角度（0～359）':'Angle (0–359)','请输入 0～359 的整数':'Enter a whole number from 0 to 359','前进':'Forward','后退':'Backward','左转':'Turn left','右转':'Turn right','转个弯':'Quarter turn','掉头':'Half turn','转一圈':'Full turn','夹爪张开':'Open gripper','夹爪闭合':'Close gripper',
    '蜂鸣器：选择音符和音阶':'Choose a buzzer note and octave','钢琴键盘':'Piano keyboard','音阶':'Octave','0 为中音区，负数更低，正数更高':'0 is the middle octave; negative is lower, positive is higher','降低音阶':'Lower octave','升高音阶':'Higher octave',
    '红色':'Red','橙色':'Orange','黄色':'Yellow','绿色':'Green','青色':'Cyan','蓝色':'Blue','紫色':'Purple','粉色':'Pink','白色':'White',
    '无法加载蜂鸣器积木，请确认 Libraries/Tone.ubl 文件存在后刷新页面。':'Cannot load buzzer blocks. Check Libraries/Tone.ubl.',
    '无法加载夹爪积木，请检查 CoCube Module 和 Servo 库文件。':'Cannot load gripper blocks. Check the CoCube Module and Servo libraries.',
    '无法加载 LED 积木，请确认 Libraries/LED Display.ubl 文件存在后刷新页面。':'Cannot load LED blocks. Check Libraries/LED Display.ubl.',
    '请连接 CoCube 小车':'Connect a CoCube robot','请把小车放在 CoMaps 定位垫上':'Place the robot on the CoMaps mat','定位丢失，请把小车放回定位垫':'Position lost. Place the robot back on the mat','运动超时，请检查小车和定位垫':'Movement timed out. Check the robot and mat',
    '缺少有效的版本号':'Missing a valid version number','库文件格式无法解析':'Cannot parse the library file','无法读取库文件，请检查本地运行目录中是否包含此文件':'Cannot read the library file. Check the bundled resources.',
    '目标超出地图：X 0～300，Y 0～200':'Target outside the mat: X 0–300, Y 0–200','定位变化过大，请重新放好小车':'Position changed too much. Place the robot on the mat again.',
    '请选择 1 到 5 格':'Choose 1 to 5 steps','请选择 1 到 4 次转弯':'Choose 1 to 4 quarter turns','前面超出地图了，请减少格数或转个弯':'The target is outside the mat. Reduce steps or turn.',
    '请把小车放在格子中心，离边缘远一点':'Place the robot at a grid center away from the edge.','快到地图边缘了，请调整路线':'Close to the mat edge. Change the route.',
    '小车走不动了，请检查是否被挡住':'The robot cannot move. Check for obstructions.',
    '无法加载 CoCube 运动积木。\n':'Cannot load CoCube motion blocks.\n',
    '发现自定义的 CoCube 导航函数，已保留原实现；这些函数不会自动更新：':'Custom CoCube navigation functions were preserved and will not be updated automatically: ',
    '不是有效的 ':'Invalid ',' 库文件（可能返回了网页或其他文件）':' library file (possibly an HTML page or another file)',
    '缺少积木定义：':'Missing block definitions: ','缺少运动函数：':'Missing motion functions: ','缺少运动变量：':'Missing motion variables: ',
    '版本为 ':'Version: ','，需要 ':'; required: ',' 或更新版本；请更新本地运行目录中的此文件':' or later. Update this bundled file.',
    '：读取失败，请检查本地服务器和库文件':': read failed. Check the server and library file.',
    '积木尚未写入设备，请重新连接后再试。':'The block has not been uploaded. Reconnect and retry.','设备连接或项目已改变，已取消旧的上传与运行请求。':'The connection or project changed. Old requests were cancelled.','设备已断开，积木未运行。请重新连接。':'Device disconnected. Reconnect before running blocks.','积木正在修改中，请编辑完成后再点击运行。':'Finish editing the blocks before running.','设备固件版本过旧，请先更新固件。':'Device firmware is too old. Update firmware first.','设备存储空间不足，未完成积木上传。':'Not enough storage to upload blocks.','积木代码过大，无法完整写入设备。':'Block code is too large to upload.','设备存储空间不足，积木未运行。':'Not enough device storage. The block was not run.','积木尚未准备好，已取消运行。':'Blocks are not ready. The run was cancelled.',
    '积木未能加载，请检查库文件。':' blocks could not be loaded. Check the libraries.','积木加载超时，请检查本地服务。':' block loading timed out. Check the local service.','积木尚未准备完整。':' blocks are not fully prepared.','积木栏未加载，请刷新页面后重试。':'The block shelf did not load. Reload and retry.',
    '蜂鸣器':'Buzzer','屏幕':'Display','CoCube 运动':'CoCube motion','夹爪':'Gripper',
    '准备机器人积木':'Prepare robot blocks','正在准备积木':'Preparing blocks','正在确认设备，请稍等…':'Checking the device, please wait…','积木写入进度':'Block preparation progress','准备好后就能开始玩啦。请保持连接，暂时不要切换页面。':'Keep the device connected while the blocks are prepared.','重试':'Retry','积木准备未完成':'Block preparation failed','正在核对设备中的积木…':'Checking blocks on the device…','正在加载声音、屏幕和机器人积木…':'Loading sound, display and robot blocks…',
    '彩色点阵':'Color matrix','画一幅彩色图案':'Draw a color picture','先选颜色，再点一点或拖动涂色':'Choose a color, then tap or drag to paint','5×5 彩色画板':'5×5 color canvas','画笔颜色与橡皮擦':'Brush colors and eraser','橡皮擦':'Eraser','涂满':'Fill','熄灭':'Off','准备失败':'Preparation failed',
    '设备没有回应，请重新连接。':'The device did not respond. Reconnect and retry.','未收到设备版本，无法准备积木。':'No device version received. Cannot prepare blocks.','设备未确认准备完成，请重新连接。':'The device did not confirm preparation. Reconnect and retry.','设备未确认积木写入，已停止运行请求。请重新连接后重试。':'Block upload was not confirmed. Reconnect and retry.','设备存储空间不足，未完成积木准备。':'Not enough device storage to prepare blocks.','设备连接中断，未完成积木上传。':'Connection lost during block upload.','设备写入超时，请重新连接。':'Device write timed out. Reconnect and retry.',
    'Wait (seconds)':'Wait (seconds)','Repeat count':'Repeat count','Decrease':'Decrease','Increase':'Increase'
};
const extra = {
    es: {'Undo':'Deshacer','Distance trigger':'Activación por distancia','Light trigger':'Activación por luz','Trigger threshold':'Umbral de activación','Light reading':'Lectura de luz','Less than':'Menor que','Greater than':'Mayor que','Triggers once when the condition is met; resets after recovery':'Se activa una vez; vuelve a estar listo al restablecerse la condición','Enter an integer within the range':'Introduce un entero dentro del rango','Where to go?':'¿Adónde quieres ir?','Tap or drag the flag':'Toca o arrastra la bandera','Which direction?':'¿En qué dirección?','Turn the arrow':'Gira la flecha','Done':'Listo','Clear':'Borrar','Octave':'Octava','Wait (seconds)':'Espera (segundos)','Repeat count':'Repeticiones','Parent settings':'Ajustes para adultos','Clear canvas':'Borrar el lienzo','Activities':'Actividades','USB cable':'Cable USB','Connect robot':'Conectar robot','Choose target X and Y':'Elige las coordenadas X e Y'},
    ja: {'Undo':'元に戻す','Where to go?':'どこに行く？','Tap or drag the flag':'旗をタップまたはドラッグ','Which direction?':'どちらを向く？','Turn the arrow':'矢印を回そう','Done':'完了','Clear':'消去','Octave':'オクターブ','Wait (seconds)':'待つ（秒）','Repeat count':'繰り返し回数','Parent settings':'保護者設定','Clear canvas':'キャンバスを消去','Activities':'アクティビティ','USB cable':'USB ケーブル','Connect robot':'ロボットに接続'},
    'zh-chs': {'Wait (seconds)':'等待（秒）','Repeat count':'重复次数','Decrease':'减少','Increase':'增加','Button':'按键','Send broadcast':'发送广播','Receive broadcast':'收到广播','Buzzer note':'蜂鸣器音符'},
    'zh-cht': {'Undo':'復原','Wait (seconds)':'等待（秒）','Repeat count':'重複次數','Decrease':'減少','Increase':'增加','Done':'完成','Clear':'清空'}
};
let reverse;
export function translateUI(value) {
    if (typeof value !== 'string' || !value) return value;
    const locale = window.GetText?.currentLocale || globalThis.GetText?.currentLocale || 'en';
    const en = english[value] || value;
    if (extra[locale]?.[en]) return extra[locale][en];
    if (locale.startsWith('zh')) {
        reverse ??= Object.fromEntries(Object.entries(english).filter(([key])=>/\p{Script=Han}/u.test(key)).map(([zh,en])=>[en,zh]));
        return reverse[en] || value;
    }
    const gt = window.GetText;
    const translated = gt?.localize(en);
    if (translated && translated !== en) return translated;
    const dynamic = value.match(/^([XY]) 坐标（(.+)）$/);
    if (dynamic) return `${dynamic[1]} coordinate (${dynamic[2]})`;
    if (/^第 \d+ 行，第 \d+ 列/.test(value)) { const n=value.match(/\d+/g); const color=value.split('，')[1]; return `Row ${n[0]}, column ${n[1]}${color ? ', '+translateUI(color) : ''}`; }
    if (/^目标 X /.test(value)) return value.replace('目标 X ','Target X ').replace(/，Y /,'; Y ').replace(/。.*$/,'');
    if (/^\d+ 度$/.test(value)) return value.replace(' 度',' degrees');
    if (/^[XY] (减少|增加) 1$/.test(value)) return value.replace('减少','decrease').replace('增加','increase');
    if (/\p{Script=Han}/u.test(value)) {
        let result = value;
        for (const [source, replacement] of Object.entries(english).sort((a,b)=>b[0].length-a[0].length)) {
            if (/\p{Script=Han}/u.test(source)) result = result.split(source).join(replacement);
        }
        return result;
    }
    return en;
}

export function installInterfaceTranslations() {
    // GetText is an upstream lexical global, not a window property.
    window.GetText = GetText;
    for (const choice of MB_IconDisplay.presets) english[choice.label] = choice.value;
    const originalLabel = MB_IconInputs.label;
    MB_IconInputs.label = function (slot) { return translateUI(originalLabel.call(this, slot)); };
    const originalInform = MB_Editor.prototype.inform;
    MB_Editor.prototype.inform = function (message) { return originalInform.call(this, translateUI(String(message))); };
    const nodes = new WeakMap(), attrs = new WeakMap();
    const refresh = root => {
        if (!root || !root.isConnected) return;
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        const apply = node => {
            if (node.nodeType === 3) {
                if (!node.parentElement?.closest('.icon-parameter-popover,.cocube-child-menu,.ble-device-dialog,.window,.cocube-toast,.icon-preparation,.cocube-dialog')) return;
                if (node.parentElement?.closest('script,style,textarea,input,[data-no-translate]')) return;
                const source = nodes.get(node);
                if (!source || node.textContent !== source.last) nodes.set(node, { original: node.textContent, last: node.textContent });
                const record = nodes.get(node), next = translateUI(record.original);
                if (node.textContent !== next) node.textContent = next;
                record.last = next;
            } else if (node.nodeType === 1) {
                for (const name of ['aria-label','title','placeholder']) {
                    const value = node.getAttribute(name); if (!value) continue;
                    const records=attrs.get(node)||{};attrs.set(node,records);
                    if (!records[name] || value!==records[name].last) records[name]={original:value,last:value};
                    const next=translateUI(records[name].original);
                    if (value!==next) node.setAttribute(name,next);
                    records[name].last=next;
                }
            }
        };
        apply(root); while(walk.nextNode()) apply(walk.currentNode);
    };
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'childList') for (const node of record.addedNodes) refresh(node);
            else refresh(record.target);
        }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
    const openPicker = MB_IconInputs.open;
    MB_IconInputs.open = function (...args) {
        openPicker.apply(this, args);
        if (this.panel) refresh(this.panel);
    };
    const set = GetText.setLocale;
    GetText.setLocale = function (locale) {
        set.call(this,locale);
        // The upstream loader re-enters this method after its dictionary arrives.
        if (this.currentLocale===locale) {
            refresh(document.body);
            document.dispatchEvent(new CustomEvent('cocube-locale-changed'));
        }
    };
    refresh(document.body);
}
