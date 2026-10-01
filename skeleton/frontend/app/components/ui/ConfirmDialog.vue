<script setup lang="ts">
// 확인 다이얼로그 — 삭제·강제 종료 같은 되돌리기 어려운 작업 전에 띄운다.
// 포커스 가둠·Esc 닫기·포커스 복귀는 공용 모달(editor/EditorDialog.vue)이 맡는다.
import { ui } from "~/lib/ui"

const {
  title,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  pending = false,
} = defineProps<{
  title: string
  confirmLabel?: string
  cancelLabel?: string
  /** 파괴적 작업이면 확인 버튼을 오류 색으로. */
  danger?: boolean
  pending?: boolean
}>()
const emit = defineEmits<{ confirm: [], cancel: [] }>()
</script>

<template>
  <EditorDialog :title="title" @close="emit('cancel')">
    <div v-if="$slots.default" class="mt-3 text-sm leading-6 text-on-surface-variant">
      <slot />
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button type="button" :class="ui.btnNeutral" data-autofocus @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button type="button" :class="danger ? ui.btnDangerSolid : ui.btnPrimary" :disabled="pending" @click="emit('confirm')">
        {{ pending ? "처리 중…" : confirmLabel }}
      </button>
    </div>
  </EditorDialog>
</template>
