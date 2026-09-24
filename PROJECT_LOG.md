# 小花模型查看器（Hana-model-viewer）开发日志

## 项目缘起

在 Hana 工作台里直接看 3D 工程模型：给助手一个模型路径，它就把模型开成一张卡片，可摆放、可拆窗。

## 想要的效果

- 卡片宽度变化时（窄到 320px）工具栏每个入口保留完整点击区域，下拉不被截断
- 界面背景与配色跟随宿主主题，而不是插件自带一套肤色
- 视口内的坐标轴要有仪器感（受光、有明暗、有中心结构），不是纯色塑料玩具

## 当前版本

- `manifest.json`：`3.1.0`（`manifestVersion: 2`）
- 源码目录：`app-dev-sources/hana-model-viewer/`
- 安装位置：`<HANA_HOME>/apps/hana-model-viewer/`
- 项目仓库：`JohnGalt0802/hana-model-viewer`（公开）

## 外部依赖

- `@hana/app-sdk`：随包分发（`sdk/` 服务端 + `ui/assets/sdk.js` 浏览器端），版本与宿主一致（0.1023.1）
- `three.js` 与各格式 Loader：`ui/assets/vendor/legacy/`（UMD 传统版，随包分发）
- OpenCascade WASM：由 `occt-import-js` 按需加载，用于 STEP / IGES。**当前未随包分发**，缺失时卡片明确报错

## 当前进度

- 2026-09-24：从 v1 插件迁移为 v2 App（3.0.0）：`plugins/` → `apps/`，`manifestVersion: 1` → `2`，自实现 iframe 协议 → `@hana/app-sdk`，`routes/` Hono 工厂 → `sdk.routes.register()`，`node:fs` 直读 → `sdk.resources.*`
- 2026-09-24：取消「内联全部资产」的老做法（v1 时代为绕开跨源 CORP 限制），`ui/` 树内相对路径直接引用
- 2026-09-24：背景改为跟随宿主主题：`body` 背景透明，工具栏/菜单/预览条/状态条全部改用宿主主题变量（`--bg` / `--bg-glass` / `--text` / `--accent` / `--border` / `--shadow`），删除 25 条 `body.light` 硬编码覆盖；浅深判定改为解析 `--bg` 实际颜色的亮度
- 2026-09-24：新增卡片拆窗（`detached`，默认 1100×720）
- 2026-09-24：移除右下空态提示条（`#info:empty` 自动隐藏，有内容时才出现）
- 2026-09-24：坐标轴重做：细杆 + 小锥头 + 中心球 + 标准材质吃光照 + X/Y/Z 字标，配色随主题深浅换档；画布 84→104px、相机距离 4.0→5.0 让字标落进视锥
- 2026-09-24：改名 3.1.0：id `easymodel-viewer` → `hana-model-viewer`，显示名 `Hana-model-viewer`，中文名「小花模型查看器」，卡片 id → `viewer`，工具名 → `hana_model_viewer_open_model`

## 功能验证清单

### 后端工具

- [x] `hana_model_viewer_open_model` - 在卡片中打开模型 - 输入：有效模型绝对路径 / 预期：结构化 `details.card`（v2 正门）
- [ ] 同一路径 `mode=append` 追加工作集
- [ ] 目录路径调用时返回明确错误（提示用卡片里的「打开文件夹」）

### 路由

- [x] `/model` 网格格式直出二进制（`new Response(Uint8Array)`）
- [ ] `/model` STEP/IGES 分支在缺 `occt-import-js` 时返回 501 与可读原因
- [x] `/scan` 列目录并按名自然排序

### 前端 UI

- [ ] 窄卡片（320px）下逐个验证：打开文件、打开文件夹、线框、自转、网格、视角、颜色、外观、光源
- [ ] 视角下拉、颜色下拉的层级与外部点击关闭
- [ ] 打开文件夹后的预览条横向滚动与点选
- [ ] 切换宿主主题（含自命名主题）时背景、工具栏、坐标轴配色跟随
- [ ] 「外观」按钮三态循环（跟随 → 浅色 → 深色）与复位
- [ ] 空态下右下无提示块；加载模型后信息条出现

### 装载

- [x] 宿主发现并加载：`plugin "hana-model-viewer" … loaded`（v3.0.0 时验证）
- [x] 官方 validator：0 error / 1 warning（`DYNAMIC_DEPENDENCIES_NOT_PROVEN`，动态依赖无法静态证明）
- [ ] 改名后（3.1.0）重新批准与加载验证

## 已知问题 / TODO

- [ ] STEP / IGES 需要可选依赖 `occt-import-js`（npm 0.0.23，解包约 11.6 MB），尚未 vendor 进包
- [ ] `details.card` 的字段白名单在 APPS.md 里没有成文条款，`route` 带 query 只有现成 App 的用法作依据
- [ ] 前端逐项点击验证仍未执行

## 经验记录

### 🐛 踩坑

- 2026-09-24：v2 App 的 `ui/` 静态资源由宿主以 `Cache-Control: max-age=0, must-revalidate` 提供，**只改卡片页面（CSS/JS）不必重启 Hana**，关掉卡片重开即吃到新文件；只有改 `index.js` 这类后端入口才需要重载 App runtime。
- 2026-09-24：v2 卡片 iframe 的资产走 `ui/` 相对路径即可（`./assets/xxx.js`），v1 时代因跨源 CORP 全量内联的做法在 v2 属于历史包袱，不要再沿用。
- 2026-09-24：主机 git 直连 `github.com:443` 会间歇性不通，而 `api.github.com` 稳定；git 通道不可用时可用 Git Data API（blob → tree → commit → ref）投递整棵树。
- 窄卡片下 v1 的失效模式是两个问题叠加：工具栏第一排与宿主标题栏重叠，同时 flex 子项允许压缩导致按钮区域变窄。v2 用 `cardForm: flush` 由宿主处理 chrome 后，44px 安全区补丁退役。

### ✅ 成功经验

- 顶部控件的 `type="button"` 显式声明，避免页面被表单包裹时产生非预期提交行为。
- 三态开关（跟随/浅色/深色）比二态开关更贴合「默认跟随宿主」的语义，手动覆盖要写在 `html` 上而不是 `body`，否则下级 `var()` 桥接层不会跟着换。

## 备份记录

- 2026-09-24：v1 插件（2.0.1）移入 `plugin-backups/easymodel-viewer-v2.0.1`，未删除
- 2026-09-24：v1 源码保留在 `plugin-dev-sources/easymodel-viewer/`

## 审查记录

- 2026-08-26 — 开发中审查 — 大姐 — v1 静态检查、dev 加载、`open_model` 回归通过；逐项点击验证未执行
- 2026-09-24 — 迁移审查 — 大姐 — v2 官方 validator 通过（0 error）、`index.js` 与 `viewer.js` 语法通过、宿主装载成功；改名后重新验证待执行
