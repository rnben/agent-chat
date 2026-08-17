<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  tool: { type: Object, required: true }, // { name, args, result, isError, status }
});

const open = ref(false);
const statusColor = computed(() => {
  if (props.tool.isError) return "#f87171";
  if (props.tool.status === "running") return "#38bdf8";
  return "#34d399";
});
const statusText = computed(() => {
  if (props.tool.isError) return "失败";
  if (props.tool.status === "running") return "执行中";
  return "完成";
});
const resultText = computed(() => {
  if (props.tool.result === undefined) return "";
  if (typeof props.tool.result === "string") return props.tool.result.slice(0, 1500);
  return JSON.stringify(props.tool.result, null, 2).slice(0, 1500);
});
</script>

<template>
  <div class="w-full glass rounded-xl overflow-hidden" :style="{ borderColor: 'var(--border-soft)' }">
    <!-- 头部 -->
    <button
      class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
      @click="open = !open"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
           :style="{ color: statusColor }">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span class="font-mono text-[12.5px] text-[var(--text-primary)] font-medium">{{ tool.name }}</span>
      <span class="ml-auto flex items-center gap-2">
        <span class="text-[11px] px-1.5 py-0.5 rounded-full border"
              :style="{ color: statusColor, borderColor: statusColor + '55', background: statusColor + '14' }">
          {{ statusText }}
        </span>
        <span class="text-[var(--text-muted)] text-[11px]">{{ open ? "收起" : "详情" }}</span>
      </span>
    </button>

    <!-- 详情 -->
    <div v-show="open" class="border-t border-[var(--border-soft)] px-3.5 py-3 space-y-2.5">
      <div>
        <div class="text-[11px] text-[var(--text-muted)] mb-1">参数</div>
        <pre class="text-[12px] text-[var(--text-secondary)] bg-[var(--code-bg)] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(tool.args, null, 2) }}</pre>
      </div>
      <div v-if="resultText">
        <div class="text-[11px] text-[var(--text-muted)] mb-1">结果</div>
        <pre class="text-[12px] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all"
             :class="tool.isError ? 'text-[var(--danger)] bg-[rgba(248,113,113,0.06)]' : 'text-[var(--text-secondary)] bg-[var(--code-bg)]'">{{ resultText }}</pre>
      </div>
    </div>
  </div>
</template>
