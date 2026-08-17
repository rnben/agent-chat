// 加载器：config.yaml → DefaultResourceLoader → AgentSession
// 零硬编码：一切路径/内容来自 config，代码只做组装
import { readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

export function expandHome(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export function toAbs(p, base) {
  return resolve(base, expandHome(p));
}

// 从 cwd 向上搜索 config.yaml（支持从 workspace 子目录启动）
function findConfig() {
  let dir = process.cwd();
  for (;;) {
    const p = join(dir, "config.yaml");
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) return "./config.yaml";
    dir = parent;
  }
}

export function loadConfig(configPath = findConfig()) {
  const raw = YAML.parse(readFileSync(configPath, "utf-8"));
  return {
    server: raw.server || {},
    agent: raw.agent || {},
    prompts: raw.prompts || {},
    skills: raw.skills || {},
    tools: raw.tools || {},
    _base: dirname(resolve(configPath)), // 路径解析基准 = config 所在目录
  };
}

// 扫描目录下所有 *.md 文件，按文件名排序，返回路径数组
function scanMdFiles(dir, base) {
  const abs = toAbs(dir, base);
  try {
    return readdirSync(abs)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => join(abs, f));
  } catch {
    return [];
  }
}

// 扫描 tools/ 目录的自定义工具插件（每个 .mjs 文件默认导出 ToolDefinition[]）
async function loadCustomTools(toolsDir, base) {
  const abs = toAbs(toolsDir, base);
  let files = [];
  try {
    files = readdirSync(abs).filter((f) => f.endsWith(".mjs"));
  } catch {
    return [];
  }
  const tools = [];
  for (const f of files) {
    try {
      const mod = await import("file://" + join(abs, f));
      const defs = mod.default || [];
      if (Array.isArray(defs)) tools.push(...defs);
    } catch (e) {
      console.error(`[loader] 工具插件加载失败 ${f}:`, e.message);
    }
  }
  return tools;
}

// 按 config 构造 DefaultResourceLoader（唯一构造点，createSession/listSkills 共用）
export async function buildLoader(cfg) {
  const base = cfg._base || process.cwd();
  const cwd = toAbs(cfg.agent.cwd || ".", base);
  const agentDir = expandHome(cfg.agent.agentDir || getAgentDir());
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const skillDirs = (cfg.skills.dirs || []).map((d) => toAbs(d, base));
  const appendFiles = scanMdFiles(cfg.prompts.appendDir || "./prompts/append", base);

  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    // 系统提示词：传路径，loader 自动读内容（resolvePromptInput）
    systemPrompt: cfg.prompts.system ? toAbs(cfg.prompts.system, base) : undefined,
    // 追加提示词：文件路径数组（同样自动读）
    appendSystemPrompt: appendFiles.length ? appendFiles : undefined,
    // skill 目录：全部来自配置
    additionalSkillPaths: skillDirs,
    noSkills: !!cfg.agent.noSkills,
    noExtensions: !!cfg.agent.noExtensions,
    noContextFiles: !!cfg.agent.noContextFiles,
    noPromptTemplates: true,
    noThemes: true,
  });
  await loader.reload();
  return { loader, settingsManager, cwd };
}

// 创建会话
// history: [{role:"user"|"assistant", content:string}] —— 用 SessionManager.inMemory 回灌，
// 让重启后恢复的 agent 依然拥有完整对话上下文（官方机制，不碰 pi 磁盘格式）
export async function createSession(cfg, { reload = true, history = [] } = {}) {
  const { loader, settingsManager, cwd } = await buildLoader(cfg);
  const customTools = await loadCustomTools(cfg.tools.dir || "./tools", cfg._base || process.cwd());

  let sessionManager;
  if (Array.isArray(history) && history.length) {
    sessionManager = SessionManager.inMemory(cwd);
    for (const m of history) {
      if (!m || !m.role || !m.content) continue;
      try {
        // 注意：content 必须转成 [{type:"text",text}] 数组格式，
        // 字符串格式的 assistant 消息会导致 deepseek 返回空回复
        const content =
          typeof m.content === "string"
            ? [{ type: "text", text: m.content }]
            : m.content;
        sessionManager.appendMessage({ role: m.role, content });
      } catch (e) {
        console.warn("[loader] 历史回灌跳过:", e.message);
      }
    }
  }

  const { session } = await createAgentSession({
    cwd,
    resourceLoader: loader,
    settingsManager,
    sessionManager,
    tools: cfg.agent.tools || undefined,
    customTools,
  });
  return session;
}
