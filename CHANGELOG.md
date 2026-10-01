# Changelog

스캐폴드 템플릿 `fastapi-nuxt-pg-starter` 의 변경 이력.
형식은 [Keep a Changelog](https://keepachangelog.com/) 를 느슨히 따른다.

---

## 2026-10-02 — 기본 문서 세트 정리 (AGENTS.md 도입, 문서 루트 배치)

생성 프로젝트의 기준 문서 6종을 골격 루트에 두고, `docs/` 는 프로젝트 고유 문서(PRD·유저 플로우·기획서 등) 전용으로 비웠다.
네 형제 템플릿(react·nextjs·nuxt·svelte)이 같은 구성을 갖는다.

```
skeleton/
├── README.md  AGENTS.md  CLAUDE.md  ARCHITECTURE.md  DESIGN.md  PLAN.md
└── docs/README.md   # 프로젝트 고유 문서 안내
```

### Changed (변경)

- **`plan.md` → `PLAN.md`** — 대문자로 통일하고 모든 참조(문서·스킬·랜딩 화면 안내 문구)를 고쳤다.
- **`docs/architecture.md` → `ARCHITECTURE.md`** (골격 루트) — 대문자로 개명하고 저장소 안의 모든 참조와 §3 구조도를 갱신했다.
- **`DESIGN.md` (템플릿 루트) → `skeleton/DESIGN.md`** — 생성 프로젝트는 `-Design`/`-NoDesign` 과 무관하게 항상 `DESIGN.md` 를 받는다.
  두 옵션은 이제 `@theme` 주입 여부만 결정하며, 스캐폴드의 별도 복사 단계(`docs/DESIGN.md`)는 제거했다.
- **`CLAUDE.md` → `AGENTS.md`** — 에이전트 공통 지침의 원본을 `AGENTS.md` 로 옮겼다(`git mv`, 이력 유지).
  새 `CLAUDE.md` 는 `@AGENTS.md` 를 import 하고 Claude Code 전용 내용만 둔다. Claude Code 는 `CLAUDE.md` 가 있으면
  `AGENTS.md` 를 스스로 읽지 않으므로, import 없이 두 파일을 따로 두면 규칙이 갈라진다.
  전역 `~/.claude/CLAUDE.md` 에 기대던 작업 규칙(TDD·Tidy First·커밋 형식·PowerShell·pnpm·한국어)은 `AGENTS.md` 에 직접 적었다 — 다른 에이전트는 그 전역 파일을 읽지 않기 때문이다.
- **변경 반영 규칙을 `main` 직접 커밋(브랜치·PR 선택)으로 통일** — 형제 저장소(react·nextjs)와 같은 규칙으로 맞췄다.
  `AGENTS.md`, `ARCHITECTURE.md`(★MUST 15·§20·§21 체크리스트), 골격 `README.md`·`PLAN.md`, `ci.yml` 주석을 갱신했다. 게이트는 push 전 로컬 검증이고 CI 는 사후 안전망이다.
- **`pr-workflow` 스킬** — macOS/Linux 명령을 함께 싣고, push 전 검증 명령을 이 골격의 실제 `package.json` 스크립트에 맞췄다(없는 스크립트를 부르지 않도록).

### Added (추가)

- **`docs/README.md`** — `docs/` 의 용도(프로젝트 고유 문서)와 루트 기준 문서 목록을 안내한다. 빈 폴더가 git 에 남도록 하는 역할도 한다.

## 2026-08-11

`fastapi-svelte-pg-starter` 로부터 프론트엔드를 **Nuxt** 로 이식해 신규 저장소로 분기.

### Added (추가)

- **Nuxt SPA 프론트엔드 골격** — `ssr: false`와 정적 생성을 적용하고 `app/pages/` 파일 기반 라우팅으로 `/login`·`/`·`/landing`·`/my` 화면을 구성했다.
- **인증 흐름** — `app/middleware/auth.ts`의 인증 가드와 각 보호 페이지의 `definePageMeta`를 연결하고, `app/plugins/api.ts`에서 Bearer 토큰 주입과 401 일괄 처리를 담당하는 `$api`를 제공한다.
- **서버·클라이언트 상태 관리** — Nuxt 내장 `useAsyncData`로 서버 상태를 관리하고 Pinia로 전역 인증 상태를 관리한다.
- **Nuxt 품질 게이트** — eslint와 `@nuxt/eslint`, `nuxt typecheck`를 사용하며 CI에서 설치·린트·타입 검사·빌드를 순서대로 수행한다.

### Changed (변경)

- **프론트 프레임워크**를 Nuxt(SPA) + Vue 3 + TypeScript로 교체하고 Nuxt 파일 기반 라우팅을 사용한다.
- **서버 상태 계층**은 쿼리 라이브러리 대신 Nuxt 내장 `useAsyncData`·`useFetch`를 사용하며, **클라이언트 상태 계층**은 Pinia로 교체했다.
- **HTTP 계층**은 별도 HTTP 클라이언트 대신 `$fetch`(ofetch)와 Nuxt 플러그인으로 구성했다.
- **프론트 환경변수 접두**를 `NUXT_PUBLIC_`로 바꾸고 `runtimeConfig.public`을 통해 읽도록 변경했다.
- **문서·스킬·스캐폴드 스크립트**의 프론트 관련 경로, 명령, 설명을 Nuxt의 `app/` 구조와 `app/assets/css/main.css` 테마 주입 방식에 맞게 갱신했다.

### Unchanged (그대로 유지)

- 백엔드(FastAPI · SQLAlchemy 2.0 · Alembic · pytest · ruff)와 PostgreSQL, 기본 인증 유저플로우, KST 단일 기준, `.env` 주입 규칙, TDD/Tidy First/PR 규칙은 형제 저장소와 동일하다.
- 런타임 최소는 Python ≥ 3.13 · Node ≥ 24 · pnpm ≥ 11이며, 백엔드 의존성은 형제 저장소의 정확 핀을 유지한다.

### 작업 관례 (다음 세션 참고)

- **버전 핀 정책**: `requirements.txt`는 `==` 정확 핀으로 재현성을 유지한다. 프론트는 `^`/`~` 범위 핀이며 정확한 값의 출처(SSOT)는 `frontend/package.json` 이다. 상향 시에는 임시 스캐폴드에서 `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm build`를 실제 검증한 뒤 확정한다. ⚠️ **배포 후 24시간이 지난 버전만 핀한다** — pnpm 11의 `minimum-release-age` 기본값이 24시간이라, 그보다 최근 버전을 핀하면 `pnpm install` 이 `pnpm-workspace.yaml` 에 `minimumReleaseAgeExclude:` 를 자동 삽입해 템플릿이 오염된다.
- **PR 흐름**: 브랜치 → 커밋(`[Structural]`/`[Behavioral]`) → push → `gh pr create` → squash 머지(`pr-workflow` 스킬).
- 정확한 버전·버전별 함정은 항상 `stack-versions` 스킬과 SoT 파일(`versions.env`·`requirements.txt`·`package.json`)을 기준으로 확인한다.

### 남은 후속 (미진행)

- 도메인 기능은 **각 프로젝트에서 PRD 작성 후** 진행한다(스캐폴드는 공통 기반까지).
- 후보: 회원가입/사용자 관리(관리자 화면)·비밀번호 변경·토큰 만료/refresh.
- CI 머지 게이트 강제는 **GitHub 저장소 설정**(main 브랜치 보호 + 필수 체크)이 필요한 저장소 관리자 작업이다.
- 형제 저장소의 상세 변경 이력은 각 저장소의 CHANGELOG를 참조한다.
