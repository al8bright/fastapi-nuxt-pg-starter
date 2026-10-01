<script setup lang="ts">
// 작업 결과 알림(성공·실패). 성공은 role="status", 실패는 role="alert". close 리스너가 있으면 닫기 버튼.
import { ui } from "~/lib/ui"

const { tone, closable = true } = defineProps<{ tone: "success" | "error", closable?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
    :class="tone === 'success' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'"
  >
    <p class="pt-0.5">
      <slot />
    </p>
    <button v-if="closable" type="button" :class="[ui.btnSmall, '-my-2 -mr-2 min-w-11 font-semibold']" aria-label="알림 닫기" @click="emit('close')">
      ×
    </button>
  </div>
</template>
