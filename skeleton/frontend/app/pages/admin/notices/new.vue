<script setup lang="ts">
// 공지 작성 — 처음 저장(POST)하면 수정 URL(/admin/notices/:id/edit)로 바꿔 첨부 패널을 연다.
definePageMeta({ layout: "admin", middleware: "admin" })
</script>

<template>
  <AdminNoticeForm :notice="null" />
</template>
