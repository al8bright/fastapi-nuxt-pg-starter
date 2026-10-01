<script setup lang="ts">
// 공지 첨부 패널 — 공지가 저장된 뒤에만 쓴다(첨부는 공지 id 에 붙는다).
// 여러 파일을 고르면 사전 검사(확장자·용량·개수) 후 하나씩 순서대로 올리고 파일별 상태·오류를 보여 준다.
// 업로드는 공용 $api(FormData `file`)로 보내 Bearer·401 refresh 가 그대로 적용된다.
// ($fetch 는 업로드 진행률 이벤트가 없어 "올리는 중" 상태만 보여 준다.)
// 관리자 다운로드는 Bearer 가 필요해 blob 으로 받아 원래 파일명으로 저장한다(임시저장 공지 포함).
import { type Attachment, useNoticesApi } from "~/api/notices"
import { apiErrorMessage } from "~/lib/apiError"
import { saveBlob } from "~/lib/download"
import { formatBytes } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_EXTENSIONS,
  attachmentProblem,
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENTS_PER_NOTICE,
} from "~/lib/uploadRules"

const { noticeId } = defineProps<{ noticeId: number }>()

type UploadStatus = "waiting" | "uploading" | "done" | "error"

interface UploadItem {
  key: string
  name: string
  status: UploadStatus
  error: string | null
}

const STATUS_LABEL: Record<UploadStatus, string> = {
  waiting: "대기",
  uploading: "올리는 중",
  done: "완료",
  error: "실패",
}

// 수정 화면과 같은 키를 쓰므로 요청을 공유한다.
const { data: notice } = useAdminNotice(() => noticeId)
const attachments = computed(() => notice.value?.attachments ?? [])
const { uploadAttachment, deleteAttachment, downloadAdminAttachment } = useNoticesApi()

const queue = ref<UploadItem[]>([])
const busy = ref(false)
const message = ref<Flash | null>(null)
const deleting = ref<Attachment | null>(null)
const inputId = useId()
const helpId = useId()

function patch(key: string, changes: Partial<UploadItem>) {
  queue.value = queue.value.map((it) => (it.key === key ? { ...it, ...changes } : it))
}

async function onSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ""
  if (!files.length) return
  let slots = MAX_ATTACHMENTS_PER_NOTICE - attachments.value.length
  const items = files.map((file, i) => {
    let problem = attachmentProblem(file)
    if (!problem) {
      if (slots <= 0) problem = `첨부 파일은 공지당 ${MAX_ATTACHMENTS_PER_NOTICE}개까지 올릴 수 있습니다.`
      else slots -= 1
    }
    const item: UploadItem = { key: `${Date.now()}-${i}-${file.name}`, name: file.name, status: problem ? "error" : "waiting", error: problem }
    return { item, file }
  })
  queue.value = items.map((x) => x.item)
  message.value = null
  busy.value = true
  let uploaded = 0
  for (const { item, file } of items) {
    if (item.status === "error") continue
    patch(item.key, { status: "uploading" })
    try {
      await uploadAttachment(noticeId, file)
      patch(item.key, { status: "done" })
      uploaded += 1
    } catch (err) {
      patch(item.key, { status: "error", error: apiErrorMessage(err, { maxMb: MAX_ATTACHMENT_MB }) })
    }
  }
  if (uploaded) await invalidateNotices()
  busy.value = false
}

async function download(a: Attachment) {
  try {
    saveBlob(await downloadAdminAttachment(noticeId, a.id), a.original_name)
  } catch (err) {
    message.value = { tone: "error", text: apiErrorMessage(err, { fallback: "파일을 내려받지 못했습니다." }) }
  }
}

const { run: remove, isPending: removing } = useAction(async (a: Attachment) => {
  await deleteAttachment(noticeId, a.id)
  await invalidateNotices()
})

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  try {
    await remove(target)
    message.value = { tone: "success", text: `${target.original_name} 을(를) 삭제했습니다.` }
  } catch (err) {
    message.value = { tone: "error", text: apiErrorMessage(err) }
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <section aria-labelledby="attachments-title" :class="[ui.card, 'flex flex-col gap-4 rounded-xl p-5']">
    <div>
      <h2 id="attachments-title" class="text-lg font-semibold">
        첨부 파일 <span class="text-on-surface-variant">({{ attachments.length }}/{{ MAX_ATTACHMENTS_PER_NOTICE }})</span>
      </h2>
    </div>

    <UiNotice v-if="message" :tone="message.tone" @close="message = null">
      {{ message.text }}
    </UiNotice>

    <p v-if="attachments.length === 0" class="text-sm text-on-surface-variant">
      첨부 파일이 없습니다.
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="a in attachments" :key="a.id" class="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant px-3 py-1.5">
        <UiIcon name="clip" :size="16" class="text-on-surface-variant" />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ a.original_name }}</span>
        <span class="text-sm text-on-surface-variant">{{ formatBytes(a.size_bytes) }}</span>
        <button type="button" :class="[ui.btnSmall, 'text-primary hover:bg-primary-fixed']" @click="download(a)">
          내려받기<span class="sr-only"> ({{ a.original_name }})</span>
        </button>
        <button type="button" :class="[ui.btnSmall, 'text-error hover:bg-error-container']" @click="deleting = a">
          삭제<span class="sr-only"> ({{ a.original_name }})</span>
        </button>
      </li>
    </ul>

    <div>
      <label :for="inputId" :class="ui.label">파일 올리기</label>
      <input
        :id="inputId"
        type="file"
        multiple
        :accept="ATTACHMENT_ACCEPT"
        :disabled="busy || attachments.length >= MAX_ATTACHMENTS_PER_NOTICE"
        :aria-describedby="helpId"
        :class="[
          'mt-2 block w-full rounded text-sm text-on-surface-variant file:mr-3 file:min-h-11 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-on-primary disabled:opacity-60',
          ui.focusRing,
        ]"
        @change="onSelect"
      >
      <p :id="helpId" :class="ui.help">
        {{ ATTACHMENT_EXTENSIONS.join(", ") }} · 파일당 {{ MAX_ATTACHMENT_MB }}MB 이하 · 공지당 {{ MAX_ATTACHMENTS_PER_NOTICE }}개까지
      </p>
    </div>

    <ul v-if="queue.length > 0" aria-label="업로드 진행 상황" aria-live="polite" class="flex flex-col gap-2">
      <li v-for="it in queue" :key="it.key" class="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="min-w-0 flex-1 truncate">{{ it.name }}</span>
          <span :class="it.status === 'error' ? 'font-semibold text-error' : 'text-on-surface-variant'">
            {{ STATUS_LABEL[it.status] }}{{ it.status === "uploading" ? "…" : "" }}
          </span>
        </div>
        <progress v-if="it.status === 'uploading'" class="mt-1 h-1.5 w-full accent-primary" :aria-label="`${it.name} 업로드 중`" />
        <p v-if="it.error" class="mt-1 text-error">
          {{ it.error }}
        </p>
      </li>
    </ul>

    <UiConfirmDialog
      v-if="deleting"
      title="첨부 파일을 삭제할까요?"
      confirm-label="삭제"
      danger
      :pending="removing"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      {{ deleting.original_name }} 이(가) 바로 삭제되며 되돌릴 수 없습니다.
    </UiConfirmDialog>
  </section>
</template>
