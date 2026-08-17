// HTTP 服务：POST /api/chat（SSE 流式）+ 会话持久化（按客户端 IP 隔离）
// 零硬编码：所有行为来自 config + skills + prompts
import { createServer } from "node:http";
import { URL } from "node:url";
import { loadConfig, createSession } from "./loader.js";
import { bridgeSession, sendSse } from "./bridge.js";
import { createStore } from "./store.js";

const cfg = loadConfig();
const store = createStore(cfg);
const sessions = new Map(); // sessionId -> { agent: AgentSession, ip: string }

// 客户端 IP：仅当请求来自本机回环（Vite 代理/Nginx）时信任 X-Forwarded-For，
// 否则用 socket 地址 —— 直接访问伪造 XFF 无效
function clientIp(req) {
  const remote = store.normalizeIp(req.socket.remoteAddress);
  if (cfg.server.trustProxy && (remote === "127.0.0.1" || remote === "::1")) {
    const fwd = req.headers["x-forwarded-for"];
    if (fwd) return store.normalizeIp(String(fwd).split(",")[0].trim());
  }
  return remote;
}

// IP 白名单校验：空列表 = 不限制；支持精确 IP 与 "192.168.1.*" 段通配
function isAllowedIp(ip) {
  const list = cfg.server.allowedIps || [];
  if (!Array.isArray(list) || !list.length) return true;
  return list.some((rule) => {
    if (!rule || rule === "*") return true;
    if (String(rule).endsWith(".*")) return ip.startsWith(rule.slice(0, -1));
    return rule === ip;
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

// 等待代理 session 就绪并执行；就绪后复用内存实例（延续上下文）
async function withAgent(ip, sessionId, fn) {
  let entry = sessions.get(sessionId);
  if (entry && entry.ip !== ip) {
    const err = new Error("无权访问该会话");
    err.status = 403;
    throw err;
  }
  if (!entry || entry.agent.isStreaming) {
    if (entry?.agent) {
      try { entry.agent.dispose(); } catch {}
    }
    console.log(`[req] ${sessionId} (${ip}): 创建 agent 会话...`);
    const meta = store.getSession(ip, sessionId);
    const history = (meta?.messages || []).map((m) => ({ role: m.role, content: m.content }));
    const agent = await createSession(cfg, {
      reload: cfg.skills?.reloadOnSession !== false,
      history,
    });
    entry = { agent, ip };
    sessions.set(sessionId, entry);
    console.log(`[req] ${sessionId}: agent 会话创建完成（历史 ${history.length} 条）`);
  }
  return fn(entry.agent);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const ip = clientIp(req);

  // CORS（开发用）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // IP 白名单：未授权 IP 一律拒绝（API 层防线）
  if (!isAllowedIp(ip)) {
    console.warn(`[deny] ${ip} -> ${req.method} ${path}`);
    sendJson(res, 403, { error: `IP ${ip} 不在白名单中，访问被拒绝` });
    return;
  }

  // GET /api/skills —— 列出已加载的 skill（验证扩展点）
  if (req.method === "GET" && path === "/api/skills") {
    const { listSkills } = await import("./skills-lister.js");
    sendJson(res, 200, await listSkills(cfg));
    return;
  }

  // GET /api/sessions —— 当前 IP 的会话列表
  if (req.method === "GET" && path === "/api/sessions") {
    sendJson(res, 200, { ip, sessions: store.listSessions(ip) });
    return;
  }

  // GET /api/sessions/:id —— 单会话详情（含消息，校验 IP 归属）
  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === "GET" && sessionMatch) {
    const meta = store.getSession(ip, decodeURIComponent(sessionMatch[1]));
    if (!meta) return sendJson(res, 404, { error: "会话不存在或无权访问" });
    sendJson(res, 200, { session: meta });
    return;
  }

  // DELETE /api/sessions/:id —— 删除会话（校验 IP 归属）
  if (req.method === "DELETE" && sessionMatch) {
    const ok = store.removeSession(ip, decodeURIComponent(sessionMatch[1]));
    if (!ok) return sendJson(res, 404, { error: "会话不存在或无权访问" });
    const sid = decodeURIComponent(sessionMatch[1]);
    const entry = sessions.get(sid);
    if (entry) {
      try { entry.agent.dispose(); } catch {}
      sessions.delete(sid);
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  // POST /api/chat —— SSE 流式对话
  if (req.method === "POST" && path === "/api/chat") {
    const body = await readBody(req).catch(() => ({}));
    const message = String(body.message || "").trim();
    const sessionId = String(body.sessionId || "").trim() || `s_${Date.now()}`;

    if (!message) return sendJson(res, 400, { error: "message 不能为空" });

    // 会话归属：先确保会话记录存在（幂等创建，标题 = IP + 时间）
    const meta = store.ensureSession(ip, sessionId);
    if (!meta) return sendJson(res, 403, { error: "无权访问该会话" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 首帧：把会话元信息（含 IP+时间标题）推给前端
    sendSse(res, { type: "session", session: { id: meta.id, ip: meta.ip, title: meta.title, createdAt: meta.createdAt } });

    // 记录用户消息
    store.appendMessage(ip, sessionId, "user", message);
    console.log(`[req] ${sessionId} (${ip}): "${message.slice(0, 30)}"`);

    let agent;
    try {
      agent = await withAgent(ip, sessionId, (a) => a);
    } catch (err) {
      console.error(`[req] ${sessionId}: 创建失败`, err);
      sendSse(res, { type: "error", error: err?.message || String(err) });
      res.end();
      return;
    }

    const unsubscribe = bridgeSession(agent, res);
    req.on("close", () => {
      unsubscribe();
      if (!res.writableEnded) res.end();
    });

    // 累积本轮 assistant 最终文本（存历史用）
    let assistantText = "";
    const collect = agent.subscribe((ev) => {
      if (ev.type === "message_end" && ev.message?.role === "assistant") {
        assistantText = (ev.message.content || [])
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");
      }
    });

    try {
      await agent.prompt(message);
      await agent.waitForIdle();
      console.log(`[req] ${sessionId}: prompt 完成`);
    } catch (err) {
      console.error(`[req] ${sessionId}: prompt 错误`, err);
      sendSse(res, { type: "error", error: err?.message || String(err) });
    }
    collect();

    // 记录 assistant 完整回复
    if (assistantText) {
      store.appendMessage(ip, sessionId, "assistant", assistantText);
    }
    res.end();
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

const host = cfg.server.host || "127.0.0.1";
const port = cfg.server.port || 8787;
server.listen(port, host, () => {
  console.log(`pi-agent-server 已启动: http://${host}:${port}`);
  console.log(`  POST /api/chat        (SSE 流式对话)`);
  console.log(`  GET  /api/sessions    (当前 IP 会话列表)`);
  console.log(`  GET  /api/sessions/:id (会话详情+历史)`);
  console.log(`  DELETE /api/sessions/:id (删除会话)`);
  console.log(`  存储: ${store.file}`);
});
