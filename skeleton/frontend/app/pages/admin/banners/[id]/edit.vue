<script setup lang="ts">
// 배너 수정 — 불러온 배너로 폼을 그린다(배너가 바뀌면 :key 로 다시 마운트).
import { apiErrorMessage, apiErrorStatus } from "~/lib/apiError"

definePageMeta({ layout: "admin", middleware: "admin" })

const route = useRoute()
const bannerId = computed(() => Number(route.params.id))
const valid = computed(() => Number.isInteger(bannerId.value) && bannerId.value > 0)
const { data, status, error, refresh } = useAdminBanner(() => bannerId.value)
const notFound = computed(() => !valid.value || (status.value === "error" && apiErrorStatus(error.value) === 404))
</script>

<template>
  <div>
    <template v-if="notFound">
      <LayoutPageHeader title="배너 수정" />
      <UiErrorState message="배너를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다." :retryable="false" />
    </template>
    <UiErrorState v-else-if="status === 'error'" :message="apiErrorMessage(error)" @retry="refresh()" />
    <AdminBannerForm v-else-if="data && data.id === bannerId" :key="data.id" :banner="data" />
    <UiLoading v-else />
  </div>
</template>
