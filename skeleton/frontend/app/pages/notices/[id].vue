<script setup lang="ts">
// 공개 공지 상세 — 제목·게시일·조회수, 서버가 정화한 본문(RichContent), 첨부 다운로드, 목록으로.
import { apiErrorStatus } from "~/lib/apiError"
import { formatBytes, formatDate, formatNumber } from "~/lib/format"
import { ui } from "~/lib/ui"

const route = useRoute()
const noticeId = computed(() => Number(route.params.id))
const valid = computed(() => Number.isInteger(noticeId.value) && noticeId.value > 0)
const { data: notice, status, error, refresh } = usePublicNotice(() => noticeId.value)
const fileUrl = useFileUrl()

// 목록에서 왔으면 그 목록(검색어·페이지)으로 돌아간다 — 목록이 history state 로 넘긴다.
const listSearch = import.meta.client ? ((window.history.state as { listSearch?: unknown } | null)?.listSearch ?? "") : ""
const backTo = `/notices${typeof listSearch === "string" && listSearch.startsWith("?") ? listSearch : ""}`

const notFound = computed(() => !valid.value || (status.value === "error" && apiErrorStatus(error.value) === 404))
const loading = computed(() => isLoadingStatus(status.value) && !notice.value)
</script>

<template>
  <div v-if="notFound" class="mx-auto max-w-[960px] px-4 py-16 text-center sm:px-6">
    <h1 class="text-2xl font-semibold">
      공지사항을 찾을 수 없습니다
    </h1>
    <p class="mt-3 text-on-surface-variant">
      삭제되었거나 게시가 중단된 공지입니다.
    </p>
    <div class="mt-6">
      <NuxtLink :to="backTo" :class="ui.btnNeutral">
        <UiIcon name="back" :size="16" />
        목록으로
      </NuxtLink>
    </div>
  </div>
  <div v-else class="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
    <UiLoading v-if="loading" />
    <UiErrorState v-else-if="status === 'error'" message="공지사항을 불러오지 못했습니다." @retry="refresh()" />
    <article v-if="notice" :class="[ui.card, 'rounded-xl']">
      <header class="border-b border-surface-container px-5 py-6 sm:px-8">
        <div v-if="notice.is_pinned" class="mb-2">
          <UiChip tone="primary">
            고정
          </UiChip>
        </div>
        <h1 class="text-2xl leading-8 font-semibold tracking-tight break-words">
          {{ notice.title }}
        </h1>
        <dl class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
          <div class="flex gap-1.5">
            <dt>게시일</dt>
            <dd class="text-on-surface">
              {{ formatDate(notice.published_at) }}
            </dd>
          </div>
          <div class="flex gap-1.5">
            <dt>조회수</dt>
            <dd class="text-on-surface">
              {{ formatNumber(notice.view_count) }}
            </dd>
          </div>
        </dl>
      </header>

      <RichContent :html="notice.body_html" class="px-5 py-8 sm:px-8" />

      <section
        v-if="notice.attachments.length > 0"
        aria-labelledby="notice-attachments"
        class="border-t border-surface-container px-5 py-6 sm:px-8"
      >
        <h2 id="notice-attachments" class="text-base font-semibold">
          첨부 파일 <span class="text-on-surface-variant">({{ notice.attachments.length }})</span>
        </h2>
        <ul class="mt-3 flex flex-col gap-2">
          <li v-for="a in notice.attachments" :key="a.id">
            <!-- 공개 다운로드는 인증이 필요 없다 — 백엔드가 Content-Disposition 으로 원래 파일명을 준다. -->
            <a
              :href="fileUrl(a.download_url)"
              :download="a.original_name"
              :class="['flex min-h-11 items-center gap-3 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low', ui.focusRing]"
            >
              <UiIcon name="download" :size="16" class="text-primary" />
              <span class="min-w-0 flex-1 truncate font-medium">{{ a.original_name }}</span>
              <span class="shrink-0 text-on-surface-variant">{{ formatBytes(a.size_bytes) }}</span>
              <span class="sr-only">다운로드</span>
            </a>
          </li>
        </ul>
      </section>
    </article>
    <div class="mt-6">
      <NuxtLink :to="backTo" :class="ui.btnNeutral">
        <UiIcon name="back" :size="16" />
        목록으로
      </NuxtLink>
    </div>
  </div>
</template>
