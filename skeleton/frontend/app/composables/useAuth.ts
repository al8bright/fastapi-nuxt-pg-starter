import { useAuthApi } from "~/api/auth"
import { httpErrorInfo } from "~/lib/apiError"

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

/** 서버 `detail` 이 문자열일 때만 살린다 (FastAPI 422 는 객체 배열이라 그대로 보여줄 수 없다). */
function serverDetail(data: unknown): string | null {
  const detail = (data as { detail?: unknown } | undefined)?.detail
  return typeof detail === "string" && detail.trim() !== "" ? detail : null
}

/**
 * 로그인 실패 원인을 상태코드로 구분해 사용자 문구로 바꾼다.
 * 모든 실패를 "아이디 또는 비밀번호" 로 표시하면 422·네트워크 오류·500 을 오진한다.
 */
export function loginErrorMessage(error: unknown): string {
  const info = httpErrorInfo(error)
  if (!info) return "알 수 없는 오류가 발생했습니다."
  if (info.status === null) return "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요."
  // 401 문구는 고정 — 계정 존재 여부를 노출하지 않는다(백엔드도 메시지를 통일한다).
  if (info.status === 401) return "아이디 또는 비밀번호가 올바르지 않습니다."
  // 429 = 백엔드 DB 스로틀(login_throttles)의 계정별 잠금. 비밀번호 오류와 구분해 안내한다.
  if (info.status === 429) return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요."
  if (info.status === 422) return serverDetail(info.data) ?? "입력값을 확인하세요. (비밀번호는 UTF-8 기준 72 bytes 이하)"
  if (info.status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요."
  return serverDetail(info.data) ?? "로그인 처리 중 오류가 발생했습니다."
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

/**
 * 로그아웃 → 서버 세션 revoke + 쿠키 삭제(서버는 항상 204, 네트워크 실패는 무시) → 상태·조회 캐시 초기화 → 홈.
 * 캐시(useAsyncData)를 남기면 다음 사용자가 이전 사용자의 관리자 목록 등을 잠깐 볼 수 있다 — 전부 비운다.
 * 첫 화면(/)은 공개라 로그아웃 뒤에는 홈으로 간다.
 */
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
    clearNuxtData()
    await navigateTo("/", { replace: true })
  }

  return { mutate }
}
