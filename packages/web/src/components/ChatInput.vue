<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  sending: { type: Boolean, default: false },
});
const emit = defineEmits(["send", "stop"]);

const text = ref("");
const taRef = ref(null);
const webSearch = ref(false);

// 自动增高
watch(text, async () => {
  await nextTick();
  const ta = taRef.value;
  if (ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }
});

function onKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
}

function submit() {
  const t = text.value.trim();
  if (!t || props.sending) return;
  text.value = "";
  emit("send", t);
}
</script>

<template>
  <div class="absolute bottom-0 left-0 right-0 pb-5 px-4 md:px-8 pointer-events-none">
    <div class="max-w-3xl mx-auto">
      <!-- 输入容器 -->
      <div class="glass rounded-2xl shadow-2xl transition-all duration-300 pointer-events-auto"
           :class="sending ? 'opacity-80' : 'hover:shadow-[0_8px_40px_rgba(124,108,255,0.15)]'"
           style="box-shadow: var(--shadow-input);">
        <textarea
          ref="taRef"
          v-model="text"
          rows="1"
          :disabled="sending"
          placeholder="给 AI 发送消息…（Enter 发送，Shift+Enter 换行）"
          class="w-full bg-transparent resize-none outline-none px-4 pt-3.5 pb-1 text-[14.5px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
          @keydown="onKeydown"
        ></textarea>

        <!-- 工具栏 -->
        <div class="flex items-center gap-1 px-2.5 pb-2.5">
          <!-- 联网搜索 -->
          <button
            class="tool-btn"
            :class="webSearch ? 'text-[var(--accent-2)] bg-[var(--active-bg)]' : ''"
            title="联网搜索"
            @click="webSearch = !webSearch"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8a3 3 0 0 0-3 3"/>
            </svg>
          </button>

          <span class="flex-1"></span>

          <!-- 停止 / 发送 -->
          <button
            v-if="sending"
            class="send-btn !bg-[rgba(248,113,113,0.9)]"
            title="停止"
            @click="emit('stop')"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
          <button
            v-else
            class="send-btn"
            :class="text.trim() ? '' : 'opacity-40 cursor-not-allowed'"
            :disabled="!text.trim()"
            @click="submit"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>

      <p class="text-center text-[11px] text-[var(--text-muted)] mt-2.5">
        pi-agent-server · 嵌入式 SDK · Skill 驱动
      </p>
    </div>
  </div>
</template>

<style scoped>
.tool-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  color: var(--text-muted);
  transition: all 0.2s ease;
  cursor: pointer;
}
.tool-btn:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
  transform: translateY(-1px);
}
.send-btn {
  width: 34px; height: 34px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  background: var(--gradient-brand);
  box-shadow: var(--shadow-brand);
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  cursor: pointer;
}
.send-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 24px var(--shadow-brand);
}
.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}
</style>
