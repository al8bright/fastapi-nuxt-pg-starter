<script setup lang="ts">
// 배너 작성(/admin/banners/new)·수정(/admin/banners/:id/edit) 폼.
// 이미지를 먼저 올려(POST /admin/banners/image, FormData `file`) key 를 받고, 저장 때 image_key 로 참조한다.
// 노출 기간은 KST 기준 datetime-local 값(초 없이)이며 서버로는 KST naive 문자열로 보낸다.
import { type BannerAdmin, type BannerWrite, useBannersApi } from "~/api/banners"
import { apiErrorMessage } from "~/lib/apiError"
import { type BannerErrors, bannerValuesOf, validateBanner } from "~/lib/bannerForm"
import { editorImageProblem } from "~/lib/editor/richText"
import { fromDateTimeLocal } from "~/lib/format"
import { LINK_URL_MAX_LENGTH } from "~/lib/linkUrl"
import { ui } from "~/lib/ui"
import { MAX_IMAGE_MB } from "~/lib/uploadRules"

const { banner } = defineProps<{ banner: BannerAdmin | null }>()

const { uploadBannerImage, createBanner, updateBanner } = useBannersApi()
const fileUrl = useFileUrl()
const values = reactive(bannerValuesOf(banner))
const errors = ref<BannerErrors>({})
const serverError = ref<string | null>(null)
const id = {
  image: useId(), imageErr: useId(), title: useId(), titleErr: useId(), alt: useId(), altErr: useId(), altHelp: useId(),
  link: useId(), linkErr: useId(), linkHelp: useId(), start: useId(), end: useId(), periodErr: useId(),
}
const describe = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined

const { run: upload, isPending: uploading } = useAction((file: File) => uploadBannerImage(file))
const { run: save, isPending: saving } = useAction(async (body: BannerWrite) => {
  const saved = banner ? await updateBanner(banner.id, body) : await createBanner(body)
  await invalidateBanners()
  return saved
})

async function onImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return
  const problem = editorImageProblem(file)
  if (problem) {
    errors.value = { ...errors.value, image: problem }
    return
  }
  errors.value = { ...errors.value, image: undefined }
  try {
    values.image = await upload(file)
  } catch (err) {
    errors.value = { ...errors.value, image: apiErrorMessage(err, { maxMb: MAX_IMAGE_MB }) }
  }
}

async function onSubmit() {
  serverError.value = null
  const next = validateBanner(values)
  errors.value = next
  const first = (["image", "title", "alt", "link", "period"] as const).find((k) => next[k])
  if (first) {
    const focusId = { image: id.image, title: id.title, alt: id.alt, link: id.link, period: id.start }[first]
    document.getElementById(focusId)?.focus()
    return
  }
  try {
    await save({
      title: values.title.trim(),
      image_key: values.image!.key,
      link_url: values.link.trim() || null,
      alt_text: values.alt.trim(),
      starts_at: fromDateTimeLocal(values.startsAt),
      ends_at: fromDateTimeLocal(values.endsAt),
      is_active: values.active,
    })
    await navigateTo("/admin/banners")
  } catch (err) {
    serverError.value = apiErrorMessage(err)
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader
      :title="banner ? '배너 수정' : '새 배너'"
      description="권장 이미지 비율 3:1(예: 1440×480). 모바일에서는 16:9 로 가운데가 잘려 보입니다."
    >
      <template #actions>
        <NuxtLink to="/admin/banners" :class="ui.btnNeutral">
          목록으로
        </NuxtLink>
      </template>
    </LayoutPageHeader>
    <form novalidate :class="[ui.card, 'flex max-w-3xl flex-col gap-5 rounded-xl p-5']" @submit.prevent="onSubmit">
      <UiNotice v-if="serverError" tone="error" :closable="false">
        {{ serverError }}
      </UiNotice>

      <div>
        <label :for="id.image" :class="ui.label">배너 이미지 <span class="text-error">*</span></label>
        <img
          v-if="values.image"
          :src="fileUrl(values.image.url)"
          alt="업로드한 배너 미리보기"
          :width="values.image.width"
          :height="values.image.height"
          class="mt-2 aspect-[3/1] w-full rounded-lg border border-outline-variant bg-surface object-cover"
        >
        <input
          :id="id.image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          :disabled="uploading"
          :aria-invalid="errors.image ? true : undefined"
          :aria-describedby="describe(!!errors.image && id.imageErr)"
          :class="[
            'mt-2 block w-full rounded text-sm text-on-surface-variant file:mr-3 file:min-h-11 file:cursor-pointer file:rounded file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-on-primary',
            ui.focusRing,
          ]"
          @change="onImage"
        >
        <p :class="ui.help">
          {{ uploading ? "이미지를 올리는 중…" : `PNG·JPEG·WebP·GIF, ${MAX_IMAGE_MB}MB 이하. ${values.image ? "다른 파일을 고르면 교체됩니다." : ""}` }}
        </p>
        <p v-if="errors.image" :id="id.imageErr" :class="ui.fieldError">
          {{ errors.image }}
        </p>
      </div>

      <div>
        <label :for="id.title" :class="ui.label">제목 <span class="text-error">*</span></label>
        <input
          :id="id.title"
          v-model="values.title"
          maxlength="200"
          :aria-invalid="errors.title ? true : undefined"
          :aria-describedby="describe(!!errors.title && id.titleErr)"
          :class="ui.input"
        >
        <p v-if="errors.title" :id="id.titleErr" :class="ui.fieldError">
          {{ errors.title }}
        </p>
      </div>

      <div>
        <label :for="id.alt" :class="ui.label">대체 텍스트 <span class="text-error">*</span></label>
        <input
          :id="id.alt"
          v-model="values.alt"
          maxlength="200"
          :aria-invalid="errors.alt ? true : undefined"
          :aria-describedby="describe(id.altHelp, !!errors.alt && id.altErr)"
          :class="ui.input"
        >
        <p :id="id.altHelp" :class="ui.help">
          화면 낭독기 사용자에게 읽히는 설명입니다. 이미지 속 문구를 그대로 적어 주세요.
        </p>
        <p v-if="errors.alt" :id="id.altErr" :class="ui.fieldError">
          {{ errors.alt }}
        </p>
      </div>

      <div>
        <label :for="id.link" :class="ui.label">링크 URL</label>
        <input
          :id="id.link"
          v-model="values.link"
          :maxlength="LINK_URL_MAX_LENGTH"
          inputmode="url"
          placeholder="/notices/1 또는 https://example.com"
          :aria-invalid="errors.link ? true : undefined"
          :aria-describedby="describe(id.linkHelp, !!errors.link && id.linkErr)"
          :class="ui.input"
        >
        <p :id="id.linkHelp" :class="ui.help">
          비우면 클릭할 수 없는 배너가 됩니다. / 로 시작하면 사이트 안에서, http(s) 주소는 새 창으로 엽니다.
        </p>
        <p v-if="errors.link" :id="id.linkErr" :class="ui.fieldError">
          {{ errors.link }}
        </p>
      </div>

      <fieldset>
        <legend :class="ui.label">
          노출 기간 (한국 시각)
        </legend>
        <div class="mt-1 grid gap-3 sm:grid-cols-2">
          <div>
            <label :for="id.start" class="text-sm text-on-surface-variant">시작</label>
            <input
              :id="id.start"
              v-model="values.startsAt"
              type="datetime-local"
              :aria-invalid="errors.period ? true : undefined"
              :aria-describedby="describe(!!errors.period && id.periodErr)"
              :class="ui.input"
            >
          </div>
          <div>
            <label :for="id.end" class="text-sm text-on-surface-variant">종료</label>
            <input
              :id="id.end"
              v-model="values.endsAt"
              type="datetime-local"
              :aria-invalid="errors.period ? true : undefined"
              :aria-describedby="describe(!!errors.period && id.periodErr)"
              :class="ui.input"
            >
          </div>
        </div>
        <p :class="ui.help">
          비우면 기간 제한 없이 노출합니다.
        </p>
        <p v-if="errors.period" :id="id.periodErr" :class="ui.fieldError">
          {{ errors.period }}
        </p>
      </fieldset>

      <label class="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input v-model="values.active" type="checkbox" class="size-5 accent-primary">
        활성 (끄면 기간과 관계없이 숨김)
      </label>

      <div class="flex gap-2 border-t border-surface-container pt-5">
        <button type="submit" :class="ui.btnPrimary" :disabled="saving || uploading">
          {{ saving ? "저장 중…" : "저장" }}
        </button>
        <NuxtLink to="/admin/banners" :class="ui.btnNeutral">
          취소
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
