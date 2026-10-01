import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { transformImage } from "~/lib/editor/imageCanvas"
import type { EditorUploadResult, UploadImageFn } from "~/lib/editor/upload"
import RichTextEditor from "./RichTextEditor.vue"

// 에디터는 Nuxt 자동 import 에 기대지 않으므로 @vue/test-utils 만으로 마운트한다.
// jsdom 에는 canvas·createImageBitmap 이 없다 — 브라우저 전용 모듈은 통째로 mock 한다.
vi.mock("~/lib/editor/imageCanvas", () => ({
  decodeImage: vi.fn(async () => ({ width: 800, height: 600 })),
  sizeOf: (img: { width: number, height: number }) => ({ width: img.width, height: img.height }),
  drawPreview: vi.fn(),
  releaseImage: vi.fn(),
  transformImage: vi.fn(async (file: File) => ({ blob: file, filename: "converted.webp" })),
}))

// jsdom 에는 document.execCommand 도 없다 — insertHTML·delete·insertText 를 Range 로 흉내 낸다.
function installExecCommand(): Mock {
  const fn = vi.fn((command: string, _ui?: boolean, value?: string) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    if (command === "insertHTML" || command === "insertText") {
      range.deleteContents()
      const t = document.createElement("template")
      if (command === "insertHTML") t.innerHTML = value ?? ""
      else t.content.append(document.createTextNode(value ?? ""))
      const last = t.content.lastChild
      range.insertNode(t.content)
      if (last) {
        range.setStartAfter(last)
        range.collapse(true)
      }
      return true
    }
    if (command === "delete") {
      range.deleteContents()
      return true
    }
    return true
  })
  Object.defineProperty(document, "execCommand", { value: fn, configurable: true, writable: true })
  return fn
}

function caretAt(node: Node, offset = 0) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** 조건이 맞을 때까지 마이크로태스크·타이머를 돌린다(testing-library 의 waitFor 대응). */
async function waitFor(check: () => void, timeout = 1000) {
  const start = Date.now()
  for (;;) {
    try {
      check()
      return
    } catch (e) {
      if (Date.now() - start > timeout) throw e
      await flushPromises()
      await new Promise((r) => setTimeout(r, 10))
    }
  }
}

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector)
const byLabel = <T extends Element = HTMLElement>(label: string, root: ParentNode = document) =>
  root.querySelector<T>(`[aria-label="${label}"]`)
const button = (name: string, root: ParentNode = document) => {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === name,
  )
  if (!found) throw new Error(`button not found: ${name}`)
  return found
}
const dialog = () => $<HTMLElement>("[role=dialog]")
const dialogTitle = () => {
  const d = dialog()
  return d ? document.getElementById(d.getAttribute("aria-labelledby") ?? "")?.textContent?.trim() : null
}

function fire(el: Element, type: string, init: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [k, v] of Object.entries(init)) Object.defineProperty(event, k, { value: v })
  el.dispatchEvent(event)
  return event
}
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))
function chooseFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true })
  fire(input, "change")
}
function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  fire(input, "input")
}

const lastHtml = (wrapper: VueWrapper) => {
  const events = wrapper.emitted("change") as string[][] | undefined
  return events?.at(-1)?.[0]
}
const pngFile = (name = "photo.png") => new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })

let wrapper: VueWrapper | null = null

function setup(props: { initialHtml?: string, uploadImage?: UploadImageFn } = {}) {
  const uploadImage
    = props.uploadImage ?? vi.fn(async (): Promise<EditorUploadResult> => ({ url: "/uploads/a.webp", width: 640, height: 360 }))
  wrapper = mount(RichTextEditor, { props: { initialHtml: props.initialHtml, uploadImage }, attachTo: document.body })
  const editor = $<HTMLDivElement>("[role=textbox][aria-label=\"본문\"]")!
  return { wrapper, uploadImage, editor }
}

describe("RichTextEditor", () => {
  let exec: Mock

  beforeEach(() => {
    exec = installExecCommand()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ""
    delete (document as { execCommand?: unknown }).execCommand
    vi.clearAllMocks()
  })

  it("접근 가능한 툴바와 여러 줄 편집 영역을 렌더하고 initialHtml 을 한 번 넣는다", () => {
    const { editor } = setup({ initialHtml: "<p>처음</p>" })
    const toolbar = $("[role=toolbar][aria-label=\"서식 도구\"]")!
    expect(button("굵게 (Ctrl+B)", toolbar).getAttribute("aria-pressed")).toBe("false")
    expect(button("영상", toolbar).hasAttribute("aria-pressed")).toBe(false)
    const buttons = Array.from(toolbar.querySelectorAll("button"))
    expect(buttons.length).toBeGreaterThanOrEqual(20)
    // roving tabindex — 탭 정지는 하나뿐
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    expect(editor.getAttribute("aria-multiline")).toBe("true")
    expect(editor.getAttribute("contenteditable")).toBe("true")
    expect(editor.innerHTML).toBe("<p>처음</p>")
    expect(editor.hasAttribute("data-empty")).toBe(false)
  })

  it("빈 문서면 placeholder 를 보이고 빈 문단으로 시작한다", () => {
    const { editor } = setup()
    expect(editor.getAttribute("data-empty")).toBe("true")
    expect(editor.getAttribute("data-placeholder")).toBe("내용을 입력하세요")
    expect(editor.innerHTML).toBe("<p><br></p>")
  })

  it("입력하면 편집 전용 속성을 지운 직렬화 HTML 로 change 를 보낸다", async () => {
    const { editor, wrapper } = setup()
    editor.innerHTML = `<p style="color:red"><b>안녕</b> <span style="x">세상</span><img src="/a.png" data-selected="true" draggable="false"></p>`
    fire(editor, "input")
    await flushPromises()
    expect(wrapper.emitted("change")).toEqual([[`<p><strong>안녕</strong> 세상<img src="/a.png"></p>`]])
    expect(editor.hasAttribute("data-empty")).toBe(false)
    // 같은 값이면 다시 보내지 않는다
    fire(editor, "input")
    expect(wrapper.emitted("change")).toHaveLength(1)
  })

  it("붙여넣은 HTML 을 정리해 insertHTML 로 넣는다", () => {
    const { editor, wrapper } = setup({ initialHtml: "<p>앞</p>" })
    caretAt(editor.querySelector("p")!.firstChild!, 1)
    const html = `<p style="font-size:30px" onclick="x()">붙인 <b>글</b></p><script>alert(1)</script><iframe src="https://evil.com"></iframe>`
    fire(editor, "paste", { clipboardData: { getData: (t: string) => (t === "text/html" ? html : ""), files: [], items: [] } })
    expect(exec).toHaveBeenCalledWith("insertHTML", false, "<p>붙인 <strong>글</strong></p>")
    const out = lastHtml(wrapper)!
    expect(out).toContain("<p>붙인 <strong>글</strong></p>")
    expect(out).not.toMatch(/script|iframe|style|onclick/)
  })

  it("여러 줄 일반 텍스트는 문단으로, 한 줄은 insertText 로 붙인다", () => {
    const { editor, wrapper } = setup({ initialHtml: "<p>x</p>" })
    caretAt(editor.querySelector("p")!.firstChild!, 1)
    fire(editor, "paste", { clipboardData: { getData: (t: string) => (t === "text/plain" ? "a<b>\nc" : ""), files: [], items: [] } })
    expect(lastHtml(wrapper)).toContain("<p>a&lt;b&gt;</p><p>c</p>")
    caretAt(editor.lastChild!, 0)
    fire(editor, "paste", { clipboardData: { getData: (t: string) => (t === "text/plain" ? "한 줄" : ""), files: [], items: [] } })
    expect(exec).toHaveBeenCalledWith("insertText", false, "한 줄")
  })

  describe("유튜브", () => {
    it("잘못된 링크는 거절하고, 올바른 링크는 고정 템플릿 마크업으로 넣는다", async () => {
      const { editor, wrapper } = setup({ initialHtml: "<p>본문</p>" })
      caretAt(editor.querySelector("p")!.firstChild!, 2)
      button("영상").click()
      await flushPromises()
      expect(dialogTitle()).toBe("유튜브 영상 넣기")
      const input = $<HTMLInputElement>("[role=dialog] input")!
      expect(document.activeElement).toBe(input)

      typeInto(input, "https://vimeo.com/12345")
      button("넣기", dialog()!).click()
      await flushPromises()
      expect($("[role=dialog] [role=alert]")?.textContent).toContain("유튜브 링크만 넣을 수 있습니다.")
      expect(dialog()).not.toBeNull()

      typeInto(input, "https://youtu.be/dQw4w9WgXcQ?t=3")
      key(input, "Enter")
      await waitFor(() => expect(dialog()).toBeNull())

      const wrapperEl = editor.querySelector("[data-youtube-video]")!
      expect(wrapperEl.getAttribute("contenteditable")).toBe("false")
      const out = lastHtml(wrapper)!
      expect(out).toContain(
        `<div class="video" data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360" title="YouTube 영상" allowfullscreen=""></iframe></div>`,
      )
      expect(out).not.toContain("contenteditable")
      // 문서 끝 삽입이면 뒤에 빈 문단
      expect(wrapperEl.nextElementSibling?.outerHTML).toBe("<p><br></p>")
    })

    it("Esc 로 다이얼로그를 닫는다", async () => {
      setup()
      button("영상").click()
      await flushPromises()
      key(dialog()!, "Escape")
      await flushPromises()
      expect(dialog()).toBeNull()
    })
  })

  describe("이미지 업로드", () => {
    it("자르기 다이얼로그 → 그대로 넣기 → 자리표시 → 업로드 성공 시 응답 url 로 치환", async () => {
      const pending = deferred<EditorUploadResult>()
      const uploadImage = vi.fn(() => pending.promise)
      const { editor, wrapper } = setup({ initialHtml: "<p>글</p>", uploadImage })
      caretAt(editor.querySelector("p")!.firstChild!, 1)
      button("이미지").click()
      chooseFiles(byLabel<HTMLInputElement>("이미지 파일 선택")!, [pngFile()])

      await waitFor(() => expect($("[data-testid=crop-stage]")).not.toBeNull())
      expect(dialogTitle()).toBe("이미지 자르기")
      button("그대로 넣기", dialog()!).click()
      await flushPromises()
      expect(dialog()).toBeNull()

      // 업로드 중: 자리표시는 편집 영역에만 있고 직렬화 HTML 에는 없다
      expect(editor.querySelector("img[data-uploading]")).not.toBeNull()
      expect($("[role=status]")?.textContent).toContain("이미지 올리는 중")
      expect(lastHtml(wrapper) ?? "").not.toContain("<img")
      await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1))
      expect(transformImage).toHaveBeenCalledWith(expect.any(File), { crop: null, rotate: 0 })
      expect(uploadImage).toHaveBeenCalledWith(expect.any(File), "converted.webp")

      pending.resolve({ url: "/uploads/public/editor/a.webp", width: 640, height: 360 })
      await waitFor(() => expect(editor.querySelector("img[data-uploading]")).toBeNull())
      expect(editor.querySelector("img")?.getAttribute("src")).toBe("/uploads/public/editor/a.webp")
      expect(lastHtml(wrapper)).toContain(`<img src="/uploads/public/editor/a.webp" alt="" width="640" height="360">`)
      expect($("[role=status]")).toBeNull()
    })

    it("자르기 적용 시 회전·자르기 값을 변환에 넘긴다", async () => {
      const { editor } = setup()
      caretAt(editor.querySelector("p")!, 0)
      chooseFiles(byLabel<HTMLInputElement>("이미지 파일 선택")!, [pngFile()])
      await waitFor(() => expect($("[data-testid=crop-stage]")).not.toBeNull())
      button("1:1", dialog()!).click()
      button("오른쪽으로 90° 회전", dialog()!).click()
      await flushPromises()
      button("적용", dialog()!).click()
      await waitFor(() => expect(transformImage).toHaveBeenCalled())
      // 800×600 을 90° 회전 → 600×800, 1:1 가운데 → 600×600
      expect(transformImage).toHaveBeenCalledWith(expect.any(File), {
        crop: { x: 0, y: 100, width: 600, height: 600 },
        rotate: 90,
      })
    })

    it("업로드 실패 시 자리표시를 지우고 하단에 오류를 보인다", async () => {
      const uploadImage = vi.fn(async (): Promise<EditorUploadResult> => ({ error: "이미지는 5MB 이하만 올릴 수 있습니다." }))
      const { editor, wrapper } = setup({ uploadImage })
      // 여러 장이면 다이얼로그 없이 바로 올린다
      chooseFiles(byLabel<HTMLInputElement>("이미지 파일 선택")!, [pngFile("a.png"), pngFile("b.png")])
      expect(dialog()).toBeNull()
      expect(editor.querySelectorAll("img[data-uploading]")).toHaveLength(2)

      await waitFor(() => expect($("[role=alert]")?.textContent).toContain("이미지는 5MB 이하만 올릴 수 있습니다."))
      await waitFor(() => expect(editor.querySelectorAll("img")).toHaveLength(0))
      expect(uploadImage).toHaveBeenCalledTimes(2)
      expect(lastHtml(wrapper) ?? "").not.toContain("<img")
      expect(editor.hasAttribute("aria-describedby")).toBe(true)
    })

    it("허용하지 않는 파일은 올리지 않고 안내한다", async () => {
      const { uploadImage } = setup()
      chooseFiles(byLabel<HTMLInputElement>("이미지 파일 선택")!, [new File(["x"], "a.pdf", { type: "application/pdf" })])
      await flushPromises()
      expect($("[role=alert]")?.textContent).toContain("PNG·JPEG·WebP·GIF 이미지만 올릴 수 있습니다.")
      expect(uploadImage).not.toHaveBeenCalled()
    })

    it("이미지 파일 붙여넣기도 같은 경로로 올린다", async () => {
      const { editor, uploadImage } = setup()
      caretAt(editor.querySelector("p")!, 0)
      const gif = new File([new Uint8Array([1])], "a.gif", { type: "image/gif" })
      fire(editor, "paste", { clipboardData: { getData: () => "", files: [gif], items: [] } })
      // GIF 는 자르기 다이얼로그 없이 바로
      await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(editor.querySelector("img[src=\"/uploads/a.webp\"]")).not.toBeNull())
    })
  })

  describe("미디어 선택", () => {
    const IMG = `<p><img src="/uploads/a.webp" alt="" width="1600" height="900"></p>`
    const imageTools = () => $("[role=toolbar][aria-label=\"이미지 도구\"]")

    it("이미지를 누르면 오버레이가 뜨고, 크기 프리셋은 selectNode + insertHTML 로 커밋한다", async () => {
      const { editor, wrapper } = setup({ initialHtml: IMG })
      editor.querySelector("img")!.click()
      await waitFor(() => expect(imageTools()).not.toBeNull())
      expect(editor.querySelector("img")?.getAttribute("data-selected")).toBe("true")
      button("중", imageTools()!).click()
      await flushPromises()
      expect(exec).toHaveBeenCalledWith("insertHTML", false, expect.stringContaining(`width="640" height="360"`))
      expect(lastHtml(wrapper)).toBe(`<p><img src="/uploads/a.webp" alt="" width="640" height="360"></p>`)
      // 치환 뒤에도 새 노드가 선택돼 있다
      expect(editor.querySelector("img")?.getAttribute("data-selected")).toBe("true")
    })

    it("원본보다 큰 프리셋은 비활성", async () => {
      const { editor } = setup({ initialHtml: `<p><img src="/a.webp" alt="" width="500" height="250"></p>` })
      editor.querySelector("img")!.click()
      await waitFor(() => expect(imageTools()).not.toBeNull())
      expect(button("중", imageTools()!).disabled).toBe(true)
      expect(button("소", imageTools()!).disabled).toBe(false)
    })

    it("선택 상태에서 Delete 는 이미지를 지운다", async () => {
      const { editor, wrapper } = setup({ initialHtml: `<p>a</p>${IMG}` })
      editor.querySelector("img")!.click()
      await waitFor(() => expect(imageTools()).not.toBeNull())
      key(editor, "Delete")
      await flushPromises()
      expect(exec).toHaveBeenCalledWith("delete", false, undefined)
      expect(editor.querySelector("img")).toBeNull()
      expect(lastHtml(wrapper)).not.toContain("<img")
      expect(imageTools()).toBeNull()
    })

    it("대체 텍스트를 바꾼다", async () => {
      const { editor, wrapper } = setup({ initialHtml: IMG })
      editor.querySelector("img")!.click()
      await waitFor(() => expect(imageTools()).not.toBeNull())
      button("대체 텍스트", imageTools()!).click()
      await flushPromises()
      expect(dialogTitle()).toBe("대체 텍스트")
      typeInto($<HTMLInputElement>("[role=dialog] input")!, `고양이 "나비"`)
      button("적용", dialog()!).click()
      await flushPromises()
      expect(lastHtml(wrapper)).toContain(`alt="고양이 &quot;나비&quot;"`)
    })

    it("영상을 누르면 영상 도구가 뜨고 Esc 로 선택을 푼다", async () => {
      const video = `<div class="video" data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360" title="YouTube 영상" allowfullscreen></iframe></div><p>뒤</p>`
      const { editor } = setup({ initialHtml: video })
      const tools = () => $("[role=toolbar][aria-label=\"영상 도구\"]")
      expect(editor.querySelector("[data-youtube-video]")?.getAttribute("contenteditable")).toBe("false")
      ;(editor.querySelector("[data-youtube-video]") as HTMLElement).click()
      await waitFor(() => expect(tools()).not.toBeNull())
      expect(button("전체 폭", tools()!).disabled).toBe(false)
      key(editor, "Escape")
      await waitFor(() => expect(tools()).toBeNull())
    })
  })

  it("정렬은 class 로만 저장한다(style 금지)", async () => {
    const { editor, wrapper } = setup({ initialHtml: "<p>가운데</p>" })
    caretAt(editor.querySelector("p")!.firstChild!, 1)
    button("가운데 정렬").click()
    await flushPromises()
    expect(lastHtml(wrapper)).toBe(`<p class="align-center">가운데</p>`)
    expect(button("가운데 정렬").getAttribute("aria-pressed")).toBe("true")
    // 다시 누르면 해제
    button("가운데 정렬").click()
    await flushPromises()
    expect(lastHtml(wrapper)).toBe("<p>가운데</p>")
  })

  it("형광펜은 선택을 <mark> 로 감싼다", () => {
    const { editor, wrapper } = setup({ initialHtml: "<p>형광펜</p>" })
    const text = editor.querySelector("p")!.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 2)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    button("형광펜").click()
    expect(lastHtml(wrapper)).toBe("<p><mark>형광</mark>펜</p>")
  })
})
