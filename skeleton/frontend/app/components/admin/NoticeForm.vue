<script setup lang="ts">
// 공지 작성(/admin/notices/new)·수정(/admin/notices/:id/edit) 폼.
// - 처음 저장(POST)하면 수정 URL 로 바꿔 첨부 패널을 연다(안내 문구는 useState 로 넘긴다).
// - 에디터는 비제어 컴포넌트라 공지가 바뀌면 부모가 :key 로 다시 마운트한다(editor-spec §8).
// - 저장하지 않은 변경이 있으면 라우터 이동(onBeforeRouteLeave)과 새로고침·닫기(beforeunload)를 막고 확인한다.
import { type AdminNoticeDetail, type NoticeWrite, useNoticesApi } from "~/api/notices"
import { apiErrorMessage } from "~/lib/apiError"
import { isRichTextEmpty } from "~/lib/editor/richText"
import { type Flash, ui } from "~/lib/ui"

const { notice } = defineProps<{ notice: AdminNoticeDetail | null }>()

const TITLE_MAX = 200

interface Values {
  title: string
  body: string
  pinned: boolean
  published: boolean
}

const valuesOf = (n: AdminNoticeDetail | null): Values => ({
  title: n?.title ?? "",
  body: n?.body_html ?? "",
  pinned: n?.is_pinned ?? false,
  published: n?.is_published ?? false,
})
const sameValues = (a: Values, b: Values) =>
  a.title === b.title && a.body === b.body && a.pinned === b.pinned && a.published === b.published

const { createNotice, updateNotice, deleteNotice } = useNoticesApi()
const uploadImage = useEditorImageUpload()
// 새 공지를 처음 저장한 뒤 수정 화면으로 옮기면서 남기는 안내 — 수정 화면이 마운트될 때 꺼내 지운다.
const handoff = useState<Flash | null>("admin:notice-flash", () => null)

const values = reactive<Values>(valuesOf(notice))
const baseline = ref<Values>(valuesOf(notice))
const errors = reactive<{ title?: string, body?: string }>({})
const flash = ref<Flash | null>(handoff.value)
handoff.value = null
const confirmDelete = ref(false)
// 저장·삭제 직후의 이동은 막지 않는다.
let allowLeave = false
const titleInput = ref<HTMLInputElement | null>(null)
const ids = { title: useId(), titleErr: useId(), body: useId(), bodyErr: useId(), pubHelp: useId() }

const dirty = computed(() => !sameValues(values, baseline.value))

// ---------- 이탈 확인 ----------
const leaveDialog = ref(false)
let resolveLeave: ((ok: boolean) => void) | null = null

onBeforeRouteLeave((to, from) => {
  if (allowLeave || !dirty.value || to.path === from.path) return true
  leaveDialog.value = true
  return new Promise<boolean>((resolve) => {
    resolveLeave = resolve
  })
})
function answerLeave(ok: boolean) {
  leaveDialog.value = false
  resolveLeave?.(ok)
  resolveLeave = null
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ""
}
onMounted(() => window.addEventListener("beforeunload", onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeUnload)
  resolveLeave?.(false)
})

// ---------- 저장 ----------
function validate(): boolean {
  const title = values.title.trim()
  errors.title = !title ? "제목을 입력하세요." : title.length > TITLE_MAX ? `제목은 ${TITLE_MAX}자 이하로 입력하세요.` : undefined
  errors.body = isRichTextEmpty(values.body) ? "본문을 입력하세요." : undefined
  if (errors.title) titleInput.value?.focus()
  else if (errors.body) document.getElementById(ids.body)?.parentElement?.querySelector<HTMLElement>("[contenteditable]")?.focus()
  return !errors.title && !errors.body
}

const { run: save, isPending: saving } = useAction(async (body: NoticeWrite) => {
  const saved = notice ? await updateNotice(notice.id, body) : await createNotice(body)
  await invalidateNotices()
  return saved
})

async function onSubmit() {
  flash.value = null
  if (!validate()) return
  const submitted: Values = { ...values, title: values.title.trim() }
  try {
    const saved = await save({
      title: submitted.title,
      body_html: submitted.body,
      is_pinned: submitted.pinned,
      is_published: submitted.published,
    })
    baseline.value = submitted
    Object.assign(values, submitted)
    if (notice === null) {
      allowLeave = true
      handoff.value = { tone: "success", text: "공지를 저장했습니다. 이제 첨부 파일을 올릴 수 있습니다." }
      await navigateTo(`/admin/notices/${saved.id}/edit`, { replace: true })
    } else {
      flash.value = { tone: "success", text: saved.is_published ? "저장했습니다. 사용자 화면에 게시 중입니다." : "임시저장했습니다." }
    }
  } catch (e) {
    flash.value = { tone: "error", text: apiErrorMessage(e) }
  }
}

// ---------- 삭제 ----------
const { run: remove, isPending: removing } = useAction(async (id: number) => {
  await deleteNotice(id)
  await invalidateNotices()
})

async function onDelete() {
  if (!notice) return
  try {
    await remove(notice.id)
    allowLeave = true
    await navigateTo("/admin/notices", { replace: true })
  } catch (e) {
    confirmDelete.value = false
    flash.value = { tone: "error", text: apiErrorMessage(e) }
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader :title="notice ? '공지 수정' : '새 공지'">
      <template #description>
        <span v-if="notice" class="inline-flex flex-wrap items-center gap-2">
          <UiChip v-if="notice.is_published" tone="success">게시</UiChip>
          <UiChip v-else>임시저장</UiChip>
          #{{ notice.id }} · 작성자 {{ notice.author_username ?? "-" }} · 조회 {{ notice.view_count }}
        </span>
        <template v-else>
          제목과 본문을 쓰고 저장하세요. 첨부 파일은 처음 저장한 뒤 올릴 수 있습니다.
        </template>
      </template>
      <template #actions>
        <NuxtLink to="/admin/notices" :class="ui.btnNeutral">
          목록으로
        </NuxtLink>
        <NuxtLink v-if="notice?.is_published" :to="`/notices/${notice.id}`" :class="ui.btnNeutral">
          사용자 화면에서 보기
        </NuxtLink>
      </template>
    </LayoutPageHeader>

    <div class="flex flex-col gap-6">
      <UiNotice v-if="flash" :tone="flash.tone" @close="flash = null">
        {{ flash.text }}
      </UiNotice>

      <form novalidate :class="[ui.card, 'flex flex-col gap-5 rounded-xl p-5']" @submit.prevent="onSubmit">
        <div>
          <label :for="ids.title" :class="ui.label">제목 <span class="text-error">*</span></label>
          <input
            :id="ids.title"
            ref="titleInput"
            v-model="values.title"
            :maxlength="TITLE_MAX"
            :aria-invalid="errors.title ? true : undefined"
            :aria-describedby="errors.title ? ids.titleErr : undefined"
            aria-required="true"
            :class="ui.input"
          >
          <p v-if="errors.title" :id="ids.titleErr" :class="ui.fieldError">
            {{ errors.title }}
          </p>
        </div>

        <div>
          <p :id="ids.body" :class="[ui.label, 'mb-1']">
            본문 <span class="text-error">*</span>
          </p>
          <EditorRichTextEditor
            :initial-html="notice?.body_html ?? ''"
            :upload-image="uploadImage"
            :label-id="ids.body"
            @change="(html) => (values.body = html)"
          />
          <p v-if="errors.body" :id="ids.bodyErr" :class="ui.fieldError" role="alert">
            {{ errors.body }}
          </p>
        </div>

        <fieldset class="flex flex-col gap-1">
          <legend :class="[ui.label, 'mb-1']">
            설정
          </legend>
          <label class="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input v-model="values.pinned" type="checkbox" class="size-5 accent-primary">
            상단 고정
          </label>
          <label class="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input v-model="values.published" type="checkbox" :aria-describedby="ids.pubHelp" class="size-5 accent-primary">
            게시
          </label>
          <p :id="ids.pubHelp" :class="[ui.help, 'mt-0']">
            게시하면 사용자 화면에 보입니다. 끄면 임시저장으로 관리자만 볼 수 있습니다.
          </p>
        </fieldset>

        <div class="flex flex-wrap items-center gap-2 border-t border-surface-container pt-5">
          <button type="submit" :class="ui.btnPrimary" :disabled="saving">
            {{ saving ? "저장 중…" : "저장" }}
          </button>
          <span v-if="dirty" class="text-sm text-on-surface-variant">저장하지 않은 변경 사항이 있습니다.</span>
          <button v-if="notice" type="button" :class="[ui.btnDanger, 'ml-auto']" @click="confirmDelete = true">
            삭제
          </button>
        </div>
      </form>

      <AdminAttachmentsPanel v-if="notice" :notice-id="notice.id" />
      <p v-else :class="[ui.card, 'rounded-xl p-5 text-sm text-on-surface-variant']">
        첨부 파일은 공지를 처음 저장한 뒤 올릴 수 있습니다.
      </p>
    </div>

    <UiConfirmDialog
      v-if="confirmDelete && notice"
      title="공지를 삭제할까요?"
      confirm-label="삭제"
      danger
      :pending="removing"
      @confirm="onDelete"
      @cancel="confirmDelete = false"
    >
      “{{ notice.title }}” 과 첨부 파일 {{ notice.attachments.length }}개가 삭제되며 되돌릴 수 없습니다.
    </UiConfirmDialog>

    <UiConfirmDialog
      v-if="leaveDialog"
      title="저장하지 않고 나갈까요?"
      confirm-label="나가기"
      cancel-label="계속 작성"
      danger
      @confirm="answerLeave(true)"
      @cancel="answerLeave(false)"
    >
      저장하지 않은 변경 사항이 사라집니다.
    </UiConfirmDialog>
  </div>
</template>
