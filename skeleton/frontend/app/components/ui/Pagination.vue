<script setup lang="ts">
// 페이지 이동 — 현재 페이지 주변 최대 5개 번호 + 이전/다음.
import { ui } from "~/lib/ui"

const { page, size, total, label = "페이지 이동" } = defineProps<{
  page: number
  size: number
  total: number
  label?: string
}>()
const emit = defineEmits<{ change: [page: number] }>()

const last = computed(() => Math.max(1, Math.ceil(total / size)))
const pages = computed(() => {
  const start = Math.max(1, Math.min(page - 2, last.value - 4))
  const end = Math.min(last.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})
const item = `${ui.btnSmall} min-w-11`
</script>

<template>
  <nav v-if="last > 1" :aria-label="label" class="flex flex-wrap items-center justify-center gap-1">
    <button
      type="button"
      :class="[item, 'text-on-surface-variant hover:bg-surface-container']"
      :disabled="page <= 1"
      aria-label="이전 페이지"
      @click="emit('change', page - 1)"
    >
      <UiIcon name="chevronLeft" />
    </button>
    <button
      v-for="p in pages"
      :key="p"
      type="button"
      :class="[item, p === page ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container']"
      :aria-current="p === page ? 'page' : undefined"
      :aria-label="`${p} 페이지`"
      @click="emit('change', p)"
    >
      {{ p }}
    </button>
    <button
      type="button"
      :class="[item, 'text-on-surface-variant hover:bg-surface-container']"
      :disabled="page >= last"
      aria-label="다음 페이지"
      @click="emit('change', page + 1)"
    >
      <UiIcon name="chevronRight" />
    </button>
  </nav>
</template>
