<script setup>
import { computed } from "vue";

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  sessions: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
  theme: { type: String, default: "dark" },
});
const emit = defineEmits(["update:collapsed", "new", "select", "toggle-theme"]);

const width = computed(() => (props.collapsed ? "w-[64px]" : "w-[260px]"));
</script>

<template>
  <aside
    class="glass shrink-0 h-full flex flex-col transition-all duration-300 ease-in-out relative z-10 border-r border-[var(--border-soft)]"
    :class="width"
  >
    <!-- 新建对话 -->
    <div class="p-3 shrink-0">
      <button
        class="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] cursor-pointer"
        style="background: var(--gradient-brand); box-shadow: 0 4px 20px rgba(124,108,255,0.3);"
        @click="emit('new')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span v-if="!collapsed">新建对话</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <nav class="flex-1 overflow-y-auto px-2 space-y-0.5">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 cursor-pointer group"
        :class="s.id === activeId
          ? 'bg-[var(--active-bg)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'"
        @click="emit('select', s.id)"
      >
        <svg class="shrink-0 opacity-50 group-hover:opacity-90 transition-opacity" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span v-if="!collapsed" class="truncate text-[13px]">{{ s.title }}</span>
        <span v-if="!collapsed" class="ml-auto text-[10px] text-[var(--text-muted)] shrink-0">{{ s.time }}</span>
      </button>
    </nav>

    <!-- 底部设置 -->
    <div class="p-3 border-t border-[var(--border-soft)] shrink-0 space-y-0.5">
      <!-- 主题切换 -->
      <button
        class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-[13px] cursor-pointer group"
        :title="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        @click="emit('toggle-theme')"
      >
        <!-- 深色时显示太阳（切到浅色），浅色时显示月亮（切到深色） -->
        <svg v-if="theme === 'dark'" class="transition-transform duration-300 group-hover:rotate-45" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
        <svg v-else class="transition-transform duration-300 group-hover:-rotate-12" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <span v-if="!collapsed">{{ theme === "dark" ? "浅色模式" : "深色模式" }}</span>
      </button>

      <button
        class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-[13px] cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span v-if="!collapsed">设置</span>
      </button>
    </div>
  </aside>
</template>
