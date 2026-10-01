// 보호 라우트 가드 (ARCHITECTURE.md §14). 미인증 시 로그인 화면으로 보낸다.
// 각 페이지가 definePageMeta({ middleware: "auth" }) 로 이 가드를 지정한다 — /, /landing, /my.
// auth-init 플러그인이 refresh 쿠키로 세션 복원을 끝낸 뒤 실행되므로 스토어(메모리)만 보면 된다.
// prerender/서버 단계에서는 아무것도 하지 않고 빈 셸만 만든다.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated && to.path !== "/login") {
    return navigateTo("/login", { replace: true })
  }
})
