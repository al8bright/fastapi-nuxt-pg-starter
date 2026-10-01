<script setup lang="ts">
// 상태 칩 (DESIGN.md Status Chips) — 배경과 글자 대비가 큰 토큰 쌍만 쓴다.
type ChipTone = "primary" | "success" | "danger" | "neutral"

const { tone = "neutral" } = defineProps<{ tone?: ChipTone }>()

const TONES: Record<ChipTone, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed",
  success: "bg-tertiary-container text-on-tertiary-container",
  danger: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
}
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" :class="TONES[tone]">
    <slot />
  </span>
</template>
