import { clearToken, getToken } from "~/lib/token"

// HTTP 클라이언트 (architecture.md §13). axios 대신 Nuxt 내장 $fetch(ofetch)를 쓴다.
// $fetch.create 로 만든 인스턴스를 provide 하면 컴포저블에서 useNuxtApp().$api 로 꺼내 쓸 수 있다.
// baseURL 미설정 시 nitro devProxy(/api/v1)를 탄다.
export default defineNuxtPlugin(() => {
  const { public: publicConfig } = useRuntimeConfig()
  const baseUrl = publicConfig.apiBaseUrl

  const api = $fetch.create({
    baseURL: baseUrl ? `${baseUrl}/api/v1` : "/api/v1",

    // 요청 인터셉터: Bearer 토큰 주입.
    onRequest({ options }) {
      const token = getToken()
      if (token) options.headers.set("Authorization", `Bearer ${token}`)
    },

    // 응답 인터셉터: 401 이면 토큰을 버리고 로그인 화면으로 보낸다.
    onResponseError({ response }) {
      if (response.status === 401) {
        clearToken()
        if (import.meta.client && location.pathname !== "/login") location.href = "/login"
      }
    },
  })

  return { provide: { api } }
})
