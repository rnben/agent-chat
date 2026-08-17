<script setup>
import { computed, ref } from "vue";
import { renderMarkdown } from "../markdown.js";
import ToolCallCard from "./ToolCallCard.vue";

const props = defineProps({
  message: { type: Object, required: true },
});

const isUser = computed(() => props.message.role === "user");
const html = computed(() => renderMarkdown(props.message.content));
const hasThinking = computed(() => !!props.message.thinking);
const hasTools = computed(() => props.message.tools?.length > 0);
const thinkingOpen = ref(false);
const streaming = computed(() => props.message.status === "streaming");
</script>

<template>
  <div class="flex gap-3.5 py-3 msg-in" :class="isUser ? 'justify-end' : 'justify-start'">
    <!-- AI 头像 -->
    <div v-if="!isUser" class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm mt-1"
         style="background: linear-gradient(135deg, rgba(124,108,255,0.25), rgba(56,189,248,0.2)); border: 1px solid var(--border-soft);">
      🤖
    </div>

    <div class="max-w-[85%] md:max-w-[75%] flex flex-col gap-2" :class="isUser ? 'items-end' : 'items-start'">
      <!-- 用户气泡 -->
      <div v-if="isUser" class="px-4 py-2.5 rounded-2xl rounded-br-md text-[14.5px] leading-relaxed text-white whitespace-pre-wrap"
           style="background: linear-gradient(135deg, #5b5bd6, #4f8ef7); box-shadow: 0 4px 16px rgba(79,142,247,0.25);">
        {{ message.content }}
      </div>

      <template v-else>
        <!-- 思考过程 -->
        <button v-if="hasThinking"
          class="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer select-none"
          @click="thinkingOpen = !thinkingOpen">
          <span class="inline-flex gap-1">
            <span class="thinking-dot w-1 h-1 rounded-full bg-[var(--accent-1)]" :style="{ animationDelay: '0s' }"></span>
            <span class="thinking-dot w-1 h-1 rounded-full bg-[var(--accent-2)]" :style="{ animationDelay: '0.2s' }"></span>
            <span class="thinking-dot w-1 h-1 rounded-full bg-[var(--accent-3)]" :style="{ animationDelay: '0.4s' }"></span>
          </span>
          <span class="ml-1">{{ thinkingOpen ? "收起思考过程" : "思考过程" }}</span>
        </button>
        <div v-if="hasThinking && thinkingOpen" class="w-full glass rounded-xl p-3.5 text-[12.5px] text-[var(--text-secondary)] leading-relaxed max-h-64 overflow-y-auto">
          {{ message.thinking }}
        </div>

        <!-- 工具调用 -->
        <ToolCallCard v-for="tool in message.tools" :key="tool.id || tool.name" :tool="tool" />

        <!-- 正文 -->
        <div v-if="message.content" class="markdown-body text-[var(--text-primary)]">
          <div v-html="html"></div>
        </div>

        <!-- 流式指示 -->
        <div v-if="streaming && !message.content" class="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <span class="inline-flex gap-1">
            <span class="thinking-dot w-1.5 h-1.5 rounded-full bg-[var(--accent-1)]"></span>
            <span class="thinking-dot w-1.5 h-1.5 rounded-full bg-[var(--accent-2)]" style="animation-delay:0.15s"></span>
            <span class="thinking-dot w-1.5 h-1.5 rounded-full bg-[var(--accent-3)]" style="animation-delay:0.3s"></span>
          </span>
          <span>{{ message.tools.length ? "正在执行…" : "正在思考…" }}</span>
        </div>

        <!-- 错误 -->
        <div v-if="message.status === 'error'" class="text-[13px] text-[var(--danger)]">
          {{ message.error }}
        </div>
      </template>
    </div>
  </div>
</template>
