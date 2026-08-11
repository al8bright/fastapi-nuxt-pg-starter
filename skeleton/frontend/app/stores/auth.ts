import { defineStore } from "pinia"
import type { User } from "~/api/auth"
import { clearToken, getToken, setToken } from "~/lib/token"

// 클라이언트 전역 상태 (architecture.md §13).
// zustand 대신 Pinia setup store 를 쓴다. @pinia/nuxt 가 app/stores/*.ts 를 자동 import 하므로
// 컴포넌트에서 import 없이 useAuthStore() 로 바로 쓴다.
export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  function setSession(nextToken: string): void {
    setToken(nextToken)
    token.value = nextToken
  }

  function setUser(nextUser: User | null): void {
    user.value = nextUser
  }

  function logout(): void {
    clearToken()
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, setSession, setUser, logout }
})
