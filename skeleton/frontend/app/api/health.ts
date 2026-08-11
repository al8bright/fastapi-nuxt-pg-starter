// 도메인별 API 함수 (architecture.md §13).
export interface DbHealth {
  db: string
  table: string
  rows: number
}

export function useHealthApi() {
  const { $api } = useNuxtApp()

  return {
    getHealth: () => $api<{ status: string }>("/health"),
    getDbHealth: () => $api<DbHealth>("/health/db"),
  }
}
