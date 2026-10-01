<script setup lang="ts">
// 사용자 화면 레이아웃 (디자인 A — 상단 내비 포털). 로그인 없이 볼 수 있는 공개 화면의 틀이다.
// 좁은 화면(<768px)에서는 내비가 두 번째 줄로 내려가고 가로로 스크롤된다.
// 페이지가 layout 을 지정하지 않으면 이 레이아웃을 쓴다(로그인은 layout: false, 관리자는 layout: "admin").
import { SITE_MARK, SITE_NAME } from "~/lib/site"
import { ui } from "~/lib/ui"

const route = useRoute()

const NAV = [
  { to: "/", label: "홈", exact: true },
  { to: "/notices", label: "공지사항", exact: false },
  // 자리표시 메뉴 — 프로젝트에 맞게 실제 화면으로 바꾼다.
  { to: "/#services", label: "서비스", placeholder: true },
  { to: "/#support", label: "고객지원", placeholder: true },
] as const

function isActive(item: (typeof NAV)[number]): boolean {
  if ("placeholder" in item) return false
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`)
}

const navClass = (active: boolean) => [
  "flex min-h-11 shrink-0 items-center rounded-lg px-3.5 text-[15px] whitespace-nowrap",
  ui.focusRing,
  active ? "bg-primary-fixed font-semibold text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-on-surface">
    <LayoutSkipLink target="main" />
    <header class="border-b border-surface-container-highest bg-surface-container-lowest">
      <div class="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-1 px-4 py-2 sm:px-6 md:h-16 md:flex-nowrap md:py-0">
        <NuxtLink to="/" :class="['flex min-h-11 items-center gap-2.5 rounded text-lg font-bold text-on-surface', ui.focusRing]">
          <span aria-hidden="true" class="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-on-primary">
            {{ SITE_MARK }}
          </span>
          {{ SITE_NAME }}
        </NuxtLink>
        <nav
          aria-label="주 메뉴"
          class="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1 md:order-none md:w-auto md:flex-1 md:pb-0"
        >
          <NuxtLink
            v-for="item in NAV"
            :key="item.label"
            :to="item.to"
            :class="navClass(isActive(item))"
            :aria-current="isActive(item) ? 'page' : undefined"
            active-class=""
            exact-active-class=""
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="ml-auto md:ml-0">
          <LayoutAccountMenu />
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="flex-1 outline-none">
      <slot />
    </main>

    <footer id="support" class="border-t border-surface-container-highest bg-surface-container-lowest">
      <div class="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-6 text-[13px] text-on-surface-variant sm:flex-row sm:justify-between sm:px-6">
        <span>© {{ SITE_NAME }}</span>
        <span>이용약관 · 개인정보처리방침</span>
      </div>
    </footer>
  </div>
</template>
