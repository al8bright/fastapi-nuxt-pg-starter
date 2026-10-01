import { type AdminSessionParams, type AdminUserParams, useAdminApi } from "~/api/admin"

// 관리자 콘솔 조회 컴포저블 — 대시보드·사용자·세션·로그인 잠금 (ARCHITECTURE.md §13).

export function useDashboard() {
  const { getDashboard } = useAdminApi()
  return useAsyncData("admin:dashboard", () => getDashboard(), { server: false })
}

export function useAdminUsers(params: () => AdminUserParams) {
  const { listUsers } = useAdminApi()
  const key = () => {
    const p = params()
    return `admin:users:${p.page ?? 1}:${p.size ?? 20}:${p.q ?? ""}:${p.role ?? ""}`
  }
  return useAsyncData(key, () => listUsers(params()), { server: false })
}

export function useAdminSessions(params: () => AdminSessionParams) {
  const { listSessions } = useAdminApi()
  const key = () => {
    const p = params()
    return `admin:sessions:${p.page ?? 1}:${p.size ?? 20}:${p.user_id ?? ""}`
  }
  return useAsyncData(key, () => listSessions(params()), { server: false })
}

export function useLoginThrottles() {
  const { listLoginThrottles } = useAdminApi()
  return useAsyncData("admin:login-throttles", () => listLoginThrottles(), { server: false })
}

/** 사용자·세션 변경은 서로 집계가 얽혀(세션 수·대시보드) 관련 키를 함께 갱신한다. */
export function invalidateAccounts(): Promise<void> {
  return refreshDataByPrefix("admin:users:", "admin:sessions:", "admin:dashboard")
}

/** 로그인 잠금 변경 뒤 — 잠금 목록과 대시보드(잠긴 계정 수·사이드바 배지). */
export function invalidateThrottles(): Promise<void> {
  return refreshDataByPrefix("admin:login-throttles", "admin:dashboard")
}
