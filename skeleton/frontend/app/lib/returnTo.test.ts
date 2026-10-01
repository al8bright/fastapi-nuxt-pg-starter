import { describe, expect, it } from "vitest"
import { isNavActive } from "./adminNav"
import { loginPath, requiresLogin, safeNext } from "./returnTo"

describe("safeNext (로그인 후 복귀 경로)", () => {
  it.each(["/admin", "/admin/notices?q=공지&page=2", "/notices/3#top", "/me"])("내부 경로는 그대로: %s", (path) => {
    expect(safeNext(path)).toBe(path)
  })

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", undefined, null, 3, "/a\nb"])(
    "외부·잘못된 값은 홈: %j",
    (value) => expect(safeNext(value)).toBe("/"),
  )

  it("쿼리 배열이면 첫 값만 본다", () => {
    expect(safeNext(["/admin", "/me"])).toBe("/admin")
  })
})

describe("loginPath", () => {
  it("원래 위치를 next 로 싣고, 홈이면 생략한다", () => {
    expect(loginPath("/admin/users?role=admin")).toBe(`/login?next=${encodeURIComponent("/admin/users?role=admin")}`)
    expect(loginPath("/")).toBe("/login")
    expect(loginPath("//evil.com")).toBe("/login")
  })
})

describe("requiresLogin", () => {
  it("관리자 콘솔과 내 정보만 로그인이 필요하다", () => {
    expect(requiresLogin("/admin")).toBe(true)
    expect(requiresLogin("/admin/notices/1/edit")).toBe(true)
    expect(requiresLogin("/me")).toBe(true)
    expect(requiresLogin("/")).toBe(false)
    expect(requiresLogin("/notices/1")).toBe(false)
    expect(requiresLogin("/administrator")).toBe(false)
  })
})

describe("관리자 사이드바 활성 메뉴 (isNavActive)", () => {
  it("대시보드는 정확히 일치할 때만, 나머지는 하위 경로도 활성", () => {
    const dashboard = { to: "/admin", label: "대시보드", icon: "dashboard" as const, exact: true }
    const notices = { to: "/admin/notices", label: "공지사항", icon: "notice" as const }
    expect(isNavActive(dashboard, "/admin")).toBe(true)
    expect(isNavActive(dashboard, "/admin/notices")).toBe(false)
    expect(isNavActive(notices, "/admin/notices/3/edit")).toBe(true)
    expect(isNavActive(notices, "/admin/notices-old")).toBe(false)
  })
})
