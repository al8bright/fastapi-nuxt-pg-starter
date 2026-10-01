---
name: stack-versions
description: __PROJECT_NAME__ 의 고정 스택 버전과 버전별 주의사항(gotcha)을 정의한다. 의존성 추가·업그레이드, pnpm/Nuxt/tsconfig/ESLint 설정 작업, 또는 버전에 따라 동작이 달라지는 코드를 작성·디버깅할 때 사용. 정확한 버전의 출처 파일과 Nuxt(SPA 모드)/useAsyncData/$fetch(ofetch)/Pinia/pnpm 10+/Starlette httpx2 등 버전별 함정, 업그레이드 검증 절차를 안내한다.
---

# 스택 버전 & 버전별 주의

## 1. 정확한 버전의 출처 (SSOT) — 항상 여기서 확인
- **런타임 최소**: `scripts/versions.env`
- **백엔드**: `backend/requirements.txt` (`==` 정확 핀)
- **프론트**: `frontend/package.json` (`^`/`~` 범위)

> 아래 2·3은 참고용 스냅샷이다. **실제 값은 위 파일을 읽어서** 확인한다.

## 2. 버전 스냅샷 (2026-10-02 기준)
- **런타임**: Python ≥ 3.13 · Node ≥ 24 · pnpm ≥ 11 (PostgreSQL 고정 없음, 14+ 권장)
- **백엔드**: FastAPI 0.142.2 · Uvicorn 0.54.0 · SQLAlchemy 2.1.1 · Alembic 1.20.0 · Pydantic 2.13.5 / settings 2.15.0 · psycopg2-binary 2.9.13 · PyJWT 2.15.1 · bcrypt 5.0.0 · httpx2 2.13.1 · pytest 9.1.1 · ruff 0.16.9
- **프론트**: nuxt `4.5` · vue `3.5` · vue-router `5.3` · pinia `4.0` · @pinia/nuxt `1.0` · tailwindcss `4.3` · @tailwindcss/vite `4.3` · @nuxt/eslint `1.17` · eslint `10.11` · typescript `6.0` · vue-tsc `3.3` · @types/node `24` · pnpm `11.28`(packageManager)
  (⛔ HTTP 는 `$fetch`(ofetch, Nuxt 내장) — **axios 의존성 없음**. 서버 상태도 쿼리 라이브러리 없이 Nuxt 내장 `useAsyncData` 를 쓴다.)

## 3. ⚠️ 버전별 함정 (코드·설정 작성 시 반드시)

### pnpm 10+ (현재 11)
- 🔴 의존성 **빌드 스크립트가 기본 차단**된다. 허용 키는 `frontend/pnpm-workspace.yaml` 의 **`allowBuilds` 맵**이다.
  ⛔ **pnpm 11 에서 `onlyBuiltDependencies` 는 무시된다** — 그대로 두면 `ERR_PNPM_IGNORED_BUILDS` 로 install 이 깨지고,
  **pnpm 이 `pnpm-workspace.yaml` 에 `allowBuilds:` 맵을 자동으로 써 넣어 템플릿을 오염시킨다.**
  (pnpm 10 시절의 "`onlyBuiltDependencies` 리스트가 정답, `allowBuilds` 는 인식 안 됨" 서술과 **정반대**다. 독립 재현 실험으로 확정.)
  → 처음부터 맵으로 둔다:
  ```yaml
  allowBuilds:
    esbuild: true
    unrs-resolver: true
  ```
  Nuxt 4 + Tailwind v4 조합에서 실제로 postinstall 을 도는 건 이 둘뿐이다
  (`unrs-resolver` 는 `@nuxt/eslint` 계열의 oxc-resolver. `@tailwindcss/oxide` 는 prebuilt 바이너리가 와서 목록에 없어도 된다).
- ⚠️ pnpm 11 의 **`minimum-release-age` 기본값이 24시간**이다(`pnpm config get` 은 `undefined` 로 보이지만 내부 기본값이 있다).
  **배포 24시간 이내 버전을 `^` 로 핀하면 `pnpm install` 이 `pnpm-workspace.yaml` 에 `minimumReleaseAgeExclude:` 블록을 자동으로 써 넣어 템플릿 파일이 오염된다.**
  (실제 사례: `typescript-eslint@^8.67.0`(전날 배포) → exclude 11줄 삽입. `^8.66.0` 으로 한 단계 낮춰 회피.)
  ⛔ 스캐폴드 템플릿은 install 이 파일을 고치면 안 된다 → **"배포 후 24시간 경과한 버전만 핀"**.
- `package.json` 의 `packageManager` 필드로 pnpm 버전 고정(corepack).

### Nuxt (SPA 모드)
- 이 스캐폴드는 **정적 SPA**다. `nuxt.config.ts` 에 **`ssr: false`**. 이게 SPA 를 성립시키는 핵심이니 지우지 말 것.
- ⚠️ **`nuxt build` 와 `nuxt generate` 는 다르다.** `build` 는 Nitro **노드 서버**(`.output/server`)를 만든다 →
  배포 산출물은 반드시 **`nuxt generate`**(정적, `.output/public` + **`200.html` SPA fallback**).
  - `ssr: false` + generate 시 뜨는 `▲ HTML content not prerendered because ssr: false was set.` 경고는 **정상**이다.
  - 빌드 중간 산출물은 `node_modules/.cache/nuxt/` 에 생긴다. 루트 `.nuxt/` 에는 타입·tsconfig·eslint config 만 있다.
- **dev 서버 포트는 5173 고정** — `devServer: { port: 5173 }`. Nuxt 기본값 3000 이 아니다.
  이유: 백엔드 `.env` 의 `CORS_ORIGINS=http://localhost:5173` 와 스캐폴드 안내문이 이 포트를 전제로 한다. ⛔ 임의로 바꾸지 말 것.
- **dev 프록시는 `nitro.devProxy`** 다(Vite 의 `server.proxy` 가 아니다). ⚠️ **의미도 다르다 — target 에 prefix 를 포함해야 한다.**
  nitro 는 라우트 prefix 를 벗겨내고 target 뒤에 이어 붙인다:
  ```ts
  nitro: { devProxy: { "/api": { target: "http://localhost:8000/api", changeOrigin: true } } }
  ```
  Vite 식으로 `target: "http://localhost:8000"` 이라고 쓰면 경로가 깨진다.
- ⛔ **서버 전용 기능 금지** — `server/` 라우트(`server/api/*`), 서버 미들웨어, `useRequestEvent`, `defineEventHandler`,
  런타임 `runtimeConfig`(비공개 키). 정적 빌드라 **실행될 서버가 없어 동작하지 않는다.** 백엔드는 별도 FastAPI 서버다.
- ⚠️ **정적 생성 단계는 Node 에서 돈다** → `localStorage`/`window` 같은 브라우저 API 를 직접 만지면 빌드가 깨진다.
  접근에는 **`import.meta.client` 가드 필수**,
  `app/middleware/auth.ts` 도 맨 앞에 `if (!import.meta.client) return` 을 둬 생성 단계에서는 통과시킨다.
  (인증 토큰은 애초에 `localStorage` 에 두지 않는다 — access 는 Pinia 메모리, refresh 는 HttpOnly 쿠키. ARCHITECTURE.md §9·§14)
- 환경변수 접두는 **`NUXT_PUBLIC_`**(⛔ `VITE_` 아님). 코드에서는 `useRuntimeConfig().public.*` 로 읽고,
  기본값은 `nuxt.config.ts` 의 `runtimeConfig.public` 에 둔다. ⛔ `import.meta.env` 직접 참조 금지.
  - ⚠️ 매핑 규칙은 **camelCase ↔ SCREAMING_SNAKE 자동 변환**이다(`public.apiBaseUrl` ↔ `NUXT_PUBLIC_API_BASE_URL`) → 키 이름을 마음대로 못 짓는다.
  - ⚠️ SPA 라 값이 **빌드 시점에 `index.html` 의 `window.__NUXT__.config` 로 인라인**된다 → **런타임 교체 불가, 배포마다 재빌드**.
- 소스 루트는 **`app/`** 디렉토리 규약이다(`app/pages`, `app/components`, `app/composables`, `app/stores`, `app/plugins`, `app/middleware`).
  **Nuxt 4 기본값이라 `srcDir` 을 따로 지정할 필요가 없다** — `nuxt.config.ts` 만 루트에 둔다.
  Tailwind v4 는 `@tailwindcss/vite` 플러그인으로 물리고 CSS 진입점은 `app/assets/css/main.css` 다.

### useAsyncData / useFetch
- 서버 상태는 **Nuxt 내장 `useAsyncData`** 로 관리한다. 쿼리 라이브러리(react-query 류)를 새로 추가하지 않는다.
- **`key` 는 필수이자 캐시 식별자**다. 같은 키는 앱 전역에서 공유·중복 제거된다 → 도메인 단위로 짓고
  파라미터가 있으면 키에 포함시킨다(`` () => `event:${id.value}` ``). ⛔ 서로 다른 데이터에 같은 키를 쓰면 조용히 덮어써진다.
- ⛔ **쿼리 라이브러리가 아니다 — `enabled` 옵션이 없다.** `enabled: Boolean(token)` 대응은 **`immediate:`**
  (예: `immediate: authStore.isAuthenticated`). ⛔ **`retry` 옵션도 없다**(애초에 재시도하지 않는다).
- **SPA 라 실행 시점이 항상 클라이언트**다(서버 프리패치 단계가 없다) → 첫 렌더의 로딩 상태를 반드시 처리해야 한다.
  반환값은 `{ data, status, error, refresh }` — ⛔ `isPending`/`isError` 는 없다.
  `status` 는 **`"idle" | "pending" | "success" | "error"`** 이고, 로딩 판정은
  `status.value === "idle" || status.value === "pending"`(첫 프레임이 `idle` 일 수 있다).
  재검증은 `refresh()`, 다른 화면 키까지 무효화하려면 `refreshNuxtData(key)`.
- 파라미터가 바뀌면 자동 재요청하려면 **`watch: [...]`** 옵션을 준다.
- ⚠️ **호출 위치는 setup 최상단 한정** — 컴포넌트/컴포저블 최상단. 이벤트 핸들러·타이머 안에서 부르면 Nuxt 인스턴스를 못 찾아 터진다.
  → **뮤테이션(로그인·생성·삭제)은 `useAsyncData` 로 못 만든다.** `ref` 2개 + async 함수의 **수동 헬퍼**로 만든다
  (`app/composables/useAuth.ts` 의 `useLogin()`). ⚠️ plain object 안의 ref 라 **템플릿에서도 `.value`** 를 붙여야 한다.
- **`$fetch` 직접 호출과의 차이**: `useAsyncData` = 캐시 키 + 중복 제거 + 상태(`status`/`error`) 관리. `$fetch` = 캐시 없는 단발 호출.
  → **조회는 `useAsyncData`, 생성/수정/삭제 같은 명령은 `$fetch`(`$api`) 직접 호출 후 `refresh()`.**
- `useFetch` 는 `useAsyncData` + `$fetch` 의 설탕(키 자동 생성)이다. 인터셉터가 붙은 `$api` 를 써야 하므로 **기본은 `useAsyncData`**.
- ⛔ **컴포넌트에서 `ref` + `onMounted` 로 수동 패칭 금지.** 캐싱·중복 제거·재검증이 전부 사라진다.

### $fetch / ofetch
- Nuxt 전역 **`$fetch`(ofetch)** 가 HTTP 클라이언트다. 공용 인스턴스는 `app/plugins/api.ts` 에서
  **`$fetch.create({ baseURL, onRequest, onResponseError })`** 로 만들어 **`$api`** 로 provide 하고, 호출부는 `useNuxtApp().$api` 를 쓴다.
  - `provide` 만으로 **`$api` 타입이 자동 생성**된다 → ⛔ `declare module` augmentation 을 따로 쓰지 마라.
  - 인스턴스에 **`credentials: "include"`** — refresh HttpOnly 쿠키(`Path=/api/v1/auth`)를 브라우저가 실어 보낸다.
  - `onRequest` — **Pinia 메모리의 access 토큰** Bearer 주입. ⚠️ **`options.headers` 는 `Headers` 인스턴스**다 →
    **`options.headers.set("Authorization", ...)`**. axios 식 `config.headers.X = ...` 대입은 타입도 런타임도 틀린다.
  - `onResponseError` — **401 일괄 처리**: refresh 1회(**single-flight** — 동시 401 은 하나의 refresh 로 합류) 후
    원 요청 재시도, 실패 시 세션 제거 + `/login` 이동. ofetch 가 4xx 를 throw 하므로 `onResponse` 가 아니라 여기다.
    `location.href` 앞에는 **`import.meta.client` 가드 필수**. ⛔ 개별 API·컴포넌트에서 401/refresh 를 따로 처리하지 마라.
- ⚠️ **`app/api/*` 는 auto-import 대상이 아니다**(Nuxt 는 `composables/`·`utils/` 만 스캔) →
  `import { useAuthApi } from "~/api/auth"` 로 명시 import. 반대로 `app/composables/*`·`app/stores/*` 는 auto-import 된다.
- ⛔ **axios 예제 복붙 금지.** 다른 점:
  - 응답이 **자동 JSON 파싱**되어 곧바로 반환된다 → `res.data` 언래핑 없음. 타입은 제네릭으로(`$api<Event[]>("/events")`).
  - 요청 본문은 `data` 가 아니라 **`body`**, 쿼리스트링은 `params` 가 아니라 **`query`**.
  - 에러는 `AxiosError` 가 아니라 **`FetchError`** 이고, 서버가 준 본문은 **`err.data`**, 응답 객체는 `err.response`(본문은 `err.response._data`)에 있다.
  - 인터셉터는 `interceptors.request.use(...)` 가 아니라 `create()` 옵션의 **`onRequest`/`onRequestError`/`onResponse`/`onResponseError`** 훅이다.
  - 4xx/5xx 는 자동으로 throw 된다(axios 와 동일). 상태코드만 보고 싶으면 옵션으로 처리하지 말고 `try/catch` 로 `FetchError` 를 잡는다.

### Pinia
- ⚠️ **`@pinia/nuxt@1` 의 peer 는 `pinia@^4`** 다(pinia 3.x 와 짝이 아니다). 한쪽만 올리지 말 것.
- 클라이언트 전역 상태는 **Pinia**(`@pinia/nuxt` 모듈). 모듈을 `nuxt.config.ts` 의 `modules` 에 등록하면
  **`app/stores/*` 의 스토어가 자동 import** 된다 → 컴포넌트에서 import 문 없이 `useAuthStore()` 로 쓴다.
  (setup store 안의 `ref`/`computed` 도 auto-import 대상. `defineStore` 만 `pinia` 에서 명시 import 한다.)
- **setup store 문법**으로 쓴다 — `defineStore("auth", () => { const token = ref<string|null>(null); ... return { token, ... } })`.
  `state/getters/actions` 옵션 객체 방식보다 Composition API 와 일관된다. 파생값은 `computed`, 변경 로직은 평범한 함수로 return.
- ⚠️ **구조분해하면 반응성이 끊긴다** → 상태·getter 는 반드시 **`storeToRefs(store)`** 를 거친다.
  액션(함수)은 `storeToRefs` 대상이 아니므로 스토어에서 그대로 꺼내 쓴다.
  ```ts
  const auth = useAuthStore()
  const { user, isAuthenticated } = storeToRefs(auth)   // ✅ 반응형 유지
  const { logout } = auth                                // ✅ 액션은 그냥
  ```
- 스토어는 **클라이언트 상태 전용**이다(토큰·사용자 프로필·UI 토글). ⛔ 서버 목록/상세를 스토어에 캐싱하지 마라 → `useAsyncData`.

### TypeScript / typecheck
- 타입 검사는 **`nuxt typecheck`**(내부적으로 **vue-tsc**) 로 한다 → `pnpm typecheck`. ⛔ `tsc -b` 로 대체하지 말 것 — `.vue` 파일을 못 본다.
  `.vue` **템플릿 안의 표현식까지** 검사한다.
- ⚠️ `frontend/tsconfig.json` 은 **project references 껍데기**다 — `"files": []` + `.nuxt/tsconfig.{app,server,shared,node}.json`
  4개를 `references` 로만 잡는다. ⛔ **여기에 `compilerOptions` 를 직접 쓰지 마라** — Nuxt 생성분을 덮어써 경로 별칭(`~`/`@`)과
  자동 import 타입이 깨진다. 커스터마이즈가 필요하면 `nuxt.config.ts` 의 **`typescript.tsConfig`** 로 준다.
- **TypeScript 는 `~6.0.3` 유지.** npm latest 는 7.x 지만 `vue-tsc@3.3` 이 `@volar/typescript` 를 통해 TS 내부 API 에 의존해 **TS 7 은 미검증**이다.
- `.nuxt/` 가 없으면 typecheck·빌드가 실패한다 → **`nuxt prepare` 가 선행**되어야 한다.
  `package.json` 의 **`postinstall: nuxt prepare`** 가 그 역할이다. ⛔ 이 스크립트를 지우지 말 것.
  (클론 직후·CI 처럼 `.nuxt/` 가 없는 상태에서 수동으로 돌리려면 `pnpm exec nuxt prepare`.)

### ESLint
- 프론트 린트는 **eslint + `@nuxt/eslint`**. 이 모듈이 **`nuxt prepare` 시점에 `.nuxt/eslint.config.mjs` 를 생성**하고,
  `frontend/eslint.config.mjs` 는 그걸 import 해 감싸는(`withNuxt(...)`) 형태다.
  → ⚠️ **`postinstall: nuxt prepare` 가 없으면 `eslint .` 자체가 깨진다**(import 대상이 없다).
- ⛔ 파서·Vue 플러그인·globals 를 손으로 재조립하지 마라 — 모듈이 이미 `.vue` 파서와 자동 import 전역을 처리한다.
  규칙 추가만 `withNuxt(...)` 인자로 넘긴다.
- **`eslint: { config: { stylistic: false } }` 를 유지한다** — 켜면 eslint 기본이 single quote 라
  이 저장소 스타일(큰따옴표·세미콜론 없음)과 싸운다. 코드 스타일은 규칙으로 강제하지 않는다.

### FastAPI 0.142 + Starlette 1.x
- TestClient 는 **httpx2** 를 쓴다(httpx 아님). `requirements.txt` 에 `httpx2`. ⛔ `httpx` 로 되돌리면 deprecation 경고.
- 서버↔서버 HTTP 클라이언트도 `httpx2`.

### SQLAlchemy 2.1 / Alembic 1.20
- 2.0 스타일(`Mapped`/`mapped_column`, `select()` + `db.execute(...).scalar_one_or_none()`) 그대로 동작한다. 2.0 → 2.1 상향 시 앱 코드 변경 없음, `pytest -W error::DeprecationWarning` 경고 0 (2026-10-02 확인).
- ⚠️ **Alembic 1.20 은 `alembic.ini` 에 `path_separator` 가 없으면 DeprecationWarning** 을 낸다
  (`prepend_sys_path` 를 공백·쉼표·콜론으로 쪼개는 레거시 동작). → `[alembic]` 에 **`path_separator = os`** 유지.
  ⛔ `alembic.ini` 는 ASCII 전용(configparser 가 OS 로캘 인코딩으로 읽는다) — 주석에 한글 금지.
- 마이그레이션 검증은 SQLite 가 아니라 **실제 PostgreSQL** 에서 `alembic upgrade head` + `alembic check`("No new upgrade operations detected") 로 한다.

### Pydantic 2.x
- v2 API(`model_config`, `@field_validator`, `SettingsConfigDict`). ⛔ v1 패턴(`class Config`, `@validator`) 금지.

### 인증 / 린트·CI
- 자체 계정 비밀번호는 **bcrypt** 해시(`core/security` 의 `hash_password`/`verify_password`).
  ⚠️ bcrypt 는 72바이트까지만 쓴다 → 비밀번호 정책이 UTF-8 72바이트 이하를 강제한다(ARCHITECTURE.md §9).
  ⚠️ **bcrypt 5 부터 `hashpw`/`checkpw` 가 72바이트 초과 입력에 `ValueError` 를 던진다**(4.x 는 조용히 잘랐다).
  → 바이트 상한은 **bcrypt 호출 전에** 검사한다: 로그인은 `LoginRequest` 스키마 검증(422), 계정 생성은
  `validate_password_policy`(`ServiceError("weak_password")`), `verify_password` 는 초과 시 `False`.
  ⛔ 이 가드를 지우면 긴 비밀번호 한 번으로 500 이 난다(`test_login_over_72_bytes_password_is_clean_4xx`).
- access 는 JWT(HS256, `sub` = user id, 15분) — **refresh 는 JWT 가 아니라 불투명 토큰**이다
  (`secrets.token_urlsafe(48)`, DB `sessions` 에 SHA-256 해시만, 회전 + 재사용 감지). 상세는 ARCHITECTURE.md §9.
- `SECRET_KEY` 는 32자 미만·기본값이면 `Settings` 검증이 기동을 거부한다. 초기 관리자는 `.env` 의
  `INITIAL_ADMIN_USERNAME`/`INITIAL_ADMIN_PASSWORD` 로 시드(미설정 시 스킵) — 하드코딩 기본 계정 없음.
- 로그인 429 rate limit 은 **인메모리(단일 프로세스 전제)** — 다중 워커 배포는 Redis 필요.
- 백엔드 린트는 **ruff**(`backend/pyproject.toml`): FastAPI `Depends` 등은 **B008 예외**(`extend-immutable-calls`), `alembic/` 제외, line-length 120. 새 의존성으로 lint 가 깨지면 이 설정을 먼저 본다.
  - ruff 0.16 은 `UP042`(`class X(str, enum.Enum)` → **`enum.StrEnum`**)를 낸다. `UserRole` 은 `StrEnum` 이다(사용처는 모두 `.value` 라 동작 동일).
  - CI 게이트는 `ruff check .` 뿐이다. `ruff format` 은 강제하지 않는다(현재 코드도 format 기준과 다르다).
- 프론트 린트는 **eslint + @nuxt/eslint**(`frontend/eslint.config.mjs`, flat config).
- **CI**(`.github/workflows/ci.yml`)가 push·PR(main) 마다 backend(ruff+pytest) / frontend(**eslint + typecheck + build**) 를 실행. 워크플로는 생성 프로젝트(루트)에서만 동작한다.

## 4. 백엔드 핀 정책
- `requirements.txt` 는 **`==` 정확 핀, 재현성 우선**(ARCHITECTURE.md §2).
- 런타임 최소를 올린다고(예: 3.13) 핀을 자동으로 올리지 말 것 — **호환되면 유지**(현재 핀은 3.13 호환 확인됨).
- 핀 상향은 보안/기능 목적의 **의식적 결정**으로. FastAPI 는 "최신이 아닌 안정화된 마이너" 선호.

## 5. 업그레이드 검증 절차 (필수)
버전을 올릴 땐 추측 금지 — **임시 스캐폴드로 실제 검증한 뒤** 핀을 고정한다:
1. `scaffold.ps1 -Name tmp -Target <스크래치경로> -SkipDb -SkipInstall -NoDesign`
   (스크립트가 런타임 사전 점검·bootstrap 단계에서 멈추면 `skeleton/` 을 복사한 뒤 `__PROJECT_NAME__`/`__PROJECT_SNAKE__`/`__THEME_CSS__` 를 치환하고 `backend/.env`·`frontend/.env` 를 직접 만들어 대체한다)
2. 백엔드: `python -m venv .venv` → `pip install -r requirements.txt` → `ruff check .` → `pytest -q`(+ 1회 `-W error::DeprecationWarning`)
   → 실제 PostgreSQL(예: `docker run postgres:16`)에 `alembic upgrade head` → `alembic check`
3. 프론트: `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm build`
   (install 전후로 `package.json`·`pnpm-workspace.yaml` 이 바뀌지 않았는지 diff 로 확인 — 바뀌면 템플릿 오염)
4. 통과 시 핀 고정 후 **갱신할 곳을 모두**: SoT 파일 + `README.md` 표(+기준일) + 필요 시 `ARCHITECTURE.md` + **이 스킬의 스냅샷/주의(§2·§3)**. 커밋/PR은 [pr-workflow].
