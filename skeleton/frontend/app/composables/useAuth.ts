import { FetchError } from "ofetch"
import { useAuthApi } from "~/api/auth"

// 인증 컴포저블 (ARCHITECTURE.md §13, §14).
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
    // ssr: false 라 서버에서는 돌지 않는다. 토큰(메모리)이 없으면 아예 요청하지 않는다.
    { server: false, immediate: authStore.isAuthenticated },
  )
}

const LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다."
// 429 = 백엔드 DB 스로틀(login_throttles)의 계정별 잠금. Retry-After 헤더가 없으므로 남은 시간은 표시하지 않는다.
const LOGIN_LOCKED_MESSAGE = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요."
const LOGIN_UNAVAILABLE_MESSAGE = "로그인에 실패했습니다. 잠시 후 다시 시도하세요."

function loginErrorMessage(error: unknown): string {
  if (error instanceof FetchError) {
    if (error.status === 429) return LOGIN_LOCKED_MESSAGE
    if (error.status === 401 || error.status === 422) return LOGIN_FAILED_MESSAGE
  }
  return LOGIN_UNAVAILABLE_MESSAGE
}

/** 로그인 → access 토큰을 스토어(메모리)에 저장 → 사용자 정보 로드 (mutation 대응).
 *  refresh 토큰은 서버가 HttpOnly 쿠키로 내려주므로(본문 refresh_token 은 null) 프론트는 저장하지 않는다. */
export function useLogin() {
  const { getMe, login } = useAuthApi()
  const authStore = useAuthStore()

  const isPending = ref(false)
  const errorMessage = ref<string | null>(null)
  const isError = computed(() => errorMessage.value !== null)

  async function mutate(username: string, password: string): Promise<boolean> {
    isPending.value = true
    errorMessage.value = null
    try {
      const token = await login(username, password)
      authStore.setSession(token.access_token)
      authStore.setUser(await getMe())
      return true
    } catch (error) {
      errorMessage.value = loginErrorMessage(error)
      return false
    } finally {
      isPending.value = false
    }
  }

  return { mutate, isPending, isError, errorMessage }
}

/** 로그아웃 → 서버 세션 revoke + 쿠키 삭제(서버는 항상 204, 네트워크 실패는 무시) → 상태 초기화 → 로그인 화면 */
export function useLogout() {
  const { logout } = useAuthApi()
  const authStore = useAuthStore()

  async function mutate(): Promise<void> {
    try {
      await logout()
    } catch {
      // 네트워크 실패는 무시 — 로컬 상태는 어차피 비운다. 서버에 남은 세션은 만료 시 거부된다.
    }
    authStore.logout()
    clearNuxtData("auth:me") // useMe 캐시도 비워 다음 로그인 때 재조회하게 한다.
    await navigateTo("/login", { replace: true })
  }

  return { mutate }
}
