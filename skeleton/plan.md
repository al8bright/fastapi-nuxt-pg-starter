# __PROJECT_NAME__ 작업 계획 (plan.md)

> TDD 순서대로 진행한다. **한 번에 실패하는 테스트 하나**(Red) → 최소 구현(Green) → 정리(Refactor).
> 구조 변경(Structural)과 동작 변경(Behavioral)을 분리한다.

## 0. 부트스트랩 (architecture.md §21 체크리스트)

- [ ] 저장소 구조 생성 (`backend/`, `frontend/`, `docs/`, `.env.example`, `.gitignore`)
- [ ] 백엔드 `app/` 골격: `main.py`, `config.py`, `dependencies.py`, `db/`, `core/security.py`
- [ ] `Settings` + `get_settings()`, CORS, `TZ=Asia/Seoul`
- [ ] PostgreSQL `connect_args` KST 고정
- [ ] Alembic 초기화 + 초기 마이그레이션
- [ ] `pytest` + SQLite in-memory + `conftest.py` 픽스처
- [ ] Nuxt 골격: `$api` 플러그인(`app/plugins/api.ts`), Pinia 인증 스토어(`app/stores/auth.ts`), `useAsyncData` 기반 컴포저블(`app/composables/`)
- [ ] `app/middleware/auth.ts` 인증 가드 + `definePageMeta`
- [ ] Nuxt SPA 설정(`ssr: false`, `devServer.port` 5173, `nitro.devProxy`)
- [ ] Tailwind v4 `@theme`, pnpm, ESLint + nuxt typecheck
- [ ] `.github/pull_request_template.md`, `main` 보호 + CI 머지 게이트

## 1. <첫 기능>

- [ ] (Red) 실패 테스트: <테스트명>
- [ ] (Green) 최소 구현
- [ ] (Refactor) 정리

## 2. <다음 기능>

- [ ] ...
