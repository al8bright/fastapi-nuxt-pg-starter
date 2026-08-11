// 토큰 저장소 (architecture.md §14). 키는 프로젝트별로 분리한다.
// SPA(ssr: false)라도 nuxt build/generate 의 prerender 단계는 Node 에서 돌아 localStorage 가 없다
// → 모든 접근 함수에 import.meta.client 가드 필수.
const TOKEN_KEY = "__PROJECT_SNAKE___token"

export function getToken(): string | null {
  if (!import.meta.client) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (!import.meta.client) return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (!import.meta.client) return
  localStorage.removeItem(TOKEN_KEY)
}
