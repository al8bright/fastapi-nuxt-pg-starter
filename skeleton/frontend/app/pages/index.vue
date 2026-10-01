<script setup lang="ts">
// 공개 첫 화면 (디자인 A) — 로그인 없이 볼 수 있다.
// 배너(없으면 히어로) → 주요 서비스 → 최신 공지 5건 + 내 계정.
import { formatDate } from "~/lib/format"
import { loginPath } from "~/lib/returnTo"
import { SITE_NAME } from "~/lib/site"
import { ui } from "~/lib/ui"

// 자리표시 서비스 카드 — 프로젝트에 맞게 바꾼다.
const SERVICES = [
  { title: "[서비스 1]", body: "[서비스 1 설명 — 한두 문장]" },
  { title: "[서비스 2]", body: "[서비스 2 설명 — 한두 문장]" },
  { title: "[서비스 3]", body: "[서비스 3 설명 — 한두 문장]" },
]

const { data: banners, status: bannerStatus } = usePublicBanners()
const { data: notices, status: noticeStatus } = usePublicNotices(() => ({ page: 1, size: 5 }))
const { user, isAuthenticated } = storeToRefs(useAuthStore())
const route = useRoute()

// 첫 로딩 동안은 같은 높이의 자리만 잡는다(히어로 → 배너로 번쩍 바뀌지 않게).
const bannersLoading = computed(() => isLoadingStatus(bannerStatus.value))
const noticesLoading = computed(() => isLoadingStatus(noticeStatus.value))
</script>

<template>
  <div>
    <div v-if="bannersLoading" class="h-[420px] bg-surface-container-low" aria-hidden="true" />
    <!-- 배너가 없거나 조회에 실패하면 기본 히어로. -->
    <HomeHero v-else-if="!banners?.length" />
    <div v-else class="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
      <h1 class="sr-only">
        {{ SITE_NAME }}
      </h1>
      <BannerCarousel :banners="banners" />
    </div>

    <section id="services" aria-labelledby="home-services" class="mx-auto flex max-w-[1200px] scroll-mt-4 flex-col gap-6 px-4 py-12 sm:px-6">
      <div class="flex items-end justify-between">
        <h2 id="home-services" class="text-2xl font-semibold">
          주요 서비스
        </h2>
      </div>
      <div class="grid gap-5 md:grid-cols-3">
        <article v-for="card in SERVICES" :key="card.title" :class="[ui.card, 'flex flex-col gap-3 rounded-xl p-6']">
          <span class="flex size-10 items-center justify-center rounded-[10px] bg-primary-fixed text-primary">
            <UiIcon name="card" :size="20" />
          </span>
          <h3 class="text-lg font-semibold">
            {{ card.title }}
          </h3>
          <p class="text-[15px] leading-6 text-on-surface-variant">
            {{ card.body }}
          </p>
        </article>
      </div>
    </section>

    <div class="mx-auto grid max-w-[1200px] gap-5 px-4 pb-14 sm:px-6 md:grid-cols-2">
      <section aria-labelledby="home-notices" :class="[ui.card, 'flex flex-col gap-3 rounded-xl p-6']">
        <div class="flex items-center justify-between">
          <h2 id="home-notices" class="text-lg font-semibold">
            공지사항
          </h2>
          <NuxtLink to="/notices" :class="[ui.link, 'text-sm font-medium']">
            전체 보기
          </NuxtLink>
        </div>
        <p v-if="noticesLoading" class="py-3 text-sm text-on-surface-variant">
          불러오는 중…
        </p>
        <p v-else-if="noticeStatus === 'error'" class="py-3 text-sm text-on-surface-variant">
          공지사항을 불러오지 못했습니다.
        </p>
        <p v-else-if="notices && notices.items.length === 0" class="py-3 text-sm text-on-surface-variant">
          등록된 공지사항이 없습니다.
        </p>
        <ul v-else-if="notices">
          <li v-for="n in notices.items" :key="n.id" class="border-t border-surface-container">
            <NuxtLink
              :to="`/notices/${n.id}`"
              :class="['flex min-h-11 items-center justify-between gap-4 py-3 text-[15px] text-on-surface hover:text-primary', ui.focusRing]"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span v-if="n.is_pinned" class="shrink-0 text-xs font-semibold text-primary">[고정]</span>
                <span class="truncate">{{ n.title }}</span>
              </span>
              <span class="shrink-0 text-sm text-on-surface-variant">{{ formatDate(n.published_at) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section aria-labelledby="home-account" :class="[ui.card, 'flex flex-col gap-4 rounded-xl p-6']">
        <h2 id="home-account" class="text-lg font-semibold">
          내 계정
        </h2>
        <template v-if="isAuthenticated && user">
          <p class="text-[15px] text-on-surface-variant">
            {{ user.username }} 님으로 로그인되어 있습니다. 권한:
            <strong class="text-primary">{{ user.role === "admin" ? "관리자" : "일반 사용자" }}</strong>
          </p>
          <div class="flex flex-wrap gap-3">
            <NuxtLink v-if="user.role === 'admin'" to="/admin" :class="ui.btnPrimary">
              관리자 콘솔로 이동
            </NuxtLink>
            <NuxtLink to="/me" :class="ui.btnNeutral">
              내 정보
            </NuxtLink>
          </div>
        </template>
        <template v-else>
          <p class="text-[15px] text-on-surface-variant">
            로그인하면 내 정보와 계정 기능을 이용할 수 있습니다.
          </p>
          <div>
            <NuxtLink :to="loginPath(route.fullPath)" :class="ui.btnPrimary">
              로그인
            </NuxtLink>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
