---
name: add-frontend-feature
description: __PROJECT_NAME__ 프론트엔드에 기능·페이지·API 호출을 추가할 때 사용. $fetch(ofetch) + Nuxt useAsyncData/useFetch + Pinia 표준(app/api/<domain>.ts → app/composables → app/pages·app/components)과 보호 라우트(middleware)/인증 흐름을 ARCHITECTURE.md §13·§14 기준으로 안내한다.
---

# 프론트엔드 기능 추가

표준 스택: **`$fetch`(ofetch) + Nuxt 내장 `useAsyncData`/`useFetch` + Pinia** (ARCHITECTURE.md §13). 패키지 매니저는 **pnpm**(⛔ npm 금지).
프레임워크는 **Nuxt(SPA 모드)** — `ssr: false` + `nuxt generate` 정적 산출. 서버 전용 기능은 쓰지 않는다([stack-versions] 참조).
⛔ **axios 를 새로 추가하지 마라** — HTTP 는 `$fetch` 하나로 통일한다.

## 순서

1. **API 함수** `frontend/app/api/<domain>.ts`
   - 공용 fetch 인스턴스는 `app/plugins/api.ts` 가 `$fetch.create()` 로 만들어 **`$api`** 로 provide 한다.
     baseURL·`credentials: "include"`·access 토큰 Bearer 주입·401 시 refresh 재시도는 전부 인스턴스가 담당하므로
     도메인 모듈은 **경로와 타입만** 신경 쓴다.
   - `useNuxtApp()` 을 써야 하므로 이 모듈은 **컴포저블 형태(`use...Api()`)** 로 노출한다.
   ```ts
   // app/api/events.ts
   export interface Event {
     id: number
     title: string
     status: "active" | "closed"
   }

   export interface EventCreate {
     title: string
   }

   export function useEventsApi() {
     const { $api } = useNuxtApp()

     return {
       listEvents: () => $api<Event[]>("/events"),
       getEvent: (id: number) => $api<Event>(`/events/${id}`),
       createEvent: (data: EventCreate) => $api<Event>("/events", { method: "POST", body: data }),
     }
   }
   ```
   - ⚠️ **`app/api/*` 는 auto-import 대상이 아니다**(Nuxt 는 `composables/`·`utils/` 만 스캔) →
     쓰는 쪽에서 `import { useEventsApi } from "~/api/events"` 로 **명시 import** 한다. `app/lib/*` 도 마찬가지.
   - ⚠️ 응답은 **자동 JSON 파싱**된다 → axios 의 `.then(r => r.data)` 같은 언래핑이 필요 없다.
   - 본문은 `data` 가 아니라 **`body`**, 쿼리스트링은 **`query`** 옵션이다. ⛔ axios 예제 복붙 금지([stack-versions] `$fetch / ofetch` 절).

2. **서버 상태 컴포저블** `frontend/app/composables/use<Domain>.ts` — `useAsyncData` 래퍼
   ```ts
   // app/composables/useEvents.ts
   import { useEventsApi } from "~/api/events"   // ← app/api/* 는 명시 import

   export function useEvents() {
     const { listEvents } = useEventsApi()
     return useAsyncData("events", () => listEvents(), { server: false })
   }

   export function useEvent(id: Ref<number>) {
     const { getEvent } = useEventsApi()
     return useAsyncData(
       () => `event:${id.value}`,        // ← 파라미터가 키에 들어가야 한다
       () => getEvent(id.value),
       { server: false, watch: [id] },   // ← id 가 바뀌면 자동 재요청
     )
   }
   ```
   - **`key` 는 필수이자 캐시 식별자**다. 같은 키는 앱 전역에서 공유·중복 제거되므로
     `"events"` 처럼 **도메인 단위**로 짓고, 파라미터가 있으면 `` `event:${id}` `` 처럼 **키에 포함**시킨다.
     ⛔ 서로 다른 데이터에 같은 키를 쓰면 조용히 덮어써진다.
   - 반환값은 `{ data, status, error, refresh }`. ⛔ `isPending`/`isError` 는 없다 —
     `status` 가 `"idle" | "pending" | "success" | "error"` 다. 로딩은
     **`status.value === "idle" || status.value === "pending"`**(첫 프레임이 `idle` 일 수 있다).
   - ⛔ **`enabled` 옵션이 없다** → 조건부 실행은 **`immediate:`**(예: `immediate: authStore.isAuthenticated`).
     ⛔ **`retry` 옵션도 없다** — 재시도가 필요하면 호출부에서 직접 만든다.
   - **갱신(뮤테이션)은 `useAsyncData` 로 못 만든다**(setup 한정) — `$api` 로 POST/PUT/DELETE 를 직접 호출하는
     **수동 헬퍼**(`ref` 2개 + async 함수, `app/composables/useAuth.ts` 의 `useLogin()` 이 그 형태)를 만들고,
     끝나면 해당 키의 **`refresh()`** (또는 다른 화면의 키까지 무효화하려면 `refreshNuxtData("events")`) 를 부른다.
   ```ts
   // app/composables/useEvents.ts (이어서) — 쿼리 라이브러리의 mutation 대응
   export function useCreateEvent() {
     const { createEvent } = useEventsApi()
     const isPending = ref(false)
     const isError = ref(false)

     async function mutate(data: EventCreate) {
       isPending.value = true
       isError.value = false
       try {
         const created = await createEvent(data)
         await refreshNuxtData("events")
         return created
       }
       catch {
         isError.value = true
         return null
       }
       finally {
         isPending.value = false
       }
     }

     return { mutate, isPending, isError }
   }
   ```
   - ⚠️ 이런 헬퍼는 **plain object 안의 ref** 를 돌려주므로 **템플릿에서도 `.value` 를 붙여야 한다**
     (top-level ref 만 자동 언랩된다) → `:disabled="createMutation.isPending.value"`.
   - ⛔ **서버 상태를 `ref` + `onMounted` 로 직접 패칭 금지.** 캐싱·중복 제거·재검증은 `useAsyncData` 가 한다.
     (일회성 이벤트 핸들러 안에서의 호출만 `$api` 직접 사용이 맞다 — 그건 서버 "상태" 가 아니라 명령이다.)
   - `useAsyncData`/`useFetch` 는 **컴포넌트·컴포저블 setup 시점**에서만 호출한다.
     이벤트 핸들러나 `setTimeout` 안에서 호출하면 Nuxt 인스턴스를 못 찾아 터진다.
   - URL 만으로 충분한 단순 호출이면 `useFetch`(= `useAsyncData` + `$fetch`, 키 자동 생성)를 써도 되지만,
     **이 스캐폴드는 인터셉터가 붙은 `$api` 를 써야 하므로 `useAsyncData` 를 기본으로 한다.**

3. **타입** `frontend/app/api/<domain>.ts` — 해당 API 모듈 안에 함께 둔다(`app/api/auth.ts` 가 이미 그 방식).
   백엔드 스키마(`backend/app/schemas/<domain>.py`)와 동기화. 유니온은 리터럴(`"active" | "closed"`).

4. **컴포넌트/페이지** `frontend/app/pages/<name>.vue`(라우트) 또는 `frontend/app/components/PascalCase.vue`(공유 컴포넌트)
   - 공유 컴포넌트 파일명 = 컴포넌트명, `PascalCase.vue`.
   - **Vue 3 `<script setup lang="ts">` + Composition API** 를 쓴다. ⛔ Options API(`export default { data(), methods }`) 금지.
   - **Nuxt 자동 import**: `app/composables/`·`app/stores/`·`app/components/` 의 export 와 `ref`·`computed`·`useAsyncData`·
     `navigateTo` 같은 Nuxt/Vue 내장 API 는 **import 문 없이** 바로 쓴다.
     ⛔ 반면 **`app/api/`·`app/lib/` 는 자동 import 대상이 아니다** — 명시적 `import` 가 필요하다.
   ```vue
   <script setup lang="ts">
   const props = defineProps<{ title: string }>()
   const { data: events, status } = useEvents()   // ← setup 최상단에서만
   const keyword = ref("")
   const isLoading = computed(() => status.value === "idle" || status.value === "pending")
   const filtered = computed(() => events.value?.filter(e => e.title.includes(keyword.value)) ?? [])
   </script>

   <template>
     <h1>{{ props.title }}</h1>
     <p v-if="isLoading">불러오는 중…</p>
     <p v-else>{{ filtered.length }} 건</p>
     <NuxtLink to="/">← 메인으로</NuxtLink>
   </template>
   ```
   - 데이터는 `app/composables/` 를 통해서만 접근. 클라이언트 상태(UI 토글)는 `ref`, **전역이면 Pinia 스토어**(`app/stores/*.ts`).
   - Pinia 는 **setup store** 문법으로 쓰고, 컴포넌트에서 구조분해할 땐 **`storeToRefs()`** 를 거쳐야 반응성이 유지된다
     (액션은 `storeToRefs` 없이 그냥 꺼내 쓴다). 상세는 [stack-versions] `Pinia` 절.
   - 한 페이지에서만 쓰는 조각은 파일을 늘리지 말고 그 `.vue` 안에 두고, 여러 페이지가 공유할 때만 `app/components/` 로 승격한다.
   - a11y: `<label for="x">` + `<input id="x">` 쌍은 **필수**.

5. **라우트** `frontend/app/pages/` — Nuxt **파일 기반 라우팅**
   - 파일 경로 = URL. `app/pages/events.vue` → `/events`, `app/pages/events/[id].vue` → `/events/:id`.
   - 첫 화면 `/`·공지(`/notices`)처럼 **공개 화면은 가드가 없다**. 로그인이 필요한 화면은 페이지 최상단에서 미들웨어를 선언한다
     — 미인증 시 `/login?next=<원래 위치>` 로 보내고 로그인 후 돌아온다(§14).
   ```vue
   <script setup lang="ts">
   definePageMeta({ middleware: "auth" })   // ← app/middleware/auth.ts (로그인만 필요)
   </script>
   ```
   - **관리자 화면**은 `app/pages/admin/` 아래에 두고 레이아웃과 가드를 함께 선언한다 — 비로그인 → 로그인, role≠admin → 403(`app/error.vue`).
     사이드바 메뉴는 `app/lib/adminNav.ts` 에 함께 등록한다.
   ```vue
   <script setup lang="ts">
   definePageMeta({ layout: "admin", middleware: "admin" })   // ← app/layouts/admin.vue + app/middleware/admin.ts
   </script>
   ```
   - 저장하지 않은 입력이 있는 폼은 `onBeforeRouteLeave`(확인 다이얼로그의 답을 기다리는 Promise 반환) + `beforeunload` 로 이탈을 막는다
     (`app/components/admin/NoticeForm.vue` 참고).
   - `definePageMeta` 는 **컴파일 타임에 추출**된다 → 인자에 런타임 변수를 넣지 말고 리터럴로 쓴다.
   - 내부 이동은 **`<NuxtLink to="/events">`**, 스크립트에서는 **`navigateTo("/events")`** 를 쓴다.
     ⛔ `<a href>` 로 내부 링크를 걸면 전체 새로고침이 된다.
   - 공통 레이아웃은 `app/app.vue`(`<NuxtLayout><NuxtPage /></NuxtLayout>`) 와 `app/layouts/` 로 구성한다.

6. **인증/토큰 (§9·§14)**
   - **access 토큰은 Pinia `auth` 스토어의 메모리에만** 있다. ⛔ **`localStorage` 에 토큰을 저장하지 마라** —
     XSS 로 통째로 털리는 저장소다(옛 `app/lib/token.ts` 방식은 폐지됐다).
   - **refresh 토큰은 HttpOnly 쿠키**(`refresh_token`, `Path=/api/v1/auth`)라 JS 에서 보이지 않는다.
     `$api` 가 `credentials: "include"` 라 브라우저가 알아서 실어 보낸다 — 프론트 코드가 만질 일이 없다.
   - **새로고침 대응**: 메모리 토큰은 새로고침에 날아간다 → `app/plugins/auth-init.ts` 가 부팅 시
     `POST /auth/refresh` 로 세션을 복원한다. 새 기능에서 따로 복원 로직을 만들지 마라.
   ```ts
   // app/middleware/auth.ts
   import { loginPath } from "~/lib/returnTo"
   export default defineNuxtRouteMiddleware((to) => {
     if (!import.meta.client) return
     const auth = useAuthStore()
     if (!auth.isAuthenticated) return navigateTo(loginPath(to.fullPath), { replace: true })   // /login?next=…
   })
   ```
   - ⚠️ 미들웨어는 **클라이언트일 때만** 리다이렉트한다 — `nuxt generate` 의 정적 생성 단계는 Node 에서 돌아 인증 상태가 없다.
   - **401 은 `app/plugins/api.ts` 가 일괄 처리**한다 — **refresh 1회(single-flight) 후 원 요청 재시도**, 실패 시
     세션 제거 + (로그인 필요 화면이면) `/login?next=` 이동. ⛔ 개별 API 함수·컴포넌트에서 401 이나 refresh 를 따로 처리하지 마라.
   - Bearer 주입도 마찬가지로 `onRequest` 인터셉터가 담당한다 — 호출부에서 헤더를 직접 붙이지 않는다.
   - 로그인 성공 시에는 Pinia `auth` 스토어의 **`setSession(accessToken)` 하나만** 부른다 — 메모리 상태를 갱신한다
     (refresh 쿠키는 응답 `Set-Cookie` 로 자동 저장). 이어서 `setUser(await getMe())` 로 사용자 정보를 채운다.
   - 로그아웃은 `useLogout()` — `POST /auth/logout`(서버가 세션 revoke + 쿠키 삭제) 후 스토어·`clearNuxtData()` 를 비우고 홈으로.

7. **업로드·파일 URL·오류 문구**
   - 업로드는 공용 `$api` 로 `FormData` 필드 `file`(`app/api/common.ts` 의 `fileForm()`) — Bearer·401 refresh 가 그대로 적용된다.
     Bearer 가 필요한 다운로드는 `$api<Blob>(url, { responseType: "blob" })` + `lib/download.ts` 의 `saveBlob()`.
   - 백엔드가 주는 파일 URL(`/uploads/...`)은 템플릿에서 `useFileUrl()` 을 거쳐 쓴다(API 를 다른 오리진에 둔 경우 보정). dev 는 devProxy `/uploads`.
   - 실패 문구는 `lib/apiError.ts` 의 `apiErrorMessage(e)`(도메인 `code`·413·422 배열 detail). 새 도메인 오류 코드를 만들면 `MESSAGE_BY_CODE` 에 문구를 추가한다.
   - 명령(생성·수정·삭제)은 `useAction()` 으로 감싸 `isPending` 을 얻고, 끝나면 `invalidate*()`(=`refreshDataByPrefix`)로 화면에 떠 있는 관련 키를 다시 부른다.
   - 리치 텍스트 본문은 `<EditorRichTextEditor :upload-image="useEditorImageUpload()" @change=…>` 로 받고, 보기는 `<RichContent :html>` 에
     **서버가 정화해 돌려준 HTML 만** 넣는다. 에디터 서식을 늘리면 백엔드 `core/sanitize.py` 허용 목록과 테스트를 같은 변경에서 고친다.

## 스타일 (§15)
- Tailwind v4 CSS-first(`@import "tailwindcss"` + `@theme`, `app/assets/css/main.css`). 별도 `tailwind.config.js` 지양.
- 한글 기본 폰트 Pretendard(+ Noto Sans KR 폴백) 권장.

## 설정
- API 호스트는 **`useRuntimeConfig().public.apiBaseUrl`**(없으면 dev proxy `/api/v1`). 값은 `nuxt.config.ts` 의
  `runtimeConfig.public` 기본값 + **`NUXT_PUBLIC_*` 환경변수**로 덮인다.
  ```
  # frontend/.env
  NUXT_PUBLIC_API_BASE_URL=
  NUXT_PUBLIC_BACKEND_URL=http://localhost:8000
  ```
- ⛔ **`VITE_` 접두 환경변수·`import.meta.env` 직접 참조 금지** — Nuxt 규약은 `runtimeConfig.public` + `NUXT_PUBLIC_` 이다.
- ⛔ 셸 환경변수 의존 금지, `.env` 로만. 새 키를 추가하면 `.env.example` 도 함께 갱신한다(§17).
- ⛔ `server/` 라우트·서버 미들웨어 등 **서버 전용 기능 금지** — 정적 SPA 라 실행될 서버가 없다([stack-versions]).

## 마무리
- 순수 로직(`app/lib/**`)과 Nuxt 자동 import 에 기대지 않는 컴포넌트는 옆에 `*.test.ts`(vitest + `@vue/test-utils`)를 둔다 → `pnpm test`.
  페이지·`useAsyncData` 컴포저블은 Nuxt 런타임이 필요해 vitest 대상이 아니다 — 실제 백엔드를 붙인 `pnpm dev` 로 확인한다(ARCHITECTURE.md §13 "프론트 테스트").
- 린트 경고 0 + `pnpm typecheck`(`nuxt typecheck` = vue-tsc) 통과 + `pnpm test` 통과 + `pnpm build` 성공 + 동작 확인 후 커밋. 커밋/PR은 [pr-workflow] 스킬 참조.
