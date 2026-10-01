# __PROJECT_NAME__

공통 아키텍처(FastAPI · Nuxt · PostgreSQL) 기반 프로젝트.
상세 기준은 [`ARCHITECTURE.md`](ARCHITECTURE.md), 작업 순서는 [`PLAN.md`](PLAN.md), 디자인 토큰은 [`DESIGN.md`](DESIGN.md), AI 에이전트 지침은 [`AGENTS.md`](AGENTS.md), 프로젝트 고유 문서(PRD 등)는 [`docs/`](docs/README.md).

## 기술 스택 (주요 버전, 2026-10-02 기준)

> 아래 표는 **2026-10-02 기준** 요약이며, **정확한 출처(SSOT)** 는 다음 파일이다 — 변경 시 이 표가 아니라 해당 파일을 기준으로 한다:
> 런타임 [`scripts/versions.env`](scripts/versions.env) · 백엔드 [`backend/requirements.txt`](backend/requirements.txt) · 프론트 [`frontend/package.json`](frontend/package.json)

### 런타임
| 항목 | 버전 |
|------|------|
| Python | ≥ 3.13 |
| Node.js | ≥ 24 |
| pnpm | ≥ 11 |
| PostgreSQL | 프로젝트 고정 없음 (psycopg2-binary 2.9.x 지원 범위, 14+ 권장) |

### 백엔드 (`==` 정확히 핀, 재현성 우선)
| 패키지 | 버전 |
|--------|------|
| FastAPI | 0.142.2 |
| Uvicorn | 0.54.0 |
| SQLAlchemy | 2.1.1 |
| Alembic | 1.20.0 |
| psycopg2-binary | 2.9.13 |
| Pydantic / pydantic-settings | 2.13.5 / 2.15.0 |
| PyJWT | 2.15.1 |
| nh3 (본문 HTML 정화) | 0.3.7 |
| pillow (업로드 이미지 재인코딩) | 12.3.0 |
| bcrypt | 5.0.0 |
| httpx2 | 2.13.1 |
| pytest | 9.1.1 |
| ruff | 0.16.9 |

### 프론트엔드 (`^` 범위 핀)
| 패키지 | 버전 |
|--------|------|
| Nuxt | 4.5 |
| Vue | 3.5 |
| vue-router | 5.3 |
| Pinia | 4.0 |
| @pinia/nuxt | 1.0 |
| Tailwind CSS | 4.3 |
| @tailwindcss/vite | 4.3 |
| @nuxt/eslint | 1.17 |
| ESLint | 10.11 |
| TypeScript | 6.0 |
| vue-tsc | 3.3 |
| Vitest / jsdom | 5.0 / 30.1 |
| @vue/test-utils / @vitejs/plugin-vue | 2.5 / 6.0 |

## 사전 요구사항 (최초 1회)

런타임 **최소 버전**은 [`scripts/versions.env`](scripts/versions.env)에 정의돼 있다(**Python ≥ 3.13 / Node ≥ 24 / pnpm ≥ 11**).
부트스트랩 스크립트는 **이미 설치된 버전이 최소치 이상이면 그대로 재사용**하고, 미만이거나 없을 때만 설치한다.

```powershell
# Windows
.\scripts\bootstrap.ps1                 # 런타임 검사/설치
.\scripts\bootstrap.ps1 -WithPostgres   # PostgreSQL 까지 (psql 있으면 유지)
```

```bash
# macOS / Linux
./scripts/bootstrap.sh                  # 런타임 검사/설치
./scripts/bootstrap.sh --with-postgres  # PostgreSQL 까지 (psql 있으면 유지)
```

> 새로 설치된 런타임이 있으면 PATH 반영을 위해 **새 터미널**을 연다. (PostgreSQL은 원격 DB를 쓰면 설치 불필요.)

그다음 의존성 설치:

```powershell
cd backend; python -m venv .venv; .\.venv\Scripts\python -m pip install -r requirements.txt
cd ..\frontend; pnpm install
```

> 이미 `scaffold.ps1`로 생성한 프로젝트는 백엔드 venv·프론트 의존성이 설치된 상태다. 위 단계는 **다른 머신에서 clone 한 경우**에 필요하다.

## 실행

```powershell
# 백엔드
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# 프론트엔드 (다른 터미널)
cd frontend
pnpm dev
```

브라우저에서 http://localhost:5173 접속 → 로그인 없이 **공개 홈 화면**이 뜬다. `admin`(비밀번호는 `backend/.env` 의 `DEFAULT_ADMIN_PASSWORD`)으로 로그인하면 상단에 **관리자 콘솔** 링크가 생긴다.

### 기본 인증 / 계정

스캐폴드에는 자체 계정(username/password) 로그인 플로우가 내장돼 있다:

- 기본 관리자(아이디 `admin`)는 **`backend/.env` 의 `SEED_DEFAULT_ADMIN=true` + `DEFAULT_ADMIN_PASSWORD`** 로 기동 시 시드된다(없을 때만, lifespan 시드).
  스캐폴드가 비밀번호를 **랜덤 생성해 `backend/.env` 에 기록**하고 마지막에 출력하므로 거기서 확인한다. 코드 기본값은 시드 꺼짐이고
  비밀번호 기본값은 없다(하드코딩 기본 계정 admin/admin123 류 없음). ⛔ 배포 전 `SEED_DEFAULT_ADMIN=false`, `APP_ENV=production`.
- 로그인하면 **access JWT(15분, 메모리, `sid` 클레임)** 와 **refresh HttpOnly 쿠키(`refresh_token`, `Path=/api/v1/auth`, DB `auth_sessions`, 회전)** 가
  발급된다(`REFRESH_TOKEN_TRANSPORT=cookie` — 응답 본문의 `refresh_token` 은 `null`). 로그아웃하면 세션이 폐기돼 access 토큰도 즉시 401 이 된다.
  상세는 `ARCHITECTURE.md` §9·§14.
- 흐름: 첫 화면 `/` 는 **공개**다. 로그인이 필요한 화면(`/me`, `/admin/**`)에 들어가면 `/login?next=<원래 위치>` 로 갔다가 로그인 후 그 위치로 돌아온다. 화면 목록은 아래 "화면 구성".
- `users` 테이블은 `role`(일반 `user` / 관리자 `admin`)로 권한을 구분한다. 관리자 전용 API 는 `require_admin` 의존성으로 보호한다.
- 로그인 브루트포스 방어(429)는 **DB `login_throttles`** 의 계정별 잠금이다 — 연속 `LOGIN_MAX_FAILURES`(5)회 실패 시 `LOGIN_LOCKOUT_MINUTES`(15)분 잠금, 다중 워커에서도 공유된다(§9).

## 화면 구성

프론트엔드는 **공개 사용자 화면**(`app/layouts/default.vue`)과 **관리자 콘솔**(`app/layouts/admin.vue`) 두 레이아웃으로 나뉜다. 라우트는 `frontend/app/pages/` 파일 구조 그대로이고, 상세 규칙은 [`ARCHITECTURE.md` §14 "화면 구성 · 레이아웃 · 관리자 가드"](ARCHITECTURE.md#14-프론트엔드-인증-흐름)를 따른다.

| 영역 | 경로 | 내용 |
|------|------|------|
| 사용자 (상단 내비) | `/` | 배너 캐러셀(없으면 기본 히어로) · 주요 서비스 · 최신 공지 · 내 계정 |
| | `/notices`, `/notices/:id` | 공지 목록(고정·검색·페이지) · 상세(본문·첨부 다운로드) |
| | `/login`, `/me` | 로그인(`?next=` 로 원래 위치 복귀) · 내 정보/로그아웃(로그인 필요) |
| 관리자 콘솔 (사이드바) | `/admin` | 대시보드 — 사용자·세션·잠금·공지·배너·DB 상태 |
| | `/admin/notices` | 공지 작성·수정(리치 텍스트 에디터 — 이미지·유튜브), 첨부 업로드·다운로드, 저장 안 한 변경 이탈 확인 |
| | `/admin/banners` | 배너 이미지 업로드, 링크·노출 기간, 활성 토글, 순서 변경 |
| | `/admin/users`, `/admin/sessions`, `/admin/login-throttles` | 권한·활성 변경, 세션 강제 종료, 로그인 잠금 해제 |
| | `/admin/system` | 백엔드·DB 헬스 체크, Alembic 리비전 |

- `/admin/**` 는 `middleware/admin.ts` 가 지킨다 — 비로그인이면 로그인 화면으로, 로그인했지만 관리자가 아니면 403 화면. 권한 경계는 백엔드(`/api/v1/admin/*` 의 `require_admin`)다.
- 디자인 토큰은 `DESIGN.md` → `frontend/app/assets/css/main.css` 의 `@theme` 다. 화면의 `[대괄호]` 문구(히어로·서비스 카드·푸터)와 자리표시 메뉴(서비스·고객지원)는 프로젝트에 맞게 바꾼다.
- 업로드 파일은 백엔드 `UPLOAD_DIR`(기본 `backend/uploads/`, 커밋 금지)에 저장된다. 개발 서버는 `nitro.devProxy` 로 `/api` 와 `/uploads` 를 백엔드로 프록시한다.
  운영(`pnpm generate` 정적 산출)에서는 리버스 프록시가 같은 오리진의 `/api`·`/uploads` 를 백엔드로 넘기거나, 백엔드 `.env` 의 `PUBLIC_FILES_BASE_URL` 에 백엔드 공개 주소를 넣는다.

## DB 스키마 변경 (ARCHITECTURE.md §11)

```powershell
cd backend
.\.venv\Scripts\python -m alembic revision --autogenerate -m "변경요약"
.\.venv\Scripts\python -m alembic upgrade head
```

## 테스트 · 린트

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q          # 백엔드 테스트
.\.venv\Scripts\python -m ruff check .       # 백엔드 린트 (ruff)
cd ..\frontend; pnpm lint                     # 프론트 린트 (eslint)
pnpm typecheck                                 # 프론트 타입 체크 (nuxt typecheck)
pnpm test                                      # 프론트 단위 테스트 (vitest — lib 순수 모듈·에디터 컴포넌트)
```

## CI (ARCHITECTURE.md §20)

`.github/workflows/ci.yml` 이 push/PR(main) 마다 자동 실행한다 — 백엔드(ruff + pytest) / 프론트(eslint + nuxt typecheck + vitest + build).
CI는 push 이후 도는 **사후 안전망**이다. ⛔ 게이트는 push 전 로컬 검증(위 명령)이며, `main` 직접 커밋이 기본이고 브랜치·PR은 선택이다.
협업자가 생기면 `main` 브랜치 보호와 CI 필수 검사를 켜고 PR 흐름을 기본으로 되돌린다.
