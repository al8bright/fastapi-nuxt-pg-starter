<script setup lang="ts">
// 한 줄 입력 다이얼로그 — 링크 걸기·유튜브 링크·대체 텍스트에 쓴다.
// validate 가 문구를 돌려주면 닫지 않고 오류를 보여 준다.
import { computed, ref, useId } from "vue"
import EditorDialog from "./EditorDialog.vue"

const {
  title,
  label,
  initialValue = "",
  placeholder = "",
  hint = "",
  submitLabel = "적용",
  inputType = "text",
  validate = () => null,
} = defineProps<{
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  hint?: string
  submitLabel?: string
  inputType?: "text" | "url"
  /** 문제가 있으면 오류 문구, 없으면 null. */
  validate?: (value: string) => string | null
}>()
const emit = defineEmits<{ submit: [value: string], close: [] }>()

const value = ref(initialValue)
const error = ref<string | null>(null)
const inputId = useId()
const errorId = useId()
const hintId = useId()
const describedBy = computed(() => [hint ? hintId : "", error.value ? errorId : ""].filter(Boolean).join(" ") || undefined)

function submit() {
  const problem = validate(value.value)
  if (problem) {
    error.value = problem
    return
  }
  emit("submit", value.value)
}

function onInput(e: Event) {
  value.value = (e.target as HTMLInputElement).value
  error.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <EditorDialog :title="title" @close="emit('close')">
    <label :for="inputId" class="mt-4 block text-sm font-medium">{{ label }}</label>
    <input
      :id="inputId"
      data-autofocus
      :type="inputType"
      :value="value"
      :placeholder="placeholder || undefined"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
      @input="onInput"
      @keydown="onKeyDown"
    >
    <p v-if="hint" :id="hintId" class="mt-1 text-xs text-on-surface-variant">
      {{ hint }}
    </p>
    <p v-if="error" :id="errorId" role="alert" class="mt-2 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
      {{ error }}
    </p>
    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        class="min-h-11 rounded-lg border border-outline-variant px-4 font-medium text-on-surface hover:bg-surface-container"
        @click="emit('close')"
      >
        취소
      </button>
      <button type="button" class="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:opacity-90" @click="submit">
        {{ submitLabel }}
      </button>
    </div>
  </EditorDialog>
</template>
