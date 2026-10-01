<script setup lang="ts">
// 배너 작성.
definePageMeta({ layout: "admin", middleware: "admin" })
</script>

<template>
  <AdminBannerForm :banner="null" />
</template>
