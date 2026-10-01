<script setup lang="ts">
// 홈 배너 캐러셀 (WAI-ARIA APG Carousel 패턴).
// - 자동 넘김 6초. 마우스를 올리거나 안쪽에 포커스가 있으면 멈추고, 일시정지 버튼으로 끌 수 있다(WCAG 2.2.2).
// - prefers-reduced-motion 이면 자동 넘김을 하지 않는다.
// - 내부 링크(/...)는 라우터로, 외부 링크는 새 창(rel="noopener noreferrer")으로 연다.
import type { BannerPublic } from "~/api/banners"
import { isInternalLink } from "~/lib/linkUrl"
import { ui } from "~/lib/ui"

const AUTO_ADVANCE_MS = 6000

const { banners } = defineProps<{ banners: BannerPublic[] }>()
const fileUrl = useFileUrl()

const index = ref(0)
const hovered = ref(false)
const focused = ref(false)
const stopped = ref(false)
const reducedMotion = ref(false)

const count = computed(() => banners.length)
const current = computed(() => (count.value ? index.value % count.value : 0))
const autoPlay = computed(() => count.value > 1 && !stopped.value && !reducedMotion.value)
const rotating = computed(() => autoPlay.value && !hovered.value && !focused.value)

let media: MediaQueryList | null = null
const syncMotion = () => {
  reducedMotion.value = media?.matches ?? false
}
onMounted(() => {
  media = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null
  syncMotion()
  media?.addEventListener?.("change", syncMotion)
})

let timer: number | undefined
watch(
  rotating,
  (on) => {
    window.clearInterval(timer)
    timer = on ? window.setInterval(() => (index.value = (index.value + 1) % count.value), AUTO_ADVANCE_MS) : undefined
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  window.clearInterval(timer)
  media?.removeEventListener?.("change", syncMotion)
})

function go(next: number) {
  index.value = (next + count.value) % count.value
}

function onFocusOut(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) focused.value = false
}

const control = `flex size-11 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow hover:bg-surface-container-lowest ${ui.focusRing}`
const linkClass = `block size-full ${ui.focusRing} focus-visible:ring-inset`
</script>

<template>
  <section
    v-if="count > 0"
    aria-roledescription="carousel"
    aria-label="주요 배너"
    class="relative overflow-hidden rounded-xl bg-surface-container"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <div class="relative aspect-[16/9] sm:aspect-[3/1]" :aria-live="rotating ? 'off' : 'polite'">
      <div
        v-for="(banner, i) in banners"
        :key="banner.id"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${i + 1} / ${count}: ${banner.title}`"
        :hidden="i !== current"
        class="absolute inset-0"
      >
        <NuxtLink v-if="banner.link_url && isInternalLink(banner.link_url)" :to="banner.link_url" :class="linkClass">
          <img
            :src="fileUrl(banner.image_url)"
            :alt="banner.alt_text || banner.title"
            :width="banner.width"
            :height="banner.height"
            :loading="i === 0 ? 'eager' : 'lazy'"
            class="size-full object-cover"
          >
        </NuxtLink>
        <a v-else-if="banner.link_url" :href="banner.link_url" target="_blank" rel="noopener noreferrer" :class="linkClass">
          <img
            :src="fileUrl(banner.image_url)"
            :alt="banner.alt_text || banner.title"
            :width="banner.width"
            :height="banner.height"
            :loading="i === 0 ? 'eager' : 'lazy'"
            class="size-full object-cover"
          >
          <span class="sr-only">(새 창에서 열림)</span>
        </a>
        <img
          v-else
          :src="fileUrl(banner.image_url)"
          :alt="banner.alt_text || banner.title"
          :width="banner.width"
          :height="banner.height"
          :loading="i === 0 ? 'eager' : 'lazy'"
          class="size-full object-cover"
        >
      </div>
    </div>

    <template v-if="count > 1">
      <button type="button" :class="[control, 'absolute top-1/2 left-3 -translate-y-1/2']" aria-label="이전 배너" @click="go(current - 1)">
        <UiIcon name="chevronLeft" />
      </button>
      <button type="button" :class="[control, 'absolute top-1/2 right-3 -translate-y-1/2']" aria-label="다음 배너" @click="go(current + 1)">
        <UiIcon name="chevronRight" />
      </button>
      <div class="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1">
        <button
          v-if="!reducedMotion"
          type="button"
          :class="[control, 'size-9 min-h-9']"
          :aria-label="stopped ? '자동 넘김 시작' : '자동 넘김 멈춤'"
          @click="stopped = !stopped"
        >
          <UiIcon :name="stopped ? 'play' : 'pause'" :size="14" />
        </button>
        <button
          v-for="(banner, i) in banners"
          :key="banner.id"
          type="button"
          :aria-label="`${i + 1}번째 배너 보기: ${banner.title}`"
          :aria-current="i === current ? 'true' : undefined"
          :class="['flex size-11 items-center justify-center rounded-full', ui.focusRing]"
          @click="go(i)"
        >
          <span
            aria-hidden="true"
            class="block h-2.5 rounded-full border border-on-surface/40 transition-all"
            :class="i === current ? 'w-6 bg-primary' : 'w-2.5 bg-surface-container-lowest'"
          />
        </button>
      </div>
    </template>
  </section>
</template>
