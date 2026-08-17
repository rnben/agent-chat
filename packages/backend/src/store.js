// 会话持久化存储：按客户端 IP 隔离，JSON 文件落地
// 零硬编码：存储路径来自 config.storage.dir
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

export function createStore(cfg) {
  const base = cfg._base || process.cwd();
  const dir = resolve(base, cfg.storage?.dir || "./data");
  const file = join(dir, "sessions.json");
  let db = { sessions: [] };

  mkdirSync(dir, { recursive: true });
  if (existsSync(file)) {
    try {
      db = JSON.parse(readFileSync(file, "utf-8"));
    } catch (e) {
      console.error("[store] 会话文件损坏，已重建:", e.message);
      db = { sessions: [] };
    }
  }
  if (!Array.isArray(db.sessions)) db.sessions = [];

  function save() {
    try {
      writeFileSync(file, JSON.stringify(db, null, 2), "utf-8");
    } catch (e) {
      console.error("[store] 保存失败:", e.message);
    }
  }

  // 规范化客户端 IP（去掉 IPv4-mapped 前缀）
  function normalizeIp(ip) {
    return String(ip || "unknown").replace(/^::ffff:/, "");
  }

  // 会话标题：默认"新对话"，首条消息后更新为内容摘要
  // （IP 和时间仅保留在数据/日志中用于区分用户与定位，不出现在标题里）
  function makeTitle() {
    return "新对话";
  }

  // 从消息内容生成标题摘要
  function summarize(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > 20 ? t.slice(0, 20) + "…" : (t || "新对话");
  }

  // 该 IP 的所有会话（不含 messages，前端列表用）
  function listSessions(ip) {
    const ipNorm = normalizeIp(ip);
    return db.sessions
      .filter((s) => s.ip === ipNorm)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map((s) => ({
        id: s.id,
        ip: s.ip,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: (s.messages || []).length,
      }));
  }

  // 取会话（校验 IP 归属），不存在返回 null
  function getSession(ip, id) {
    const ipNorm = normalizeIp(ip);
    const s = db.sessions.find((x) => x.id === id);
    if (!s || s.ip !== ipNorm) return null;
    return s;
  }

  // 创建会话记录（幂等：已存在则直接返回）
  function ensureSession(ip, id) {
    const ipNorm = normalizeIp(ip);
    let s = db.sessions.find((x) => x.id === id);
    if (!s) {
      const now = new Date().toISOString();
      s = {
        id,
        ip: ipNorm,
        title: makeTitle(ipNorm),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      db.sessions.push(s);
      save();
    } else if (s.ip !== ipNorm) {
      return null; // 归属冲突
    }
    return s;
  }

  // 追加消息（user/assistant 文本）
  function appendMessage(ip, id, role, content) {
    const s = getSession(ip, id);
    if (!s) return false;
    s.messages.push({ role, content: String(content), ts: new Date().toISOString() });
    // 首条用户消息后，把标题从占位/旧格式更新为内容摘要
    if (role === "user" && (s.title === "新对话" || s.title.includes(" · "))) {
      s.title = summarize(content);
    }
    s.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  // 删除会话（校验 IP 归属）
  function removeSession(ip, id) {
    const ipNorm = normalizeIp(ip);
    const i = db.sessions.findIndex((x) => x.id === id);
    if (i < 0 || db.sessions[i].ip !== ipNorm) return false;
    db.sessions.splice(i, 1);
    save();
    return true;
  }

  return {
    listSessions,
    getSession,
    ensureSession,
    appendMessage,
    removeSession,
    normalizeIp,
    makeTitle,
    file,
  };
}
