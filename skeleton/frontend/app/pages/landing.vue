<script setup lang="ts">
// 랜딩(시스템 상태) 화면 (architecture.md §14). 백엔드 / DB 연결 상태를 보여 준다.
definePageMeta({ middleware: "auth" })

const { data: health, status: healthStatus } = useHealthStatus()
const { data: dbHealth, status: dbHealthStatus } = useDbHealthStatus()

// 원본의 StatusBadge 컴포넌트 대응 — 파일을 늘리지 않고 목록 + v-for 로 둔다.
const statuses = computed(() => [
  {
    label: "백엔드 API",
    ok: health.value?.status === "ok",
    loading: healthStatus.value === "idle" || healthStatus.value === "pending",
    detail: "GET /api/v1/health",
  },
  {
    label: "데이터베이스",
    ok: dbHealth.value?.db === "ok",
    loading: dbHealthStatus.value === "idle" || dbHealthStatus.value === "pending",
    detail: dbHealth.value
      ? `GET /api/v1/health/db — ${dbHealth.value.table} (${dbHealth.value.rows} rows)`
      : "GET /api/v1/health/db",
  },
])

const badgeText = (s: { ok: boolean, loading: boolean }) =>
  s.loading ? "확인 중…" : s.ok ? "정상" : "연결 안 됨"

const badgeTone = (s: { ok: boolean, loading: boolean }) =>
  s.loading
    ? "bg-surface-container text-on-surface-variant"
    : s.ok
      ? "bg-tertiary-container text-on-tertiary-container"
      : "bg-error-container text-on-error-container"
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
    <div class="w-full max-w-xl">
      <header class="mb-8 text-center">
        <span class="inline-block rounded-full bg-primary px-4 py-1 text-sm font-semibold text-on-primary">
          __PROJECT_NAME__
        </span>
        <h1 class="mt-4 text-4xl font-bold tracking-tight text-on-surface">
          프로젝트 스캐폴드 완료 🎉
        </h1>
        <p class="mt-3 text-on-surface-variant">
          공통 아키텍처(FastAPI · Nuxt · PostgreSQL) 기반 스타터입니다.
          아래에서 백엔드/DB 연결 상태를 확인하세요.
        </p>
      </header>

      <div class="space-y-3">
        <div
          v-for="s in statuses"
          :key="s.label"
          class="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-lowest px-5 py-4"
        >
          <div>
            <p class="font-semibold text-on-surface">{{ s.label }}</p>
            <p class="text-sm text-on-surface-variant">{{ s.detail }}</p>
          </div>
          <span class="rounded-full px-3 py-1 text-sm font-semibold" :class="badgeTone(s)">
            {{ badgeText(s) }}
          </span>
        </div>
      </div>

      <footer class="mt-8 text-center text-sm text-on-surface-variant">
        다음 단계: <code class="font-mono">plan.md</code> 순서대로 TDD 로 개발을 시작하세요.
        <NuxtLink to="/" class="mt-3 block text-on-surface-variant hover:text-on-surface">
          ← 메인으로
        </NuxtLink>
      </footer>
    </div>
  </main>
</template>
