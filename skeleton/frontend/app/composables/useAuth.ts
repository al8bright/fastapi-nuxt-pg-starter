import { useAuthApi } from "~/api/auth"

// 인증 컴포저블 (architecture.md §13, §14).
// Nuxt 판은 쿼리 라이브러리(react-query/svelte-query) 대신 내장 useAsyncData 를 쓴다.
// 키("auth:me")가 캐시 키 역할을 하므로 같은 키를 쓰는 여러 컴포넌트가 요청을 공유한다.
// ⛔ 컴포넌트에서 ref + onMounted 로 직접 패칭하지 말 것 — 반드시 이 계층을 통한다.
// ⚠️ useAsyncData 는 setup 최상단(컴포넌트 초기화 시점)에서만 호출할 수 있다.

/** 현재 로그인 사용자 (토큰 있을 때만 조회, 스토어에도 반영) */
export function useMe() {
  const { getMe } = useAuthApi()
  const authStore = useAuthStore()

  return useAsyncData(
    "auth:me",
    async () => {
      const user = await getMe()
      authStore.setUser(user)
      return user
    },
    // ssr: false 라 서버에서는 돌지 않는다. 토큰이 없으면 아예 요청하지 않는다.
    { server: false, immediate: authStore.isAuthenticated },
  )
}

/** 로그인 → 토큰 저장 → 사용자 정보 로드 (쿼리 라이브러리의 mutation 대응) */
export function useLogin() {
  const { getMe, login } = useAuthApi()
  const authStore = useAuthStore()

  const isPending = ref(false)
  const isError = ref(false)

  async function mutate(username: string, password: string): Promise<boolean> {
    isPending.value = true
    isError.value = false
    try {
      const token = await login(username, password)
      authStore.setSession(token.access_token)
      authStore.setUser(await getMe())
      return true
    } catch {
      isError.value = true
      return false
    } finally {
      isPending.value = false
    }
  }

  return { mutate, isPending, isError }
}
