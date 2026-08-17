// SSE 流式客户端：POST /api/chat，解析 data: 帧
export async function streamChat({ message, sessionId, onEvent, signal }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
    signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch {}
    throw new Error(`请求失败 ${res.status}: ${detail}`);
  }
  if (!res.body) throw new Error("浏览器不支持流式响应");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE 帧以空行分隔
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)));
      } catch {
        // 忽略无法解析的帧
      }
    }
  }
}

// 会话列表（按客户端 IP 隔离）
export async function listSessions() {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error(`获取会话列表失败 ${res.status}`);
  const data = await res.json();
  return data.sessions || [];
}

// 会话详情（含消息历史）
export async function getSession(id) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`获取会话失败 ${res.status}`);
  const data = await res.json();
  return data.session;
}
