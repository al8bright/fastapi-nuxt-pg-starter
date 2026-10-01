# __PROJECT_NAME__

공통 아키텍처(FastAPI · Nuxt · PostgreSQL) 기반 프로젝트.
상세 기준은 [`ARCHITECTURE.md`](ARCHITECTURE.md), 작업 순서는 [`PLAN.md`](PLAN.md), 디자인 토큰은 [`DESIGN.md`](DESIGN.md), AI 에이전트 지침은 [`AGENTS.md`](AGENTS.md), 프로젝트 고유 문서(PRD 등)는 [`docs/`](docs/README.md).

## 기술 스택 (주요 버전, 2026-08-11 기준)

> 아래 표는 **2026-08-11 기준** 요약이며, **정확한 출처(SSOT)** 는 다음 파일이다 — 변경 시 이 표가 아니라 해당 파일을 기준으로 한다:
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
| FastAPI | 0.137.2 |
| Uvicorn | 0.49.0 |
| SQLAlchemy | 2.0.51 |
| Alembic | 1.18.5 |
| psycopg2-binary | 2.9.12 |
| Pydantic / pydantic-settings | 2.13.4 / 2.14.2 |
| PyJWT | 2.13.0 |
| bcrypt | 4.3.0 |
| httpx2 | 2.5.0 |
| pytest | 9.1.1 |
| ruff | 0.14.0 |

### 프론트엔드 (`^` 범위 핀)
| 패키지 | 버전 |
|--------|------|
| Nuxt | 4.5 |
| Vue | 3.5 |
| vue-router | 5.2 |
| Pinia | 4.0 |
| @pinia/nuxt | 1.0 |
| Tailwind CSS | 4.3 |
| @tailwindcss/vite | 4.3 |
| @nuxt/eslint | 1.17 |
| ESLint | 10.8 |
| TypeScript | 6.0 |
| vue-tsc | 3.3 |

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

브라우저에서 http://localhost:5173 접속 → **로그인 화면**이 뜬다.

### 기본 인증 / 계정

스캐폴드에는 자체 계정(username/password) 로그인 플로우가 내장돼 있다:

- 초기 관리자는 **`backend/.env` 의 `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD`** 로 시드된다(없을 때만, lifespan 시드).
  스캐폴드가 비밀번호를 **랜덤 생성해 `backend/.env` 에 기록**하므로 거기서 확인한다. 미설정이면 시드를 건너뛴다.
  하드코딩 기본 계정(admin/admin123 류)은 없다.
- 로그인하면 **access JWT(15분, 메모리)** 와 **refresh HttpOnly 쿠키(DB `sessions`, 회전)** 가 발급된다 — 상세는 `ARCHITECTURE.md` §9·§14.
- 흐름: **미인증 → `/login`** → 로그인 성공 → **메인(`/`)** → 랜딩(`/landing`, 시스템 상태) / **My(`/my`, 내 정보·로그아웃)**.
- `users` 테이블은 `role`(일반 `user` / 관리자 `admin`)로 권한을 구분한다. 관리자 전용 API 는 `require_admin` 의존성으로 보호한다.
- ⚠️ 로그인 브루트포스 방어(429)는 **인메모리 카운터(단일 프로세스 전제)** 다 — 다중 워커 배포는 Redis 등으로 교체한다(§9).

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
```

## CI (ARCHITECTURE.md §20)

`.github/workflows/ci.yml` 이 push/PR(main) 마다 자동 실행한다 — 백엔드(ruff + pytest) / 프론트(eslint + nuxt typecheck + build).
CI는 push 이후 도는 **사후 안전망**이다. ⛔ 게이트는 push 전 로컬 검증(위 명령)이며, `main` 직접 커밋이 기본이고 브랜치·PR은 선택이다.
협업자가 생기면 `main` 브랜치 보호와 CI 필수 검사를 켜고 PR 흐름을 기본으로 되돌린다.
