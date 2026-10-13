# CoCube ICON Web

CoCube ICON 网页编辑器，与 [CoCube-ICON-Android](https://github.com/CoCubeRobot/CoCube-ICON-Android) 共用编辑器、32 种语言、移动端界面、连接准备和 23 个积木。

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

`src/`、`test/`、构建设置来自 Android 仓库，精确提交在 `ANDROID-SOURCE.json`。功能修复在 Android 仓库完成、测试并提交，再从 Android 仓库执行：

```sh
npm run export:web -- ../CoCube-ICON-Web
```

随后检查 Web diff、执行 `npm ci && npm test && npm run build` 并提交。Web 仓库不单独修改共享源码。移除共享文件时同步删除 Web 中的对应文件。

## Cloudflare Pages

正式网址：https://cocube-icon-web.pages.dev/ （2026-10-13 首次部署）。

当前使用 Wrangler 直接上传部署；GitHub Actions 自动执行测试与构建，还未连接自动发布。

可在 Cloudflare 控制台连接这个私有 GitHub 仓库，生产分支 `main`，构建命令 `npm ci && npm run build`，输出目录 `dist`，环境变量 `NODE_VERSION=22`。Cloudflare 的 GitHub App 需要允许访问本仓库。

或在本机已登录 Wrangler 时使用：

```sh
npx wrangler pages deploy dist --project-name cocube-icon-web --branch main
```

私有 GitHub 仓库与公开的 Pages 网址相互独立。

构建携带 404 页面以避免缺失 `.ubl`/`.js` 返回首页；静态文件禁止缓存，防止内测版本混用。不启用旧 WASM service worker。

许可证 MPL-2.0，上游原始包为 2026-10-11 ICON beta，来源见 `src/js-editor/SOURCE-INFO.json`。

2026-10-13 更新：新增 ToF 距离与 DLight 光线事件帽子，支持大于/小于阈值、单次触发与回差复位。ToF 单位 mm，DLight 使用原始读数。负数/缺失传感器不触发；实体模块尚需验收。

2026-10-13：移除家长设置/MB IDE 和 Activities 菜单入口。32 种语言保留。

2026-10-13 本地修复：传感器帽子复用原版 CoCube Module 读数函数，并修正缓存条件的 GP 逻辑语法；自动更新旧项目中原版生成的错误函数，保留自定义函数。ToF 触发已由用户实物验证，DLight 仍需实物验收。图标改为测距探头/障碍物与太阳；下方使用与广播、屏幕相同尺寸的下拉按钮，条件缩小显示在帽子内部。阈值、回差复位和编译语义不变。此处共享源码的本地修复需同步回 Android 仓库，再进行后续 Web 导出，避免覆盖。

2026-10-13 本地修复：ToF / DLight 临时编译展开按结构位置映射回画布中的原积木，恢复单块执行高亮，包括相同指令与循环内部指令。隐藏的传感器复位等待不生成动作高亮；整段运行外发光不变，无需更新固件。刷新本地页面并重新启动程序，使设备收到带执行反馈的新 chunk。测试覆盖编译、设备输出反馈模拟、停止清理、旧反馈失效与设备读回；实物高亮仍需验证。

2026-10-13：ToF、DLight 帽子按此顺序放到积木库末尾，其他积木顺序不变；末尾传感器预览仍参与连接准备。
