import { loginPath } from "~/lib/returnTo"

// 로그인 필요 화면 가드 (ARCHITECTURE.md §14). 미인증이면 원래 위치를 next 로 담아 로그인 화면으로 보낸다.
// 페이지가 definePageMeta({ middleware: "auth" }) 로 지정한다 — 현재 /me. (관리자 화면은 admin 미들웨어)
// 첫 화면(/)·공지(/notices)는 공개라 가드가 없다.
// auth-init 플러그인이 refresh 쿠키로 세션 복원을 끝낸 뒤 실행되므로 스토어(메모리)만 보면 된다.
// prerender/서버 단계에서는 아무것도 하지 않고 빈 셸만 만든다.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return navigateTo(loginPath(to.fullPath), { replace: true })
})
