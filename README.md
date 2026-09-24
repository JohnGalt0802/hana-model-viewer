# Hana-model-viewer · 小花模型查看器

在 Hana 工作台里直接看 3D 工程模型。给助手一个模型路径，它就把模型开成一张卡片；卡片可以摆在黑板任意位置，也可以拆成独立窗口。

- **中文名**：小花模型查看器
- **形态**：Hana v2 App（`manifestVersion: 2`），装在 `<HANA_HOME>/apps/hana-model-viewer/`
- **版本**：3.1.0（2026-09-24 由 EasyModel 迁移为 v2 App 并改名）
- **支持格式**：STL / OBJ / PLY / GLB / GLTF / 3MF（网格直读）；STEP / STP / IGES / IGS（需可选依赖，见下）
- **作者**：John Galt

> 命名约定与同族 App 一致：`id` 用句柄（`hana-model-viewer`），`name` 用英文显示名（`Hana-model-viewer`），中文名随 `description` 与卡片标题出现。

## 功能

| 能力 | 说明 |
| --- | --- |
| 打开文件 | 通过宿主文件选择器选单个模型；也可直接把文件拖到卡片上 |
| 打开文件夹 | 选一个目录，自动加载首个模型并在卡片上方生成横向缩略图预览条 |
| 多模型工作集 | 卡片两侧 ◀ ▶ 切换，或点预览条缩略图直接跳转 |
| 视角 | 重置 / 透视 / 正交切换；前、后、左、右、俯、仰六个正视图；左下角小坐标轴可点击切正视 |
| 显示 | 线框、自转、自适应网格（按模型包围盒自动取网格单位） |
| 外观 | 颜色（预设色板 + 色环）、光源跟随视角 / 光源复位 |
| 主题 | **背景与全部配色跟随宿主主题**，支持手动强制浅色 / 深色 |
| 卡片形态 | 黑板卡片（`cardForm: flush`），可在工作台摆放，也可拆窗到独立窗口（默认 1100×720） |

## 安装

1. 把 `hana-model-viewer/` 整个目录放到 `<HANA_HOME>/apps/` 下（目录名必须与 manifest 的 `id` 完全一致）。
2. 重启 Hana。首次见到这个 App 时宿主会弹窗询问是否启用，确认后生效。
3. 首次调用工具前，在「设置 → 安全 → 应用能力」里为该 App 打开 **应用工具暴露给模型**（`app/tools.expose-to-model`），模型才能在对话里主动调用它。

## Agent 工具

工具名 **`hana_model_viewer_open_model`**（v2 工具名即最终名，宿主不再加前缀）。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `file` | string，必填 | 模型文件的本地绝对路径 |
| `fit` | boolean | 打开后自动 fit 到模型包围盒，默认 `true` |
| `mode` | `replace` \| `append` | 替换当前内容或追加到工作集，默认 `replace` |

工具返回一张卡片（`details.card`），卡片 route 形如
`/viewer.html?file=<路径>&fit=true&mode=replace`。

## 权限

| 能力词 | 用途 |
| --- | --- |
| `app/tools.expose-to-model` | 允许模型在对话里调用 `hana_model_viewer_open_model` |
| `app/resources.read` | 读取 `dataDir` 之外的用户模型文件与目录（卡片选文件、扫描文件夹、取模型字节） |

一切文件读取都走宿主的 ResourceIO（`sdk.resources.*`），由宿主按账本校验；App 不直接对盘外路径做 `node:fs` 读写。

## 目录结构

```
hana-model-viewer/
├── manifest.json                 # v2 清单（cards / capabilities / icon）
├── index.js                      # defineApp 入口：工具 + /model /scan 路由
├── README.md
├── assets/
│   └── icon.png                  # App 身份图标（512×512）
├── sdk/                          # 随包分发的 @hana/app-sdk 服务端构建产物
└── ui/                           # 卡片页面树，route 相对此目录解析
    ├── viewer.html               # 卡片页面（route: /viewer.html）
    └── assets/
        ├── sdk.js                # 浏览器端 SDK（hana 对象）
        ├── viewer.js             # 渲染核心：three.js 场景 + 交互 + 主题跟随
        ├── viewer.css            # 样式：配色全部取自宿主主题变量
        ├── cover.png             # 卡片封面（face）
        └── vendor/legacy/        # three.js 与各格式 Loader（UMD，随包分发）
```

## 主题跟随

宿主会把主题 CSS 注入卡片 iframe，其中定义了 `--bg` / `--bg-card` / `--bg-glass` / `--text` / `--text-light` / `--text-muted` / `--border` / `--shadow` / `--accent` / `--accent-hover` / `--accent-light` 等变量。本 App 的做法：

- **默认（外观·跟随）**：`body` 背景透明，卡片底色由宿主给；工具栏、菜单、预览条、状态条全部使用上述变量，因此换任何主题（含用户自命名主题）都自然贴合。
- **浅色/深色判定**：three.js 的网格线、坐标轴、地面取色需要知道当前底色深浅。App 通过探针元素解析 `--bg` 的实际颜色并计算亮度，而不是猜主题名；宿主无法提供时依次退到 `hana.theme` 的 `appearance`、主题名关键词、系统偏好。左下角小坐标轴的配色也跟着深浅换档。
- **手动覆盖**：工具栏「外观」按钮在 跟随 → 浅色 → 深色 之间循环，用于看深色模型时临时换底。覆盖写在 `html[data-em-skin]` 上，只影响本卡片。

## 已知限制

- **STEP / IGES 需要可选依赖 `occt-import-js`**，本包未包含（约 11.6 MB）。缺失时卡片会明确提示，网格格式不受影响。
- 卡片内拖入的浏览器级文件（`dataTransfer.files`）在页面内直接解析；要落到磁盘路径的场景请用「打开文件」。
- 预览条缩略图在主线程空闲时逐个生成，模型数量很多时需要一点时间。
- 右下信息条只在有内容（模型名 / 三角面数 / 尺寸，或加载失败提示）时出现，空态不占位。

## 命名与迁移历史

| 阶段 | 标识 | 说明 |
| --- | --- | --- |
| v1 插件 2.0.1 | `plugins/easymodel-viewer` | `manifestVersion: 1`，`contributes.cards[].type: webview`，自实现 iframe 协议 |
| v2 App 3.0.0 | `apps/easymodel-viewer` | 迁移到 v2 装载机制，背景改为跟随宿主主题 |
| v2 App 3.1.0 | `apps/hana-model-viewer` | 改名（id / 显示名 / 卡片标题 / 工具名），沿用 v2 结构 |

3.0.0 的迁移要点：

| | v1 插件 | v2 App |
| --- | --- | --- |
| 装载 | `<HANA_HOME>/plugins/` | `<HANA_HOME>/apps/` |
| 清单 | 卡片 `type: webview`，无 `face` | 卡片必带 `face`，iframe 能力改由顶层 `capabilities` 声明 |
| 前端协议 | 自实现 `hana.plugin.ui` postMessage + 手拼 `/api/plugins/...` | `@hana/app-sdk`（`hana.api.fetch` / `hana.theme` / `hana.resources` / `hana.ui.resize`） |
| 后端路由 | `routes/viewer.js`（Hono 工厂，靠文件扫描装载） | `sdk.routes.register()`，地址 `/api/apps/<id>/routes/*` |
| 资产加载 | 因跨源 CORP 限制把 three.js 与全部 Loader 内联进 HTML | `ui/` 树内相对路径直接引用，不必内联 |
| 卡片标题栏 | 顶部留 44px 安全区躲开 solid 标题栏 | `cardForm: flush` 由宿主处理 chrome，补丁退役 |
| 取数 | `node:fs` 直读任意路径 | `sdk.resources.read/list/stat`（宿主按账本校验） |
| 主题 | 自带深色渐变 + 手动「换肤」 | 背景与配色跟随宿主主题，手动覆盖为可选 |

## 版本

- 3.1.0（2026-09-24）：改名 Hana-model-viewer / 小花模型查看器；工具名改为 `hana_model_viewer_open_model`；卡片标题用中文；坐标轴重做（细杆 + 锥头 + 球心 + 受光材质 + X/Y/Z 字标，随主题调色）；移除右下空态提示条
- 3.0.0（2026-09-24）：迁移为 Hana v2 App；背景与配色跟随宿主主题；卡片可拆窗；文件读写改走 ResourceIO
- 2.0.1（2026-08-26）：修复卡片顶部按钮命中区域与常驻变色
- 2.0.0（2026-08-23）：移除 right/center 二选一配置
- 1.5.0：缩略图预览条 + WebGL 上下文修复
- 1.2.0：打开文件夹 + 多模型工作集
