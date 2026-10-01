import { FetchError } from "ofetch"
import type { TokenResponse } from "~/api/auth"
import { loginPath, requiresLogin } from "~/lib/returnTo"

// HTTP 클라이언트 (ARCHITECTURE.md §13). axios 대신 Nuxt 내장 $fetch(ofetch)를 쓴다.
// $fetch.create 인스턴스를 provide 하면 컴포저블에서 useNuxtApp().$api 로 꺼내 쓸 수 있다.
// baseURL 미설정 시 nitro devProxy(/api/v1)를 탄다.
//
// 인증 흐름 (ARCHITECTURE.md §14): 스토어(메모리)의 access 토큰을 Bearer 로 주입하고,
// 401 이면 HttpOnly refresh 쿠키로 access 토큰을 재발급받아 원 요청을 1회만 재시도한다.
// ofetch 인터셉터(onResponseError)는 응답을 대체할 수 없으므로,
// 재시도는 $fetch.create 인스턴스를 감싼 래퍼 함수로 구현한다.

// 자기 자신이 401 이어도 refresh 를 타면 안 되는 인증 엔드포인트.
const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"]

// single-flight: 동시에 여러 요청이 401 을 받아도 refresh 는 한 번만 나간다.
let refreshPromise: Promise<string | null> | null = null

function refreshAccessToken(baseURL: string): Promise<string | null> {
  // 래핑 안 된 전역 $fetch 를 쓴다 — $api 로 부르면 401 처리와 얽혀 무한루프 위험.
  // refresh 토큰은 HttpOnly 쿠키라 credentials 만 명시하면 브라우저가 알아서 보낸다.
  refreshPromise ??= $fetch<TokenResponse>("/auth/refresh", {
    baseURL,
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.access_token)
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof FetchError && error.status === 401
}

function requestPath(request: Parameters<typeof $fetch>[0]): string {
  return typeof request === "string" ? request : request.url
}

export default defineNuxtPlugin(() => {
  const { public: publicConfig } = useRuntimeConfig()
  const baseURL = publicConfig.apiBaseUrl ? `${publicConfig.apiBaseUrl}/api/v1` : "/api/v1"
  const authStore = useAuthStore()

  const instance = $fetch.create({
    baseURL,
    // refresh 쿠키를 주고받으려면 교차 오리진에서도 쿠키를 포함해야 한다 (same-site 전제).
    credentials: "include",

    // 요청 인터셉터: 스토어(메모리)의 access 토큰을 Bearer 로 주입.
    onRequest({ options }) {
      const token = authStore.token
      if (token) options.headers.set("Authorization", `Bearer ${token}`)
    },
  })

  // 래퍼: 401 → refresh 1회 → 원 요청 1회 재시도. refresh 실패 시 (보호 화면이면) 로그인 화면으로.
  const api = (async (request: Parameters<typeof $fetch>[0], options?: Parameters<typeof $fetch>[1]) => {
    try {
      return await instance(request, options)
    } catch (error) {
      const path = requestPath(request)
      if (!isUnauthorized(error) || AUTH_PATHS.some((p) => path.startsWith(p))) throw error

      const accessToken = await refreshAccessToken(baseURL)
      if (accessToken === null) {
        // refresh 실패 = 세션 만료. 상태를 비우고, 로그인이 필요한 화면(/admin/**, /me)에 있었다면
        // 원래 위치(next)를 담아 로그인 화면으로 보낸다. 공개 화면(/, /notices)은 그대로 둔다.
        // 하드 이동(location.href)이라 메모리의 조회 캐시도 함께 사라진다.
        authStore.logout()
        if (import.meta.client) {
          const here = `${location.pathname}${location.search}${location.hash}`
          if (requiresLogin(location.pathname)) location.href = loginPath(here)
        }
        throw error
      }

      authStore.setSession(accessToken)
      // 재시도는 1회뿐 — 여기서 또 401 이면 그대로 실패시킨다.
      return await instance(request, options)
    }
  }) as typeof $fetch

  // $fetch 인터페이스 유지: .raw / .create 는 원 인스턴스에 위임한다.
  api.raw = instance.raw
  api.create = instance.create

  return { provide: { api } }
})
