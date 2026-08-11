<script setup lang="ts">
// 부트스트랩 (architecture.md §13).
// Pinia 는 @pinia/nuxt 모듈이, 전역 CSS 는 nuxt.config.ts 의 css 옵션이 붙여 주므로
// 여기서는 레이아웃 → 페이지 슬롯만 연결한다. (쿼리 라이브러리 Provider 가 필요 없다)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
