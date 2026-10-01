<script setup lang="ts">
// 대시보드 (디자인 A) — KPI 타일 + 최근 활성 세션 5건(강제 종료) + 잠긴 계정(잠금 해제).
import { type AdminSession, useAdminApi } from "~/api/admin"
import { apiErrorMessage } from "~/lib/apiError"
import { formatDateTime, formatNumber } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

interface Kpi {
  label: string
  value: string
  sub: string
  tone?: "primary" | "danger" | "success"
}
const KPI_COLOR = { primary: "text-primary", danger: "text-error", success: "text-tertiary" } as const

const dashboard = useDashboard()
const sessions = useAdminSessions(() => ({ page: 1, size: 5 }))
const throttles = useLoginThrottles()
const { revokeSession, unlockLoginThrottle } = useAdminApi()
const message = ref<Flash | null>(null)

const kpis = computed<Kpi[]>(() => {
  const d = dashboard.data.value
  if (!d) return []
  return [
    {
      label: "전체 사용자",
      value: formatNumber(d.users.total),
      sub: `활성 ${formatNumber(d.users.active)} · 비활성 ${formatNumber(d.users.inactive)}`,
    },
    { label: "활성 세션", value: formatNumber(d.active_sessions), sub: "만료·폐기 전 refresh 세션", tone: "primary" },
    {
      label: "잠긴 계정",
      value: formatNumber(d.locked_accounts),
      sub: d.locked_accounts ? "자동 해제 대기" : "잠긴 계정 없음",
      tone: d.locked_accounts ? "danger" : undefined,
    },
    {
      label: "공지사항",
      value: formatNumber(d.notices.published),
      sub: `게시 중 · 임시저장 ${formatNumber(d.notices.draft)}`,
    },
    { label: "활성 배너", value: formatNumber(d.active_banners), sub: "활성 + 노출 기간 안" },
    {
      label: "DB 상태",
      value: d.db === "ok" ? "정상" : "오류",
      sub: `마이그레이션 ${d.alembic_revision ?? "확인 불가"}`,
      tone: d.db === "ok" ? "success" : "danger",
    },
  ]
})
const locked = computed(() => throttles.data.value?.filter((t) => t.is_locked) ?? [])
const refreshing = computed(() => dashboard.status.value === "pending")

function refreshAll() {
  void dashboard.refresh()
  void sessions.refresh()
  void throttles.refresh()
}

// ---------- 세션 강제 종료 ----------
const revokeTarget = ref<AdminSession | null>(null)
const { run: runRevoke, isPending: revoking } = useAction(async (s: AdminSession) => {
  await revokeSession(s.id)
  await invalidateAccounts()
})
async function confirmRevoke() {
  const target = revokeTarget.value
  if (!target) return
  try {
    await runRevoke(target)
    message.value = { tone: "success", text: `${target.username} 의 세션을 종료했습니다.` }
  } catch (e) {
    message.value = { tone: "error", text: apiErrorMessage(e) }
  } finally {
    revokeTarget.value = null
  }
}

// ---------- 잠금 해제 ----------
const unlocking = ref<string | null>(null)
async function unlock(username: string) {
  unlocking.value = username
  try {
    await unlockLoginThrottle(username)
    await invalidateThrottles()
    message.value = { tone: "success", text: `${username} 의 잠금을 해제했습니다.` }
  } catch (e) {
    message.value = { tone: "error", text: apiErrorMessage(e) }
  } finally {
    unlocking.value = null
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader title="대시보드" description="시스템 상태와 인증 현황">
      <template #actions>
        <button type="button" :class="ui.btnNeutral" :disabled="refreshing" @click="refreshAll">
          {{ refreshing ? "새로고침 중…" : "새로고침" }}
        </button>
      </template>
    </LayoutPageHeader>

    <div class="flex flex-col gap-6">
      <UiNotice v-if="message" :tone="message.tone" @close="message = null">
        {{ message.text }}
      </UiNotice>

      <UiLoading v-if="isLoadingStatus(dashboard.status.value) && !dashboard.data.value" />
      <UiErrorState
        v-else-if="dashboard.status.value === 'error'"
        message="대시보드 집계를 불러오지 못했습니다."
        @retry="dashboard.refresh()"
      />
      <div v-else class="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
        <section v-for="k in kpis" :key="k.label" :class="[ui.card, 'flex flex-col gap-2 rounded-xl p-5']">
          <h2 class="text-sm font-medium text-on-surface-variant">
            {{ k.label }}
          </h2>
          <p :class="['text-3xl font-bold', k.tone ? KPI_COLOR[k.tone] : 'text-on-surface']">
            {{ k.value }}
          </p>
          <p class="text-[13px] text-on-surface-variant">
            {{ k.sub }}
          </p>
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-3">
        <section aria-labelledby="dash-sessions" :class="[ui.card, 'flex min-w-0 flex-col gap-3 rounded-xl p-5 xl:col-span-2']">
          <div class="flex items-center justify-between">
            <h2 id="dash-sessions" class="text-lg font-semibold">
              활성 세션
            </h2>
            <NuxtLink to="/admin/sessions" :class="[ui.link, 'text-sm font-medium']">
              전체 보기
            </NuxtLink>
          </div>
          <UiLoading v-if="isLoadingStatus(sessions.status.value) && !sessions.data.value" />
          <UiErrorState v-else-if="sessions.status.value === 'error'" message="세션 목록을 불러오지 못했습니다." @retry="sessions.refresh()" />
          <UiEmptyState v-else-if="sessions.data.value && sessions.data.value.items.length === 0">
            활성 세션이 없습니다.
          </UiEmptyState>
          <div v-else-if="sessions.data.value" class="overflow-x-auto">
            <table class="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
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
                <tr v-for="s in sessions.data.value.items" :key="s.id">
                  <td :class="[ui.td, 'font-medium']">
                    {{ s.username }}
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
                    <button
                      type="button"
                      :class="[ui.btnSmall, 'border border-error text-error hover:bg-error-container']"
                      @click="revokeTarget = s"
                    >
                      강제 종료<span class="sr-only"> ({{ s.username }})</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="dash-locks" :class="[ui.card, 'flex flex-col gap-3 rounded-xl p-5']">
          <div class="flex items-center justify-between">
            <h2 id="dash-locks" class="text-lg font-semibold">
              로그인 잠금
            </h2>
            <NuxtLink to="/admin/login-throttles" :class="[ui.link, 'text-sm font-medium']">
              전체 보기
            </NuxtLink>
          </div>
          <p class="text-[13px] text-on-surface-variant">
            연속 실패 횟수가 기준을 넘으면 일정 시간 로그인이 잠깁니다.
          </p>
          <UiLoading v-if="isLoadingStatus(throttles.status.value) && !throttles.data.value" />
          <UiErrorState v-else-if="throttles.status.value === 'error'" message="잠금 목록을 불러오지 못했습니다." @retry="throttles.refresh()" />
          <UiEmptyState v-else-if="throttles.data.value && locked.length === 0">
            잠긴 계정이 없습니다.
          </UiEmptyState>
          <ul v-else-if="locked.length > 0" class="flex flex-col gap-2">
            <li v-for="t in locked" :key="t.username" class="flex items-center gap-3 rounded-[10px] bg-error-container p-3 text-on-error-container">
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="truncate text-sm font-semibold">{{ t.username }}</span>
                <span class="text-xs">실패 {{ t.failed_count }}회 · {{ formatDateTime(t.locked_until) }}까지</span>
              </div>
              <button
                type="button"
                :class="[ui.btnSmall, 'bg-surface-container-lowest font-semibold text-on-error-container']"
                :disabled="unlocking === t.username"
                @click="unlock(t.username)"
              >
                잠금 해제<span class="sr-only"> ({{ t.username }})</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <UiConfirmDialog
      v-if="revokeTarget"
      title="세션을 강제 종료할까요?"
      confirm-label="강제 종료"
      danger
      :pending="revoking"
      @confirm="confirmRevoke"
      @cancel="revokeTarget = null"
    >
      {{ revokeTarget.username }} 의 세션(#{{ revokeTarget.id }})이 즉시 끊기고 다시 로그인해야 합니다. 내 세션이면 나도 로그아웃됩니다.
    </UiConfirmDialog>
  </div>
</template>
