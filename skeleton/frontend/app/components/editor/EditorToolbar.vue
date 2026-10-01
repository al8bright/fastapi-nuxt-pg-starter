<script setup lang="ts">
// 에디터 툴바 — role="toolbar" + 화살표 키 이동(roving tabindex), 토글은 aria-pressed.
// 버튼은 mousedown 기본 동작을 막아 편집 영역의 선택·포커스를 유지한다.
import { ref } from "vue"
import type { ActiveState } from "~/lib/editor/editorDom"
import { TOOLBAR_GROUPS, type ToolbarCommand } from "~/lib/editor/toolbar"
import EditorIcon from "./EditorIcon.vue"

const { active, controlsId } = defineProps<{ active: ActiveState, controlsId: string }>()
const emit = defineEmits<{ command: [command: ToolbarCommand] }>()

const focusIndex = ref(0)
const root = ref<HTMLDivElement | null>(null)

function onKeyDown(e: KeyboardEvent) {
  const buttons = Array.from(root.value?.querySelectorAll<HTMLButtonElement>("button[data-index]") ?? [])
  if (!buttons.length) return
  let next: number | null = null
  if (e.key === "ArrowRight") next = (focusIndex.value + 1) % buttons.length
  else if (e.key === "ArrowLeft") next = (focusIndex.value - 1 + buttons.length) % buttons.length
  else if (e.key === "Home") next = 0
  else if (e.key === "End") next = buttons.length - 1
  if (next === null) return
  e.preventDefault()
  focusIndex.value = next
  buttons[next]?.focus()
}
</script>

<template>
  <div
    ref="root"
    role="toolbar"
    aria-label="서식 도구"
    :aria-controls="controlsId"
    class="flex flex-wrap items-center gap-0.5 border-b border-outline-variant bg-surface-container-lowest p-1"
    @keydown="onKeyDown"
  >
    <div v-for="(group, gi) in TOOLBAR_GROUPS" :key="gi" class="flex items-center gap-0.5">
      <span v-if="gi > 0" role="separator" aria-orientation="vertical" class="mx-1 h-6 w-px bg-outline-variant" />
      <button
        v-for="item in group"
        :key="item.command"
        type="button"
        :data-index="item.index"
        :tabindex="item.index === focusIndex ? 0 : -1"
        :aria-label="item.label"
        :title="item.label"
        :aria-pressed="item.pressed ? item.pressed(active) : undefined"
        class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
        :class="item.pressed?.(active) ? 'bg-primary text-on-primary hover:bg-primary hover:text-on-primary' : ''"
        @mousedown.prevent
        @focus="focusIndex = item.index"
        @click="emit('command', item.command)"
      >
        <EditorIcon :name="item.icon" />
      </button>
    </div>
  </div>
</template>
