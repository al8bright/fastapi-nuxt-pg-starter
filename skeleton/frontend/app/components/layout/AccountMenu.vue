<script setup lang="ts">
// 상단 내비 오른쪽 — 비로그인: 로그인 버튼 / 로그인: 계정 메뉴(내 정보·로그아웃) + 관리자에게만 "관리자 콘솔".
// 메뉴는 디스클로저 패턴(button aria-expanded + 링크 목록). Esc·바깥 클릭으로 닫는다.
import { loginPath } from "~/lib/returnTo"
import { ui } from "~/lib/ui"

const { user, isAuthenticated } = storeToRefs(useAuthStore())
const logout = useLogout()
const route = useRoute()

const open = ref(false)
const menuId = useId()
const root = ref<HTMLDivElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)

const isAdmin = computed(() => user.value?.role === "admin")
const initials = computed(() => (user.value ? user.value.username.slice(0, 2).toUpperCase() : "··"))
// 로그인 후 지금 보던 화면으로 돌아온다.
const loginHref = computed(() => loginPath(route.fullPath))

// 페이지를 옮기면 메뉴를 닫는다.
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

function onPointer(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    open.value = false
    button.value?.focus()
  }
}
function unlisten() {
  document.removeEventListener("pointerdown", onPointer)
  document.removeEventListener("keydown", onKey)
}
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
  } else {
    unlisten()
  }
})
onBeforeUnmount(unlisten)

async function onLogout() {
  open.value = false
  await logout.mutate()
}

const menuItem = `flex min-h-11 items-center rounded px-3 text-sm hover:bg-surface-container-low ${ui.focusRing}`
</script>

<template>
  <NuxtLink v-if="!isAuthenticated" :to="loginHref" :class="ui.btnSecondary">
    로그인
  </NuxtLink>
  <div v-else class="flex items-center gap-2">
    <NuxtLink v-if="isAdmin" to="/admin" :class="[ui.btnSecondary, 'max-md:hidden']">
      <UiIcon name="shield" :size="16" />
      관리자 콘솔
    </NuxtLink>
    <div ref="root" class="relative">
      <button
        ref="button"
        type="button"
        :aria-expanded="open"
        :aria-controls="menuId"
        :aria-label="user ? `내 계정 메뉴 (${user.username})` : '내 계정 메뉴'"
        :class="[
          'flex min-h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest py-1.5 pr-3 pl-1.5 text-on-surface hover:bg-surface-container-low',
          ui.focusRing,
        ]"
        @click="open = !open"
      >
        <span class="flex size-8 items-center justify-center rounded-full bg-tertiary text-xs font-semibold text-on-primary">
          {{ initials }}
        </span>
        <span class="max-w-28 truncate text-sm font-medium max-sm:hidden">{{ user?.username ?? "계정" }}</span>
        <UiIcon name="chevronDown" :size="16" class="text-on-surface-variant" />
      </button>
      <div
        v-if="open"
        :id="menuId"
        class="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-[0_12px_40px_rgba(0,0,0,0.1)]"
      >
        <p v-if="user" class="border-b border-surface-container px-3 pt-1 pb-2 text-sm text-on-surface-variant">
          <span class="font-semibold text-on-surface">{{ user.username }}</span> ·
          {{ isAdmin ? "관리자" : "일반 사용자" }}
        </p>
        <ul class="mt-1 flex flex-col">
          <li v-if="isAdmin">
            <NuxtLink to="/admin" :class="menuItem">
              관리자 콘솔
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/me" :class="menuItem">
              내 정보
            </NuxtLink>
          </li>
          <li>
            <button
              type="button"
              :class="['flex min-h-11 w-full items-center rounded px-3 text-left text-sm text-error hover:bg-error-container', ui.focusRing]"
              @click="onLogout"
            >
              로그아웃
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
