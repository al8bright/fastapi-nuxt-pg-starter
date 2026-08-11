// 인증 API (architecture.md §13, §14).
// 플러그인이 provide 한 $api 를 쓰므로 setup / 컴포저블 컨텍스트 안에서 호출해야 한다.
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
    login: (username: string, password: string) =>
      $api<TokenResponse>("/auth/login", { method: "POST", body: { username, password } }),

    getMe: () => $api<User>("/auth/me"),
  }
}
