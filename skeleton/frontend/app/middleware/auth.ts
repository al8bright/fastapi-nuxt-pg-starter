import { getToken } from "~/lib/token"

// 보호 라우트 가드 (architecture.md §14). 미인증 시 로그인 화면으로 보낸다.
// 각 페이지가 definePageMeta({ middleware: "auth" }) 로 이 가드를 지정한다 — /, /landing, /my.
// prerender/서버 단계에서는 localStorage 가 없으므로 아무것도 하지 않고 빈 셸만 만든다.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  if (!getToken() && to.path !== "/login") return navigateTo("/login", { replace: true })
})
