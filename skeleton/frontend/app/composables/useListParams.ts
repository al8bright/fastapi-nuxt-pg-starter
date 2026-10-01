// 목록 화면의 page·q 등을 URL 쿼리에 둔다 — 새로고침·뒤로 가기·링크 공유에도 상태가 유지된다.
export function useListParams() {
  const route = useRoute()

  const page = computed(() => {
    const raw = Number(queryValue(route.query.page) ?? "1")
    return Number.isInteger(raw) && raw > 0 ? raw : 1
  })
  const q = computed(() => queryValue(route.query.q) ?? "")

  /** 임의 쿼리 값(첫 번째 값). 없으면 null. */
  function get(name: string): string | null {
    return queryValue(route.query[name])
  }

  /** 값을 바꾼다. 빈 값은 지우고, page 외의 값이 바뀌면 1페이지로 돌아간다. */
  function update(changes: Record<string, string | number | null>) {
    const merged = new Map<string, string>()
    for (const [key, value] of Object.entries(route.query)) {
      const v = queryValue(value)
      if (v !== null) merged.set(key, v)
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") merged.delete(key)
      else merged.set(key, String(value))
    }
    if (!("page" in changes) || merged.get("page") === "1") merged.delete("page")
    return navigateTo({ path: route.path, query: Object.fromEntries(merged) })
  }

  return { page, q, get, update }
}

function queryValue(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === "string" ? v : null
}
