<script setup lang="ts">
// 인라인 SVG 아이콘 — 장식용(aria-hidden). 의미는 옆 텍스트나 sr-only 로 전달한다.
import { ICON_PATHS, type IconName } from "~/lib/icons"

const { name, size = 18 } = defineProps<{ name: IconName, size?: number }>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
  >
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>
