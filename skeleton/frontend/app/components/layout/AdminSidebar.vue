<script setup lang="ts">
// 관리자 사이드바 — 그룹 라벨 + 메뉴, 현재 메뉴는 aria-current="page" + 강조 배경.
// "로그인 잠금" 에는 잠긴 계정 수 배지(대시보드 집계)를 붙인다.
import { ADMIN_NAV, isNavActive } from "~/lib/adminNav"
import { SITE_MARK } from "~/lib/site"
import { ui } from "~/lib/ui"

const { user } = storeToRefs(useAuthStore())
const { data: dashboard } = useDashboard()
const locked = computed(() => dashboard.value?.locked_accounts ?? 0)
const route = useRoute()
// 넓은 화면 사이드바와 좁은 화면 서랍이 동시에 그려질 수 있어 id 가 겹치지 않게 접두사를 둔다.
const idPrefix = useId()

const itemClass = (active: boolean) => [
  "flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 text-[15px]",
  ui.focusRing,
  active
    ? "border-primary bg-primary-fixed font-semibold text-primary"
    : "border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
]
</script>

<template>
  <div class="flex h-full flex-col gap-6 px-4 py-5">
    <NuxtLink to="/admin" :class="['flex min-h-11 items-center gap-2.5 rounded px-2 text-base font-bold text-on-surface', ui.focusRing]">
      <span aria-hidden="true" class="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-on-primary">
        {{ SITE_MARK }}
      </span>
      관리자 콘솔
    </NuxtLink>

    <nav aria-label="관리자 메뉴" class="flex flex-col gap-4">
      <div v-for="(group, gi) in ADMIN_NAV" :key="group.label" class="flex flex-col gap-0.5">
        <p :id="`${idPrefix}-group-${gi}`" class="px-3 pb-1.5 text-xs font-semibold tracking-wider text-outline">
          {{ group.label }}
        </p>
        <ul :aria-labelledby="`${idPrefix}-group-${gi}`" class="flex flex-col gap-0.5">
          <li v-for="item in group.items" :key="item.to">
            <!-- aria-current 는 직접 정한다 — 대시보드(/admin)만 정확히 일치, 나머지는 하위 경로도 활성. -->
            <NuxtLink
              :to="item.to"
              :class="itemClass(isNavActive(item, route.path))"
              :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
              active-class=""
              exact-active-class=""
            >
              <UiIcon :name="item.icon" />
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.badge === 'locked' && locked > 0"
                class="rounded-full bg-error-container px-2 py-0.5 text-xs font-semibold text-on-error-container"
              >
                {{ locked }}<span class="sr-only">개 계정 잠김</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="mt-auto flex flex-col gap-2 border-t border-surface-container-highest pt-4">
      <NuxtLink
        to="/"
        :class="[
          'flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
          ui.focusRing,
        ]"
      >
        <UiIcon name="back" />
        사용자 화면으로
      </NuxtLink>
      <p class="px-3 py-2 text-[13px] text-on-surface-variant">
        {{ user ? `${user.username} · 관리자` : "관리자" }}
      </p>
    </div>
  </div>
</template>
