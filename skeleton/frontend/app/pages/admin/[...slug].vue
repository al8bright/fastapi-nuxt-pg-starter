<script setup lang="ts">
// 없는 관리자 경로 — 가드(관리자 확인)를 거친 뒤 대시보드로 보낸다.
definePageMeta({ layout: "admin", middleware: ["admin", () => navigateTo("/admin", { replace: true })] })
</script>

<template>
  <div />
</template>
