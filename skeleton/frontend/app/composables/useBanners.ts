import { useBannersApi } from "~/api/banners"

// 배너 조회 컴포저블 (ARCHITECTURE.md §13). 변경은 화면의 useAction 이 하고 invalidateBanners() 로 갱신한다.

export function usePublicBanners() {
  const { listBanners } = useBannersApi()
  return useAsyncData("banners:public", () => listBanners(), { server: false })
}

export function useAdminBanners() {
  const { listAdminBanners } = useBannersApi()
  return useAsyncData("banners:admin:list", () => listAdminBanners(), { server: false })
}

export function useAdminBanner(id: () => number) {
  const { getAdminBanner } = useBannersApi()
  return useAsyncData(() => `banners:admin:detail:${id()}`, () => getAdminBanner(id()), {
    server: false,
    immediate: Number.isInteger(id()) && id() > 0,
  })
}

/** 배너 변경 뒤 — 떠 있는 배너 목록(공개·관리자)과 대시보드를 다시 불러온다. */
export function invalidateBanners(): Promise<void> {
  return refreshDataByPrefix("banners:", "admin:dashboard")
}
