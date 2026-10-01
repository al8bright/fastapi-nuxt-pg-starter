import { describe, expect, it } from "vitest"
import { apiErrorCode, apiErrorMessage, apiErrorStatus, httpErrorInfo } from "./apiError"

// $api(ofetch)의 FetchError 와, useAsyncData 가 그것을 cause 로 감싼 NuxtError 모양.
function fetchError(status: number | undefined, data?: unknown) {
  return Object.assign(new Error("fetch failed"), { name: "FetchError", status, statusCode: status, data })
}
function nuxtError(cause: Error) {
  return Object.assign(new Error("wrapped"), { name: "NuxtError", statusCode: 500, cause })
}

describe("httpErrorInfo", () => {
  it("FetchError 와 그것을 감싼 NuxtError 를 같은 모양으로 푼다", () => {
    const e = fetchError(404, { detail: "없음", code: "not_found" })
    expect(httpErrorInfo(e)).toEqual({ status: 404, data: { detail: "없음", code: "not_found" } })
    expect(httpErrorInfo(nuxtError(e))).toEqual(httpErrorInfo(e))
    expect(apiErrorStatus(nuxtError(e))).toBe(404)
    expect(apiErrorCode(e)).toBe("not_found")
  })

  it("HTTP 오류가 아니면 null, 응답이 없으면 status null", () => {
    expect(httpErrorInfo(new Error("x"))).toBeNull()
    expect(httpErrorInfo("문자열")).toBeNull()
    expect(httpErrorInfo(fetchError(undefined))).toEqual({ status: null, data: undefined })
  })
})

describe("apiErrorMessage", () => {
  it("도메인 오류 코드를 한국어 문구로", () => {
    expect(apiErrorMessage(fetchError(409, { detail: "x", code: "last_admin" }))).toMatch(/마지막 활성 관리자/)
    expect(apiErrorMessage(fetchError(409, { detail: "x", code: "self_modification" }))).toMatch(/자기 자신/)
  })

  it("형식 오류는 서버가 준 허용 목록(detail)을 그대로", () => {
    expect(apiErrorMessage(fetchError(422, { detail: "허용: pdf, hwp", code: "unsupported_file_type" }))).toBe("허용: pdf, hwp")
  })

  it("413 은 상한을 넣어 안내한다", () => {
    expect(apiErrorMessage(fetchError(413), { maxMb: 20 })).toBe("파일이 너무 큽니다. 20MB 이하만 올릴 수 있습니다.")
  })

  it("422 배열 detail 은 첫 메시지(Value error 접두사 제거)", () => {
    const body = { detail: [{ loc: ["body", "link_url"], msg: "Value error, 링크가 잘못됐습니다." }] }
    expect(apiErrorMessage(fetchError(422, body))).toBe("링크가 잘못됐습니다.")
  })

  it("상태코드별 기본 문구 · 네트워크 · 알 수 없는 오류", () => {
    expect(apiErrorMessage(fetchError(403))).toMatch(/권한/)
    expect(apiErrorMessage(fetchError(404))).toMatch(/찾을 수 없습니다/)
    expect(apiErrorMessage(fetchError(502))).toMatch(/서버 오류/)
    expect(apiErrorMessage(fetchError(undefined))).toMatch(/서버에 연결할 수 없습니다/)
    expect(apiErrorMessage(new Error("x"), { fallback: "대체 문구" })).toBe("대체 문구")
  })
})
