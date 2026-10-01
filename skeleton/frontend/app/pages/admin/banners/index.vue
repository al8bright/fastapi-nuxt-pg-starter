<script setup lang="ts">
// 배너 목록 — 썸네일·제목·노출 기간·활성 토글(PUT 전체 본문)·순서 이동(PATCH order)·삭제.
import { type BannerAdmin, bannerToWrite, useBannersApi } from "~/api/banners"
import { apiErrorMessage } from "~/lib/apiError"
import { formatDateTime } from "~/lib/format"
import { type Flash, ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const { data: banners, status, refresh } = useAdminBanners()
const { updateBanner, reorderBanners, deleteBanner } = useBannersApi()
const fileUrl = useFileUrl()
const message = ref<Flash | null>(null)
const deleting = ref<BannerAdmin | null>(null)
const loading = computed(() => isLoadingStatus(status.value) && !banners.value)
const onError = (err: unknown) => {
  message.value = { tone: "error", text: apiErrorMessage(err) }
}

function period(b: BannerAdmin): string {
  if (!b.starts_at && !b.ends_at) return "기간 제한 없음"
  return `${b.starts_at ? formatDateTime(b.starts_at) : "처음부터"} ~ ${b.ends_at ? formatDateTime(b.ends_at) : "계속"}`
}

/** 활성 토글 — PUT 전체 본문. 목록을 낙관적으로 바꾸고 실패하면 되돌린다. */
async function toggle(banner: BannerAdmin) {
  const previous = banners.value
  banners.value = previous?.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
  try {
    await updateBanner(banner.id, { ...bannerToWrite(banner), is_active: !banner.is_active })
  } catch (err) {
    banners.value = previous
    onError(err)
  } finally {
    await invalidateBanners()
  }
}

const { run: reorder, isPending: reordering } = useAction(async (ids: number[]) => {
  banners.value = await reorderBanners(ids)
  await invalidateBanners()
})

async function move(index: number, delta: -1 | 1) {
  const list = banners.value
  if (!list) return
  const ids = list.map((b) => b.id)
  const target = index + delta
  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  const title = list[index]?.title
  try {
    await reorder(ids)
    message.value = { tone: "success", text: `“${title}” 의 순서를 바꿨습니다.` }
  } catch (err) {
    onError(err)
  }
}

const { run: remove, isPending: removing } = useAction(async (id: number) => {
  await deleteBanner(id)
  await invalidateBanners()
})

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  try {
    await remove(target.id)
    message.value = { tone: "success", text: `“${target.title}” 배너를 삭제했습니다.` }
  } catch (err) {
    onError(err)
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div>
    <LayoutPageHeader title="배너" description="홈 화면 캐러셀에 노출 순서대로 보입니다. 활성이고 노출 기간 안인 배너만 보입니다.">
      <template #actions>
        <NuxtLink to="/admin/banners/new" :class="ui.btnPrimary">
          새 배너
        </NuxtLink>
      </template>
    </LayoutPageHeader>
    <div class="flex flex-col gap-4">
      <UiNotice v-if="message" :tone="message.tone" @close="message = null">
        {{ message.text }}
      </UiNotice>
      <UiLoading v-if="loading" />
      <UiErrorState v-else-if="status === 'error'" message="배너 목록을 불러오지 못했습니다." @retry="refresh()" />
      <UiEmptyState v-else-if="banners && banners.length === 0">
        등록된 배너가 없습니다. 배너가 없으면 홈 화면에 기본 히어로가 보입니다.
      </UiEmptyState>
      <ol v-else-if="banners" class="flex flex-col gap-3" aria-label="배너 노출 순서">
        <li v-for="(b, i) in banners" :key="b.id" :class="[ui.card, 'flex flex-col gap-3 p-3 sm:flex-row sm:items-center']">
          <img
            :src="fileUrl(b.image_url)"
            alt=""
            :width="b.image_width"
            :height="b.image_height"
            loading="lazy"
            class="aspect-[3/1] w-full rounded bg-surface object-cover sm:w-40"
          >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="flex items-center gap-2">
              <span class="text-xs font-semibold text-on-surface-variant">{{ i + 1 }}</span>
              <NuxtLink :to="`/admin/banners/${b.id}/edit`" :class="[ui.link, 'truncate font-medium text-on-surface']">
                {{ b.title }}
              </NuxtLink>
            </span>
            <span class="text-sm text-on-surface-variant">{{ period(b) }}</span>
            <span v-if="b.link_url" class="truncate text-sm text-on-surface-variant">링크: {{ b.link_url }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <button
              type="button"
              role="switch"
              :aria-checked="b.is_active"
              :aria-label="`${b.title} 활성`"
              :class="[ui.btnSmall, 'gap-2 text-on-surface hover:bg-surface-container-low']"
              @click="toggle(b)"
            >
              <span aria-hidden="true" class="relative inline-block h-6 w-10 rounded-full transition-colors" :class="b.is_active ? 'bg-primary' : 'bg-outline'">
                <span
                  class="absolute top-0.5 size-5 rounded-full bg-surface-container-lowest transition-all"
                  :class="b.is_active ? 'left-[18px]' : 'left-0.5'"
                />
              </span>
              {{ b.is_active ? "활성" : "비활성" }}
            </button>
            <button
              type="button"
              :class="[ui.btnSmall, 'min-w-11 text-on-surface-variant hover:bg-surface-container-low']"
              :disabled="i === 0 || reordering"
              :aria-label="`${b.title} 위로 이동`"
              @click="move(i, -1)"
            >
              <UiIcon name="up" />
            </button>
            <button
              type="button"
              :class="[ui.btnSmall, 'min-w-11 text-on-surface-variant hover:bg-surface-container-low']"
              :disabled="i === banners.length - 1 || reordering"
              :aria-label="`${b.title} 아래로 이동`"
              @click="move(i, 1)"
            >
              <UiIcon name="down" />
            </button>
            <NuxtLink :to="`/admin/banners/${b.id}/edit`" :class="[ui.btnSmall, 'text-primary hover:bg-primary-fixed']">
              수정<span class="sr-only"> ({{ b.title }})</span>
            </NuxtLink>
            <button type="button" :class="[ui.btnSmall, 'text-error hover:bg-error-container']" @click="deleting = b">
              삭제<span class="sr-only"> ({{ b.title }})</span>
            </button>
          </div>
        </li>
      </ol>
    </div>

    <UiConfirmDialog
      v-if="deleting"
      title="배너를 삭제할까요?"
      confirm-label="삭제"
      danger
      :pending="removing"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      “{{ deleting.title }}” 배너와 이미지가 삭제되며 되돌릴 수 없습니다.
    </UiConfirmDialog>
  </div>
</template>
