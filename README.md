# pi-agent-server

基于 [pi 嵌入式 SDK](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)（`createAgentSession`）构建的 AI Agent 聊天服务。**零硬编码**：能力由 Skill 文件驱动，人格由提示词文件定义，工具由配置白名单控制。

## ✨ 特性

- **嵌入式 SDK**：直接在 Node.js 进程内运行 agent，不 spawn CLI
- **Skill 驱动**：加能力 = 往 `skills/` 目录放 Markdown 文件，不碰代码
- **工具白名单**：默认只开放 `read` + `bash`，能力边界清晰
- **双主题前端**：Vue 3 + Tailwind CSS 4 手写聊天界面（深色/浅色切换），Markdown + 代码高亮 + 数学公式 + 工具调用卡片
- **会话持久化**：按客户端 IP 隔离，重启不丢，支持历史上下文恢复
- **内网部署**：IP 白名单访问控制（适合 10 人以内小团队）
- **Monorepo**：npm workspaces，前后端一体

## 🏗 架构

```
浏览器 ──► Vite :5173 ──(X-Forwarded-For)──► 后端 :8787
                                            ├── IP 白名单校验
                                            ├── 会话存储 data/sessions.json（按 IP 隔离）
                                            └── createAgentSession（pi 嵌入式 SDK）
```

```
pi-agent-server/
├── config.yaml              # 唯一配置入口（模型/白名单/skill 目录/工具）
├── prompts/system.md        # 产品人格（改人格不改代码）
├── prompts/append/          # 追加提示词目录
├── skills/builtin/          # 内置能力（Skill 文件）
├── skills/custom/           # 自定义能力目录
├── tools/                   # 自定义工具插件目录（预留）
├── packages/backend/        # Node.js 后端（HTTP + SSE）
└── packages/web/            # Vue 3 前端（Vite + Tailwind CSS 4）
```

## 🚀 快速开始

### 1. 准备 pi 环境（必需）

`@earendil-works/pi-coding-agent` 依赖本地 pi 配置（模型 + 认证）：

```bash
npm install -g @earendil-works/pi-coding-agent
```

配置 `~/.pi/agent/models.json`（模型定义）与 `~/.pi/agent/auth.json`（API Key），或直接运行 `pi` 交互模式引导配置。**API Key 只存放在 `~/.pi/agent/`，绝不进入本项目文件。**

### 2. 安装与启动

```bash
npm install
npm run start      # 后端 :8787
npm run dev:web    # 前端 :5173（另开终端）
```

浏览器打开 `http://127.0.0.1:5173`

### 3. 配置（config.yaml）

```yaml
server:
  host: "0.0.0.0"            # 内网监听
  allowedIps:                # IP 白名单（空 = 不限制）
    - "127.0.0.1"
    - "192.168.31.*"         # 段通配

agent:
  tools: ["read", "bash"]    # 工具白名单（能力边界）
  model: "deepseek-v4-flash" # 模型（不填则用 pi settings.json）

prompts:
  system: "./prompts/system.md"   # 人格文件
skills:
  dirs: ["./skills/builtin", "./skills/custom"]  # 能力目录
```

## 🔒 安全说明

- **API Key 不入库**：密钥只存在于 `~/.pi/agent/auth.json`，`.gitignore` 已排除 `.env`、`data/` 等敏感路径
- **IP 白名单**：白名单外 IP 一律 403；`X-Forwarded-For` 仅信任来自本机回环代理的转发（伪造无效）
- **会话隔离**：每个客户端 IP 独立会话，互不可见
- **能力限制**：工具白名单默认仅 `read` + `bash`，不暴露编辑/网络等其他工具

## 📡 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | SSE 流式对话（`message` + `sessionId`） |
| GET | `/api/sessions` | 当前 IP 的会话列表 |
| GET | `/api/sessions/:id` | 会话详情（含历史消息） |
| DELETE | `/api/sessions/:id` | 删除会话 |
| GET | `/api/skills` | 已加载的 Skill 列表 |

## 🧩 扩展能力（加 Skill）

在 `skills/custom/` 放一个 Markdown 文件（YAML frontmatter + 步骤说明），重启后 agent 即获得该能力：

```markdown
---
name: my-skill
description: 技能描述（agent 何时使用）
---
# 技能名称
## 执行步骤
1. 用 bash 执行 xxx
2. 用 read 读取 xxx
## 注意事项
```

## 🛠 技术栈

- 后端：Node.js + `@earendil-works/pi-coding-agent`（嵌入式 SDK）+ 原生 HTTP/SSE
- 前端：Vue 3 + Vite 5 + Tailwind CSS 4 + markdown-it + highlight.js + KaTeX
- 存储：JSON 文件（`data/sessions.json`）
