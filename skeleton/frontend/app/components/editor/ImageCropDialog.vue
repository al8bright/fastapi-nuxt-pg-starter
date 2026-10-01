<script setup lang="ts">
// 자르기·회전 다이얼로그 (editor-spec §4).
// - 미리보기 위에서 드래그로 선택 영역을 만들고, 모서리·변 핸들로 크기를, 내부 드래그로 위치를 바꾼다.
// - 회전은 자르기보다 먼저 적용된다(선택 영역은 회전한 이미지 좌표계). 회전하면 선택을 초기화한다.
// - 표시 좌표 → 원본 좌표로 환산한 뒤 clampCrop 으로 정수·경계를 맞춰 apply 이벤트로 넘긴다.
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { type DecodedImage, decodeImage, drawPreview, releaseImage, sizeOf } from "~/lib/editor/imageCanvas"
import {
  centeredCrop,
  clampCrop,
  CROP_RATIOS,
  type CropHandle,
  displayToSource,
  dragCrop,
  normalizeRotation,
  previewScale,
  type Rect,
  type Rotation,
  rotatedSize,
} from "~/lib/editor/imageTransform"
import type { CropResult } from "~/lib/editor/types"
import EditorDialog from "./EditorDialog.vue"
import EditorIcon from "./EditorIcon.vue"

const { file, mode } = defineProps<{
  file: File
  /** insert: 새 이미지 삽입("그대로 넣기" 제공) / recrop: 이미 넣은 이미지 다시 자르기. */
  mode: "insert" | "recrop"
}>()
const emit = defineEmits<{ apply: [result: CropResult], skip: [], cancel: [] }>()

const HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
const HANDLE_POS: Record<CropHandle, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  n: "left-1/2 top-0 cursor-ns-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  e: "left-full top-1/2 cursor-ew-resize",
  se: "left-full top-full cursor-nwse-resize",
  s: "left-1/2 top-full cursor-ns-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  w: "left-0 top-1/2 cursor-ew-resize",
}

interface Drag {
  mode: CropHandle | "move"
  start: Rect
  originX: number
  originY: number
  pointerId: number
}

const image = shallowRef<DecodedImage | null>(null)
const failed = ref(false)
const rotate = ref<Rotation>(0)
const ratio = ref<number | null>(null)
const selection = ref<Rect | null>(null)
// 미리보기 상자 — 다이얼로그를 여는 시점의 화면 크기 기준.
const box = {
  width: Math.max(200, Math.min(720, window.innerWidth - 80)),
  height: Math.max(160, Math.min(440, window.innerHeight - 300)),
}
const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLDivElement | null>(null)
let drag: Drag | null = null
let cancelled = false

onMounted(() => {
  decodeImage(file).then(
    (img) => {
      if (cancelled) releaseImage(img)
      else image.value = markRaw(img)
    },
    () => {
      if (!cancelled) failed.value = true
    },
  )
})

onBeforeUnmount(() => {
  cancelled = true
  releaseImage(image.value)
})

// 회전한 원본 크기와 표시 크기.
const geometry = computed(() => {
  if (!image.value) return null
  const natural = rotatedSize(sizeOf(image.value), rotate.value)
  const scale = previewScale(natural, box.width, box.height)
  return {
    natural,
    scale,
    display: { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) },
  }
})

watch(
  [image, rotate, geometry, canvas],
  () => {
    if (image.value && geometry.value && canvas.value) drawPreview(canvas.value, image.value, rotate.value, geometry.value.display)
  },
  { flush: "post" },
)

function pointFrom(e: PointerEvent) {
  const rect = stage.value?.getBoundingClientRect()
  return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
}

function onPointerDown(e: PointerEvent) {
  const g = geometry.value
  if (!g || e.button !== 0) return
  const target = e.target as HTMLElement
  const handle = target.dataset.handle as CropHandle | undefined
  const p = pointFrom(e)
  if (handle && selection.value) {
    drag = { mode: handle, start: selection.value, originX: e.clientX, originY: e.clientY, pointerId: e.pointerId }
  } else if (target.dataset.cropBox !== undefined && selection.value) {
    drag = { mode: "move", start: selection.value, originX: e.clientX, originY: e.clientY, pointerId: e.pointerId }
  } else {
    // 빈 곳에서 새로 그린다 — 0 크기 사각형의 se 핸들을 끄는 것과 같다.
    const start = { x: p.x, y: p.y, width: 0, height: 0 }
    drag = { mode: "se", start, originX: e.clientX, originY: e.clientY, pointerId: e.pointerId }
    selection.value = dragCrop(start, "se", 0, 0, g.display, ratio.value, 0)
  }
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const g = geometry.value
  if (!drag || drag.pointerId !== e.pointerId || !g) return
  selection.value = dragCrop(
    drag.start,
    drag.mode,
    e.clientX - drag.originX,
    e.clientY - drag.originY,
    g.display,
    ratio.value,
    drag.start.width === 0 ? 0 : 8,
  )
}

function onPointerUp(e: PointerEvent) {
  if (!drag || drag.pointerId !== e.pointerId) return
  drag = null
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  // 클릭만 한 경우(아주 작은 영역)는 선택 해제 = 전체.
  const sel = selection.value
  if (sel && (sel.width < 4 || sel.height < 4)) selection.value = null
}

// 키보드: 화살표 이동, Shift+화살표 크기 조절.
function onBoxKeyDown(e: KeyboardEvent) {
  const g = geometry.value
  if (!selection.value || !g) return
  const step = 10
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const d = deltas[e.key]
  if (!d) return
  e.preventDefault()
  selection.value = dragCrop(selection.value, e.shiftKey ? "se" : "move", d[0], d[1], g.display, ratio.value)
}

function chooseRatio(value: number | null) {
  ratio.value = value
  if (value && geometry.value) selection.value = centeredCrop(geometry.value.display, value)
}

function rotateBy(deg: number) {
  rotate.value = normalizeRotation(rotate.value + deg)
  // 회전하면 좌표계가 바뀐다 — 선택을 지운다(비율이 있으면 적용 시 가운데 영역을 쓴다).
  selection.value = null
}

function apply() {
  const g = geometry.value
  if (!g) {
    emit("apply", { crop: null, rotate: rotate.value })
    return
  }
  const sel = selection.value ?? (ratio.value ? centeredCrop(g.display, ratio.value) : null)
  const crop = sel ? clampCrop(displayToSource(sel, g.scale), g.natural, ratio.value) : null
  const isFull
    = crop && crop.x === 0 && crop.y === 0 && crop.width === g.natural.width && crop.height === g.natural.height
  emit("apply", { crop: isFull ? null : crop, rotate: rotate.value })
}

const selectionLabel = computed(() => {
  const g = geometry.value
  const sel = selection.value
  if (!g || !sel) return ""
  return `자르기 영역 ${Math.round(sel.width / g.scale)}×${Math.round(sel.height / g.scale)}px — 화살표로 이동, Shift+화살표로 크기 조절`
})

const btn
  = "inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container disabled:opacity-50"
</script>

<template>
  <EditorDialog :title="mode === 'insert' ? '이미지 자르기' : '이미지 다시 자르기'" wide @close="emit('cancel')">
    <p class="mt-1 text-sm text-on-surface-variant">
      드래그해서 남길 영역을 고르세요. 고르지 않으면 이미지 전체를 씁니다.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="자르기 비율" class="flex flex-wrap gap-1">
        <button
          v-for="r in CROP_RATIOS"
          :key="r.label"
          type="button"
          :aria-pressed="ratio === r.value"
          :class="[btn, ratio === r.value ? 'border-primary bg-primary text-on-primary hover:bg-primary' : '']"
          @click="chooseRatio(r.value)"
        >
          {{ r.label }}
        </button>
      </div>
      <div class="ml-auto flex gap-1">
        <button type="button" :class="btn" aria-label="왼쪽으로 90° 회전" :disabled="!image" @click="rotateBy(-90)">
          <EditorIcon name="rotateLeft" />
        </button>
        <button type="button" :class="btn" aria-label="오른쪽으로 90° 회전" :disabled="!image" @click="rotateBy(90)">
          <EditorIcon name="rotateRight" />
        </button>
      </div>
    </div>

    <div class="mt-3 flex min-h-40 items-center justify-center rounded-xl bg-surface-container p-2">
      <p v-if="failed" role="alert" class="text-sm text-on-error-container">
        이미지를 읽을 수 없습니다.{{ mode === "insert" ? " 그대로 넣기를 눌러 원본을 올릴 수 있습니다." : "" }}
      </p>
      <p v-else-if="!geometry" role="status" class="text-sm text-on-surface-variant">
        이미지를 불러오는 중…
      </p>
      <div
        v-else
        ref="stage"
        class="relative touch-none overflow-hidden select-none"
        :style="{ width: `${geometry.display.width}px`, height: `${geometry.display.height}px` }"
        data-testid="crop-stage"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <canvas ref="canvas" class="block h-full w-full" aria-label="자르기 미리보기" role="img" />
        <div
          v-if="selection"
          data-crop-box=""
          tabindex="0"
          role="group"
          :aria-label="selectionLabel"
          class="absolute cursor-move border-2 border-white outline-none focus-visible:border-primary"
          :style="{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            width: `${selection.width}px`,
            height: `${selection.height}px`,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.5)',
          }"
          @keydown="onBoxKeyDown"
        >
          <span
            v-for="h in HANDLES"
            :key="h"
            :data-handle="h"
            aria-hidden="true"
            class="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 after:absolute after:inset-[7px] after:rounded-sm after:border after:border-primary after:bg-white"
            :class="HANDLE_POS[h]"
          />
        </div>
      </div>
    </div>

    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button type="button" :class="btn" @click="emit('cancel')">
        취소
      </button>
      <button v-if="mode === 'insert'" type="button" :class="btn" @click="emit('skip')">
        그대로 넣기
      </button>
      <button
        type="button"
        :disabled="!image"
        class="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
        @click="apply"
      >
        적용
      </button>
    </div>
  </EditorDialog>
</template>
