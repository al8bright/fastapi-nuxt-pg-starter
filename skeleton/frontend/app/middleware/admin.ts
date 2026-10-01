import { useAuthApi } from "~/api/auth"
import { loginPath } from "~/lib/returnTo"

// 관리자 가드 (ARCHITECTURE.md §14). 모든 /admin/** 페이지가 definePageMeta({ layout: "admin", middleware: "admin" }) 로 지정한다.
// - 비로그인 → /login?next=<원래 위치> (로그인 후 그 위치로 돌아온다)
// - 로그인했지만 role ≠ admin → 403 오류 화면(app/error.vue). fatal 오류여야 클라이언트 이동에서도 오류 화면이 뜬다.
// 역할은 스토어의 사용자(auth-init 플러그인·로그인이 GET /auth/me 로 채운다)로 판단한다.
// 이 가드는 화면 노출을 정하는 UX 장치이고, 권한 경계는 백엔드(/api/v1/admin/* 의 require_admin)다.
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return navigateTo(loginPath(to.fullPath), { replace: true })

  if (!authStore.user) {
    // 토큰은 있는데 사용자 정보가 없다(직전 /auth/me 실패 등) — 한 번 더 불러온다.
    try {
      authStore.setUser(await useAuthApi().getMe())
    } catch {
      return createError({ status: 503, statusText: "사용자 정보를 불러오지 못했습니다.", fatal: true })
    }
  }
  if (authStore.user?.role !== "admin") {
    return createError({ status: 403, statusText: "Forbidden", fatal: true })
  }
})
