// 인증 API (ARCHITECTURE.md §13, §14).
// 플러그인이 provide 한 $api 를 쓰므로 setup / 컴포저블 / 플러그인 컨텍스트 안에서 호출해야 한다.
export type UserRole = "user" | "admin"

export interface User {
  id: number
  username: string
  role: UserRole
  is_active: boolean
}

// 로그인/리프레시 공통 응답 (backend app/schemas/user.py TokenResponse, ARCHITECTURE.md §9).
// 이 템플릿은 REFRESH_TOKEN_TRANSPORT=cookie 라 refresh 토큰은 httpOnly 쿠키로만 오고 본문은 항상 null 이다.
// expires_in / refresh_expires_in 은 절대 시각이 아니라 "지금부터 남은 초" 다.
export interface TokenResponse {
  access_token: string
  refresh_token: string | null
  token_type: string
  expires_in: number
  refresh_expires_in: number
}

export function useAuthApi() {
  const { $api } = useNuxtApp()

  return {
    // 성공 시 access 토큰(바디) + HttpOnly refresh 쿠키(Set-Cookie)를 함께 받는다.
    // 실패: 401(아이디/비밀번호 불일치·비활성), 429(계정별 연속 실패로 잠금 — LOGIN_LOCKOUT_MINUTES 동안).
    // 429 에는 Retry-After 헤더가 없다 — 남은 시간을 계산하지 말고 일반 안내 문구를 보여준다.
    login: (username: string, password: string) =>
      $api<TokenResponse>("/auth/login", { method: "POST", body: { username, password } }),

    // 바디 없음 — HttpOnly refresh 쿠키로 인증하고, 새 access 토큰 + 회전된 쿠키를 받는다.
    // 실패(쿠키 없음/만료/폐기/재사용)는 원인 무관 401 이고, 서버가 refresh 쿠키도 지운다.
    refresh: () => $api<TokenResponse>("/auth/refresh", { method: "POST" }),

    // 서버가 세션 revoke + refresh 쿠키 삭제. 쿠키 유무·상태와 무관하게 항상 204 No Content (바디 없음).
    // 세션이 폐기되면 그 세션의 access 토큰(sid 클레임)도 즉시 401 이 된다.
    logout: () => $api("/auth/logout", { method: "POST" }),

    getMe: () => $api<User>("/auth/me"),
  }
}
