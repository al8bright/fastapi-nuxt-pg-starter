<script setup lang="ts">
// 에디터 전용 선(stroke) 아이콘. 프로젝트에 아이콘 세트가 없어 의존성 없이 인라인 SVG 로 둔다.
// 색은 currentColor 를 따르고, 스크린 리더에는 숨긴다(버튼의 aria-label 이 이름을 준다).
// 에디터 컴포넌트는 Nuxt 자동 import 에 기대지 않는다(vitest 로 단독 테스트) — vue API 를 직접 import 한다.
import { EDITOR_ICONS, type EditorIconName } from "~/lib/editor/editorIcons"

const { name, size = 20 } = defineProps<{ name: EditorIconName, size?: number }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <component :is="shape.tag" v-for="(shape, i) in EDITOR_ICONS[name]" :key="i" v-bind="shape.attrs" />
  </svg>
</template>
