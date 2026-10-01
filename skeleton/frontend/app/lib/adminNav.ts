import type { IconName } from "./icons"

// 관리자 콘솔 사이드바 메뉴 (디자인 A — 그룹형 사이드바).
// 메뉴를 추가하면 여기와 app/pages/admin/ 의 페이지 파일을 함께 만든다.
export interface AdminNavItem {
  to: string
  label: string
  icon: IconName
  /** 하위 경로(/admin/notices/3/edit)에서도 활성으로 볼지. 대시보드(/admin)만 true. */
  exact?: boolean
  /** 배지 종류 — 잠긴 계정 수. */
  badge?: "locked"
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: "개요", items: [{ to: "/admin", label: "대시보드", icon: "dashboard", exact: true }] },
  {
    label: "콘텐츠",
    items: [
      { to: "/admin/notices", label: "공지사항", icon: "notice" },
      { to: "/admin/banners", label: "배너", icon: "banner" },
    ],
  },
  {
    label: "회원·보안",
    items: [
      { to: "/admin/users", label: "사용자", icon: "users" },
      { to: "/admin/sessions", label: "세션", icon: "session" },
      { to: "/admin/login-throttles", label: "로그인 잠금", icon: "lock", badge: "locked" },
    ],
  },
  { label: "시스템", items: [{ to: "/admin/system", label: "시스템 상태", icon: "system" }] },
]

/** 현재 경로가 메뉴 항목에 해당하는가. exact 가 아니면 하위 경로도 활성. */
export function isNavActive(item: AdminNavItem, path: string): boolean {
  if (item.exact) return path === item.to || path === `${item.to}/`
  return path === item.to || path.startsWith(`${item.to}/`)
}
