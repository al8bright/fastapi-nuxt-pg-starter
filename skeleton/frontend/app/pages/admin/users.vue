<script setup lang="ts">
// 사용자 관리 — 검색·역할 필터·페이지(URL 쿼리), 권한·활성 변경(확인 후 PATCH), 세션 모두 종료.
// 자기 자신 변경(409 self_modification)·마지막 관리자 보호(409 last_admin)는 서버가 거부하고 문구로 안내한다.
import { type AdminUser, type AdminUserUpdate, useAdminApi } from "~/api/admin"
import type { UserRole } from "~/api/auth"
import { apiErrorMessage } from "~/lib/apiError"
import { formatDate, formatNumber } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const PAGE_SIZE = 20
const ROLE_LABEL: Record<UserRole, string> = { admin: "관리자", user: "일반 사용자" }

type Pending =
  | { kind: "update", user: AdminUser, body: AdminUserUpdate, title: string, description: string }
  | { kind: "revoke", user: AdminUser }

const { page, q, get, update } = useListParams()
const role = computed<UserRole | undefined>(() => {
  const r = get("role")
  return r === "admin" || r === "user" ? r : undefined
})
const { data, status, refresh } = useAdminUsers(() => ({ page: page.value, size: PAGE_SIZE, q: q.value, role: role.value }))
const { user: me } = storeToRefs(useAuthStore())
const { updateUser, revokeUserSessions } = useAdminApi()
const pending = shallowRef<Pending | null>(null)
const message = ref<Flash | null>(null)
const roleFilterId = useId()
const loading = computed(() => isLoadingStatus(status.value) && !data.value)

function askRole(user: AdminUser, e: Event) {
  const select = e.target as HTMLSelectElement
  const next = select.value as UserRole
  // 확인 전까지는 현재 권한을 그대로 보여 준다(제어 컴포넌트처럼).
  select.value = user.role
  if (next === user.role) return
  pending.value = {
    kind: "update",
    user,
    body: { role: next },
    title: `${user.username} 의 권한을 바꿀까요?`,
    description: `${ROLE_LABEL[user.role]} → ${ROLE_LABEL[next]}. ${next === "admin" ? "관리자 콘솔의 모든 기능을 쓸 수 있게 됩니다." : "관리자 콘솔에 더 이상 들어올 수 없습니다."}`,
  }
}

function askActive(user: AdminUser) {
  pending.value = {
    kind: "update",
    user,
    body: { is_active: !user.is_active },
    title: user.is_active ? `${user.username} 을(를) 비활성화할까요?` : `${user.username} 을(를) 다시 활성화할까요?`,
    description: user.is_active ? "로그인할 수 없게 되고 살아 있는 세션이 모두 종료됩니다." : "다시 로그인할 수 있게 됩니다.",
  }
}

const { run: apply, isPending: applying } = useAction(async (p: Pending) => {
  const result = p.kind === "update" ? await updateUser(p.user.id, p.body) : await revokeUserSessions(p.user.id)
  await invalidateAccounts()
  return result
})

async function confirm() {
  const p = pending.value
  if (!p) return
  try {
    const result = await apply(p)
    message.value
      = p.kind === "update"
        ? { tone: "success", text: `${p.user.username} 의 정보를 바꿨습니다.` }
        : { tone: "success", text: `${p.user.username} 의 세션 ${(result as { revoked: number }).revoked}개를 종료했습니다.` }
  } catch (err) {
    message.value = { tone: "error", text: apiErrorMessage(err) }
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader title="사용자" :description="data ? `${formatNumber(data.total)}명` : '계정 권한·활성 상태 관리'" />
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <UiSearchForm :key="q" label="아이디 검색" :initial="q" @search="(value) => update({ q: value })" />
      <div class="sm:w-44">
        <label :for="roleFilterId" class="sr-only">권한 필터</label>
        <select
          :id="roleFilterId"
          :value="role ?? ''"
          :class="[ui.input, 'mt-0']"
          @change="update({ role: ($event.target as HTMLSelectElement).value })"
        >
          <option value="">
            모든 권한
          </option>
          <option value="admin">
            관리자
          </option>
          <option value="user">
            일반 사용자
          </option>
        </select>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <UiNotice v-if="message" :tone="message.tone" @close="message = null">
        {{ message.text }}
      </UiNotice>
      <UiLoading v-if="loading" />
      <UiErrorState v-else-if="status === 'error'" message="사용자 목록을 불러오지 못했습니다." @retry="refresh()" />
      <UiEmptyState v-else-if="data && data.items.length === 0">
        조건에 맞는 사용자가 없습니다.
      </UiEmptyState>
      <div v-else-if="data" :class="[ui.card, 'overflow-x-auto']">
        <table class="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              <th scope="col" :class="ui.th">
                아이디
              </th>
              <th scope="col" :class="ui.th">
                권한
              </th>
              <th scope="col" :class="ui.th">
                상태
              </th>
              <th scope="col" :class="ui.th">
                가입일
              </th>
              <th scope="col" :class="ui.th">
                활성 세션
              </th>
              <th scope="col" :class="ui.th">
                <span class="sr-only">작업</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in data.items" :key="u.id">
              <th scope="row" :class="[ui.td, 'text-left font-medium']">
                {{ u.username }}
                <span v-if="me?.id === u.id" class="ml-1 text-xs text-on-surface-variant">(나)</span>
              </th>
              <td :class="ui.td">
                <label class="sr-only" :for="`role-${u.id}`">{{ u.username }} 권한</label>
                <select :id="`role-${u.id}`" :value="u.role" :class="[ui.input, 'mt-0 w-36']" @change="askRole(u, $event)">
                  <option value="user">
                    일반 사용자
                  </option>
                  <option value="admin">
                    관리자
                  </option>
                </select>
              </td>
              <td :class="ui.td">
                <UiChip v-if="u.is_active" tone="success">
                  활성
                </UiChip>
                <UiChip v-else tone="danger">
                  비활성
                </UiChip>
              </td>
              <td :class="[ui.td, 'text-on-surface-variant']">
                {{ formatDate(u.created_at) }}
              </td>
              <td :class="ui.td">
                <NuxtLink :to="`/admin/sessions?user_id=${u.id}`" :class="ui.link">
                  {{ u.active_session_count }}개<span class="sr-only"> ({{ u.username }} 세션 보기)</span>
                </NuxtLink>
              </td>
              <td :class="[ui.td, 'text-right whitespace-nowrap']">
                <button
                  type="button"
                  :class="[ui.btnSmall, u.is_active ? 'text-error hover:bg-error-container' : 'text-primary hover:bg-primary-fixed']"
                  @click="askActive(u)"
                >
                  {{ u.is_active ? "비활성화" : "활성화" }}<span class="sr-only"> ({{ u.username }})</span>
                </button>
                <button
                  type="button"
                  :class="[ui.btnSmall, 'text-error hover:bg-error-container']"
                  :disabled="u.active_session_count === 0"
                  @click="pending = { kind: 'revoke', user: u }"
                >
                  세션 모두 종료<span class="sr-only"> ({{ u.username }})</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiPagination v-if="data" :page="page" :size="PAGE_SIZE" :total="data.total" @change="(p) => update({ page: p })" />
    </div>

    <UiConfirmDialog
      v-if="pending?.kind === 'update'"
      :title="pending.title"
      confirm-label="변경"
      :danger="pending.body.is_active === false || pending.body.role === 'user'"
      :pending="applying"
      @confirm="confirm"
      @cancel="pending = null"
    >
      {{ pending.description }}
    </UiConfirmDialog>
    <UiConfirmDialog
      v-if="pending?.kind === 'revoke'"
      :title="`${pending.user.username} 의 세션을 모두 종료할까요?`"
      confirm-label="모두 종료"
      danger
      :pending="applying"
      @confirm="confirm"
      @cancel="pending = null"
    >
      모든 기기에서 즉시 로그아웃됩니다. 계정은 그대로이며 다시 로그인할 수 있습니다.
    </UiConfirmDialog>
  </div>
</template>
