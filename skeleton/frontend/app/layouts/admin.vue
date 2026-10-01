<script setup lang="ts">
// 관리자 콘솔 레이아웃 (디자인 A — 그룹형 사이드바 콘솔). /admin/** 페이지가 layout: "admin" 으로 쓴다.
// ≥1024px: 248px 고정 사이드바 + 본문. 그보다 좁으면 상단 바의 "메뉴" 버튼이 사이드바를 위에서 펼친다.
import { ui } from "~/lib/ui"

const route = useRoute()
const drawerOpen = ref(false)
const drawer = ref<HTMLDivElement | null>(null)
const toggle = ref<HTMLButtonElement | null>(null)

// 이동하면 서랍을 닫는다.
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") drawerOpen.value = false
}

watch(drawerOpen, async (open) => {
  if (open) {
    document.addEventListener("keydown", onKey)
    await nextTick()
    drawer.value?.querySelector<HTMLElement>("a, button")?.focus()
  } else {
    document.removeEventListener("keydown", onKey)
    toggle.value?.focus({ preventScroll: true })
  }
})
onBeforeUnmount(() => document.removeEventListener("keydown", onKey))
</script>

<template>
  <div class="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <LayoutSkipLink target="admin-main" />

    <!-- 넓은 화면 — 고정 사이드바 -->
    <aside class="border-r border-surface-container-highest bg-surface-container-lowest max-lg:hidden">
      <div class="sticky top-0 h-screen overflow-y-auto">
        <LayoutAdminSidebar />
      </div>
    </aside>

    <!-- 좁은 화면 — 상단 바 + 서랍 -->
    <div class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-surface-container-highest bg-surface-container-lowest px-2 lg:hidden">
      <button
        ref="toggle"
        type="button"
        :aria-expanded="drawerOpen"
        aria-controls="admin-drawer"
        :class="[ui.btnSmall, 'gap-2 text-on-surface hover:bg-surface-container-low']"
        @click="drawerOpen = !drawerOpen"
      >
        <UiIcon :name="drawerOpen ? 'close' : 'menu'" />
        {{ drawerOpen ? "메뉴 닫기" : "메뉴" }}
      </button>
      <span class="pr-3 text-sm font-semibold">관리자 콘솔</span>
    </div>
    <template v-if="drawerOpen">
      <div class="fixed inset-0 top-14 z-20 bg-black/30 lg:hidden" aria-hidden="true" @click="drawerOpen = false" />
      <div
        id="admin-drawer"
        ref="drawer"
        class="fixed inset-x-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-surface-container-highest bg-surface-container-lowest shadow-[0_12px_40px_rgba(0,0,0,0.1)] lg:hidden"
      >
        <LayoutAdminSidebar />
      </div>
    </template>

    <main id="admin-main" tabindex="-1" class="min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8">
      <slot />
    </main>
  </div>
</template>
