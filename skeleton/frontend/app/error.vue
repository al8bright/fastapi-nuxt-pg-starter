<script setup lang="ts">
// 오류 화면 (Nuxt 규약 — app/error.vue). showError·fatal 오류·없는 경로에서 페이지 대신 그려진다.
// - 404: 없는 주소 → 사용자 레이아웃 안의 "페이지를 찾을 수 없습니다"
// - 403: admin 미들웨어가 로그인했지만 관리자가 아닌 사용자를 막을 때 → "접근 권한이 없습니다"
// - 그 밖: 렌더·지연 로딩 실패(배포 직후 옛 청크 등) → 새로고침 안내
import type { NuxtError } from "#app"
import { ui } from "~/lib/ui"

const { error } = defineProps<{ error: NuxtError }>()

const status = computed(() => error.status ?? error.statusCode ?? 500)
const detail = computed(() => {
  const text = error.statusText ?? error.statusMessage
  return text ? `${status.value} ${text}` : String(status.value)
})

const goHome = () => clearError({ redirect: "/" })
const reload = () => window.location.reload()
</script>

<template>
  <NuxtLayout v-if="status === 404" name="default">
    <div class="mx-auto max-w-[1200px] px-4 py-20 text-center sm:px-6">
      <p class="text-sm font-semibold tracking-wider text-primary">
        404
      </p>
      <h1 class="mt-2 text-2xl font-semibold">
        페이지를 찾을 수 없습니다
      </h1>
      <p class="mt-3 text-on-surface-variant">
        주소가 바뀌었거나 삭제된 페이지입니다.
      </p>
      <button type="button" :class="[ui.btnPrimary, 'mt-6']" @click="goHome">
        홈으로 이동
      </button>
    </div>
  </NuxtLayout>

  <main v-else-if="status === 403" class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div :class="[ui.card, 'w-full max-w-md p-8 text-center']">
      <p class="text-sm font-semibold tracking-wider text-error">
        403
      </p>
      <h1 class="mt-2 text-2xl font-semibold text-on-surface">
        접근 권한이 없습니다
      </h1>
      <p class="mt-3 text-on-surface-variant">
        관리자 콘솔은 관리자 계정만 이용할 수 있습니다. 권한이 필요하면 관리자에게 문의하세요.
      </p>
      <button type="button" :class="[ui.btnPrimary, 'mt-6']" @click="goHome">
        홈으로 이동
      </button>
    </div>
  </main>

  <main v-else class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div role="alert" :class="[ui.card, 'w-full max-w-md p-8 text-center']">
      <h1 class="text-2xl font-semibold">
        화면을 표시하지 못했습니다
      </h1>
      <p class="mt-3 text-on-surface-variant">
        일시적인 문제일 수 있습니다. 새로고침한 뒤에도 같으면 관리자에게 알려 주세요.
        <span class="mt-1 block text-sm">({{ detail }})</span>
      </p>
      <div class="mt-6 flex justify-center gap-2">
        <button type="button" :class="ui.btnPrimary" @click="reload">
          새로고침
        </button>
        <button type="button" :class="ui.btnNeutral" @click="goHome">
          홈으로
        </button>
      </div>
    </div>
  </main>
</template>
