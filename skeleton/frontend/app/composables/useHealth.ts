import { useHealthApi } from "~/api/health"

// 헬스 체크 컴포저블 (ARCHITECTURE.md §13). useAsyncData 키가 캐시 키다.
export function useHealthStatus() {
  const { getHealth } = useHealthApi()
  return useAsyncData("health", () => getHealth(), { server: false })
}

export function useDbHealthStatus() {
  const { getDbHealth } = useHealthApi()
  return useAsyncData("health:db", () => getDbHealth(), { server: false })
}
