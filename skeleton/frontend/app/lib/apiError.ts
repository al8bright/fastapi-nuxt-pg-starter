// API 오류 → 한국어 사용자 문구 (ARCHITECTURE.md §13 "오류 표시는 상태코드로 구분한다").
// 도메인 오류 응답은 {"detail": str, "code": str}, FastAPI 검증 422 는 detail 이 객체 배열이다.
//
// $api(ofetch) 는 4xx/5xx 에 FetchError 를 던지고, useAsyncData 는 그 오류를 NuxtError 로 감싼다
// (원래 FetchError 는 cause, statusCode·data 는 복사됨). 둘 다 여기서 같은 모양으로 푼다.
// ofetch 를 import 하지 않고 모양(name·status·data)으로 판정한다 — 이 모듈을 Nuxt 밖(vitest)에서도 쓰기 위해서다.

/** 도메인 오류 코드별 문구 — 백엔드 app/api/errors.py 의 STATUS_BY_CODE 와 짝이다. */
const MESSAGE_BY_CODE: Record<string, string> = {
  self_modification: "자기 자신의 권한이나 활성 상태는 바꿀 수 없습니다.",
  last_admin: "마지막 활성 관리자는 강등하거나 비활성화할 수 없습니다. 다른 관리자를 먼저 지정하세요.",
  too_many_attachments: "첨부 파일은 공지당 10개까지 올릴 수 있습니다.",
  empty_body: "본문을 입력하세요.",
  invalid_image: "이미지를 처리할 수 없습니다. PNG·JPEG·WebP·GIF 파일인지 확인하세요.",
  invalid_image_key: "이미지를 다시 올려 주세요. (올린 이미지를 찾을 수 없습니다)",
  unsupported_file_type: "허용되지 않는 파일 형식입니다.",
  invalid_filename: "파일 이름이 올바르지 않습니다. 확장자가 있는 파일인지 확인하세요.",
  invalid_reorder: "순서를 바꿀 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.",
  not_found: "대상을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.",
}

interface ErrorBody {
  detail?: unknown
  code?: unknown
}

/** HTTP 오류 정보. status 가 null 이면 응답 자체가 없었다(네트워크 오류·CORS 등). */
export interface HttpErrorInfo {
  status: number | null
  data: unknown
}

const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null)

/** FetchError(또는 그것을 cause 로 감싼 NuxtError)면 상태코드·본문을, 아니면 null. */
export function httpErrorInfo(error: unknown, depth = 0): HttpErrorInfo | null {
  if (!error || typeof error !== "object" || depth > 2) return null
  const e = error as { name?: unknown; status?: unknown; statusCode?: unknown; data?: unknown; cause?: unknown }
  if (e.name === "FetchError") return { status: asNumber(e.status) ?? asNumber(e.statusCode), data: e.data }
  return httpErrorInfo(e.cause, depth + 1)
}

/** 응답의 도메인 오류 코드(없으면 null). */
export function apiErrorCode(error: unknown): string | null {
  const code = (httpErrorInfo(error)?.data as ErrorBody | undefined)?.code
  return typeof code === "string" ? code : null
}

/** 응답 상태코드(네트워크 오류 등 응답이 없으면 null). */
export function apiErrorStatus(error: unknown): number | null {
  return httpErrorInfo(error)?.status ?? null
}

/** FastAPI 422 배열 detail 의 첫 메시지("Value error, " 접두사 제거). */
function validationMessage(detail: unknown): string | null {
  if (!Array.isArray(detail) || detail.length === 0) return null
  const msg = (detail[0] as { msg?: unknown }).msg
  if (typeof msg !== "string" || !msg) return null
  return msg.replace(/^Value error,\s*/, "")
}

export interface ApiErrorOptions {
  /** 413 문구에 넣을 상한(MB). */
  maxMb?: number
  /** 어떤 분기에도 맞지 않을 때 쓸 문구. */
  fallback?: string
}

export function apiErrorMessage(error: unknown, options: ApiErrorOptions = {}): string {
  const fallback = options.fallback ?? "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요."
  const info = httpErrorInfo(error)
  if (!info) return fallback
  if (info.status === null) return "서버에 연결할 수 없습니다. 네트워크 상태를 확인하세요."
  const { status } = info
  const body = info.data as ErrorBody | undefined
  const code = typeof body?.code === "string" ? body.code : null
  const known = code ? MESSAGE_BY_CODE[code] : undefined
  if (known) {
    // 형식 오류는 서버가 허용 목록을 detail 에 담아 준다 — 그 편이 더 구체적이다.
    if (code === "unsupported_file_type" && typeof body?.detail === "string") return body.detail
    return known
  }
  if (status === 413 || code === "file_too_large") {
    return options.maxMb ? `파일이 너무 큽니다. ${options.maxMb}MB 이하만 올릴 수 있습니다.` : "파일이 너무 큽니다."
  }
  if (status === 401) return "로그인이 만료되었습니다. 다시 로그인하세요."
  if (status === 403) return "이 작업을 할 권한이 없습니다."
  if (status === 404) return MESSAGE_BY_CODE.not_found!
  if (status === 422) {
    const detail = body?.detail
    if (typeof detail === "string" && detail) return detail
    return validationMessage(detail) ?? "입력값을 확인하세요."
  }
  if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요."
  return typeof body?.detail === "string" && body.detail ? body.detail : fallback
}
