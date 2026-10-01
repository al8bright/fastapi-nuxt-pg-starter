<script setup lang="ts">
// 관리자 화면 머리 — h1 제목 + 설명(description prop 또는 #description 슬롯) + 오른쪽 작업 버튼(#actions 슬롯).
const { title, description = "" } = defineProps<{ title: string, description?: string }>()
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">
        {{ title }}
      </h1>
      <div v-if="$slots.description || description" class="text-sm text-on-surface-variant">
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
