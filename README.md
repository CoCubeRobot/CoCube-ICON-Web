# CoCube ICON Web

CoCube ICON 网页编辑器，与合并版 [CoCube-android](https://github.com/CoCubeRobot/CoCube-android) 共用 ICON 编辑器、32 种语言、连接准备和 23 个积木。原独立 CoCube-ICON-Android 仓库尚未同步全部后续修改。

```sh
npm ci
npm test
npm run start
# 或构建静态文件
npm run build
npm run preview
```

入口为 `/`（固定跳转 `/icon.html`）。通过 HTTPS 部署；本地 localhost 可调试。桌面 Chrome/Edge 支持 USB Web Serial 与 Web Bluetooth，Android Chrome 蓝牙需浏览器支持；iOS/Safari 可编辑，但缺少设备连接 API。手机 USB 使用 Android App。

## 共用源码

截至 2026-10-29，`src/js-editor/` 的 545 个核心文件与当前合并版 Android 本地源码一致，撤回、定位垫判断、小范围数字选择和防误触等共用模块也已同步。源码基线、是否含本地未提交修改及核对摘要记录在 `ANDROID-SOURCE.json`；基线提交本身并不包含全部本地修改。

同步时逐项比较共用文件，保留 Web 的浏览器 USB/BLE 连接、跨网站切换、入口和缓存策略；Android 的窗口避让、生命周期和内嵌编辑器切换不能整包覆盖到 Web。共用模块修改后在各端分别测试。检查 Web diff，执行 `npm ci && npm test && npm run build`，并运行相关浏览器回归后提交。旧的 `export:web` 命令不适用于当前合并版 Android。

## Cloudflare Pages

正式网址：https://icon.cocube.fun/ 。Pages 项目：https://cocube-icon-web.pages.dev/ 。

当前使用 Wrangler 直接上传部署；GitHub Actions 自动执行测试与构建，还未连接自动发布。

可在 Cloudflare 控制台连接这个私有 GitHub 仓库，生产分支 `main`，构建命令 `npm ci && npm run build`，输出目录 `dist`，环境变量 `NODE_VERSION=22`。Cloudflare 的 GitHub App 需要允许访问本仓库。

或在本机已登录 Wrangler 时使用：

```sh
npx wrangler pages deploy dist --project-name cocube-icon-web --branch main
```

私有 GitHub 仓库与公开的 Pages 网址相互独立。

2026-10-29 仓库更新：浏览器 USB 选择器按 MicroBlocks 的 13 个串口芯片厂商 ID 筛选；共用蓝牙选择器保留设备行和触控目标，避免扫描更新时重建列表导致点不到设备或关闭按钮。普通 Web 连接仍使用浏览器原生选择器。未引入 NLD 固件兼容、品牌或其 Service Worker。

本次验证：30 项 Node 测试及生产构建通过；Chrome 中英文/西语连接菜单、USB/BLE 筛选与用户激活、取消不报错、扫描中设备行稳定及关闭、数字选择/输入法边界、多步撤回和长按误触回归通过。真实小车连接未在本次验证。

构建携带 404 页面以避免缺失 `.ubl`/`.js` 返回首页；静态文件禁止缓存，防止内测版本混用。不启用旧 WASM service worker。

许可证 MPL-2.0，上游原始包为 2026-10-11 ICON beta，来源见 `src/js-editor/SOURCE-INFO.json`。

2026-10-13 更新：新增 ToF 距离与 DLight 光线事件帽子，支持大于/小于阈值、单次触发与回差复位。ToF 单位 mm，DLight 使用原始读数。负数/缺失传感器不触发；实体模块尚需验收。

2026-10-13：移除家长设置/MB IDE 和 Activities 菜单入口。32 种语言保留。

2026-10-13 本地修复：传感器帽子复用原版 CoCube Module 读数函数，并修正缓存条件的 GP 逻辑语法；自动更新旧项目中原版生成的错误函数，保留自定义函数。ToF 触发已由用户实物验证，DLight 仍需实物验收。图标改为测距探头/障碍物与太阳；下方使用与广播、屏幕相同尺寸的下拉按钮，条件缩小显示在帽子内部。阈值、回差复位和编译语义不变。这些核心修复已包含在当前 Web 和合并版 Android 源码中。

2026-10-13 本地修复：ToF / DLight 临时编译展开按结构位置映射回画布中的原积木，恢复单块执行高亮，包括相同指令与循环内部指令。隐藏的传感器复位等待不生成动作高亮；整段运行外发光不变，无需更新固件。刷新本地页面并重新启动程序，使设备收到带执行反馈的新 chunk。测试覆盖编译、设备输出反馈模拟、停止清理、旧反馈失效与设备读回；实物高亮仍需验证。

2026-10-13：ToF、DLight 帽子按此顺序放到积木库末尾，其他积木顺序不变；末尾传感器预览仍参与连接准备。

正式 ICON 域名：https://icon.cocube.fun/ 。Web 项目菜单提供新标签页打开 MicroBlocks 和选择编程方式，目标为 cocube.fun；入口页偏好保存在主域名，ICON 子域不直接修改它。
