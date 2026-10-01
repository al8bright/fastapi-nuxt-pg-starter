<script setup lang="ts">
// 조회 실패 표시 — role="alert" 로 즉시 읽히게 한다. retry 리스너가 있으면 "다시 시도" 버튼.
import { ui } from "~/lib/ui"

const { message, retryable = true } = defineProps<{ message: string, retryable?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div role="alert" class="flex flex-col items-center gap-3 rounded-lg bg-error-container px-4 py-6 text-center text-sm text-on-error-container">
    <p>{{ message }}</p>
    <button v-if="retryable" type="button" :class="ui.btnNeutral" @click="emit('retry')">
      다시 시도
    </button>
  </div>
</template>
