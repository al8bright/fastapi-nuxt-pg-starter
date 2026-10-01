<script setup lang="ts">
// 자체 리치 텍스트 에디터 (editor-spec 전체). contentEditable + execCommand, 라이브러리 없음.
//
// 비제어 컴포넌트다 — initialHtml 은 마운트 때 한 번만 쓰고 이후 변경은 무시한다(대상이 바뀌면 :key 로 재마운트).
// 입력 중에는 innerHTML 을 다시 쓰지 않는다(캐럿·undo 스택 보존) — 편집 영역 div 에는 템플릿 자식을 두지 않는다.
// 변경은 change 이벤트(직렬화 HTML)로만 알린다. 저장 전 정화는 백엔드 서비스 계층의 sanitize_html 몫이다.
// execCommand 호출은 lib/editor/editorDom.ts 의 exec() 한 곳에 모여 있고, 프로그램적 변경(크기·alt·교체·삽입·삭제)은
// 대상 노드를 Range.selectNode 로 선택한 뒤 exec("insertHTML")/exec("delete") 로 치환한다(undo 스택에 남도록).
//
// 에디터 컴포넌트는 Nuxt 자동 import 에 기대지 않는다(vitest 로 단독 테스트) — vue API·하위 컴포넌트를 직접 import 한다.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from "vue"
import {
  type ActiveState,
  applyLink,
  caretAfter,
  clearFormatting,
  closestLink,
  decorateEditable,
  deleteNode,
  EMPTY_ACTIVE,
  exec,
  insertHtmlAt,
  isAtDocumentEnd,
  rangeAtEnd,
  rangeFromPoint,
  readActiveState,
  removeLink,
  replaceNode,
  selectRange,
  selectionRangeIn,
  setBlock,
  toggleAlign,
  toggleMark,
} from "~/lib/editor/editorDom"
import { transformImage } from "~/lib/editor/imageCanvas"
import { type Size, sizeForWidth, videoSizeForWidth } from "~/lib/editor/imageTransform"
import { extractYoutubeId, imageHtml, serializeEditorHtml, youtubeEmbedHtml, youtubeIdFromEmbedSrc } from "~/lib/editor/mediaHtml"
import {
  cleanPastedHtml,
  EDITOR_IMAGE_TYPES,
  editorImageProblem,
  escapeHtml,
  isRichTextEmpty,
  normalizeLinkUrl,
  plainTextToHtml,
} from "~/lib/editor/richText"
import type { ToolbarCommand } from "~/lib/editor/toolbar"
import type { CropResult } from "~/lib/editor/types"
import type { EditorUploadResult, UploadImageFn } from "~/lib/editor/upload"
import EditorToolbar from "./EditorToolbar.vue"
import ImageCropDialog from "./ImageCropDialog.vue"
import MediaOverlay from "./MediaOverlay.vue"
import TextPromptDialog from "./TextPromptDialog.vue"

const {
  initialHtml = "",
  uploadImage,
  placeholder = "내용을 입력하세요",
  labelId = "",
} = defineProps<{
  /** 마운트 시 한 번 넣는 HTML(서버가 정화해 돌려준 본문). */
  initialHtml?: string
  /** 이미지 업로드 함수 — reject 하지 않고 실패는 `{ error }`. 기본 구현: composables/useUploads.ts 의 useEditorImageUpload(). */
  uploadImage: UploadImageFn
  placeholder?: string
  /** 편집 영역의 aria-labelledby (보이는 라벨 요소 id). 없으면 aria-label="본문". */
  labelId?: string
}>()
/** change: 편집 전용 속성을 지운 직렬화 HTML. 빈 문서면 "". */
const emit = defineEmits<{ change: [html: string] }>()

interface Selected {
  el: HTMLElement
  kind: "image" | "video"
}

type DialogState =
  | { type: "link", range: Range | null, initial: string }
  | { type: "youtube", range: Range | null, target: HTMLElement | null, initial: string }
  | { type: "alt", target: HTMLImageElement }
  | { type: "crop-insert", file: File, range: Range | null }
  | { type: "crop-again", file: File, target: HTMLImageElement }
  | null

interface UploadItem {
  file: File
  edit: CropResult | null
}

const ACCEPT = EDITOR_IMAGE_TYPES.join(",")
const BLANK_GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
const RECROP_ERROR = "이 이미지는 다시 자를 수 없습니다. 새로 올려 주세요."

let uploadSeq = 0

/** 커밋 마크업에 선택 표식을 붙여, 치환 뒤 새 노드를 다시 찾는다(직렬화 때 제거됨). */
const withSelectedMarker = (html: string) => html.replace(/^<(\w+)/, "<$1 data-selected=\"true\"")

function imageNatural(img: HTMLImageElement): Size {
  const attrW = Number.parseInt(img.getAttribute("width") ?? "", 10)
  const attrH = Number.parseInt(img.getAttribute("height") ?? "", 10)
  const width = img.naturalWidth || attrW || 0
  const height = img.naturalHeight || attrH || 0
  return width > 0 && height > 0 ? { width, height } : { width: 1600, height: 900 }
}

function currentWidthOf(sel: Selected): number {
  const el = sel.kind === "image" ? sel.el : sel.el.querySelector("iframe")
  const attr = Number.parseInt(el?.getAttribute("width") ?? "", 10)
  if (Number.isFinite(attr) && attr > 0) return attr
  return sel.kind === "image" ? imageNatural(sel.el as HTMLImageElement).width : 640
}

function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  const files = Array.from(data.files ?? []).filter((f) => f.type.startsWith("image/"))
  if (files.length) return files
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null)
}

function filenameFromUrl(src: string): string {
  try {
    return decodeURIComponent(new URL(src, window.location.href).pathname.split("/").pop() || "image")
  } catch {
    return "image"
  }
}

const editorRef = ref<HTMLDivElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const replaceInputRef = ref<HTMLInputElement | null>(null)
let pendingRange: Range | null = null
let savedRange: Range | null = null
let replaceTarget: HTMLImageElement | null = null
// 이 세션에서 올린 이미지의 원본 — 다시 자르기에 쓴다(서버 재인코딩본 대신 원본 화질).
const originals = new Map<string, File>()
let lastHtml: string | null = null

const empty = ref(isRichTextEmpty(initialHtml))
const active = shallowRef<ActiveState>(EMPTY_ACTIVE)
const selected = shallowRef<Selected | null>(null)
const dialog = shallowRef<DialogState>(null)
const error = ref<string | null>(null)
const uploading = ref(0)
// 커밋 뒤 오버레이를 다시 그리기 위한 카운터(폭 입력 초기화 등) — MediaOverlay 의 key.
const revision = ref(0)

const editorId = useId()
const errorId = useId()

/** 직렬화해 change — 이전 값과 같으면 보내지 않는다. 모든 변경 경로가 이 함수로 모인다. */
function emitChange() {
  const el = editorRef.value
  if (!el) return
  const raw = el.innerHTML
  const html = serializeEditorHtml(raw)
  empty.value = isRichTextEmpty(raw) && !el.querySelector("hr, table")
  if (selected.value && !selected.value.el.isConnected) selected.value = null
  if (html !== lastHtml) {
    lastHtml = html
    emit("change", html)
  }
}

// 선택 변화 — 툴바 활성 상태, 마지막 선택 위치 저장, 미디어 선택 해제.
function onSelectionChange() {
  const el = editorRef.value
  if (!el) return
  const range = selectionRangeIn(el)
  if (!range) return
  savedRange = range
  const next = readActiveState(el)
  if (JSON.stringify(active.value) !== JSON.stringify(next)) active.value = next
  const prev = selected.value
  if (prev) {
    const touches = range.intersectsNode(prev.el) || prev.el.contains(range.startContainer)
    if (!touches) selected.value = null
  }
}

// 미디어 선택 중 에디터 바깥을 누르면 해제(오버레이·다이얼로그 안은 제외).
function onDocumentMouseDown(e: MouseEvent) {
  if (!selected.value) return
  const t = e.target as Node
  if (wrapperRef.value?.contains(t)) return
  if (t instanceof Element && t.closest("[role=dialog]")) return
  selected.value = null
}

onMounted(() => {
  // 마운트 시 한 번 초기 HTML 을 넣는다.
  const el = editorRef.value
  if (el) {
    el.innerHTML = initialHtml && initialHtml.trim() ? initialHtml : "<p><br></p>"
    decorateEditable(el)
    lastHtml = serializeEditorHtml(el.innerHTML)
  }
  document.addEventListener("selectionchange", onSelectionChange)
  document.addEventListener("mousedown", onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionChange)
  document.removeEventListener("mousedown", onDocumentMouseDown)
})

// 선택 표식(data-selected) 동기화 — 편집 전용 속성이라 undo 와 무관하다.
watch([selected, revision], () => {
  const el = editorRef.value
  if (!el) return
  el.querySelectorAll("[data-selected]").forEach((n) => {
    if (n !== selected.value?.el) n.removeAttribute("data-selected")
  })
  selected.value?.el.setAttribute("data-selected", "true")
})

function editorHasFocus(): boolean {
  const el = editorRef.value
  return Boolean(el && document.activeElement && el.contains(document.activeElement))
}

/** 포커스를 편집 영역으로 되돌리고 마지막 선택을 복원한다(툴바·다이얼로그에서 돌아올 때). */
function focusEditor(range: Range | null = savedRange) {
  const el = editorRef.value
  if (!el) return
  if (!editorHasFocus()) el.focus({ preventScroll: true })
  if (range && el.contains(range.commonAncestorContainer)) selectRange(range)
}

/**
 * 사용자의 현재 선택을 보존하며 노드를 치환/삭제한다(업로드 완료 등 비동기 커밋).
 * 편집 영역에 포커스가 없으면 execCommand 가 포커스를 빼앗지 않도록 DOM 직접 치환으로 처리한다.
 */
function commitAsync(fn: () => void) {
  const el = editorRef.value
  if (!el) return
  const keep = editorHasFocus() ? selectionRangeIn(el) : null
  const focused = document.activeElement as HTMLElement | null
  fn()
  if (keep && el.contains(keep.startContainer)) selectRange(keep)
  else if (!keep && focused && focused !== document.body && !el.contains(focused)) focused.focus({ preventScroll: true })
  decorateEditable(el)
  emitChange()
}

function selectMedia(node: HTMLElement | null) {
  if (!node) {
    selected.value = null
    return
  }
  const kind = node.matches("img") ? "image" : "video"
  const range = document.createRange()
  range.selectNode(node)
  selectRange(range)
  selected.value = { el: node, kind }
  // 다른 미디어로 옮겨 가도 오버레이(폭 입력 등)를 새로 그린다.
  revision.value += 1
}

/** 치환 커밋 후 표식으로 새 노드를 찾아 다시 선택한다. */
function reselectMarked() {
  const next = editorRef.value?.querySelector<HTMLElement>("[data-selected]")
  if (next) selectMedia(next)
  else selected.value = null
}

// 포커스 여부에 따라 exec(undo 가능) 또는 직접 치환.
const replaceNodeCommitted = (node: Element, html: string) => replaceNode(node, html, !editorHasFocus())
const removeNodeCommitted = (node: Element) => deleteNode(node, !editorHasFocus())

// ---------- 이미지 업로드 ----------

async function safeUpload(blob: Blob, filename: string): Promise<EditorUploadResult> {
  try {
    return await uploadImage(blob, filename)
  } catch {
    // 계약상 reject 하지 않지만, 방어적으로 문구를 만든다.
    return { error: "이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
}

async function prepare(file: File, edit: CropResult | null) {
  try {
    return await transformImage(file, { crop: edit?.crop ?? null, rotate: edit?.rotate ?? 0 })
  } catch {
    return { blob: file as Blob, filename: file.name || "image" }
  }
}

/** 자리표시를 넣고 각 파일을 변환·업로드한 뒤 결과로 치환(실패 시 제거 + 오류). */
function insertUploads(items: UploadItem[], range: Range | null) {
  const el = editorRef.value
  if (!el || !items.length) return
  const entries = items.map((item) => {
    uploadSeq += 1
    const id = `u${Date.now().toString(36)}${uploadSeq}`
    const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(item.file) : BLANK_GIF
    return { ...item, id, preview }
  })
  const placeholders = entries
    .map((e) => `<img data-uploading="${e.id}" src="${escapeHtml(e.preview)}" alt="업로드 중">`)
    .join("")
  const target = range && el.contains(range.commonAncestorContainer) ? range : rangeAtEnd(el)
  // 편집 영역 바로 아래(문단 밖)에 들어가면 문단으로 감싼다.
  const html = target.startContainer === el ? `<p>${placeholders}</p>` : placeholders
  focusEditor(target)
  insertHtmlAt(el, target, html)
  decorateEditable(el)
  emitChange()
  error.value = null

  for (const entry of entries) {
    uploading.value += 1
    void (async () => {
      const prepared = await prepare(entry.file, entry.edit)
      const result = await safeUpload(prepared.blob, prepared.filename)
      if (entry.preview.startsWith("blob:")) URL.revokeObjectURL(entry.preview)
      uploading.value -= 1
      const placeholder = editorRef.value?.querySelector<HTMLImageElement>(`img[data-uploading="${entry.id}"]`)
      if ("error" in result) {
        error.value = result.error
        if (placeholder) commitAsync(() => removeNodeCommitted(placeholder))
        return
      }
      originals.set(result.url, entry.file)
      // 사용자가 업로드 중 자리표시를 지웠으면 넣지 않는다.
      if (!placeholder) return
      const markup = imageHtml({ src: result.url, alt: "", width: result.width, height: result.height })
      commitAsync(() => replaceNodeCommitted(placeholder, markup))
    })()
  }
}

/** 버튼·붙여넣기·드롭으로 들어온 파일 처리 — 사전 검사 후 1장(GIF 제외)이면 자르기 다이얼로그. */
function handleFiles(files: File[], range: Range | null) {
  const valid: File[] = []
  let problem: string | null = null
  for (const file of files) {
    const p = editorImageProblem(file)
    if (p) problem ??= p
    else valid.push(file)
  }
  error.value = problem
  if (!valid.length) return
  const only = valid[0]
  if (valid.length === 1 && only && only.type !== "image/gif") {
    dialog.value = { type: "crop-insert", file: only, range }
    return
  }
  // 여러 장은 다이얼로그 없이 전부 "그대로 넣기".
  insertUploads(
    valid.map((file) => ({ file, edit: null })),
    range,
  )
}

/** 다시 자르기 — 세션 원본 또는 fetch(src). 결과는 새 파일로 업로드 후 src 교체. */
async function startRecrop(img: HTMLImageElement) {
  const src = img.getAttribute("src") ?? ""
  let file = originals.get(src) ?? null
  if (!file) {
    try {
      // 공개 이미지 파일(정적 파일) 다운로드라 API 인스턴스($api)가 아닌 fetch 를 쓴다.
      const res = await fetch(src)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      if (!blob.type.startsWith("image/")) throw new Error(blob.type)
      file = new File([blob], filenameFromUrl(src), { type: blob.type })
    } catch {
      error.value = RECROP_ERROR
      return
    }
  }
  if (file.type === "image/gif") {
    error.value = "GIF 이미지는 자를 수 없습니다."
    return
  }
  dialog.value = { type: "crop-again", file, target: img }
}

async function finishRecrop(target: HTMLImageElement, file: File, edit: CropResult) {
  uploading.value += 1
  const prepared = await prepare(file, edit)
  const result = await safeUpload(prepared.blob, prepared.filename)
  uploading.value -= 1
  if ("error" in result) {
    error.value = result.error
    return
  }
  originals.set(result.url, file)
  if (!target.isConnected) return
  const keepWidth = Number.parseInt(target.getAttribute("width") ?? "", 10)
  const size = sizeForWidth(result, Number.isFinite(keepWidth) ? keepWidth : result.width)
  const markup = imageHtml({ src: result.url, alt: target.getAttribute("alt") ?? "", ...size })
  commitAsync(() => replaceNodeCommitted(target, markup))
  selected.value = null
}

async function finishReplace(target: HTMLImageElement, file: File) {
  const problem = editorImageProblem(file)
  if (problem) {
    error.value = problem
    return
  }
  error.value = null
  uploading.value += 1
  const prepared = await prepare(file, null)
  const result = await safeUpload(prepared.blob, prepared.filename)
  uploading.value -= 1
  if ("error" in result) {
    error.value = result.error
    return
  }
  originals.set(result.url, file)
  if (!target.isConnected) return
  const markup = imageHtml({
    src: result.url,
    alt: target.getAttribute("alt") ?? "",
    width: result.width,
    height: result.height,
  })
  commitAsync(() => replaceNodeCommitted(target, markup))
  selected.value = null
}

// ---------- 미디어 커밋 (§6: selectNode → insertHTML) ----------

function resizeSelected(width: number) {
  const sel = selected.value
  const root = editorRef.value
  if (!sel || !root) return
  let html: string | null = null
  if (sel.kind === "image") {
    const img = sel.el as HTMLImageElement
    const size = sizeForWidth(imageNatural(img), width)
    html = imageHtml({ src: img.getAttribute("src") ?? "", alt: img.getAttribute("alt") ?? "", ...size })
  } else {
    const id = youtubeIdFromEmbedSrc(sel.el.querySelector("iframe")?.getAttribute("src"))
    if (id) html = youtubeEmbedHtml(id, videoSizeForWidth(width).width, true)
  }
  if (!html) return
  focusEditor(null)
  replaceNode(sel.el, withSelectedMarker(html))
  decorateEditable(root)
  reselectMarked()
  emitChange()
}

function deleteSelected() {
  const sel = selected.value
  if (!sel) return
  focusEditor(null)
  deleteNode(sel.el)
  selected.value = null
  emitChange()
}

// ---------- 툴바 ----------

function runCommand(command: ToolbarCommand) {
  const el = editorRef.value
  if (!el) return
  const range = selectionRangeIn(el) ?? savedRange
  if (command === "image") {
    pendingRange = range
    fileInputRef.value?.click()
    return
  }
  if (command === "video") {
    dialog.value = { type: "youtube", range, target: null, initial: "" }
    return
  }
  if (command === "link") {
    const href = closestLink(range?.startContainer ?? null, el)?.getAttribute("href") ?? ""
    dialog.value = { type: "link", range, initial: href }
    return
  }
  focusEditor(range)
  // execCommand 기본값: 문단 구분자 <p>, 서식은 태그로(style 금지 §0-2).
  exec("defaultParagraphSeparator", "p")
  exec("styleWithCSS", "false")
  switch (command) {
    case "undo":
    case "redo":
      exec(command)
      break
    case "p":
    case "h2":
    case "h3":
    case "blockquote":
      setBlock(el, command)
      break
    case "bold":
    case "italic":
    case "underline":
      exec(command)
      break
    case "strike":
      exec("strikeThrough")
      break
    case "mark":
      error.value = toggleMark(el)
      break
    case "clear":
      clearFormatting(el)
      break
    case "align-left":
    case "align-center":
    case "align-right":
      toggleAlign(el, command.replace("align-", "") as "left" | "center" | "right")
      break
    case "ul":
      exec("insertUnorderedList")
      break
    case "ol":
      exec("insertOrderedList")
      break
    case "hr":
      if (!exec("insertHorizontalRule")) insertHtmlAt(el, selectionRangeIn(el), "<hr>")
      break
    case "unlink":
      removeLink(el)
      break
  }
  decorateEditable(el)
  emitChange()
  active.value = readActiveState(el)
}

// ---------- 편집 영역 이벤트 ----------

function onInput() {
  const el = editorRef.value
  if (el) decorateEditable(el)
  emitChange()
}

function onPaste(e: ClipboardEvent) {
  const el = editorRef.value
  const data = e.clipboardData
  if (!el || !data) return
  const html = data.getData("text/html")
  const text = data.getData("text/plain")
  const files = imageFilesFrom(data)
  const range = selectionRangeIn(el)
  // 워드·엑셀은 서식 HTML 과 함께 "그림" 표현을 같이 싣는다 — 글자가 있는 HTML 이면 HTML 을 우선한다.
  const htmlHasText = html ? !isRichTextEmpty(html.replace(/<img[^>]*>/gi, "")) : false
  if (files.length && !htmlHasText) {
    e.preventDefault()
    handleFiles(files, range)
    return
  }
  e.preventDefault()
  selected.value = null
  if (html) {
    const cleaned = cleanPastedHtml(html)
    if (cleaned) insertHtmlAt(el, range, cleaned)
  } else if (text) {
    if (!/[\r\n]/.test(text)) {
      if (range) selectRange(range)
      if (!exec("insertText", text)) insertHtmlAt(el, range, escapeHtml(text))
    } else {
      insertHtmlAt(el, range, plainTextToHtml(text))
    }
  }
  decorateEditable(el)
  emitChange()
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }
}

function onDrop(e: DragEvent) {
  const el = editorRef.value
  const files = imageFilesFrom(e.dataTransfer)
  if (!el || !files.length) {
    // 파일이 아니면(글자 끌어 옮기기 등) 브라우저 기본 동작 — 직렬화가 style 등을 지운다.
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault()
    return
  }
  e.preventDefault()
  const point = rangeFromPoint(e.clientX, e.clientY)
  handleFiles(files, point && el.contains(point.startContainer) ? point : selectionRangeIn(el))
}

function onClick(e: MouseEvent) {
  const el = editorRef.value
  const target = e.target as Element
  if (!el) return
  const img = target.closest("img")
  if (img && el.contains(img) && !img.hasAttribute("data-uploading")) {
    selectMedia(img)
    return
  }
  const video = target.closest<HTMLElement>("[data-youtube-video]")
  if (video && el.contains(video)) {
    selectMedia(video)
    return
  }
  if (selected.value) selected.value = null
}

function onKeyDown(e: KeyboardEvent) {
  const sel = selected.value
  const el = editorRef.value
  if (!sel || !el) return
  const node = sel.el
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault()
    deleteSelected()
    return
  }
  if (e.key === "Escape") {
    e.preventDefault()
    caretAfter(node)
    selected.value = null
    return
  }
  if (e.key === "Enter") {
    e.preventDefault()
    if (sel.kind === "video") {
      const next = node.nextElementSibling
      if (!(next && next.matches("p") && isRichTextEmpty(next.innerHTML))) {
        caretAfter(node)
        insertHtmlAt(el, selectionRangeIn(el), "<p><br></p>")
      }
      const p = node.nextElementSibling
      if (p) {
        const r = document.createRange()
        r.setStart(p, 0)
        r.collapse(true)
        selectRange(r)
      }
    } else {
      caretAfter(node)
      if (!exec("insertParagraph")) insertHtmlAt(el, selectionRangeIn(el), "<p><br></p>")
    }
    selected.value = null
    emitChange()
    return
  }
  // 그 밖의 키: 선택을 풀고 캐럿을 미디어 뒤로 — 글자 입력이 미디어를 덮어쓰지 않게 한다.
  if (e.key.length === 1 || e.key.startsWith("Arrow")) {
    if (!e.key.startsWith("Arrow")) caretAfter(node)
    selected.value = null
  }
}

function onFocus() {
  exec("defaultParagraphSeparator", "p")
  exec("styleWithCSS", "false")
}

// ---------- 다이얼로그 결과 ----------

const closeDialog = () => {
  dialog.value = null
}

function submitLink(value: string, range: Range | null) {
  const el = editorRef.value
  const url = normalizeLinkUrl(value)
  if (!el || !url) return
  dialog.value = null
  focusEditor(range)
  applyLink(el, range, url)
  emitChange()
}

function submitYoutube(value: string, range: Range | null, target: HTMLElement | null) {
  const el = editorRef.value
  const id = extractYoutubeId(value)
  if (!el || !id) return
  dialog.value = null
  if (target && target.isConnected) {
    const width = Number.parseInt(target.querySelector("iframe")?.getAttribute("width") ?? "", 10)
    focusEditor(null)
    replaceNode(target, withSelectedMarker(youtubeEmbedHtml(id, Number.isFinite(width) ? width : undefined, true)))
    decorateEditable(el)
    reselectMarked()
    emitChange()
    return
  }
  const at = range && el.contains(range.commonAncestorContainer) ? range : rangeAtEnd(el)
  const atEnd = isAtDocumentEnd(el, at)
  focusEditor(at)
  insertHtmlAt(el, at, youtubeEmbedHtml(id, undefined, true) + (atEnd ? "<p><br></p>" : ""))
  decorateEditable(el)
  emitChange()
}

function submitAlt(value: string, target: HTMLImageElement) {
  dialog.value = null
  const root = editorRef.value
  if (!target.isConnected || !root) return
  const width = Number.parseInt(target.getAttribute("width") ?? "", 10)
  const height = Number.parseInt(target.getAttribute("height") ?? "", 10)
  focusEditor(null)
  replaceNode(
    target,
    withSelectedMarker(imageHtml({ src: target.getAttribute("src") ?? "", alt: value.trim(), width, height })),
  )
  decorateEditable(root)
  reselectMarked()
  emitChange()
}

function onCropApply(edit: CropResult) {
  const d = dialog.value
  dialog.value = null
  if (d?.type === "crop-insert") insertUploads([{ file: d.file, edit }], d.range)
  else if (d?.type === "crop-again") void finishRecrop(d.target, d.file, edit)
}

function onCropSkip() {
  const d = dialog.value
  dialog.value = null
  if (d?.type === "crop-insert") insertUploads([{ file: d.file, edit: null }], d.range)
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ""
  handleFiles(files, pendingRange)
}

function onReplaceChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  const target = replaceTarget
  replaceTarget = null
  if (file && target) void finishReplace(target, file)
}

// ---------- 오버레이 ----------

const selectedNatural = computed<Size>(() =>
  selected.value?.kind === "image" ? imageNatural(selected.value.el as HTMLImageElement) : { width: 1280, height: 720 },
)
const canRecrop = computed(() => {
  const sel = selected.value
  return sel?.kind === "image" && !/\.gif(?:$|\?)/i.test(sel.el.getAttribute("src") ?? "")
})

function onOverlayAltText() {
  const sel = selected.value
  if (sel?.kind === "image") dialog.value = { type: "alt", target: sel.el as HTMLImageElement }
}

function onOverlayRecrop() {
  const sel = selected.value
  if (sel?.kind === "image") void startRecrop(sel.el as HTMLImageElement)
}

function onOverlayReplace() {
  const sel = selected.value
  if (sel?.kind !== "image") return
  replaceTarget = sel.el as HTMLImageElement
  replaceInputRef.value?.click()
}

function onOverlayChangeLink() {
  const sel = selected.value
  if (!sel) return
  const id = youtubeIdFromEmbedSrc(sel.el.querySelector("iframe")?.getAttribute("src"))
  dialog.value = {
    type: "youtube",
    range: null,
    target: sel.el,
    initial: id ? `https://www.youtube.com/watch?v=${id}` : "",
  }
}

const linkProblem = (v: string) => (normalizeLinkUrl(v) ? null : "http·https·mailto·tel 링크만 넣을 수 있습니다.")
const youtubeProblem = (v: string) => (extractYoutubeId(v) ? null : "유튜브 링크만 넣을 수 있습니다.")
</script>

<template>
  <div class="rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary">
    <EditorToolbar :active="active" :controls-id="editorId" @command="runCommand" />
    <div ref="wrapperRef" class="relative">
      <div
        :id="editorId"
        ref="editorRef"
        class="editor rich-text min-h-60 px-4 py-3 text-on-surface outline-none"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :aria-labelledby="labelId || undefined"
        :aria-label="labelId ? undefined : '본문'"
        :aria-describedby="error ? errorId : undefined"
        :data-placeholder="placeholder"
        :data-empty="empty ? 'true' : undefined"
        spellcheck="true"
        @input="onInput"
        @paste="onPaste"
        @dragover="onDragOver"
        @drop="onDrop"
        @click="onClick"
        @keydown="onKeyDown"
        @focus="onFocus"
      />
      <MediaOverlay
        v-if="selected && wrapperRef"
        :key="revision"
        :kind="selected.kind"
        :target="selected.el"
        :container="wrapperRef"
        :natural="selectedNatural"
        :current-width="currentWidthOf(selected)"
        :can-recrop="canRecrop"
        @resize="resizeSelected"
        @delete="deleteSelected"
        @alt-text="onOverlayAltText"
        @recrop="onOverlayRecrop"
        @replace="onOverlayReplace"
        @change-link="onOverlayChangeLink"
      />
    </div>

    <div v-if="uploading > 0 || error" class="space-y-1 border-t border-outline-variant px-3 py-2">
      <p v-if="uploading > 0" role="status" class="text-sm text-on-surface-variant">
        이미지 올리는 중… ({{ uploading }})
      </p>
      <div
        v-if="error"
        :id="errorId"
        role="alert"
        class="flex items-center justify-between gap-2 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
      >
        <span>{{ error }}</span>
        <button
          type="button"
          class="min-h-11 min-w-11 rounded-lg font-medium hover:underline"
          aria-label="오류 닫기"
          @click="error = null"
        >
          닫기
        </button>
      </div>
    </div>

    <input ref="fileInputRef" type="file" :accept="ACCEPT" multiple hidden aria-label="이미지 파일 선택" @change="onFileChosen">
    <input ref="replaceInputRef" type="file" :accept="ACCEPT" hidden aria-label="교체할 이미지 파일 선택" @change="onReplaceChosen">

    <TextPromptDialog
      v-if="dialog?.type === 'link'"
      title="링크 걸기"
      label="링크 주소"
      input-type="url"
      :initial-value="dialog.initial"
      placeholder="https://example.com"
      hint="http·https·mailto·tel 링크를 넣을 수 있습니다."
      :validate="linkProblem"
      @submit="(v) => dialog?.type === 'link' && submitLink(v, dialog.range)"
      @close="closeDialog"
    />
    <TextPromptDialog
      v-if="dialog?.type === 'youtube'"
      :title="dialog.target ? '영상 링크 바꾸기' : '유튜브 영상 넣기'"
      label="유튜브 링크"
      input-type="url"
      :initial-value="dialog.initial"
      placeholder="https://www.youtube.com/watch?v=…"
      hint="watch·youtu.be·shorts·embed 링크를 넣을 수 있습니다."
      :submit-label="dialog.target ? '바꾸기' : '넣기'"
      :validate="youtubeProblem"
      @submit="(v) => dialog?.type === 'youtube' && submitYoutube(v, dialog.range, dialog.target)"
      @close="closeDialog"
    />
    <TextPromptDialog
      v-if="dialog?.type === 'alt'"
      title="대체 텍스트"
      label="이미지 설명"
      :initial-value="dialog.target.getAttribute('alt') ?? ''"
      hint="화면 낭독기 사용자에게 읽어 줄 설명입니다. 장식용 이미지면 비워 두세요."
      @submit="(v) => dialog?.type === 'alt' && submitAlt(v, dialog.target)"
      @close="closeDialog"
    />
    <ImageCropDialog
      v-if="dialog?.type === 'crop-insert' || dialog?.type === 'crop-again'"
      :file="dialog.file"
      :mode="dialog.type === 'crop-insert' ? 'insert' : 'recrop'"
      @apply="onCropApply"
      @skip="onCropSkip"
      @cancel="closeDialog"
    />
  </div>
</template>
