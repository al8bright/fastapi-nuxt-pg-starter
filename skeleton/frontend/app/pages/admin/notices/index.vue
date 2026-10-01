<script setup lang="ts">
// 관리자 공지 목록 — 임시저장 포함, 제목 검색·페이지(URL 쿼리), 게시 상태·고정·첨부 표시.
import { formatDate, formatDateTime, formatNumber } from "~/lib/format"
import { ui } from "~/lib/ui"

definePageMeta({ layout: "admin", middleware: "admin" })

const PAGE_SIZE = 20

const { page, q, update } = useListParams()
const { data, status, refresh } = useAdminNotices(() => ({ page: page.value, size: PAGE_SIZE, q: q.value }))
const loading = computed(() => isLoadingStatus(status.value) && !data.value)
const description = computed(() =>
  data.value ? `${q.value ? `“${q.value}” 검색 결과 ` : "전체 "}${formatNumber(data.value.total)}건` : "공지 작성·게시 관리",
)
</script>

<template>
  <div>
    <LayoutPageHeader title="공지사항" :description="description">
      <template #actions>
        <NuxtLink to="/admin/notices/new" :class="ui.btnPrimary">
          새 공지
        </NuxtLink>
      </template>
    </LayoutPageHeader>
    <div class="mb-4">
      <UiSearchForm :key="q" label="공지 제목 검색" :initial="q" @search="(value) => update({ q: value })" />
    </div>

    <UiLoading v-if="loading" />
    <UiErrorState v-else-if="status === 'error'" message="공지 목록을 불러오지 못했습니다." @retry="refresh()" />
    <UiEmptyState v-else-if="data && data.items.length === 0">
      {{ q ? "검색 결과가 없습니다." : "아직 작성한 공지가 없습니다. ‘새 공지’로 시작하세요." }}
    </UiEmptyState>
    <div v-else-if="data" :class="[ui.card, 'overflow-x-auto']">
      <table class="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th scope="col" :class="ui.th">
              제목
            </th>
            <th scope="col" :class="ui.th">
              상태
            </th>
            <th scope="col" :class="ui.th">
              게시일
            </th>
            <th scope="col" :class="[ui.th, 'text-right']">
              조회
            </th>
            <th scope="col" :class="ui.th">
              작성자
            </th>
            <th scope="col" :class="ui.th">
              수정
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in data.items" :key="n.id" class="hover:bg-surface-container-low">
            <td :class="ui.td">
              <span class="flex items-center gap-2">
                <UiChip v-if="n.is_pinned" tone="primary">고정</UiChip>
                <NuxtLink :to="`/admin/notices/${n.id}/edit`" :class="[ui.link, 'font-medium text-on-surface']">
                  {{ n.title }}
                </NuxtLink>
                <span v-if="n.has_attachments" class="text-on-surface-variant" title="첨부 파일 있음">
                  <UiIcon name="clip" :size="16" />
                  <span class="sr-only">(첨부 파일 있음)</span>
                </span>
              </span>
            </td>
            <td :class="ui.td">
              <UiChip v-if="n.is_published" tone="success">
                게시
              </UiChip>
              <UiChip v-else>
                임시저장
              </UiChip>
            </td>
            <td :class="[ui.td, 'text-on-surface-variant']">
              {{ formatDate(n.published_at) }}
            </td>
            <td :class="[ui.td, 'text-right text-on-surface-variant']">
              {{ formatNumber(n.view_count) }}
            </td>
            <td :class="[ui.td, 'text-on-surface-variant']">
              {{ n.author_username ?? "-" }}
            </td>
            <td :class="[ui.td, 'whitespace-nowrap text-on-surface-variant']">
              {{ formatDateTime(n.updated_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="data" class="mt-6">
      <UiPagination :page="page" :size="PAGE_SIZE" :total="data.total" @change="(p) => update({ page: p })" />
    </div>
  </div>
</template>
