<script setup>
import { ref, reactive, nextTick, onMounted, computed } from "vue";
import { streamChat, listSessions, getSession } from "./api.js";
import Sidebar from "./components/Sidebar.vue";
import ChatMessage from "./components/ChatMessage.vue";
import ChatInput from "./components/ChatInput.vue";

const sidebarCollapsed = ref(false);
const theme = ref("dark");

// 主题初始化：读取 localStorage / 系统偏好（index.html 已预载 class，这里同步状态）
function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem("pi-theme");
    if (saved) return saved;
  } catch (e) {}
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
theme.value = resolveInitialTheme();

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", theme.value === "dark");
  try { localStorage.setItem("pi-theme", theme.value); } catch (e) {}
}

// 本地会话列表（轻量版：每个会话对应后端一个 sessionId）
const sessions = ref([]);
const activeSessionId = ref(null);

const messages = ref([]);
const sending = ref(false);
const abortController = ref(null);
const streamRef = ref(null);

let currentAssistant = null;

function findSession(id) {
  return sessions.value.find((s) => s.id === id);
}

function newChat() {
  if (sending.value) abort();
  const id = `s_${Date.now()}`;
  activeSessionId.value = id;
  messages.value = [];
}

async function selectSession(id) {
  if (sending.value) abort();
  activeSessionId.value = id;
  messages.value = [];
  try {
    const meta = await getSession(id);
    if (meta?.messages?.length) {
      messages.value = meta.messages.map((m) => ({
        role: m.role,
        content: m.content,
        thinking: "",
        tools: [],
        status: "done",
      }));
    }
  } catch (e) {
    console.error("加载会话失败:", e);
  }
  await scrollBottom();
}

// 当前会话标题（IP + 时间，来自后端）
const activeTitle = computed(() => {
  const s = findSession(activeSessionId.value);
  return s?.title || activeSessionId.value;
});

// 后端 session 事件：同步会话列表（含 IP+时间标题）
function upsertSession(meta) {
  if (!meta?.id) return;
  const idx = sessions.value.findIndex((s) => s.id === meta.id);
  const item = {
    id: meta.id,
    title: meta.title,
    time: nowLabel(new Date(meta.createdAt)),
  };
  if (idx >= 0) {
    sessions.value[idx] = item;
  } else {
    sessions.value.unshift(item);
  }
}

function nowLabel(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pushUser(text) {
  messages.value.push({ role: "user", content: text, status: "done" });
}

function startAssistant() {
  currentAssistant = reactive({
    role: "assistant",
    content: "",
    thinking: "",
    tools: [],
    status: "streaming",
  });
  messages.value.push(currentAssistant);
  return currentAssistant;
}

async function scrollBottom() {
  await nextTick();
  if (streamRef.value) {
    streamRef.value.scrollTo({ top: streamRef.value.scrollHeight, behavior: "smooth" });
  }
}

async function refreshSessions() {
  try {
    sessions.value = (await listSessions()).map((s) => ({
      id: s.id,
      title: s.title,
      time: nowLabel(new Date(s.updatedAt || s.createdAt)),
    }));
  } catch (e) {
    console.error("刷新会话列表失败:", e);
  }
}

async function send(text) {
  if (!text || sending.value) return;
  if (!activeSessionId.value) newChat();

  sending.value = true;
  pushUser(text);
  const assistant = startAssistant();
  await scrollBottom();

  abortController.value = new AbortController();
  try {
    await streamChat({
      message: text,
      sessionId: activeSessionId.value,
      signal: abortController.value.signal,
      onEvent: (ev) => handleEvent(ev, assistant),
    });
    assistant.status = "done";
  } catch (err) {
    if (err.name === "AbortError") {
      assistant.status = "done";
    } else {
      assistant.status = "error";
      assistant.error = err.message;
    }
  } finally {
    sending.value = false;
    abortController.value = null;
    await refreshSessions(); // 同步最新标题（内容摘要）与排序
    await scrollBottom();
  }
}

function handleEvent(ev, assistant) {
  switch (ev.type) {
    case "session":
      upsertSession(ev.session);
      break;
    case "text":
      assistant.content = ev.text;
      break;
    case "thinking":
      assistant.thinking = ev.text;
      break;
    case "tool_start":
      assistant.tools.push({
        id: ev.id, name: ev.name, args: ev.args,
        result: undefined, isError: false, status: "running",
      });
      break;
    case "tool_end": {
      const t = assistant.tools.find((x) => x.id === ev.id);
      if (t) { t.result = ev.result; t.isError = ev.isError; t.status = "done"; }
      break;
    }
  }
  scrollBottom();
}

function abort() {
  if (abortController.value) abortController.value.abort();
}

onMounted(async () => {
  newChat();
  // 拉取当前 IP 的历史会话列表（含 IP+时间标题）
  try {
    sessions.value = (await listSessions()).map((s) => ({
      id: s.id,
      title: s.title,
      time: nowLabel(new Date(s.updatedAt || s.createdAt)),
    }));
  } catch (e) {
    console.error("加载会话列表失败:", e);
  }
});
</script>

<template>
  <div class="flex h-full overflow-hidden relative">
    <!-- 氛围背景 -->
    <div class="absolute inset-0 aurora pointer-events-none"></div>

    <Sidebar
      v-model:collapsed="sidebarCollapsed"
      :sessions="sessions"
      :active-id="activeSessionId"
      :theme="theme"
      @new="newChat"
      @select="selectSession"
      @toggle-theme="toggleTheme"
    />

    <!-- 主区 -->
    <main class="flex-1 flex flex-col min-w-0 relative">
      <!-- 顶栏 -->
      <header class="flex items-center justify-between px-5 h-14 shrink-0">
        <div class="flex items-center gap-3">
          <button
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span class="text-sm text-[var(--text-muted)] truncate max-w-[260px]">{{ activeTitle }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span class="px-2.5 py-1 rounded-full border border-[var(--border-soft)]">嵌入式 SDK · Skill 驱动</span>
        </div>
      </header>

      <!-- 消息流 -->
      <div ref="streamRef" class="flex-1 overflow-y-auto px-4 md:px-8">
        <div class="max-w-3xl mx-auto pb-48 pt-4">
          <template v-if="messages.length === 0">
            <div class="text-center pt-[22vh] msg-in">
              <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-5"
                   style="background: var(--gradient-brand); box-shadow: var(--shadow-brand);">
                🤖
              </div>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-2">开始新的对话</h1>
              <p class="text-sm text-[var(--text-muted)]">能力由 Skill 驱动，试试「看看当前目录里有什么」</p>
            </div>
          </template>
          <ChatMessage v-for="(m, i) in messages" :key="i" :message="m" />
        </div>
      </div>

      <!-- 输入区 -->
      <ChatInput
        :sending="sending"
        @send="send"
        @stop="abort"
      />
    </main>
  </div>
</template>
