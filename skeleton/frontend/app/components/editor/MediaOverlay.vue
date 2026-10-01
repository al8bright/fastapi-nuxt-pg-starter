<script setup lang="ts">
// 선택된 이미지/영상 위 오버레이 (editor-spec §4·§6).
// - 편집 영역 래퍼(position:relative) 안에 absolute 로 놓고, getBoundingClientRect 차이로 배치한다.
//   스크롤·리사이즈·이미지 로드·크기 변화(ResizeObserver) 때 다시 잰다.
// - 모서리 핸들 4개: 드래그 중에는 style.width 로 미리보기만 하고 pointerup 에 한 번 커밋(resize 이벤트).
//   커밋은 부모가 selectNode + insertHTML 로 처리한다(undo 스택에 남도록).
// - 미니 툴바: 이미지(크기 프리셋·폭 입력·대체 텍스트·다시 자르기·교체·삭제) / 영상(크기 프리셋·폭 입력·링크 바꾸기·삭제).
// 부모가 커밋마다 key 를 바꿔 다시 마운트한다(폭 입력 초기화).
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue"
import {
  IMAGE_MIN_WIDTH,
  IMAGE_WIDTH_PRESETS,
  type Size,
  sizeForWidth,
  VIDEO_MAX_WIDTH,
  VIDEO_MIN_WIDTH,
  VIDEO_SIZE_PRESETS,
  videoSizeForWidth,
} from "~/lib/editor/imageTransform"
import EditorIcon from "./EditorIcon.vue"

const { kind, target, container, natural, currentWidth, canRecrop } = defineProps<{
  kind: "image" | "video"
  target: HTMLElement
  container: HTMLElement
  /** 이미지 원본 크기(프리셋 상한). 영상은 무시. */
  natural: Size
  /** 현재 저장된 폭(width 속성). */
  currentWidth: number
  canRecrop: boolean
}>()
const emit = defineEmits<{
  resize: [width: number]
  delete: []
  altText: []
  recrop: []
  replace: []
  changeLink: []
}>()

interface Box {
  /** 래퍼 폭 — 미니 툴바가 오른쪽으로 넘치지 않게 왼쪽 위치를 당긴다. */
  containerWidth: number
  left: number
  top: number
  width: number
  height: number
}

type Corner = "nw" | "ne" | "sw" | "se"
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"]
const CORNER_POS: Record<Corner, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  se: "left-full top-full cursor-nwse-resize",
}

const box = ref<Box | null>(null)
const preview = ref<Size | null>(null)
const draft = ref(String(currentWidth))
let drag: { corner: Corner, startX: number, startWidth: number, pointerId: number } | null = null
const widthId = useId()

// ---------- 위치 측정 ----------
// rAF 가 없는 환경(테스트 등)은 setTimeout 으로 대신한다.
const raf = (cb: () => void): number =>
  typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(cb) : window.setTimeout(cb, 16)
const caf = (id: number) =>
  typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame(id) : window.clearTimeout(id)
let frame = 0
let observer: ResizeObserver | null = null

function measure() {
  caf(frame)
  frame = raf(() => {
    const t = target.getBoundingClientRect()
    const c = container.getBoundingClientRect()
    box.value = { containerWidth: c.width, left: t.left - c.left, top: t.top - c.top, width: t.width, height: t.height }
  })
}

onMounted(() => {
  measure()
  observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null
  observer?.observe(target)
  observer?.observe(container)
  window.addEventListener("resize", measure)
  window.addEventListener("scroll", measure, true)
  target.addEventListener("load", measure)
})

onBeforeUnmount(() => {
  caf(frame)
  observer?.disconnect()
  window.removeEventListener("resize", measure)
  window.removeEventListener("scroll", measure, true)
  target.removeEventListener("load", measure)
})

// ---------- 크기 ----------
const sizeFor = (width: number): Size => (kind === "image" ? sizeForWidth(natural, width) : videoSizeForWidth(width))
// 미리보기 대상 — 영상은 래퍼가 아니라 iframe 크기를 바꾼다.
const previewEl = (): HTMLElement => (kind === "video" ? (target.querySelector("iframe") ?? target) : target)

function onHandleDown(corner: Corner, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  drag = {
    corner,
    startX: e.clientX,
    startWidth: previewEl().getBoundingClientRect().width || currentWidth,
    pointerId: e.pointerId,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onHandleMove(e: PointerEvent) {
  if (!drag || drag.pointerId !== e.pointerId) return
  const dx = e.clientX - drag.startX
  const grow = drag.corner === "nw" || drag.corner === "sw" ? -dx : dx
  const size = sizeFor(drag.startWidth + grow)
  const el = previewEl()
  el.style.width = `${size.width}px`
  el.style.height = `${size.height}px`
  preview.value = size
}

function onHandleUp(e: PointerEvent) {
  if (!drag || drag.pointerId !== e.pointerId) return
  drag = null
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  const el = previewEl()
  el.style.removeProperty("width")
  el.style.removeProperty("height")
  if (!el.getAttribute("style")) el.removeAttribute("style")
  const size = preview.value
  preview.value = null
  if (size && size.width !== currentWidth) emit("resize", size.width)
}

function commitDraft() {
  const n = Number.parseInt(draft.value, 10)
  if (!Number.isFinite(n)) {
    draft.value = String(currentWidth)
    return
  }
  const size = sizeFor(n)
  draft.value = String(size.width)
  if (size.width !== currentWidth) emit("resize", size.width)
}

// 버튼 클릭이 편집 영역 선택을 바꾸지 않도록 (입력칸은 포커스가 필요하다).
function onToolbarMouseDown(e: MouseEvent) {
  if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
}

const toolbarStyle = computed(() => {
  const b = box.value
  if (!b) return {}
  // 미니 툴바 예상 폭(약 360px)만큼 오른쪽 여유가 없으면 왼쪽으로 당긴다.
  const left = `${Math.max(0, Math.min(b.left, b.containerWidth - 360))}px`
  return b.top > 64
    ? { left, top: `${b.top - 8}px`, transform: "translateY(-100%)" }
    : { left, top: `${b.top + b.height + 8}px` }
})

const presets = computed<Array<{ label: string, width: number }>>(() =>
  kind === "image"
    ? [
        { label: "소", width: IMAGE_WIDTH_PRESETS[0] },
        { label: "중", width: IMAGE_WIDTH_PRESETS[1] },
        { label: "대", width: IMAGE_WIDTH_PRESETS[2] },
        { label: "원본", width: natural.width },
      ]
    : [
        ...VIDEO_SIZE_PRESETS.map(([w, h]) => ({ label: `${w}×${h}`, width: w as number })),
        { label: "전체 폭", width: VIDEO_MAX_WIDTH },
      ],
)
const minWidth = computed(() => (kind === "image" ? Math.min(IMAGE_MIN_WIDTH, natural.width) : VIDEO_MIN_WIDTH))
const maxWidth = computed(() => (kind === "image" ? natural.width : VIDEO_MAX_WIDTH))

const btn
  = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-primary aria-pressed:text-on-primary"
</script>

<template>
  <template v-if="box">
    <!-- 선택 테두리 + 모서리 핸들 -->
    <div
      class="pointer-events-none absolute z-10 outline-2 outline-primary"
      :style="{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${preview?.width ?? box.width}px`,
        height: `${preview?.height ?? box.height}px`,
      }"
      data-testid="media-overlay"
    >
      <span
        v-for="c in CORNERS"
        :key="c"
        aria-hidden="true"
        :data-corner="c"
        class="pointer-events-auto absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none after:absolute after:inset-2 after:rounded-sm after:border-2 after:border-primary after:bg-white"
        :class="CORNER_POS[c]"
        @pointerdown="onHandleDown(c, $event)"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="onHandleUp"
      />
      <span v-if="preview" class="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
        {{ preview.width }} × {{ preview.height }}
      </span>
    </div>

    <!-- 미니 툴바 -->
    <div
      role="toolbar"
      :aria-label="kind === 'image' ? '이미지 도구' : '영상 도구'"
      class="absolute z-20 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-lg"
      :style="toolbarStyle"
      @mousedown="onToolbarMouseDown"
    >
      <div role="group" aria-label="크기" class="flex flex-wrap gap-0.5">
        <button
          v-for="p in presets"
          :key="p.label"
          type="button"
          :class="btn"
          :aria-pressed="currentWidth === p.width"
          :disabled="kind === 'image' && p.width > natural.width"
          :title="`폭 ${p.width}px`"
          @click="emit('resize', p.width)"
        >
          {{ p.label }}
        </button>
      </div>
      <label :for="widthId" class="ml-1 text-xs text-on-surface-variant">폭(px)</label>
      <input
        :id="widthId"
        v-model="draft"
        type="number"
        inputmode="numeric"
        :min="minWidth"
        :max="maxWidth"
        class="min-h-11 w-20 rounded-lg border border-outline-variant bg-surface px-2 text-sm text-on-surface outline-none focus:border-primary"
        @blur="commitDraft"
        @keydown.enter.prevent="commitDraft"
      >
      <span class="mx-1 h-6 w-px bg-outline-variant" aria-hidden="true" />
      <template v-if="kind === 'image'">
        <button type="button" :class="btn" aria-label="대체 텍스트" title="대체 텍스트" @click="emit('altText')">
          <EditorIcon name="alt" />
        </button>
        <button
          type="button"
          :class="btn"
          :disabled="!canRecrop"
          aria-label="다시 자르기"
          :title="canRecrop ? '다시 자르기' : 'GIF 는 자를 수 없습니다'"
          @click="emit('recrop')"
        >
          <EditorIcon name="crop" />
        </button>
        <button type="button" :class="btn" aria-label="이미지 교체" title="이미지 교체" @click="emit('replace')">
          <EditorIcon name="replace" />
        </button>
      </template>
      <button v-else type="button" :class="btn" aria-label="링크 바꾸기" title="링크 바꾸기" @click="emit('changeLink')">
        <EditorIcon name="link" />
      </button>
      <button
        type="button"
        :class="[btn, 'text-on-error-container']"
        :aria-label="kind === 'image' ? '이미지 삭제' : '영상 삭제'"
        title="삭제"
        @click="emit('delete')"
      >
        <EditorIcon name="trash" />
      </button>
    </div>
  </template>
</template>
