<script setup lang="ts">
// 에디터 공용 모달 다이얼로그 — role="dialog" + aria-modal, 포커스 가둠(Tab 순환), Esc 로 닫기,
// 닫히면 열기 전 포커스로 돌아간다. 확인 다이얼로그(ui/ConfirmDialog.vue)도 이것을 쓴다.
//
// body 로 Teleport 한다: 에디터가 <form> 안에 있어도 중첩 form·제출이 생기지 않도록 다이얼로그는
// <form> 을 쓰지 않고 Enter 를 직접 처리한다. 다이얼로그 안 keydown 은 여기서 전파를 끊는다.
// 에디터 컴포넌트는 Nuxt 자동 import 에 기대지 않는다(vitest 로 단독 테스트) — vue API 를 직접 import 한다.
import { onBeforeUnmount, onMounted, ref, useId } from "vue"

const FOCUSABLE
  = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"

const { title, wide = false } = defineProps<{
  title: string
  /** 넓은 다이얼로그(자르기). */
  wide?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const root = ref<HTMLDivElement | null>(null)
const titleId = useId()
let previous: HTMLElement | null = null

onMounted(() => {
  previous = document.activeElement as HTMLElement | null
  const el = root.value
  const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE)
  ;(first ?? el)?.focus()
})

onBeforeUnmount(() => {
  if (previous?.isConnected) previous.focus()
})

function onKeyDown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === "Escape") {
    e.preventDefault()
    emit("close")
    return
  }
  if (e.key !== "Tab") return
  const items = Array.from(root.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
  if (!items.length) {
    e.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === root.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @mousedown.self="emit('close')">
      <div
        ref="root"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="max-h-full w-full overflow-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-xl outline-none"
        :class="wide ? 'max-w-3xl' : 'max-w-md'"
        @keydown="onKeyDown"
      >
        <h2 :id="titleId" class="text-lg font-semibold">
          {{ title }}
        </h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
