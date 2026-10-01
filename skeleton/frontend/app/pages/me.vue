<script setup lang="ts">
// 내 정보 화면 (ARCHITECTURE.md §14) — 사용자 레이아웃 안, 로그인 필요(auth 미들웨어).
import { ui } from "~/lib/ui"

definePageMeta({ middleware: "auth" })

const { data: me, status } = useMe()
const logout = useLogout()
const isPending = computed(() => isLoadingStatus(status.value))
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12">
    <section :class="[ui.card, 'rounded-xl p-8']">
      <h1 class="text-2xl font-semibold text-on-surface">
        내 정보
      </h1>

      <p v-if="isPending" class="mt-4 text-on-surface-variant" role="status">
        불러오는 중…
      </p>
      <dl v-else class="mt-4 space-y-3">
        <div class="flex justify-between border-b border-outline-variant pb-2">
          <dt class="text-on-surface-variant">
            아이디
          </dt>
          <dd class="font-medium text-on-surface">
            {{ me?.username }}
          </dd>
        </div>
        <div class="flex justify-between border-b border-outline-variant pb-2">
          <dt class="text-on-surface-variant">
            권한
          </dt>
          <dd class="font-medium text-on-surface">
            {{ me?.role === "admin" ? "관리자" : "일반 사용자" }}
          </dd>
        </div>
      </dl>

      <div class="mt-6 flex flex-col gap-3">
        <NuxtLink v-if="me?.role === 'admin'" to="/admin" :class="ui.btnSecondary">
          관리자 콘솔로 이동
        </NuxtLink>
        <button type="button" :class="ui.btnDanger" @click="logout.mutate()">
          로그아웃
        </button>
      </div>
    </section>
  </div>
</template>
