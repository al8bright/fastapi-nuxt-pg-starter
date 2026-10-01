// 로그인 후 원래 목적지 복귀 (ARCHITECTURE.md §14).
// 보호 화면(middleware auth·admin)과 $api 의 refresh 실패 처리가 `/login?next=<원래 경로>` 로 보낸다.
// next 는 URL 로 조작할 수 있으므로 사이트 내부 경로만 받는다(오픈 리다이렉트 차단).

/** 안전한 내부 경로면 그대로, 아니면 "/". `//host`·`/\host`(브라우저가 `//` 로 해석)는 외부라 거부. */
export function safeNext(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== "string" || !value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/"
  return value
}

/** 로그인 화면 경로 — 돌아올 경로(path + query + hash)를 next 로 싣는다. 홈이면 생략. */
export function loginPath(fullPath: string): string {
  const next = safeNext(fullPath)
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`
}

/** 로그인이 필요한 화면인가 — refresh 실패(세션 만료) 시 로그인 화면으로 보낼지 정한다. */
export function requiresLogin(path: string): boolean {
  return path === "/me" || path === "/admin" || path.startsWith("/admin/")
}
