import { describe, expect, it, vi } from "vitest"
import { createEditorUploader, editorUploadErrorMessage, type EditorImageResponse, resolveUploadUrl } from "./upload"

// $api(ofetch)가 던지는 FetchError 모양 — status(응답 없으면 undefined)·data(파싱된 본문).
function fetchError(status: number | undefined, data?: unknown) {
  return Object.assign(new Error("fetch failed"), { name: "FetchError", status, statusCode: status, data })
}

describe("createEditorUploader", () => {
  it("multipart file 필드로 보내고 url·크기를 돌려준다", async () => {
    const post = vi.fn(async (_form: FormData): Promise<EditorImageResponse> => ({
      key: "public/editor/a.webp",
      url: "/uploads/public/editor/a.webp",
      width: 640,
      height: 360,
    }))
    const upload = createEditorUploader(post)
    const result = await upload(new Blob(["x"], { type: "image/webp" }), "a.webp")

    expect(result).toEqual({ url: "/uploads/public/editor/a.webp", width: 640, height: 360 })
    const form = post.mock.calls[0]![0]
    expect(form).toBeInstanceOf(FormData)
    expect((form.get("file") as File).name).toBe("a.webp")
  })

  it("API 를 다른 오리진에 두면 루트 상대 url 에 그 오리진을 붙인다", async () => {
    const upload = createEditorUploader(async () => ({ key: "k", url: "/uploads/a.webp", width: 1, height: 1 }), "https://api.example.com")
    expect(await upload(new Blob(["x"]), "a.png")).toMatchObject({ url: "https://api.example.com/uploads/a.webp" })
  })

  it.each([
    [413, undefined, /5MB/],
    [415, undefined, /PNG·JPEG·WebP·GIF/],
    [422, { detail: "이미지를 읽을 수 없습니다." }, /이미지를 읽을 수 없습니다/],
    [422, { detail: [{ loc: ["body", "file"], msg: "Field required" }] }, /처리할 수 없습니다/],
    [401, undefined, /로그인이 만료/],
    [403, undefined, /권한/],
    [500, undefined, /잠시 후/],
  ])("%i → 한국어 문구로 { error } (reject 하지 않음)", async (status, body, message) => {
    const upload = createEditorUploader(async () => {
      throw fetchError(status, body)
    })
    const result = await upload(new Blob(["x"]), "a.png")
    expect("error" in result && result.error).toMatch(message)
  })

  it("네트워크 오류(응답 없음)도 { error }", async () => {
    const upload = createEditorUploader(async () => {
      throw fetchError(undefined)
    })
    const result = await upload(new Blob(["x"]), "a.png")
    expect("error" in result && result.error).toMatch(/네트워크/)
  })
})

describe("editorUploadErrorMessage", () => {
  it("HTTP 오류가 아니면 일반 문구", () => {
    expect(editorUploadErrorMessage(new Error("x"))).toMatch(/올리지 못했습니다/)
  })
})

describe("resolveUploadUrl", () => {
  it("API 를 다른 오리진에 두지 않았으면 루트 상대 경로 그대로", () => {
    expect(resolveUploadUrl("/uploads/a.webp", undefined)).toBe("/uploads/a.webp")
    expect(resolveUploadUrl("/uploads/a.webp", "")).toBe("/uploads/a.webp")
  })
  it("NUXT_PUBLIC_API_BASE_URL 이 있으면 루트 상대 경로에 그 오리진을 붙인다", () => {
    expect(resolveUploadUrl("/uploads/a.webp", "https://api.example.com/")).toBe("https://api.example.com/uploads/a.webp")
  })
  it("절대 URL·프로토콜 상대 URL 은 그대로", () => {
    expect(resolveUploadUrl("https://cdn.example.com/a.webp", "https://api.example.com")).toBe("https://cdn.example.com/a.webp")
    expect(resolveUploadUrl("//cdn.example.com/a.webp", "https://api.example.com")).toBe("//cdn.example.com/a.webp")
  })
})
