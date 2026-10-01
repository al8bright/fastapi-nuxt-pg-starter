<script setup lang="ts">
// 리치 텍스트 보기 컴포넌트 (editor-spec §2-5·§3).
//
// ⛔ html 에는 **서버가 sanitize_html 로 정화해 돌려준 본문만** 넣는다. 에디터 change 값이나
//    사용자 입력을 그대로 넣으면 XSS 다 — 정화는 백엔드 서비스 계층의 책임이고 여기서는 하지 않는다.
// 본문 스타일(목록 점·번호·정렬·미디어 반응형)은 전역 CSS 의 `.rich-text` 가 담당한다(assets/css/main.css).
// (eslint 예외는 여기 둔다 — 템플릿 맨 위 주석은 dev 빌드에서 루트 노드가 되어 class 상속을 깨뜨린다.)
/* eslint-disable vue/no-v-html -- 서버(nh3)가 정화한 본문만 넣는다(아래 템플릿의 v-html) */
const { html } = defineProps<{
  /** 서버가 정화한 HTML. */
  html: string
}>()
</script>

<template>
  <div class="rich-text" v-html="html" />
</template>
