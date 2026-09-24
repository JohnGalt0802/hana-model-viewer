// 小花模型查看器（Hana-model-viewer）—— Hana v2 App 服务端入口
//
// 3.1 从 v1 插件（EasyModel）迁移并改名而来，职责分三块：
//   1) hana_model_viewer_open_model 工具：把模型文件「开成一张卡片」交给对话（details.card）
//   2) /model 路由：按路径取模型字节（网格格式直出二进制，STEP/IGES 走 occt 解析成 JSON）
//   3) /scan 路由：打开文件夹后列出目录内的可读模型
//
// 文件读取一律走 sdk.resources（宿主按应用与账本校验），不直接用 node:fs 读盘外路径；
// 卡片页面在 ui/viewer.html，与后端通过 /api/apps/hana-model-viewer/routes/* 通信。
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineApp } from "./sdk/app-contract/server-client.js";

const APP_ID = "hana-model-viewer";
const CARD_ID = "viewer";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const CAD_EXTS = new Set(["step", "stp", "iges", "igs"]);
const MODEL_EXTS = new Set(["stl", "obj", "ply", "glb", "gltf", "3mf", "step", "stp", "iges", "igs"]);

function msgOf(e) {
  return String((e && e.message) || e || "未知错误");
}
function extOf(p) {
  const i = String(p).lastIndexOf(".");
  return i >= 0 ? String(p).slice(i + 1).toLowerCase() : "";
}
function baseName(p) {
  return String(p).split(/[\\/]/).pop() || String(p);
}

// ── STEP / IGES：可选依赖 occt-import-js ──
// 未随包分发时给一句能看懂的话，而不是把 require 栈丢给用户。
let occtPromise = null;
function getOCCT() {
  if (!occtPromise) {
    occtPromise = import("occt-import-js")
      .then((mod) => (typeof mod.default === "function" ? mod.default() : mod))
      .catch((e) => {
        occtPromise = null;
        throw new Error(
          "STEP/IGES 解析需要可选依赖 occt-import-js（本包未包含）。" +
          "网格格式 STL/OBJ/PLY/GLB/GLTF/3MF 不受影响。原始错误：" + msgOf(e)
        );
      });
  }
  return occtPromise;
}

export default defineApp(async (sdk) => {
  const log = (m) => { void sdk.logger?.info?.(`[hmv] ${m}`); };
  const warn = (m) => { void sdk.logger?.warn?.(`[hmv] ${m}`); };

  await log(`小花模型查看器 v3.1 已加载（${appDir}）`);

  // ── 工具：把模型开成卡片 ──
  await sdk.tools.register({
    name: "hana_model_viewer_open_model",
    description:
      "在小花模型查看器卡片中打开一个 3D 模型文件（STL/OBJ/PLY/GLB/GLTF/3MF/STEP/IGES），" +
      "以卡片形式在工作台渲染显示。用户给出模型文件（本地绝对路径，或拖入对话的文件）时优先调用。" +
      "卡片可横向预览同目录下的其他模型，也可拆成独立窗口。",
    parameters: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "模型文件的本地绝对路径，如 C:\\models\\part.stl",
        },
        fit: {
          type: "boolean",
          description: "打开后自动 fit 视角到模型包围盒（默认 true）",
          default: true,
        },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description: "replace 替换查看器当前内容；append 追加到当前工作集（默认 replace）",
          default: "replace",
        },
      },
      required: ["file"],
    },
    sessionPermission: { readOnly: true },
    execute: async (input) => {
      const file = input && typeof input.file === "string" ? input.file.trim() : "";
      const fit = !(input && input.fit === false);
      const mode = input && input.mode === "append" ? "append" : "replace";

      if (!file) {
        return { content: [{ type: "text", text: "缺少模型文件路径（file 参数）" }], isError: true };
      }

      const ext = extOf(file);
      if (!MODEL_EXTS.has(ext)) {
        return {
          content: [{ type: "text", text: `不支持的模型格式 .${ext || "?"}（支持 STL/OBJ/PLY/GLB/GLTF/3MF/STEP/IGES）` }],
          isError: true,
        };
      }

      let info = null;
      try {
        info = await sdk.resources.stat({ kind: "local-file", path: file });
      } catch (e) {
        return {
          content: [{ type: "text", text: `读取文件信息失败：${msgOf(e)}` }],
          isError: true,
        };
      }
      if (!info || info.exists === false) {
        return { content: [{ type: "text", text: `文件不存在：${file}` }], isError: true };
      }
      if (info.isDirectory) {
        return {
          content: [{ type: "text", text: `这是一个目录，不是模型文件：${file}。请在卡片里用「打开文件夹」。` }],
          isError: true,
        };
      }

      const name = baseName(file);
      const bytes = info.version && typeof info.version.size === "number" ? info.version.size : null;
      const sizeText = bytes === null ? "大小未知" : bytes >= 1048576
        ? (bytes / 1048576).toFixed(1) + " MB"
        : Math.max(0.1, bytes / 1024).toFixed(1) + " KB";
      const cadNote = CAD_EXTS.has(ext) ? "（STEP/IGES 需要可选依赖，缺失时卡片会说明原因）" : "";

      const query = new URLSearchParams({ file, fit: String(fit), mode });
      const route = `/viewer.html?${query.toString()}`;

      return {
        content: [{
          type: "text",
          text: `已就绪 ${name}（${sizeText} · ${ext}）${cadNote}\n` +
                `卡片：小花模型查看器（可在工作台摆放或拆成独立窗口）`,
        }],
        details: {
          card: {
            pluginId: APP_ID,
            cardId: CARD_ID,
            route,
            title: `小花模型查看器 · ${name}`,
            description: `${ext} · ${sizeText}`,
            aspectRatio: "16:10",
            cardForm: "flush",
          },
          modelViewer: {
            filePath: file,
            fileName: name,
            fileSize: bytes,
            format: ext,
            fit,
            mode,
          },
        },
      };
    },
  });

  // ── 路由：卡片页面取数 ──
  await sdk.routes.register((app) => {
    // 目录扫描：列出文件夹内可读模型（顶层，按名自然排序）
    app.get("/scan", async (c) => {
      const dir = c.req.query("dir") || "";
      if (!dir) return c.json({ error: "缺少 dir 参数" }, 400);
      try {
        const listed = await sdk.resources.list({ kind: "local-file", path: dir });
        const files = [];
        for (const item of (listed && listed.items) || []) {
          if (item.isDirectory) continue;
          const ext = extOf(item.name);
          if (!MODEL_EXTS.has(ext)) continue;
          files.push({
            name: item.name,
            path: path.join(dir, item.name),
            size: typeof item.size === "number" ? item.size : 0,
            ext,
          });
        }
        files.sort((a, b) => a.name.localeCompare(b.name, "zh", { numeric: true }));
        return c.json({ dir, count: files.length, files });
      } catch (e) {
        return c.json({ error: "目录读取失败：" + msgOf(e) }, 500);
      }
    });

    // 模型数据：CAD 解析成 JSON，其余直出二进制
    app.get("/model", async (c) => {
      const file = c.req.query("path") || "";
      if (!file) return c.json({ error: "缺少 path 参数" }, 400);
      const ext = extOf(file);

      let content = null;
      try {
        const read = await sdk.resources.read({ kind: "local-file", path: file });
        content = read && read.content;
      } catch (e) {
        return c.json({ error: "读取失败：" + msgOf(e) }, 500);
      }
      if (!content) return c.json({ error: "读取失败：内容为空" }, 500);

      if (CAD_EXTS.has(ext)) {
        let occt = null;
        try {
          occt = await getOCCT();
        } catch (e) {
          warn("CAD 依赖缺失：" + msgOf(e));
          return c.json({ error: msgOf(e) }, 501);
        }
        try {
          const params = { linearUnit: "millimeter" };
          const result = ext === "iges" || ext === "igs"
            ? occt.ReadIgesFile(content, params)
            : occt.ReadStepFile(content, params);
          if (!result || !result.success) {
            return c.json({ error: "解析失败：" + ((result && result.error) || "未知") }, 422);
          }
          return c.json({ format: "cad", meshes: result.meshes || [] });
        } catch (e) {
          return c.json({ error: "CAD 解析异常：" + msgOf(e) }, 500);
        }
      }

      // 二进制直出。Hono 的 c.body 对 Buffer 支持不稳，这里直接返回 Web Response。
      return new Response(new Uint8Array(content), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    });
  });
});
