<script setup lang="ts">
// 로그인 잠금 — 잠긴 계정 우선, 최근 24시간 실패 기록(최대 200). 잠금 해제는 실패 기록을 지운다(멱등).
// 존재하지 않는 아이디도 기록된다(계정 존재 비노출 정책).
import { useAdminApi } from "~/api/admin"
import { apiErrorMessage } from "~/lib/apiError"
import { formatDateTime } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const { data, status, refresh } = useLoginThrottles()
const { unlockLoginThrottle } = useAdminApi()
const message = ref<Flash | null>(null)
const unlocking = ref<string | null>(null)
const lockedCount = computed(() => data.value?.filter((t) => t.is_locked).length ?? 0)
const loading = computed(() => isLoadingStatus(status.value) && !data.value)
const fetching = computed(() => status.value === "pending")

async function onUnlock(username: string, locked: boolean) {
  unlocking.value = username
  try {
    await unlockLoginThrottle(username)
    await invalidateThrottles()
    message.value = { tone: "success", text: locked ? `${username} 의 잠금을 해제했습니다.` : `${username} 의 실패 기록을 지웠습니다.` }
  } catch (err) {
    message.value = { tone: "error", text: apiErrorMessage(err) }
  } finally {
    unlocking.value = null
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader
      title="로그인 잠금"
      :description="data ? `잠김 ${lockedCount}건 · 최근 24시간 실패 기록 ${data.length}건` : '연속 로그인 실패 기록'"
    >
      <template #actions>
        <button type="button" :class="ui.btnNeutral" :disabled="fetching" @click="refresh()">
          {{ fetching ? "새로고침 중…" : "새로고침" }}
        </button>
      </template>
    </LayoutPageHeader>
    <div class="flex flex-col gap-4">
      <UiNotice v-if="message" :tone="message.tone" @close="message = null">
        {{ message.text }}
      </UiNotice>
      <UiLoading v-if="loading" />
      <UiErrorState v-else-if="status === 'error'" message="잠금 목록을 불러오지 못했습니다." @retry="refresh()" />
      <UiEmptyState v-else-if="data && data.length === 0">
        최근 로그인 실패 기록이 없습니다.
      </UiEmptyState>
      <div v-else-if="data" :class="[ui.card, 'overflow-x-auto']">
        <table class="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th scope="col" :class="ui.th">
                아이디
              </th>
              <th scope="col" :class="ui.th">
                상태
              </th>
              <th scope="col" :class="ui.th">
                실패 횟수
              </th>
              <th scope="col" :class="ui.th">
                마지막 실패
              </th>
              <th scope="col" :class="ui.th">
                잠금 해제 예정
              </th>
              <th scope="col" :class="ui.th">
                <span class="sr-only">작업</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in data" :key="t.username" :class="t.is_locked ? 'bg-error-container/60' : undefined">
              <th scope="row" :class="[ui.td, 'text-left font-medium']">
                {{ t.username }}
              </th>
              <td :class="ui.td">
                <UiChip v-if="t.is_locked" tone="danger">
                  잠김
                </UiChip>
                <UiChip v-else>
                  기록만
                </UiChip>
              </td>
              <td :class="ui.td">
                {{ t.failed_count }}회
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ formatDateTime(t.last_failed_at) }}
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ t.is_locked ? formatDateTime(t.locked_until) : "-" }}
              </td>
              <td :class="[ui.td, 'text-right']">
                <button
                  type="button"
                  :class="[
                    ui.btnSmall,
                    t.is_locked
                      ? 'border border-error bg-surface-container-lowest font-semibold text-on-error-container'
                      : 'text-on-surface-variant hover:bg-surface-container-low',
                  ]"
                  :disabled="unlocking === t.username"
                  @click="onUnlock(t.username, t.is_locked)"
                >
                  {{ t.is_locked ? "잠금 해제" : "기록 지우기" }}<span class="sr-only"> ({{ t.username }})</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
