<script setup lang="ts">
// 로그인 화면 (ARCHITECTURE.md §14). 성공하면 ?next=<원래 위치>(없으면 홈)로 돌아간다.
// 보호 화면(middleware auth·admin)과 $api 의 세션 만료 처리가 next 를 실어 이 화면으로 보낸다.
// next 는 내부 경로만 받는다(safeNext — 오픈 리다이렉트 차단). 레이아웃 없이 단독 화면이다.
import { safeNext } from "~/lib/returnTo"
import { SITE_NAME } from "~/lib/site"

definePageMeta({ layout: false })

const authStore = useAuthStore()
const loginMutation = useLogin()
const route = useRoute()
const next = computed(() => safeNext(route.query.next))

const username = ref("")
const password = ref("")

// 이미 로그인 상태면 목적지로.
onMounted(() => {
  if (authStore.isAuthenticated) navigateTo(next.value, { replace: true })
})

const onSubmit = async () => {
  if (await loginMutation.mutate(username.value, password.value)) {
    await navigateTo(next.value, { replace: true })
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-surface px-4">
    <form
      class="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm"
      @submit.prevent="onSubmit"
    >
      <span class="inline-block rounded-full bg-primary px-4 py-1 text-sm font-semibold text-on-primary">
        {{ SITE_NAME }}
      </span>
      <h1 class="mt-4 text-2xl font-bold text-on-surface">
        로그인
      </h1>
      <p class="mt-1 text-sm text-on-surface-variant">
        계정으로 로그인하세요.
      </p>

      <label class="mt-6 block text-sm font-medium text-on-surface" for="username">아이디</label>
      <input
        id="username"
        v-model="username"
        class="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
        autocomplete="username"
        autofocus
      >

      <label class="mt-4 block text-sm font-medium text-on-surface" for="password">비밀번호</label>
      <input
        id="password"
        v-model="password"
        type="password"
        class="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
        autocomplete="current-password"
      >

      <p
        v-if="loginMutation.isError.value"
        role="alert"
        class="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
      >
        {{ loginMutation.errorMessage.value }}
      </p>

      <button
        type="submit"
        :disabled="loginMutation.isPending.value"
        class="mt-6 w-full rounded-lg bg-primary py-2.5 font-semibold text-on-primary disabled:opacity-60"
      >
        {{ loginMutation.isPending.value ? "로그인 중…" : "로그인" }}
      </button>
      <NuxtLink
        to="/"
        class="mt-4 flex min-h-11 items-center justify-center rounded text-sm text-on-surface-variant hover:text-on-surface"
      >
        ← 홈으로
      </NuxtLink>
    </form>
  </main>
</template>
