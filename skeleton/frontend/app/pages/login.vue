<script setup lang="ts">
// 로그인 화면 (architecture.md §14). 성공 시 메인(/)으로 이동.
// 이 페이지만 auth 가드를 걸지 않는다.
const authStore = useAuthStore()
const loginMutation = useLogin()

const username = ref("")
const password = ref("")

// 이미 로그인 상태면 메인으로.
onMounted(() => {
  if (authStore.isAuthenticated) navigateTo("/", { replace: true })
})

const onSubmit = async () => {
  if (await loginMutation.mutate(username.value, password.value)) {
    await navigateTo("/", { replace: true })
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
        __PROJECT_NAME__
      </span>
      <h1 class="mt-4 text-2xl font-bold text-on-surface">로그인</h1>
      <p class="mt-1 text-sm text-on-surface-variant">계정으로 로그인하세요.</p>

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
        class="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
      >
        아이디 또는 비밀번호가 올바르지 않습니다.
      </p>

      <button
        type="submit"
        :disabled="loginMutation.isPending.value"
        class="mt-6 w-full rounded-lg bg-primary py-2.5 font-semibold text-on-primary disabled:opacity-60"
      >
        {{ loginMutation.isPending.value ? "로그인 중…" : "로그인" }}
      </button>

      <p class="mt-4 text-center text-xs text-on-surface-variant">
        기본 관리자 계정: <code class="font-mono">admin / admin123</code>
      </p>
    </form>
  </main>
</template>
