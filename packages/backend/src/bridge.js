// 事件桥接：AgentSession 事件 → SSE 帧
// 纯映射，无业务逻辑
export function sendSse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// 从 AgentMessage.content 提取文本块
function textOf(message) {
  return (message.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

function thinkingOf(message) {
  return (message.content || [])
    .filter((c) => c.type === "thinking")
    .map((c) => c.text)
    .join("");
}

// 订阅 session 事件并转发为 SSE；返回取消函数
export function bridgeSession(session, res) {
  const unsubscribe = session.subscribe((ev) => {
    switch (ev.type) {
      case "message_start":
        sendSse(res, { type: "message_start", role: ev.message.role });
        break;
      case "message_update": {
        const text = textOf(ev.message);
        const thinking = thinkingOf(ev.message);
        if (text) sendSse(res, { type: "text", text });
        if (thinking) sendSse(res, { type: "thinking", text: thinking });
        break;
      }
      case "message_end":
        sendSse(res, { type: "message_end" });
        break;
      case "tool_execution_start":
        sendSse(res, {
          type: "tool_start",
          id: ev.toolCallId,
          name: ev.toolName,
          args: ev.args,
        });
        break;
      case "tool_execution_update":
        sendSse(res, {
          type: "tool_update",
          id: ev.toolCallId,
          name: ev.toolName,
          partialResult: ev.partialResult,
        });
        break;
      case "tool_execution_end":
        sendSse(res, {
          type: "tool_end",
          id: ev.toolCallId,
          name: ev.toolName,
          result: ev.result,
          isError: ev.isError,
        });
        break;
      case "turn_end":
        sendSse(res, { type: "turn_end" });
        break;
      case "agent_settled":
        sendSse(res, { type: "done" });
        break;
      case "agent_end": {
        if (ev.willRetry) sendSse(res, { type: "will_retry" });
        break;
      }
    }
  });
  return unsubscribe;
}
