<script setup lang="ts">
// 제목 검색 폼 — 제출할 때만 search(공백 제거). 보이는 라벨은 sr-only 로 둔다(placeholder 는 라벨이 아니다).
// 부모가 :key="q" 로 다시 마운트해 URL 의 검색어와 맞춘다.
import { ui } from "~/lib/ui"

const { label, initial, placeholder = "" } = defineProps<{ label: string, initial: string, placeholder?: string }>()
const emit = defineEmits<{ search: [q: string] }>()

const value = ref(initial)
const id = useId()

function onSubmit() {
  emit("search", value.value.trim().slice(0, 100))
}
</script>

<template>
  <form role="search" class="flex w-full gap-2 sm:w-auto" @submit.prevent="onSubmit">
    <label :for="id" class="sr-only">{{ label }}</label>
    <input
      :id="id"
      v-model="value"
      type="search"
      maxlength="100"
      :placeholder="placeholder || label"
      :class="[ui.input, 'mt-0 min-w-0 flex-1 sm:w-64']"
    >
    <button type="submit" :class="ui.btnNeutral">
      <UiIcon name="search" :size="16" />
      검색
    </button>
  </form>
</template>
