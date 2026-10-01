<script setup lang="ts">
// 시스템 상태 — 헬스 체크(GET /health, /health/db) + 대시보드의 DB 상태·Alembic 리비전.
// (옛 /landing 화면의 백엔드·DB 상태 배지가 여기로 옮겨 왔다.)
import { ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const health = useHealthStatus()
const db = useDbHealthStatus()
const dashboard = useDashboard()

type RowState = "loading" | "ok" | "error"
const stateOf = (status: string, ok: boolean): RowState => (isLoadingStatus(status) ? "loading" : status !== "error" && ok ? "ok" : "error")

const rows = computed(() => [
  {
    label: "백엔드 API",
    detail: "GET /api/v1/health",
    state: stateOf(health.status.value, health.data.value?.status === "ok"),
  },
  {
    label: "데이터베이스",
    detail: db.data.value ? `GET /api/v1/health/db — ${db.data.value.table} (${db.data.value.rows} rows)` : "GET /api/v1/health/db",
    state: stateOf(db.status.value, db.data.value?.db === "ok"),
  },
])

// 빌드 모드 — SPA 라 빌드 시점 값이다(nuxt dev = development, nuxt generate/build = production).
const buildMode = import.meta.dev ? "development" : "production"

function refreshAll() {
  void health.refresh()
  void db.refresh()
  void dashboard.refresh()
}
</script>

<template>
  <div>
    <LayoutPageHeader title="시스템 상태" description="백엔드·데이터베이스 연결과 마이그레이션 상태">
      <template #actions>
        <button type="button" :class="ui.btnNeutral" @click="refreshAll">
          새로고침
        </button>
      </template>
    </LayoutPageHeader>
    <div class="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="sys-health" :class="[ui.card, 'rounded-xl']">
        <h2 id="sys-health" class="border-b border-surface-container px-5 py-4 text-lg font-semibold">
          헬스 체크
        </h2>
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex flex-col gap-2 border-b border-surface-container px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="font-semibold">
              {{ row.label }}
            </p>
            <p class="text-sm break-all text-on-surface-variant">
              {{ row.detail }}
            </p>
          </div>
          <UiChip v-if="row.state === 'loading'">
            확인 중…
          </UiChip>
          <UiChip v-else-if="row.state === 'ok'" tone="success">
            정상
          </UiChip>
          <UiChip v-else tone="danger">
            연결 안 됨
          </UiChip>
        </div>
      </section>

      <section aria-labelledby="sys-db" :class="[ui.card, 'rounded-xl']">
        <h2 id="sys-db" class="border-b border-surface-container px-5 py-4 text-lg font-semibold">
          데이터베이스
        </h2>
        <dl class="divide-y divide-surface-container">
          <div class="flex justify-between gap-4 px-5 py-4">
            <dt class="text-on-surface-variant">
              상태 (대시보드 집계)
            </dt>
            <dd>
              <template v-if="isLoadingStatus(dashboard.status.value) && !dashboard.data.value">
                확인 중…
              </template>
              <UiChip v-else-if="dashboard.data.value?.db === 'ok'" tone="success">
                정상
              </UiChip>
              <UiChip v-else tone="danger">
                오류
              </UiChip>
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-5 py-4">
            <dt class="text-on-surface-variant">
              Alembic 리비전
            </dt>
            <dd class="font-mono text-sm">
              {{ dashboard.data.value?.alembic_revision ?? (isLoadingStatus(dashboard.status.value) ? "…" : "확인 불가") }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-5 py-4">
            <dt class="text-on-surface-variant">
              프론트엔드 빌드
            </dt>
            <dd class="text-sm">
              {{ buildMode }}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
