// 명령(생성·수정·삭제·업로드) 헬퍼 — 쿼리 라이브러리의 mutation 대응 (ARCHITECTURE.md §13).
// useAsyncData 는 setup 최상단 전용이라 이벤트 핸들러에서 부르는 명령에는 못 쓴다 →
// ref 2개(isPending·error) + async 함수로 감싼다. 실패는 그대로 throw 한다(호출부가 문구를 정한다).
//
//   const { run: saveNotice, isPending: saving } = useAction((body: NoticeWrite) => createNotice(body))
//   try { await saveNotice(body) } catch (e) { flash.value = { tone: "error", text: apiErrorMessage(e) } }
//
// ⚠️ 돌려주는 객체는 plain object 안의 ref 다 — 구조분해해 top-level 변수로 두면 템플릿에서 자동 언랩된다.
export function useAction<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) {
  const isPending = ref(false)
  const error = shallowRef<unknown>(null)

  async function run(...args: Args): Promise<Result> {
    isPending.value = true
    error.value = null
    try {
      return await fn(...args)
    } catch (e) {
      error.value = e
      throw e
    } finally {
      isPending.value = false
    }
  }

  return { run, isPending, error }
}

/** 첫 로딩인가 — useAsyncData 의 status 는 첫 프레임에 "idle" 일 수 있다. */
export function isLoadingStatus(status: string): boolean {
  return status === "idle" || status === "pending"
}

/**
 * 같은 화면에 떠 있는 useAsyncData 들 중 키가 prefix 로 시작하는 것을 다시 불러온다.
 * 변경 명령 뒤 관련 목록·대시보드를 갱신할 때 쓴다(쿼리 라이브러리의 invalidateQueries 대응).
 * 화면에 없는(언마운트된) 키는 Nuxt 4 가 캐시를 비우므로 다음 마운트 때 새로 불러온다.
 */
export async function refreshDataByPrefix(...prefixes: string[]): Promise<void> {
  const nuxtApp = useNuxtApp()
  const keys = Object.keys(nuxtApp._asyncData).filter((key) => prefixes.some((p) => key.startsWith(p)))
  if (keys.length) await refreshNuxtData(keys)
}
