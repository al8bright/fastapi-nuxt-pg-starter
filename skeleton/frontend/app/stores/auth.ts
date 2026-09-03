import { defineStore } from "pinia"
import type { User } from "~/api/auth"

// 클라이언트 전역 상태 (architecture.md §13).
// zustand 대신 Pinia setup store 를 쓴다. @pinia/nuxt 가 app/stores/*.ts 를 자동 import 하므로
// 컴포넌트에서 import 없이 useAuthStore() 로 바로 쓴다.
//
// access 토큰은 메모리(ref)에만 둔다 — localStorage 금지 (XSS 탈취 방지, architecture.md §14).
// 새로고침으로 사라진 토큰은 auth-init 플러그인이 HttpOnly refresh 쿠키로 복원한다.
export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  function setSession(nextToken: string): void {
    token.value = nextToken
  }

  function setUser(nextUser: User | null): void {
    user.value = nextUser
  }

  // 상태만 비운다 — 서버 세션 revoke(POST /auth/logout)는 useLogout 컴포저블이 담당한다.
  function logout(): void {
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, setSession, setUser, logout }
})
