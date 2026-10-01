// 인증 API (ARCHITECTURE.md §13, §14).
// 플러그인이 provide 한 $api 를 쓰므로 setup / 컴포저블 / 플러그인 컨텍스트 안에서 호출해야 한다.
export type UserRole = "user" | "admin"

export interface User {
  id: number
  username: string
  role: UserRole
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export function useAuthApi() {
  const { $api } = useNuxtApp()

  return {
    // 성공 시 access 토큰(바디) + HttpOnly refresh 쿠키(Set-Cookie)를 함께 받는다.
    login: (username: string, password: string) =>
      $api<TokenResponse>("/auth/login", { method: "POST", body: { username, password } }),

    // 바디 없음 — HttpOnly refresh 쿠키로 인증하고, 새 access 토큰 + 회전된 쿠키를 받는다.
    refresh: () => $api<TokenResponse>("/auth/refresh", { method: "POST" }),

    // 서버가 세션 revoke + refresh 쿠키 삭제. 204 No Content (바디 없음).
    logout: () => $api("/auth/logout", { method: "POST" }),

    getMe: () => $api<User>("/auth/me"),
  }
}
