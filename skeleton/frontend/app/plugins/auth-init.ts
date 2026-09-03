import { useAuthApi } from "~/api/auth"

// 세션 복원 플러그인 (architecture.md §14). 파일명이 api.ts 다음 알파벳 순서라 $api 이후에 로드된다.
// SPA 라 새로고침하면 메모리의 access 토큰이 사라진다 → 앱 부팅 시 HttpOnly refresh 쿠키로
// /auth/refresh 를 1회 시도해 세션을 복원한다. await 로 라우트 미들웨어(auth 가드)보다 먼저 끝낸다.
export default defineNuxtPlugin(async () => {
  // prerender(Node) 단계에는 쿠키가 없다 — 클라이언트에서만 시도한다.
  if (!import.meta.client) return

  const { getMe, refresh } = useAuthApi()
  const authStore = useAuthStore()

  try {
    const token = await refresh()
    authStore.setSession(token.access_token)
    authStore.setUser(await getMe())
  } catch {
    // 실패(401 등) = refresh 쿠키가 없거나 만료 — 조용히 무시하고 비로그인 상태로 시작한다.
  }
})
