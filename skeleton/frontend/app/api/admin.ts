import type { UserRole } from "./auth"
import { cleanParams, type Page, type PageParams } from "./common"

// 관리자 API — 대시보드·사용자·세션·로그인 잠금 (백엔드 schemas/admin.py 와 동기화).

export interface Dashboard {
  users: { total: number, active: number, inactive: number }
  active_sessions: number
  locked_accounts: number
  notices: { published: number, draft: number }
  active_banners: number
  db: "ok" | "error"
  /** 적용된 Alembic 리비전. alembic_version 테이블이 없으면 null. */
  alembic_revision: string | null
}

export interface AdminUser {
  id: number
  username: string
  role: UserRole
  is_active: boolean
  created_at: string
  active_session_count: number
}

/** 부분 수정 — 보낸 필드만 바꾼다. 409 self_modification·last_admin. */
export interface AdminUserUpdate {
  role?: UserRole
  is_active?: boolean
}

export interface AdminUserParams extends PageParams {
  role?: UserRole
}

export interface AdminSession {
  id: number
  user_id: number
  username: string
  created_at: string
  last_used_at: string
  expires_at: string
}

export interface AdminSessionParams {
  user_id?: number
  page?: number
  size?: number
}

export interface LoginThrottle {
  username: string
  failed_count: number
  locked_until: string | null
  last_failed_at: string
  is_locked: boolean
}

export function useAdminApi() {
  const { $api } = useNuxtApp()

  return {
    getDashboard: () => $api<Dashboard>("/admin/dashboard"),
    listUsers: (params: AdminUserParams = {}) =>
      $api<Page<AdminUser>>("/admin/users", { query: cleanParams(params) }),
    updateUser: (id: number, body: AdminUserUpdate) =>
      $api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body }),
    revokeUserSessions: (id: number) =>
      $api<{ revoked: number }>(`/admin/users/${id}/sessions`, { method: "DELETE" }),
    listSessions: (params: AdminSessionParams = {}) =>
      $api<Page<AdminSession>>("/admin/sessions", { query: cleanParams(params) }),
    /** 강제 종료 — 멱등 204. */
    revokeSession: (id: number) => $api(`/admin/sessions/${id}`, { method: "DELETE" }),
    listLoginThrottles: () => $api<LoginThrottle[]>("/admin/login-throttles"),
    /** 잠금 해제(실패 기록 삭제) — 멱등 204. */
    unlockLoginThrottle: (username: string) =>
      $api(`/admin/login-throttles/${encodeURIComponent(username)}`, { method: "DELETE" }),
  }
}
