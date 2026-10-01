<script setup lang="ts">
// 활성 세션 — 최근 사용순, 페이지, 사용자 필터(?user_id= — 사용자 화면의 세션 수 링크), 강제 종료.
import { type AdminSession, useAdminApi } from "~/api/admin"
import { apiErrorMessage } from "~/lib/apiError"
import { formatDateTime, formatNumber } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const PAGE_SIZE = 20

const { page, get, update } = useListParams()
const userId = computed(() => {
  const raw = Number(get("user_id"))
  return Number.isInteger(raw) && raw > 0 ? raw : undefined
})
const { data, status, refresh } = useAdminSessions(() => ({ page: page.value, size: PAGE_SIZE, user_id: userId.value }))
const { revokeSession } = useAdminApi()
const target = ref<AdminSession | null>(null)
const message = ref<Flash | null>(null)
const loading = computed(() => isLoadingStatus(status.value) && !data.value)
const filteredName = computed(() => (userId.value ? (data.value?.items[0]?.username ?? `#${userId.value}`) : null))

const { run: revoke, isPending: revoking } = useAction(async (s: AdminSession) => {
  await revokeSession(s.id)
  await invalidateAccounts()
})

async function confirm() {
  const t = target.value
  if (!t) return
  try {
    await revoke(t)
    message.value = { tone: "success", text: `${t.username} 의 세션 #${t.id} 을(를) 종료했습니다.` }
  } catch (err) {
    message.value = { tone: "error", text: apiErrorMessage(err) }
  } finally {
    target.value = null
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader title="세션" :description="data ? `활성 세션 ${formatNumber(data.total)}개 · 최근 사용순` : '만료·폐기 전 로그인 세션'" />
    <div class="flex flex-col gap-4">
      <div v-if="userId" class="flex flex-wrap items-center gap-3 rounded-lg bg-primary-fixed px-4 py-2 text-sm text-on-primary-fixed">
        <span>사용자 <strong>{{ filteredName }}</strong> 의 세션만 보는 중</span>
        <button type="button" :class="[ui.btnSmall, 'font-semibold underline']" @click="update({ user_id: null })">
          필터 해제
        </button>
      </div>
      <UiNotice v-if="message" :tone="message.tone" @close="message = null">
        {{ message.text }}
      </UiNotice>
      <UiLoading v-if="loading" />
      <UiErrorState v-else-if="status === 'error'" message="세션 목록을 불러오지 못했습니다." @retry="refresh()" />
      <UiEmptyState v-else-if="data && data.items.length === 0">
        활성 세션이 없습니다.
      </UiEmptyState>
      <div v-else-if="data" :class="[ui.card, 'overflow-x-auto']">
        <table class="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              <th scope="col" :class="ui.th">
                세션
              </th>
              <th scope="col" :class="ui.th">
                사용자
              </th>
              <th scope="col" :class="ui.th">
                로그인
              </th>
              <th scope="col" :class="ui.th">
                마지막 사용
              </th>
              <th scope="col" :class="ui.th">
                만료
              </th>
              <th scope="col" :class="ui.th">
                <span class="sr-only">작업</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in data.items" :key="s.id">
              <td :class="[ui.td, 'text-on-surface-variant']">
                #{{ s.id }}
              </td>
              <td :class="ui.td">
                <button type="button" :class="[ui.link, 'font-medium text-on-surface']" @click="update({ user_id: s.user_id })">
                  {{ s.username }}<span class="sr-only"> 의 세션만 보기</span>
                </button>
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ formatDateTime(s.created_at) }}
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ formatDateTime(s.last_used_at) }}
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ formatDateTime(s.expires_at) }}
              </td>
              <td :class="[ui.td, 'text-right']">
                <button type="button" :class="[ui.btnSmall, 'border border-error text-error hover:bg-error-container']" @click="target = s">
                  강제 종료<span class="sr-only"> (세션 #{{ s.id }}, {{ s.username }})</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiPagination v-if="data" :page="page" :size="PAGE_SIZE" :total="data.total" @change="(p) => update({ page: p })" />
    </div>

    <UiConfirmDialog
      v-if="target"
      title="세션을 강제 종료할까요?"
      confirm-label="강제 종료"
      danger
      :pending="revoking"
      @confirm="confirm"
      @cancel="target = null"
    >
      {{ target.username }} 의 세션 #{{ target.id }} 이(가) 즉시 끊기고 다시 로그인해야 합니다. 내 세션이면 나도 로그아웃됩니다.
    </UiConfirmDialog>
  </div>
</template>
