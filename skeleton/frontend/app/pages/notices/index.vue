<script setup lang="ts">
// 공개 공지 목록 — 고정 공지 우선, 제목 검색, 페이지 이동(page·q 는 URL 쿼리에).
import { formatDate, formatNumber } from "~/lib/format"
import { ui } from "~/lib/ui"

const PAGE_SIZE = 10

const { page, q, update } = useListParams()
const route = useRoute()
const { data, status, refresh } = usePublicNotices(() => ({ page: page.value, size: PAGE_SIZE, q: q.value }))
const loading = computed(() => isLoadingStatus(status.value) && !data.value)
// 상세에서 "목록으로" 를 누르면 지금의 검색어·페이지로 돌아오도록 넘긴다(history state).
const listSearch = computed(() => route.fullPath.slice(route.path.length))
</script>

<template>
  <div class="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight sm:text-[32px] sm:leading-10">
          공지사항
        </h1>
        <p v-if="data" class="mt-1 text-sm text-on-surface-variant" aria-live="polite">
          {{ q ? `“${q}” 검색 결과 ` : "전체 " }}{{ formatNumber(data.total) }}건
        </p>
      </div>
      <UiSearchForm :key="q" label="공지 제목 검색" :initial="q" @search="(value) => update({ q: value })" />
    </div>

    <UiLoading v-if="loading" />
    <UiErrorState v-else-if="status === 'error'" message="공지사항을 불러오지 못했습니다." @retry="refresh()" />
    <UiEmptyState v-else-if="data && data.items.length === 0">
      {{ q ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다." }}
    </UiEmptyState>
    <ul v-else-if="data" :class="[ui.card, 'divide-y divide-surface-container']">
      <li v-for="n in data.items" :key="n.id" :class="n.is_pinned ? 'bg-surface-container-low' : undefined">
        <NuxtLink
          :to="{ path: `/notices/${n.id}`, state: { listSearch } }"
          :class="[
            'flex min-h-14 flex-col gap-1 px-4 py-3 hover:bg-surface-container-low sm:flex-row sm:items-center sm:gap-4 sm:px-5',
            ui.focusRing,
            'focus-visible:ring-inset',
          ]"
        >
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <UiChip v-if="n.is_pinned" tone="primary">고정</UiChip>
            <span class="truncate font-medium text-on-surface">{{ n.title }}</span>
            <span v-if="n.has_attachments" class="text-on-surface-variant" title="첨부 파일 있음">
              <UiIcon name="clip" :size="16" />
              <span class="sr-only">(첨부 파일 있음)</span>
            </span>
          </span>
          <span class="flex shrink-0 gap-3 text-sm text-on-surface-variant">
            <span>{{ formatDate(n.published_at) }}</span>
            <span>조회 {{ formatNumber(n.view_count) }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <div v-if="data" class="mt-6">
      <UiPagination :page="page" :size="PAGE_SIZE" :total="data.total" @change="(p) => update({ page: p })" />
    </div>
  </div>
</template>
