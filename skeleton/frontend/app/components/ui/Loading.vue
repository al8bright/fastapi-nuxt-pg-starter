<script setup lang="ts">
// 조회 중 표시 — role="status" 로 읽힌다.
const { label = "불러오는 중…" } = defineProps<{ label?: string }>()
</script>

<template>
  <p role="status" class="py-8 text-center text-sm text-on-surface-variant">
    {{ label }}
  </p>
</template>
