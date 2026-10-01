<script setup lang="ts">
// 공지 수정 — 불러온 공지로 폼을 그린다. 에디터는 비제어라 공지가 바뀌면 :key 로 다시 마운트한다(editor-spec §8).
import { apiErrorMessage, apiErrorStatus } from "~/lib/apiError"
import { ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const route = useRoute()
const noticeId = computed(() => Number(route.params.id))
const valid = computed(() => Number.isInteger(noticeId.value) && noticeId.value > 0)
const { data, status, error, refresh } = useAdminNotice(() => noticeId.value)
const notFound = computed(() => !valid.value || (status.value === "error" && apiErrorStatus(error.value) === 404))
</script>

<template>
  <div>
    <template v-if="notFound">
      <LayoutPageHeader title="공지 수정" />
      <UiErrorState message="공지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다." :retryable="false" />
      <NuxtLink to="/admin/notices" :class="[ui.btnNeutral, 'mt-4']">
        목록으로
      </NuxtLink>
    </template>
    <UiErrorState v-else-if="status === 'error'" :message="apiErrorMessage(error)" @retry="refresh()" />
    <AdminNoticeForm v-else-if="data && data.id === noticeId" :key="data.id" :notice="data" />
    <UiLoading v-else />
  </div>
</template>
