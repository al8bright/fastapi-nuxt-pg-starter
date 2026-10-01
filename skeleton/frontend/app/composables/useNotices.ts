import type { PageParams } from "~/api/common"
import { useNoticesApi } from "~/api/notices"

// 공지사항 조회 컴포저블 (ARCHITECTURE.md §13). 키 = 캐시 식별자 — 파라미터를 키에 넣는다.
// 변경 명령(저장·삭제·첨부)은 화면에서 useAction + $api 로 부르고, 끝나면 invalidateNotices() 로 갱신한다.

const listKey = (scope: "public" | "admin", p: PageParams) => `notices:${scope}:list:${p.page ?? 1}:${p.size ?? 20}:${p.q ?? ""}`

/**
 * 공개 목록 — 파라미터(getter)가 바뀌면 키가 바뀌어 다시 불러온다.
 * 새 키를 불러오는 동안 data 는 이전 결과를 유지한다(Nuxt 4 의 반응형 키 동작 — keepPreviousData 대응).
 */
export function usePublicNotices(params: () => PageParams) {
  const { listNotices } = useNoticesApi()
  return useAsyncData(() => listKey("public", params()), () => listNotices(params()), { server: false })
}

/** 공개 상세 — 서버가 조회 때마다 조회수를 올린다. 화면 갱신(invalidate) 대상에서 뺀다. */
export function usePublicNotice(id: () => number) {
  const { getNotice } = useNoticesApi()
  return useAsyncData(() => `notice:public:${id()}`, () => getNotice(id()), {
    server: false,
    immediate: Number.isInteger(id()) && id() > 0,
  })
}

export function useAdminNotices(params: () => PageParams) {
  const { listAdminNotices } = useNoticesApi()
  return useAsyncData(() => listKey("admin", params()), () => listAdminNotices(params()), { server: false })
}

export function useAdminNotice(id: () => number) {
  const { getAdminNotice } = useNoticesApi()
  return useAsyncData(() => `notices:admin:detail:${id()}`, () => getAdminNotice(id()), {
    server: false,
    immediate: Number.isInteger(id()) && id() > 0,
  })
}

/** 공지 변경 뒤 — 떠 있는 공지 목록·관리자 상세·대시보드를 다시 불러온다. */
export function invalidateNotices(): Promise<void> {
  return refreshDataByPrefix("notices:", "admin:dashboard")
}
