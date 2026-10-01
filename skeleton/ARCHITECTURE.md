# 프로젝트 공통 아키텍처 가이드

> 본 문서는 **이 템플릿으로 만드는 모든 웹 프로젝트**가 따르는 공통 표준이다.
> 표준 스택은 **FastAPI(백엔드) + Nuxt(프론트엔드) + PostgreSQL**이며,
> 인증은 **자체 계정 또는 OIDC SSO**, 시각은 **KST 단일 기준**을 따른다.

---

## ★ 핵심 MUST 요약 (반드시 고정)

> 아래 항목은 **프로젝트마다 바뀌지 않는 고정 규칙**이다. 어기려면 `ARCHITECTURE.md`에 사유를 남기되, ⛔ 표시 항목은 예외 없이 금지한다.
> 세부 내용은 각 섹션(§) 참조.

| # | 고정 규칙 (MUST) | § |
|---|------------------|---|
| 1 | **표준 스택 고정**: 백엔드 FastAPI 0.142 + SQLAlchemy 2.1 + Alembic, 프론트 Nuxt(SPA) + Vue 3 + TS, DB는 **PostgreSQL** | §2 |
| 2 | **DB는 항상 Alembic으로만 관리** — 모든 스키마 생성·변경은 마이그레이션. ⛔ dev/운영 런타임 `create_all`·자동 DDL·수동 `ALTER` 금지(테스트 in-memory만 예외) | §11 |
| 3 | **설정은 OS 무관하게 `.env`로 주입** — 동일 `.env`가 Windows/mac/Linux에서 동작. ⛔ 개발 중 `$env:`/`export`/`set` 셸 환경변수 의존 금지. ⛔ `.env` 커밋 금지(`.env.example`만) | §5, §17 |
| 4 | **시각은 KST 단일 기준** — `now()`는 naive `datetime.now()`, PostgreSQL `connect_args`에 `timezone=Asia/Seoul`, 런타임 `TZ=Asia/Seoul`. ⛔ UTC 변환/`ZoneInfo` 신규 도입 금지 | §10, §7 |
| 5 | **API 경로 `/api/v1` 고정** — 버전 prefix는 `main.py`에서, 라우터는 `api/v1/router.py`로 집계 | §4 |
| 6 | **설정 접근은 `get_settings()` + `@lru_cache`** — ⛔ 모듈 전역 `settings` 싱글톤 금지 | §5 |
| 7 | **공통 의존성은 `app/dependencies.py` 단일 파일** (`get_db`, `get_current_user` 등) | §6 |
| 8 | **계층 분리** — 라우터(`api/`)는 HTTP만 얇게, 도메인 로직은 `services/`, 검증/직렬화는 `schemas/` | §4, §8 |
| 9 | **프론트 표준 스택 고정**: `$fetch`(ofetch) + Nuxt `useAsyncData`/`useFetch` + Pinia. ⛔ 서버 상태를 `ref` + `onMounted`로 직접 패칭 금지 | §2, §13 |
| 10 | **패키지 매니저는 pnpm** — ⛔ npm 사용 금지 | §2 |
| 11 | **인증은 access JWT(메모리, 15분, `sid` 클레임) + refresh HttpOnly 쿠키(DB `auth_sessions`, 회전·재사용 감지·즉시 폐기)** — API 요청은 `Authorization: Bearer <access>`, 검증 실패 시 401. 로그인 시도 제한은 DB `login_throttles`(429). ⛔ 토큰의 `localStorage` 저장 금지 | §9 |
| 12 | **테스트는 pytest + SQLite in-memory** — `get_settings.cache_clear()` autouse, `dependency_overrides`로 격리 | §12 |
| 13 | **TDD + Tidy First** — Red→Green→Refactor, 구조 변경과 동작 변경을 한 커밋에 섞지 않음 | §18 |
| 14 | **커밋 메시지**: `[Structural]`/`[Behavioral]` + conventional type, 테스트·린트 통과 시에만 | §19 |
| 15 | **push 전 로컬 테스트·린트 통과가 유일한 게이트** — `main` 직접 커밋이 기본(브랜치·PR은 선택), 1 커밋은 Structural·Behavioral 중 하나만 | §20 |

---

## 0. 적용 범위 & 우선순위

- **MUST**: 신규 프로젝트는 반드시 따른다.
- **SHOULD**: 특별한 사유가 없으면 따른다. 벗어나면 `ARCHITECTURE.md`에 사유를 남긴다.
- **MAY**: 프로젝트 성격에 따라 선택한다.
- 본 가이드와 개별 프로젝트 문서가 충돌하면 **본 가이드 우선**. 예외는 프로젝트 `ARCHITECTURE.md`에 명시한다.

---

## 1. 프로젝트 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| **저장소/루트 폴더** | `PascalCase` 또는 `snake_case` 일관 유지(프로젝트 내 통일) | `MyProject`, `my_project` |
| **FastAPI app title** | `"<프로젝트> API"` | `FastAPI(title="my_project API", version="0.1.0")` |
| **PostgreSQL DB명** | `snake_case`, 프로젝트명 기반 | `my_project`, `shop` |
| **DB 테이블명** | `snake_case` **복수형**. 외부 시스템 연동 테이블은 접미사로 출처 표기 | `admins`, `events`, `orders_ext` |
| **Python 모듈 파일** | `snake_case`, 모델은 **단수** | `order.py`, `auth_service.py` |
| **프론트 컴포넌트 파일** | `PascalCase.vue`, 파일명 = 컴포넌트명 | `LoginForm.vue`, `EventCalendar.vue` |
| **프론트 페이지 파일** | Nuxt 파일 라우팅 규약 고정(소문자) — `app/pages/` 아래 URL 그대로. 동적 세그먼트는 대괄호 | `app/pages/index.vue`, `app/pages/login.vue`, `app/pages/[id].vue` |
| **프론트 라우트 디렉토리** | `kebab-case` (URL 세그먼트가 그대로 됨) | `app/pages/my-page/` |
| **프론트 컴포저블 파일** | `use<Domain>.ts` (`app/composables/`) | `useAuth.ts`, `useHealth.ts` |
| **환경변수 접두** | 백엔드는 `UPPER_SNAKE`, 프론트는 **`NUXT_PUBLIC_` 필수** | `DATABASE_URL`, `NUXT_PUBLIC_API_BASE_URL` |
| **refresh 쿠키 이름** | `refresh_token` 고정(HttpOnly, `Path=/api/v1/auth`) — access 토큰은 저장소 키가 없다(메모리 전용, §9·§14) | `refresh_token` |

> 프론트 환경변수는 **`VITE_` 가 아니라 `NUXT_PUBLIC_` 접두를 쓴다.** Nuxt 는 `nuxt.config.ts` 의
> `runtimeConfig.public` 을 단일 창구로 삼고, 그 값은 `NUXT_PUBLIC_*` 환경변수로 덮인다.
> 코드에서는 `import.meta.env` 가 아니라 **`useRuntimeConfig().public.*`** 로 접근한다(§17).

---

## 2. 기술 스택 표준

### 백엔드
- **언어/런타임**: Python 3.10+ (`X | None` 문법, `Mapped[]` 타입 힌트 사용)
- **프레임워크**: FastAPI 0.142.x + Uvicorn(`[standard]`)
- **ORM/마이그레이션**: SQLAlchemy 2.1 (`Mapped`/`mapped_column`) + Alembic
- **DB 드라이버**: PostgreSQL + `psycopg2-binary`
- **설정**: `pydantic-settings` (BaseSettings)
- **검증/직렬화**: Pydantic 2.x
- **인증**: access JWT(`PyJWT`) + 불투명 refresh 토큰(DB `auth_sessions` 테이블, §9), 로그인 시도 제한(DB `login_throttles`). **OIDC/SSO 연동 → `python-jose[cryptography]`**
- **테스트**: `pytest` + SQLite in-memory
- **HTTP 클라이언트(서버↔서버)**: `httpx2` (httpx 의 유지보수 후속, Starlette 1.x TestClient 호환)
- **버전 고정**: `requirements.txt`에 **`==` 정확한 버전 핀** (재현성 우선)

### 프론트엔드
- **빌드/런타임**: Nuxt 4.5 (**SPA 모드**) + Vue 3.5 + TypeScript 6.0
  - SPA 고정: `nuxt.config.ts`의 `ssr: false` + 정적 생성(`nuxt generate` → `200.html` SPA fallback 포함).
    백엔드가 별도 FastAPI 서버이고 인증 상태를 클라이언트(메모리 + HttpOnly 쿠키)가 들고 가므로 **SSR을 쓰지 않는다.**
- **라우팅**: **Nuxt 파일 기반 라우팅**(`app/pages/`). 인증 가드는 `app/middleware/auth.ts`(§14)
- **HTTP**: **`$fetch`(ofetch) 인스턴스 + 인터셉터** — `app/plugins/api.ts`에서 `$fetch.create()`로
  `credentials: "include"` + `onRequest`(메모리 access 토큰 Bearer 주입) + 401 시 refresh 1회 후 재시도(§14)를 붙여 `$api`로 provide 한다. **axios 를 쓰지 않는다.**
- **서버 상태**: **Nuxt 내장 `useAsyncData` / `useFetch`** (키 기반 캐싱/재요청/무효화). 별도 쿼리 라이브러리를 쓰지 않는다.
- **클라이언트 상태**: **Pinia** 4.0 (`@pinia/nuxt`) — 토큰·세션 등 전역 상태는 `app/stores/*.ts`의 setup store 에 둔다.
- **스타일**: Tailwind CSS v4 4.3 (CSS-first `@theme`)
- **패키지 매니저**: **pnpm** (npm 금지)
- **타입 체크**: `pnpm typecheck` = `nuxt typecheck` (vue-tsc 기반) — `postinstall`의 `nuxt prepare`가
  `.nuxt/tsconfig.{app,server,shared,node}.json`을 만들어야 동작한다
- **린트**: ESLint + `@nuxt/eslint`

> 프론트 표준 스택은 **`$fetch`(ofetch) + `useAsyncData`/`useFetch` + Pinia**로 통일한다.
> 매우 단순한 화면만 있는 소규모 도구는 `$fetch` 직접 호출 + 컴포넌트 지역 `ref`만으로 처리하는 것을 MAY로 허용하되,
> 그 사유를 `ARCHITECTURE.md`에 남긴다.

---

## 3. 저장소 구조(목표)

```
<ProjectName>/
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── tests/
│   └── uploads/                 # UPLOAD_DIR 기본값 — 업로드 파일(public/·private/), .gitignore 대상
├── frontend/
│   ├── app/
│   ├── package.json
│   ├── nuxt.config.ts
│   └── tsconfig.json
├── docs/                        # 프로젝트 고유 문서 (PRD·유저 플로우·기획서·<연동>-가이드 등)
│   └── README.md
├── AGENTS.md                    # AI 에이전트 공통 지침 (CLAUDE.md 가 @import)
├── CLAUDE.md                    # Claude Code 진입점
├── ARCHITECTURE.md              # 본 가이드 — 벗어난 결정/사유도 여기 기록
├── DESIGN.md                    # 디자인 토큰(색상/타이포그래피) — 테마(@theme)의 원본
├── PLAN.md                      # TDD 작업 순서 (필수)
├── .env.example
└── README.md
```

- 루트에 `PLAN.md`를 두고 **TDD 작업 순서**(실패 테스트 단위)를 관리한다.
- 환경값은 `.env.example`로 키만 공유하고 실제 `.env`는 커밋하지 않는다.

---

## 4. 백엔드 구조(`backend/app/`)

```
backend/app/
├── __init__.py
├── main.py                 # FastAPI 진입점, lifespan, 미들웨어, 라우터 등록
├── config.py               # Settings(BaseSettings) + get_settings()
├── dependencies.py         # get_db, get_current_user 등 공통 의존성  ★단일 파일
├── api/
│   ├── v1/                 # ★ /api/v1 버전 디렉토리
│   │   ├── router.py       # 하위 라우터 집계
│   │   ├── auth.py         # 자체 계정 /auth/login·refresh·logout·me; SSO는 도입 시 확장
│   │   ├── health.py
│   │   ├── notices.py      # 공개 공지 목록·상세·첨부 다운로드
│   │   ├── banners.py      # 공개 배너(노출 기간 안의 활성 배너)
│   │   ├── admin/          # /admin/* — 라우터 단위 require_admin (dashboard·users·notices·banners·editor)
│   │   └── <domain>.py     # 도메인별 APIRouter (얇은 HTTP 계층)
│   ├── errors.py           # ServiceError·StorageError → HTTP 상태 변환표(전역 핸들러)
│   └── files.py            # 첨부 다운로드 응답(Content-Disposition), 업로드 크기 제한 읽기
├── core/
│   ├── security.py         # access JWT·refresh 불투명 토큰, 비밀번호 정책, now() (KST naive)
│   ├── storage.py          # UPLOAD_DIR 로컬 저장소 — 이미지 검증·재인코딩, 첨부 허용 목록, 키 해석 (§8)
│   └── sanitize.py         # 리치 텍스트 본문 HTML 정화(nh3 허용 목록) (§8)
├── db/
│   ├── base.py             # DeclarativeBase (Base)
│   ├── engine.py           # 엔진 팩토리 (SQLite/PG 분기, KST connect_args)
│   └── session.py          # get_db 세션 / SessionLocal
├── models/
│   ├── __init__.py         # 모든 모델 re-export (Alembic/메타데이터 등록용)
│   ├── auth_session.py     # AuthSession(refresh 세션) + LoginThrottle(로그인 시도 제한) (§9)
│   ├── notice.py           # Notice + NoticeAttachment
│   ├── banner.py           # Banner
│   └── <domain>.py
├── schemas/
│   └── <domain>.py         # Pydantic BaseModel (요청/응답)
└── services/
    ├── session_service.py  # refresh 세션 생성·회전·폐기 (§9)
    ├── notice_service.py   # 공지 — 저장 직전 sanitize_html, 게시일·조회수, 첨부
    ├── banner_service.py   # 배너 — 노출 기간 판정, 이미지 key 검증, 순서
    ├── admin_service.py    # 대시보드 집계, 사용자 권한·활성(자기 강등·마지막 관리자 보호), 세션·스로틀 관리
    ├── upload_service.py   # 공개 이미지 업로드(에디터·배너) 응답 조립
    ├── <domain>_service.py # 비즈니스 로직
    └── exceptions.py       # ServiceError 등 도메인 예외
```

### 계층 규칙 (MUST)
- **라우터(`api/`)는 얇게**: HTTP 입출력·인증·상태코드만. 비즈니스 로직 금지.
- **도메인 로직은 `services/`**: DB 트랜잭션, 규칙 검증, 외부 연동.
- **`schemas/`**: Pydantic 검증·직렬화 전용. ORM 모델과 분리.
- **의존성 주입**: DB 세션·현재 사용자는 항상 `Depends()`로 주입.

### `main.py` 표준 형태
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    import app.models  # 모델 메타데이터 등록
    # 엔진/세션 팩토리 초기화는 app.state 또는 db 모듈에서
    yield

app = FastAPI(title="<Project> API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")   # ★ 버전 prefix는 여기서

@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

### 라우터 집계 (`api/v1/router.py`)
```python
from fastapi import APIRouter
from app.api.v1 import auth, health, orders   # 도메인 모듈

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(health.router)
api_router.include_router(orders.router)
```

---

## 5. 설정 (`config.py`)  — `get_settings()` + `@lru_cache`

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore",
    )

    # 실행 환경 — "production" 이면 안전하지 않은 기본값으로 기동하지 않는다 (§9)
    app_env: str = "development"

    # DB
    database_url: str | None = None

    # JWT / 세션 — access 는 짧게(탈취 창 축소), 갱신은 DB 세션 기반 refresh 토큰이 담당한다 (§9)
    secret_key: str = DEFAULT_SECRET_KEY  # "change-me-in-production-use-32-bytes"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    # 로그인 시도 제한 — 계정별 연속 실패가 max 이상이면 lockout 분 동안 429 (§9)
    login_max_failures: int = 5
    login_lockout_minutes: int = 15

    # refresh 토큰 전달 방식 (§9) — 이 템플릿(브라우저 SPA)은 cookie
    refresh_token_transport: Literal["cookie", "body"] = "cookie"
    cookie_secure: bool = False  # 운영(HTTPS)에서는 true (production + cookie 에서 false 면 기동 거부)

    # 초기 시드 — 기본은 꺼짐. 개발 환경에서만 .env 로 켠다. ⛔ 비밀번호 기본값 없음
    seed_default_admin: bool = False
    default_admin_password: str | None = None

    # CORS
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

규칙:
- **접근은 항상 `get_settings()` 함수로** (모듈 전역 `settings` 싱글톤 금지).
  → 테스트에서 `get_settings.cache_clear()`로 환경을 재설정할 수 있어야 한다.
- 파생 값은 `@property`(예: `cors_origin_list`)로 노출한다.
- 환경변수명이 필드명과 다르면 `Field(validation_alias=...)`로 명시한다.

### 설정 주입은 항상 `.env` — OS 독립 (MUST)

> **개발 환경 설정은 OS에 관계없이 반드시 프로젝트 루트의 `.env` 파일로 주입한다.**
> Windows/macOS/Linux 어디서든 **동일한 `.env` 파일**로 동작해야 한다.

- 백엔드: `pydantic-settings`가 `.env`를 로드한다(`env_file=".env"`). 코드에 설정값 하드코딩 금지.
- 프론트엔드: Nuxt가 `.env`의 `NUXT_PUBLIC_*`를 `runtimeConfig.public`으로 로드한다(§17). `useRuntimeConfig()`로만 접근.
- **금지(MUST NOT)**: 개발 중 OS별 셸 환경변수 설정에 의존하는 방식.
  - PowerShell `$env:VAR=...`, bash `export VAR=...`, `set VAR=...` 등으로 **셸에 값을 심어두고 실행하는 것** — OS·셸마다 달라 재현되지 않는다.
  - `launch.json`/IDE 설정·OS 사용자 환경변수에 비밀값을 박아두는 것.
- **예외**: 컨테이너/CI/배포 런타임에서 **오케스트레이터가 주입하는 실제 환경변수는 허용**(이때도 `pydantic-settings`가 `.env`와 동일 인터페이스로 읽으므로 코드 변경 불필요). 즉, **로컬 개발은 `.env` 강제**, 운영은 동일 키를 환경변수로 주입.
- `.env`는 **커밋 금지(`.gitignore`)**, `.env.example`에 **키만** 채워 커밋한다(§17).
- 줄바꿈/인코딩은 `UTF-8`로 통일하고, `.env`는 OS별로 갈라지지 않게 저장소에 `.gitattributes`로 `* text=auto eol=lf`를 권장한다.

---

## 6. 의존성 주입 (`app/dependencies.py`)  ★단일 파일

```python
from collections.abc import Generator
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.security import decode_access_token

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(...), db: Session = Depends(get_db)):
    cred_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "인증이 필요합니다.")
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise cred_error
    user = ...  # services 통해 조회
    if user is None:
        raise cred_error
    return user
```

- 공통 의존성(`get_db`, `get_current_user`, 권한 체크 등)은 **`app/dependencies.py` 한 곳**에 모은다.

---

## 7. DB · 세션 · 엔진

`app/db/engine.py` (엔진 팩토리 — SQLite 테스트/PostgreSQL 운영 동시 지원):
```python
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from app.config import Settings

def postgres_connect_args() -> dict[str, str]:
    return {"options": "-c timezone=Asia/Seoul"}   # ★ KST 고정

def create_engine_from_settings(settings: Settings) -> Engine:
    url = settings.database_url or "sqlite:///:memory:"
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url:
            kwargs["poolclass"] = StaticPool
    elif "postgresql" in url:
        kwargs["connect_args"] = postgres_connect_args()
    return create_engine(url, pool_pre_ping=True, **kwargs)
```

`app/db/base.py`:
```python
from sqlalchemy.orm import DeclarativeBase
class Base(DeclarativeBase):
    pass
```

`app/db/session.py`: 요청 단위 세션을 제공한다(`SessionLocal` 또는 `get_db`).
**PostgreSQL 연결에는 반드시 `timezone=Asia/Seoul` connect_args를 적용한다.**

---

## 8. 모델 · 스키마 · 서비스 규칙

### 모델 (`models/`) — SQLAlchemy 2.x `Mapped`
```python
from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.security import now
from app.db.base import Base

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
```
- 모든 모델은 `models/__init__.py`에서 import(re-export)하여 메타데이터에 등록한다.
- 생성·수정 시각은 `default=now`(KST naive). 열거형은 `str, enum.Enum`을 상속.

### 스키마 (`schemas/`)
- `XxxBase` → `XxxCreate`/`XxxUpdate`/`XxxRead` 상속 패턴.
- 제약은 `Field(ge=, gt=, max_length=)`, 복합 규칙은 `@field_validator`.

### 서비스 (`services/`)
- 함수형 서비스(`def create_order(db, user, data)`)를 기본으로 한다.
- 실패는 `ServiceError(code=...)` 같은 **도메인 예외**로 던지고, 라우터에서 HTTP로 변환.
- N+1 방지: 조회 시 `selectinload` 등 명시적 로딩 옵션.
- `ServiceError(code)`(와 저장소의 `StorageError`)는 `app/api/errors.py` 의 전역 핸들러가 `STATUS_BY_CODE` 표로 HTTP 상태를 정한다(`not_found` 404, `self_modification`·`last_admin`·`too_many_attachments` 409, `file_too_large` 413, 검증류 422, 표에 없으면 400). 응답 본문은 `{"detail": <메시지>, "code": <코드>}`. 인증 라우터(`auth.py`)는 401/429 와 쿠키·헤더가 얽혀 있어 직접 변환한다.

### 기본 제공 테이블

| 테이블 | 리비전 | 용도 |
|--------|--------|------|
| `app_meta` | `0001_initial` | 연결 확인용 샘플(`/health/db`) |
| `users` | `0002_users` | 자체 계정 — `role`(`user`/`admin`), `is_active` |
| `auth_sessions`, `login_throttles` | `0003_auth_sessions` | refresh 세션(해시만 저장), 계정별 로그인 실패 카운터 (§9) |
| `notices` | `0004_notices_banners` | 공지 — `body_html`(저장 시 정화), `is_pinned`, `is_published`, `published_at`(처음 게시 때 1회), `view_count`, `author_id`(FK users, `SET NULL`) |
| `notice_attachments` | 〃 | 공지 첨부 — `notice_id`(FK, `CASCADE`), `storage_key`(private 키), `original_name`, `content_type`, `size_bytes`. 공지당 최대 10개 |
| `banners` | 〃 | 배너 — `image_key`(public/banners 키)·`image_width/height`(서버가 잰 값), `link_url`(http(s) 또는 `/` 내부 경로만), `alt_text`, `starts_at`/`ends_at`(노출 기간, NULL=무제한), `sort_order`, `is_active` |

### 파일 업로드 · 저장소 · 본문 HTML 정화

**저장소(`core/storage.py`)** — 업로드 파일은 `UPLOAD_DIR`(기본 `backend/uploads/`, 상대 경로는 backend 기준) 아래에 **서버가 만든 키**로만 저장한다. 사용자 파일명은 디스크 경로에 쓰지 않는다.

| 키 | 내용 | 노출 |
|----|------|------|
| `public/editor/YYYY/MM/DD/<uuid>.<ext>` | 에디터 본문 이미지 | `/uploads/public/...` 정적 서빙 (`Cache-Control: public, max-age=31536000, immutable`) |
| `public/banners/YYYY/MM/DD/<uuid>.<ext>` | 배너 이미지 | 〃 |
| `private/attachments/YYYY/MM/DD/<uuid>.<ext>` | 공지 첨부(원본 파일명은 DB) | ⛔ 정적 서빙 금지 — 다운로드 API 로만 |

- **이미지**: 매직 바이트 + Pillow 로 실제 이미지인지 확인(PNG·JPEG·WebP·GIF 만, SVG·BMP 등 거부, 4천만 픽셀 초과 거부) → EXIF 방향 반영 → 긴 변 `MAX_LONG_EDGE`(2000px) 초과 시 축소 → **메타데이터 없이 재인코딩**(EXIF·위치 정보 제거). **GIF 는 애니메이션 보존을 위해 재인코딩하지 않고 그대로** 저장한다(크기 상한은 업로드 용량 제한). 애니메이션 WebP 는 첫 프레임만 남는다. 상한 `MAX_IMAGE_UPLOAD_MB`(5).
- **첨부**: 확장자 허용 목록(`pdf hwp hwpx doc docx xls xlsx ppt pptx txt csv zip png jpg jpeg`), `Content-Type` 은 클라이언트 값이 아니라 확장자 표로 정한다. 상한 `MAX_ATTACHMENT_UPLOAD_MB`(20). 다운로드는 `Content-Disposition: attachment; filename="<ASCII 대체>"; filename*=UTF-8''<RFC 5987>` + `nosniff` + `Cache-Control: private, no-store`.
- **경로 탈출 방지**: 키는 정규식(`(public/(editor|banners)|private/attachments)/YYYY/MM/DD/<32hex>.<ext>`)에 맞아야 해석하고, 해석된 경로가 `UPLOAD_DIR` 안인지 다시 확인한다. 정적 마운트 루트가 `UPLOAD_DIR/public` 이라 `../` 로도 private 에 닿지 않는다.
- **URL**: 응답의 공개 파일 URL = `PUBLIC_FILES_BASE_URL` + `/uploads/` + key. 비우면 루트 상대(`/uploads/public/...`) — 프론트엔드가 같은 오리진이거나 `/uploads` 를 백엔드로 프록시할 때. 다른 오리진·BFF 구성은 백엔드 공개 주소를 넣는다. 첨부 `download_url` 도 같은 접두사를 쓴다.
- **삭제**: 공지·첨부·배너 행을 지우면 커밋 후 파일도 지운다(배너 이미지는 다른 배너가 같은 키를 참조하지 않을 때만). 에디터 본문 이미지는 본문 HTML 이 참조하므로 자동으로 지우지 않는다 — 고아 파일 정리는 별도 배치 몫.
- 업로드 크기는 핸들러가 상한+1 바이트까지만 읽어 판정한다. multipart 본문 자체는 그 전에 임시 파일로 받아지므로, 운영에서는 앞단 프록시(nginx `client_max_body_size` 등)에도 상한을 둔다.

**본문 HTML 정화(`core/sanitize.py`, nh3)** — 리치 텍스트 본문은 **서비스 계층이 저장 직전에** `sanitize_html` 을 거친다(클라이언트를 믿지 않는다). 보기 화면에는 서버가 정화해 돌려준 HTML 만 넣는다.

- 허용 태그: `p div br hr span h1–h6 strong b em i u s strike sub sup mark small ul ol li blockquote pre code a img table thead tbody tfoot tr th td caption colgroup col iframe`
- 허용 속성: 모든 태그 `class`(값은 `align-left align-center align-right video` 만, 남는 값이 없으면 속성 제거) · `a`: `href target title` · `img`: `src alt width height title` · `iframe`: `src width height title allowfullscreen` · `div`: `data-youtube-video` · `td/th`: `colspan rowspan scope` · `ol`: `start` · `col`: `span`. `width/height` 는 1~4자리 정수만.
- `iframe[src]` 는 `^https://www\.youtube(?:-nocookie)?\.com/embed/[A-Za-z0-9_-]{11}$` 만 — 그 외(다른 호스트, 쿼리 문자열)는 iframe 을 **내용째** 지운다. 남는 iframe 에는 `sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"`·`loading="lazy"`·`referrerpolicy="strict-origin-when-cross-origin"` 를 강제한다.
- URL 스킴 `http https mailto tel`(+상대 경로)만 — `javascript:`·`data:` 는 제거. `a` 에는 `rel="noopener noreferrer"` 강제.
- `style`·`id`·`on*`·`srcdoc`·편집 전용 속성(`contenteditable`, `data-selected` 등)은 제거, `script`·`style` 은 내용째 제거.
- 정화 후 글자·`src` 있는 `img`·`iframe` 이 하나도 없으면 빈 본문으로 422.
- ⚠️ **에디터와 정화 허용 목록은 한 쌍이다.** 에디터에 서식·미디어를 추가하면 허용 목록과 `tests/test_sanitize.py` 를 같은 변경에서 고친다(허용 목록을 넓힐 땐 테스트를 먼저).

### 공지·배너·관리자 API 요약

| 경로 (`/api/v1` 기준) | 인증 | 설명 |
|------|------|------|
| `GET /notices?page&size&q` · `GET /notices/{id}` · `GET /notices/{id}/attachments/{aid}` | 없음 | 게시된 공지만(초안은 404). 고정 먼저 → 게시일 최신순. 상세 조회 시 `view_count` +1 |
| `GET /banners` | 없음 | `is_active` + 노출 기간 안(KST 현재) — `sort_order`, `id` 순 |
| `/admin/*` | `require_admin` | 라우터 단위 의존성 — 비로그인 401, 일반 사용자 403. 역할은 요청마다 DB 에서 읽어 강등 즉시 403 |
| `GET /admin/dashboard` | 〃 | 사용자·세션·잠금·공지·배너 집계 + DB 상태 + Alembic 리비전 |
| `GET /admin/users` · `PATCH /admin/users/{id}` · `DELETE /admin/users/{id}/sessions` | 〃 | 자기 강등·비활성화 금지, 마지막 활성 관리자 보호(409). 비활성화 시 세션 전부 폐기 |
| `GET /admin/sessions` · `DELETE /admin/sessions/{id}` | 〃 | 살아 있는 세션 목록·강제 폐기 |
| `GET /admin/login-throttles` · `DELETE /admin/login-throttles/{username}` | 〃 | 잠금·최근 24시간 실패 목록, 잠금 해제 |
| `/admin/notices`(CRUD) · `/admin/notices/{id}/attachments` | 〃 | 저장 시 본문 정화, 첨부 업로드(multipart `file`)·다운로드·삭제 |
| `/admin/banners`(CRUD) · `POST /admin/banners/image` · `PATCH /admin/banners/order` | 〃 | 이미지 먼저 업로드 → `image_key` 로 참조 |
| `POST /admin/editor/images` | 〃 | multipart `file` → `{key, url, width, height}` |

---

## 9. 인증 (access JWT + refresh 세션 · SSO)

- `core/security.py`에 토큰 생성/검증과 비밀번호 정책, `now()`를 둔다. 세션(refresh) 도메인 로직은 `services/session_service.py`, 로그인·스로틀은 `services/user_service.py`, HTTP 변환은 `api/v1/auth.py`가 담당한다(§4 계층 분리 그대로).

### 토큰 모델 (자체 계정 — skeleton 구현)

- **access 토큰**: `PyJWT` HS256 JWT. 클레임은 `sub`(user id 문자열)·`sid`(세션 id)·`iat`·`exp`·`typ:"access"`. 만료 `ACCESS_TOKEN_EXPIRE_MINUTES` **기본 15분** — 짧게 잡아 탈취 창을 줄이고, 갱신은 refresh 토큰이 담당한다.
  로그인/refresh **응답 바디**로만 내려주고, 클라이언트는 **메모리에만** 보관한다(§14).
- **refresh 토큰**: JWT 가 **아니라** 불투명(opaque) 토큰 `"<session_id>.<urlsafe 무작위>"` 다. DB(`auth_sessions`)에는 **SHA-256 해시만** 저장한다 — DB 가 유출돼도 평문 토큰을 복원할 수 없고, 검증은 해시 재계산 + 상수시간 비교(`hmac.compare_digest`)다. refresh 토큰 1개 = `auth_sessions` 행 1개.
- **즉시 무효화**: `get_current_user` 가 요청마다 `sid` 세션의 유효성(존재·미폐기·미만료)을 검사한다 — 로그아웃·강제 폐기가 access 토큰 만료를 기다리지 않고 **즉시 401** 로 반영된다. `sid` 가 없는 토큰도 401 이다.
- 토큰은 `Authorization: Bearer <token>` 헤더. 검증 실패는 401 + `WWW-Authenticate: Bearer`.

### 테이블 (Alembic)

| 리비전 | 테이블 | 용도 |
|--------|--------|------|
| `0001_initial` | `app_meta` | 헬스체크(`/health/db`)용 메타 테이블 |
| `0002_users` | `users` | 자체 계정 — `username`(unique)·`hashed_password`(bcrypt)·`role`(`user`/`admin`)·`is_active` |
| `0003_auth_sessions` | `auth_sessions` | refresh 세션 — `id`(= refresh 토큰의 `<session_id>`·access 의 `sid`)·`user_id`(FK)·현재/직전 토큰 해시·`rotated_at`·`expires_at`(절대 수명)·`revoked_at` |
| `0003_auth_sessions` | `login_throttles` | 계정(username)별 연속 로그인 실패 카운터·잠금 만료 시각 |

컬럼의 SSOT 는 `app/models/`·`alembic/versions/` 다.

### 엔드포인트 계약

| 엔드포인트 | 요청 | 응답 |
|------|------|------|
| `POST /auth/login` | `{username, password}` | `TokenResponse` + refresh 쿠키 (성공 200 / 자격증명 오류 401 / 잠금 429) |
| `POST /auth/refresh` | 본문 없음 — refresh 쿠키 | `TokenResponse` — **회전된 새 쌍**(쿠키도 교체). 실패는 원인 무관 401 **+ 쿠키 삭제** |
| `POST /auth/logout` | 본문 없음 — refresh 쿠키 | **204 멱등·인증 불요** — 토큰 "소지"가 폐기 권한이다(해시 검증 후 폐기). 쿠키 유무·상태와 무관하게 항상 204 + 쿠키 삭제 |
| `GET /auth/me` | Bearer access | `UserRead` |

- `TokenResponse` 는 로그인·리프레시가 **동일 형태**다: `{access_token, refresh_token, token_type, expires_in, refresh_expires_in}`. 이 템플릿(cookie 모드)에서 `refresh_token` 은 **항상 `null`** 이다. `expires_in`/`refresh_expires_in` 은 절대 시각이 아니라 **"지금부터 남은 초"** 다 — 클라이언트가 서버와 시계를 맞출 필요 없이 갱신 시점을 계산한다.

### refresh 토큰 전달 방식 (`REFRESH_TOKEN_TRANSPORT`)

같은 백엔드 코드가 BFF 와 브라우저 SPA 를 모두 섬기도록 refresh 토큰의 운반 경로만 설정으로 바꾼다. 세션·회전·재사용 감지 로직은 동일하다.

| 모드 | 대상 | 동작 |
|------|------|------|
| `cookie` (**코드 기본값 · 이 템플릿**) | 브라우저 SPA (React·Nuxt·SvelteKit) | login/refresh 가 refresh 토큰을 **httpOnly 쿠키**로 심고 본문의 `refresh_token` 은 `null` 이다 — JS 가 refresh 토큰을 읽을 수 없다. refresh/logout 은 쿠키에서 읽고 본문은 보지 않는다. refresh 실패는 401 **+ 쿠키 삭제**, logout 은 항상 204 + 쿠키 삭제 |
| `body` | BFF (Next.js 서버) | 요청·응답 JSON 본문으로 주고받고 쿠키를 쓰지 않는다. refresh/logout 본문은 필수(없으면 422). ⛔ 이 템플릿(브라우저 SPA)에서는 쓰지 않는다 — refresh 토큰이 JS 에 노출된다 |

- 쿠키 속성(cookie 모드): 이름 `refresh_token`, **`Path=/api/v1/auth`**(refresh/logout 에만 전송 — 일반 API 요청에는 실리지 않는다), **`HttpOnly`**(JS 접근 불가 → XSS 로 탈취 불가), `SameSite=Lax`, `Secure=COOKIE_SECURE`, `Max-Age` = 세션의 남은 절대 수명(`refresh_expires_in` 과 같은 값).
- ⛔ `APP_ENV=production` + `cookie` 모드에서 `COOKIE_SECURE=false` 면 **기동을 거부**한다. 교차 출처 SPA 의 쿠키 갱신을 위해 CORS 는 `allow_credentials=True` 이며, 따라서 `CORS_ORIGINS` 에 출처를 명시한다(`*` 불가).
- **회전(rotation)**: `/auth/refresh` 는 성공할 때마다 새 secret 으로 교체하고, 직전 해시를 `prev_token_hash` 에 보관한다. **재사용 감지** — 현재 해시도 직전 해시도 아니거나, 직전 해시이지만 회전(`rotated_at`) 후 `ROTATION_GRACE_SECONDS`(60초)가 지났으면 탈취 신호로 보고 **그 세션을 즉시 폐기**한다. 응답은 다른 실패와 동일한 401 이다 — 실패 사유(형식 오류/미존재/만료/폐기/재사용)를 응답으로 구분하지 않아 공격자가 토큰 상태를 탐침하지 못한다.
- **동시 요청 유예(60초)**: 멀티 탭이 **같은 refresh 쿠키로 동시에** 갱신을 치는 것은 정상 상황이다 — 유예 없이 전부 재사용으로 판정하면 첫 요청만 이기고 나머지가 세션을 폐기해 사용자가 주기적으로 강제 로그아웃당한다. 그래서 직전 토큰은 회전 후 60초 동안만 정상 회전으로 받아 준다(이때 `prev_token_hash`·`rotated_at` 은 갱신하지 않는다 — 창이 슬라이딩하면 탈취된 이전 토큰이 무한히 살아남는다). 유예 내 이전 토큰 허용의 추가 노출은 실질 0 이다 — 그 토큰을 가진 공격자는 회전 전에도 같은 토큰을 쓸 수 있었다.
- ⚠️ **회전해도 절대 수명은 연장되지 않는다** — `expires_at` 은 로그인 시점 + `REFRESH_TOKEN_EXPIRE_DAYS`(기본 14일)로 고정이다. 회전으로 세션이 무한히 살아남지 못한다.

### 로그인 보호 (계정 존재 비노출 · 시도 제한)

- **실패 메시지 통일**: 로그인 실패는 원인(자격증명 불일치/비활성 계정)과 무관하게 같은 문구·같은 401 이다. 미존재 계정에도 **더미 bcrypt 해시로 1회 검증**해 응답 시간(타이밍)으로도 존재 여부가 드러나지 않게 한다.
- **로그인 스로틀**: 계정(username)별 DB 카운터(`login_throttles`). 연속 실패가 `LOGIN_MAX_FAILURES`(기본 5) 이상이면 `LOGIN_LOCKOUT_MINUTES`(기본 15분) 동안 **429** 로 거부한다. **미존재 계정도 행을 만들어 같은 429 를 받는다** — 잠금 응답 유무로도 계정 존재가 구분되지 않는다. 성공 시 스로틀 행은 삭제된다. DB 에 있으므로 다중 워커·다중 인스턴스에서도 공유된다. 429 응답에는 `Retry-After` 헤더가 없다(프론트는 일반 안내 문구만 보여준다, §14).
- **감사 로그**: 보안 이벤트(로그인 성공/실패/잠금, refresh 회전/거부/재사용 감지, 로그아웃)는 전용 로거 **`app.audit`** 로 남긴다 — 일반 로그와 분리 수집할 수 있다. 원인 구분은 응답이 아니라 이 로그로만 한다.

### 비밀번호 정책

- **새로 저장하는 비밀번호**는 `validate_new_password()` 한 곳에서 통합 검증한다 — 최소 `PASSWORD_MIN_LENGTH`(8자) + `len(password.encode("utf-8")) <= 72` bytes(bcrypt 상한). 위반은 422 도메인 오류로 변환한다. 한글은 UTF-8에서 글자당 3 bytes이므로 문자 수 제한과 같지 않다. 조합 규칙은 두지 않는다(NIST 800-63B 권고 방식).
- 하한(8자)은 "새 비밀번호를 만드는 규칙"이라 **로그인 검증에는 적용하지 않는다** — 기존 계정의 짧은 비밀번호로도 로그인은 된다. 상한(72 bytes)은 HTTP 입력(스키마)에서도 미리 걸러 절단 착시를 막고, `hash_password()`도 방어적으로 초과 시 `ValueError`를 발생시킨다.

### SECRET_KEY · 초기 관리자 · `APP_ENV`

- `SECRET_KEY` 가 공개된 기본값(`change-me-in-production-use-32-bytes`)이면 개발에서는 기동 **경고**, `APP_ENV=production` 에서는 **기동 실패**다(공개된 키라 토큰 위조가 가능하다). 32 bytes 미만이면 경고한다. 스캐폴드가 `.env` 에 랜덤 생성해 넣는다.
- 기본 관리자(`admin`)는 `SEED_DEFAULT_ADMIN=true` + `DEFAULT_ADMIN_PASSWORD` 로 기동 시 시드한다. **코드 기본값은 꺼짐**이고, 스캐폴드가 개발용 `.env` 에서만 켜고 무작위 비밀번호를 넣어 출력한다. 비밀번호가 비어 있으면 시드를 건너뛰고 에러 로그를 남긴다. ⛔ **비밀번호 기본값·하드코딩 기본 계정(예: admin/admin123)은 금지** — 설정을 빠뜨린 모든 배포가 같은 자격증명을 갖게 된다. ⛔ `APP_ENV=production` 에서 `SEED_DEFAULT_ADMIN=true` 면 기동을 거부한다.

### CORS · 응답 헤더

- CORS 는 `allow_credentials=True` + `allow_methods/allow_headers=["*"]` 이고, 출처는 `CORS_ORIGINS` 에 명시한다(`*` 불가).
- 백엔드는 보안 응답 헤더(`X-Frame-Options`·HSTS 등)나 `Cache-Control: no-store` 를 붙이지 않는다 — 필요하면 프론트 정적 호스팅·리버스 프록시(nginx 등)에서 설정한다.

### 배포 전제 (same-site)

- `SameSite=Lax` 쿠키이므로 **프론트와 API 는 same-site 로 배포**한다(예: `app.example.com` + `api.example.com`).
- 완전 크로스 사이트 배포는 지원하지 않는다 — 하려면 `SameSite=None` + 별도 CSRF 대책이 필요하다.

### OIDC SSO 연동 (선택)

- 백엔드가 authorize→callback→userinfo 처리 후 앱 세션 JWT 발급, `python-jose`.
- 최초 로그인 시 `provision_from_userinfo()`로 사용자 upsert(없으면 생성, 식별정보 갱신).

### 응답 보안 헤더 · 캐시 금지 · CORS

백엔드는 모든 응답에 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin` 을 붙인다(`app/main.py` 보안 헤더 미들웨어 — CORS 바깥에서 감싸 preflight·오류 응답에도 적용).
HSTS(`max-age=31536000`)는 `COOKIE_SECURE=true` 이거나 `APP_ENV=production` 일 때만 보낸다 — body 모드(BFF) 운영은 `COOKIE_SECURE` 를 켜지 않을 수 있어 production 도 조건에 넣었고, 브라우저는 평문 HTTP 로 받은 HSTS 를 무시하므로 TLS 종단이 앞단 프록시여도 무해하다.
CSP 는 `/docs`·`/redoc` 의 CDN·인라인 스크립트를 막으므로 백엔드에서 붙이지 않고 프론트엔드(정적 호스팅/BFF) 쪽 책임으로 둔다.

- `/api/v1/auth/*` 응답은 성공·오류(401/422/429)·쿠키 삭제 응답을 가리지 않고 `Cache-Control: no-store` 다.
- 로그인 잠금 429 는 `Retry-After`(남은 잠금 초, 올림·최소 1)를 싣는다. 미존재 계정도 같은 스로틀 행을 거쳐 같은 헤더를 받으므로 계정 존재가 드러나지 않는다.
- CORS 는 `CORS_ORIGINS` 의 출처만 허용하고 `allow_credentials=True`(cookie 모드 refresh 쿠키 전송)를 유지하되, 메서드는 `GET·POST·PUT·PATCH·DELETE·OPTIONS`, 요청 헤더는 `Authorization·Content-Type` 만 명시 허용하며 `Retry-After` 를 expose 한다. 새 커스텀 요청 헤더가 필요하면 `app/main.py` 의 `CORS_ALLOW_HEADERS` 에 추가한다.

---

## 10. 날짜·시간 (KST)  — MUST

- **기준**: 저장·표시되는 업무 일자는 **KST**로 통일. 애플리케이션에 UTC↔KST 변환 레이어를 두지 않는다.
- **PostgreSQL**: 엔진 `connect_args`에 `options="-c timezone=Asia/Seoul"`.
- **FastAPI**: `app.core.security.now()`는 **naive `datetime.now()`만** 사용.
- **실행 환경**: API 프로세스에 **`TZ=Asia/Seoul`** 설정.
- **금지(신규 코드)**: `datetime.now(timezone.utc)`, `ZoneInfo` 기반 변환 추가.

---

## 11. 마이그레이션 (Alembic)  — MUST: DB는 항상 Alembic으로 관리

> **모든 DB 스키마는 예외 없이 Alembic 마이그레이션으로만 생성·변경한다.**
> 개발·스테이징·운영 어느 환경에서도 동일하다. 스키마의 단일 진실 공급원(SSOT)은 마이그레이션 히스토리다.

- `alembic/env.py`에서 `app.config.get_settings()`의 DB URL과 `Base.metadata`를 사용한다.
- `import app.models`로 모든 모델을 로드한 뒤 `target_metadata = Base.metadata`.
- `compare_type=True`, PostgreSQL은 `NullPool` 권장. offline/online 모두 지원.
- 모델 변경 시 워크플로:
  ```powershell
  alembic revision --autogenerate -m "<변경 요약>"   # 초안 생성
  # 생성된 versions/*.py 를 반드시 검토·수정 (autogenerate는 초안일 뿐)
  alembic upgrade head                               # 적용
  ```
- 모든 마이그레이션은 **`downgrade()`를 작성**하고, 가능하면 되돌릴 수 있게 한다.
- 마이그레이션 파일은 **반드시 커밋**한다. 머지 시 head가 갈라지면 `alembic merge`로 정리.

### 금지 (MUST NOT)
- **런타임 `Base.metadata.create_all()`로 운영/개발 스키마를 만드는 행위** — 단, **테스트(SQLite in-memory)에서만 예외 허용**(§12).
- `DATABASE_AUTO_DDL` 같은 **자동 DDL 플래그를 dev/prod에서 켜는 것**.
- DB 콘솔에서 직접 `ALTER TABLE` 등 **마이그레이션을 거치지 않은 수동 스키마 변경**.

---

## 12. 백엔드 테스트 (pytest)

- `pytest.ini`: `pythonpath = .`, `testpaths = tests`.
- DB는 **SQLite in-memory**, 테스트마다 `Base.metadata.create_all/drop_all`.
- `conftest.py`에 공통 픽스처:
  - `_clear_settings_cache` (autouse): `get_settings.cache_clear()`.
  - `db_session_factory`: 테스트 엔진에 바인딩된 세션 팩토리.
  - `db_session`: 테스트별 DB 세션.
  - `client`: `app.dependency_overrides[get_db]`를 적용한 기본 API 클라이언트(conftest 는 `REFRESH_TOKEN_TRANSPORT=body` 로 고정).
  - `lifespan_client`: 기동·종료 훅과 기본 관리자 시드·경고를 검증하는 클라이언트.
- skeleton 의 인증 회귀는 `tests/test_auth.py`(로그인·`/auth/me`·`sid`), **`tests/test_auth_sessions.py`**(refresh 회전·재사용 감지 시 세션 폐기·동시 갱신 60초 유예·절대 수명 비연장·로그아웃 멱등·즉시 무효화·로그인 스로틀·비밀번호 정책), **`tests/test_auth_cookie_transport.py`**(이 템플릿이 쓰는 cookie 모드 — 쿠키 속성·회전·삭제·429·production 기동 거부)가 고정한다(§9).
- 업로드·정화·공지·배너·관리자 회귀는 `tests/test_sanitize.py`(정화 허용 목록 표, §8)·`test_storage.py`(재인코딩·축소·EXIF 제거·GIF 원본 유지·허용 목록·경로 탈출)·`test_uploads_serving.py`(public 정적 서빙, private 미노출)·`test_notices.py`·`test_banners.py`·`test_admin.py` 가 고정한다. autouse 픽스처 `upload_dir` 이 `UPLOAD_DIR` 을 테스트별 `tmp_path` 로 돌려 저장소에 파일을 남기지 않고, `admin_headers`·`user_headers` 픽스처가 실제 로그인으로 Bearer 헤더를 만든다.

```python
@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
```

---

## 13. 프론트엔드 구조 (`frontend/app/`)

표준 스택: **`$fetch`(ofetch) + Nuxt `useAsyncData`/`useFetch` + Pinia**.

```
frontend/
├── .env.example                 # NUXT_PUBLIC_*
├── .gitignore                   # .nuxt/, .output/, dist/, node_modules/, .env 등
├── eslint.config.mjs            # @nuxt/eslint
├── nuxt.config.ts               # ssr:false(SPA) + devServer.port 5173 + nitro.devProxy(/api·/uploads) + runtimeConfig
├── vitest.config.ts             # 단위 테스트(jsdom) — app/lib/** 순수 모듈 + 에디터·RichContent 컴포넌트
├── package.json
├── pnpm-workspace.yaml          # allowBuilds 맵 (pnpm 11 의 빌드 스크립트 허용 키)
├── tsconfig.json                # .nuxt/tsconfig.*.json 4개를 참조만 하는 껍데기 (nuxt prepare 가 생성)
├── public/.gitkeep              # 정적 자산
└── app/
    ├── app.vue                  # 앱 셸 — <NuxtLayout><NuxtPage /></NuxtLayout>
    ├── error.vue                # 오류 화면 — 404(사용자 레이아웃)·403(관리자 아님)·그 밖(새로고침 안내)
    ├── assets/css/main.css      # Tailwind v4 @import + @theme 토큰(+ 확장 토큰 기본값) + .rich-text/.editor 본문 스타일
    ├── plugins/
    │   ├── api.ts               # ★ $fetch.create + 인터셉터(access 주입/401→single-flight refresh→1회 재시도) → provide('api')
    │   └── auth-init.ts         # 부팅 시 /auth/refresh 로 세션 복원 (SPA 새로고침 대응)
    ├── api/                     # ★ 도메인별 use<Domain>Api() + 타입 (명시 import)
    │   ├── auth.ts · health.ts  # 인증·헬스
    │   ├── common.ts            # Page<T>·PageParams·UploadedImage·cleanParams·fileForm(FormData `file`)
    │   ├── notices.ts           # 공개 목록·상세 / 관리자 CRUD·첨부 업로드·blob 다운로드
    │   ├── banners.ts           # 공개 배너 / 관리자 CRUD·이미지 업로드·순서
    │   └── admin.ts             # 대시보드·사용자·세션·로그인 잠금
    ├── composables/             # (자동 import)
    │   ├── useAuth.ts           # useMe() / useLogin() / useLogout() / loginErrorMessage()
    │   ├── useHealth.ts         # useHealthStatus(), useDbHealthStatus()
    │   ├── useNotices.ts · useBanners.ts · useAdmin.ts  # 조회 = useAsyncData(키에 파라미터), invalidate*() = 관련 키 재조회
    │   ├── useAction.ts         # useAction() — 명령(생성·수정·삭제·업로드)용 isPending/error 헬퍼, refreshDataByPrefix()
    │   ├── useListParams.ts     # 목록 page·q 등을 URL 쿼리에
    │   └── useUploads.ts        # useFileUrl()(파일 URL 보정) · useEditorImageUpload()($api 업로드 함수)
    ├── lib/                     # (명시 import) Nuxt 런타임 없이 도는 순수 모듈 — vitest 대상
    │   ├── apiError.ts          # FetchError·NuxtError → 한국어 문구(도메인 code·413·422 배열 detail)
    │   ├── format.ts · linkUrl.ts · uploadRules.ts · bannerForm.ts  # 표시·검증(백엔드 규칙과 같은 값)
    │   ├── returnTo.ts          # safeNext()(오픈 리다이렉트 차단) · loginPath() · requiresLogin()
    │   ├── download.ts · site.ts · ui.ts · icons.ts · adminNav.ts  # blob 저장·사이트 이름·공용 클래스·아이콘·관리자 메뉴
    │   └── editor/              # 리치 에디터 순수 로직(richText·imageTransform·mediaHtml·editorDom·imageCanvas·upload·toolbar)
    ├── stores/
    │   └── auth.ts              # Pinia setup store — access 토큰(메모리)·user
    ├── middleware/
    │   ├── auth.ts              # 로그인 가드 — 미인증이면 /login?next=<원래 위치>
    │   └── admin.ts             # 관리자 가드 — 미인증 → /login?next=…, role≠admin → 403(error.vue)
    ├── layouts/
    │   ├── default.vue          # 사용자 화면 — 상단 내비 + 계정 메뉴(관리자에게만 "관리자 콘솔")
    │   └── admin.vue            # 관리자 콘솔 — 그룹형 사이드바(좁은 화면은 서랍)
    ├── components/              # (자동 등록 — 폴더명이 접두사: ui/Chip.vue → <UiChip>)
    │   ├── ui/                  # Icon·Chip·ConfirmDialog·Pagination·SearchForm·Loading·ErrorState·EmptyState·Notice
    │   ├── layout/              # AccountMenu·AdminSidebar·PageHeader·SkipLink
    │   ├── admin/               # NoticeForm(이탈 확인)·AttachmentsPanel·BannerForm
    │   ├── editor/              # RichTextEditor 와 하위(Toolbar·MediaOverlay·ImageCropDialog·TextPromptDialog·EditorDialog)
    │   ├── RichContent.vue      # 서버가 정화한 본문 HTML 보기
    │   ├── BannerCarousel.vue   # 홈 배너 캐러셀(APG carousel)
    │   └── HomeHero.vue         # 배너가 없을 때의 기본 히어로
    └── pages/                   # 파일 라우팅 — 표는 §14 "화면 구성"
        ├── index.vue · login.vue · me.vue · my.vue(→ /me)
        ├── notices/index.vue · notices/[id].vue
        └── admin/               # index·notices/(index·new·[id]/edit)·banners/(…)·users·sessions·login-throttles·system·[...slug]
```

`app/plugins/api.ts` (`$fetch` 인스턴스 표준 — axios 대체):
```ts
// 앱 전역 HTTP 클라이언트 (ARCHITECTURE.md §13·§14).
// axios 를 쓰지 않는다 — Nuxt 내장 $fetch(ofetch) 인스턴스에 인터셉터를 붙인다.
export default defineNuxtPlugin(() => {
  const { public: publicConfig } = useRuntimeConfig()
  const baseUrl = publicConfig.apiBaseUrl
  const authStore = useAuthStore()

  const api = $fetch.create({
    baseURL: baseUrl ? `${baseUrl}/api/v1` : "/api/v1",
    credentials: "include",   // ★ refresh 쿠키 전송 (auth 경로에만 붙는다 — Path=/api/v1/auth)

    // 요청 인터셉터: 메모리(Pinia)의 access 토큰을 Bearer 로 주입.
    onRequest({ options }) {
      const token = authStore.accessToken
      if (token) options.headers.set("Authorization", `Bearer ${token}`)
    },

    // 응답 인터셉터: 401 이면 refresh 1회(single-flight) 후 원 요청을 재시도한다.
    // refresh 까지 실패하면 세션을 버리고 /login 으로 보낸다(§14).
    async onResponseError({ request, response, options }) {
      if (response.status !== 401) return
      const refreshed = await authStore.refreshOnce()   // 동시 401 은 하나의 refresh 로 합류
      if (!refreshed) {
        authStore.clearSession()
        // 로그인 필요 화면(/admin/**, /me)에 있었다면 /login?next=<원래 위치> 로 (공개 화면은 그대로)
        if (import.meta.client && requiresLogin(location.pathname)) location.href = loginPath(location.pathname)
        return
      }
      // 새 access 토큰으로 원 요청 1회 재시도 (재귀 방지 플래그는 구현에서 관리)
    },
  })

  // 사용처: const { $api } = useNuxtApp()  (provide 만으로 $api 타입이 자동 생성된다)
  return { provide: { api } }
})
```
- ⚠️ `onRequest({ options })` 의 **`options.headers` 는 `Headers` 인스턴스**다 → `options.headers.set(...)`.
  axios 식 `config.headers.Authorization = ...` 대입은 타입도 런타임도 틀린다.
- ofetch 는 4xx/5xx 를 throw 하므로 **401 처리는 `onResponse` 가 아니라 `onResponseError`** 에 둔다.
- ⚠️ refresh 는 **single-flight** 로 만든다 — 동시에 터진 401 들이 각자 refresh 를 부르면
  회전(rotation) 때문에 서로의 토큰을 revoke 해 재사용 감지에 걸린다. 진행 중인 refresh Promise 하나를 공유한다.

`app/stores/auth.ts` (Pinia setup store — 전역 클라이언트 상태):
```ts
import { defineStore } from "pinia"
import type { User } from "~/api/auth"           // ← app/api/* 는 auto-import 대상이 아니다

// 클라이언트 전역 상태 (ARCHITECTURE.md §13·§14).
// ★ access 토큰은 "메모리에만" 둔다 — localStorage/쿠키에 쓰지 않는다.
//   새로고침으로 날아간 세션은 plugins/auth-init.ts 가 /auth/refresh 로 복원한다.
// options store 가 아니라 setup store 형태로 통일한다.
export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(null)
  const user = ref<User | null>(null)

  // 파생값은 computed 다 — 사용처에서 괄호 없이 `auth.isAuthenticated`.
  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function setSession(nextToken: string): void {
    accessToken.value = nextToken
  }

  function setUser(nextUser: User | null): void {
    user.value = nextUser
  }

  function clearSession(): void {
    accessToken.value = null
    user.value = null
  }

  // POST /auth/refresh 를 single-flight 로 감싼 액션 —
  // 진행 중이면 같은 Promise 를 돌려줘 동시 401 이 refresh 를 중복 호출하지 않게 한다.
  async function refreshOnce(): Promise<boolean> { /* 구현은 스캐폴드 참조 */ }

  return { accessToken, user, isAuthenticated, setSession, setUser, clearSession, refreshOnce }
})
```
- `@pinia/nuxt` 가 `app/stores/*` 를 스캔하므로 컴포넌트에서는 **import 없이 `useAuthStore()`** 로 쓴다.
  구조분해할 때 반응성을 유지하려면 **`storeToRefs(store)`** 를 거친다(액션은 그냥 꺼내 쓴다).

`app/composables/useHealth.ts` (`useAsyncData` 래퍼 — 서버 상태):
```ts
import { useHealthApi } from "~/api/health"   // ← app/api/* 는 auto-import 안 됨(명시 import)

// 서버 상태 컴포저블 (ARCHITECTURE.md §13).
// 첫 인자가 캐시 키다 — 같은 키의 중복 요청을 합쳐주고, 무효화·재요청의 단위가 된다.
export function useHealthStatus() {
  const { getHealth } = useHealthApi()
  return useAsyncData("health", () => getHealth(), { server: false })
}

export function useDbHealthStatus() {
  const { getDbHealth } = useHealthApi()
  return useAsyncData("health:db", () => getDbHealth(), { server: false })
}
```

조건부 조회와 뮤테이션(`app/composables/useAuth.ts`) — 쿼리 라이브러리의 `enabled`/`mutation` 대응:
```ts
/** 토큰이 있을 때만 조회 — enabled 옵션이 없으므로 immediate 로 표현한다 */
export function useMe() {
  const { getMe } = useAuthApi()
  const authStore = useAuthStore()

  return useAsyncData("auth:me", async () => {
    const user = await getMe()
    authStore.setUser(user)
    return user
  }, { server: false, immediate: authStore.isAuthenticated })
}

/** 로그인은 setup 밖(이벤트 핸들러)에서 돌아야 하므로 useAsyncData 가 아니라 수동 헬퍼로 만든다 */
export function useLogin() {
  const { getMe, login } = useAuthApi()
  const authStore = useAuthStore()
  const isPending = ref(false)
  const isError = ref(false)

  async function mutate(username: string, password: string): Promise<boolean> {
    isPending.value = true
    isError.value = false
    try {
      const token = await login(username, password)
      authStore.setSession(token.access_token)
      authStore.setUser(await getMe())
      return true
    }
    catch {
      isError.value = true
      return false
    }
    finally {
      isPending.value = false
    }
  }

  return { mutate, isPending, isError }
}
```

**Nuxt 서버 상태 호출 규칙** (외부 쿼리 라이브러리와 규약이 다르다 — 그쪽 예제를 복붙하면 깨진다):
- `useAsyncData`/`useFetch` 는 **컴포넌트·컴포저블의 setup 최상단에서만** 호출한다. 이벤트 핸들러 안에서 호출하면
  Nuxt 인스턴스를 찾지 못해 터진다. 버튼 클릭 등 명령형 호출은 `refresh()` 를 쓰거나 `$api` 를 직접 호출한다.
- 반환값은 **ref 묶음**이다 → `data.value` / `status.value` / `error.value` / `refresh()`. 템플릿 안에서는 `.value` 없이 쓴다.
  ⛔ `isPending`/`isError` 같은 불리언은 없다 — **`status`** 가 `"idle" | "pending" | "success" | "error"` 를 준다.
  로딩 판정은 `status.value === "idle" || status.value === "pending"`(첫 프레임이 `idle` 일 수 있다).
- ⛔ **`enabled` 옵션이 없다** → 조건부 실행은 **`immediate:`** 로 쓴다. ⛔ **`retry` 옵션도 없다**(재시도하지 않는다).
- **첫 인자 키가 캐시 단위**다. 키를 생략하면 파일·라인 기반으로 자동 생성되어 무효화가 어려우니 **항상 명시**한다.
- SPA(`ssr: false`) 이므로 `server: false` 를 기본으로 둔다 — 정적 생성 단계(Node)에서 백엔드를 때리지 않게 한다.

규칙:
- **서버 상태는 `useAsyncData`/`useFetch`**, **컴포넌트에서 `ref` + `onMounted` 로 직접 패칭 금지**.
- **클라이언트 상태(토큰·세션·UI)는 Pinia** — 전역은 `app/stores/<domain>.ts`, 지역은 컴포넌트 내 `ref`.
- API 함수는 `app/api/<domain>.ts`에 모으고, 컴포넌트는 `app/composables/`의 컴포저블을 통해 접근한다.
- ⚠️ auto-import 범위: `app/composables/*`·`app/stores/*` 는 자동, **`app/api/*`·`app/lib/*` 는 자동이 아니다**(명시 import).
- ⚠️ `useLogin()` 처럼 **plain object 안의 ref** 를 돌려주는 헬퍼는 템플릿에서도 **`.value`** 를 붙여야 한다
  (top-level ref 만 자동 언랩된다) → `loginMutation.isPending.value`. `useAction()` 은 구조분해해
  top-level 변수로 두면 템플릿에서 자동 언랩된다(`const { run: save, isPending: saving } = useAction(...)`).
- **변경 뒤 갱신**: 명령은 `$api` 직접 호출(보통 `useAction` 으로 감싼다) 후 `invalidateNotices()`·`invalidateBanners()`·
  `invalidateAccounts()`·`invalidateThrottles()` 로 **화면에 떠 있는** 관련 키(`notices:`·`banners:`·`admin:…` 접두사)와
  대시보드를 다시 부른다(`refreshDataByPrefix`). 언마운트된 키는 Nuxt 4 가 캐시를 비우므로 다음 마운트 때 새로 불러온다.
  반응형 키(getter)가 바뀌는 동안 `data` 는 이전 결과를 유지한다 — 목록 페이지 이동 때 화면이 비지 않는다.
  공개 공지 상세(`notice:public:<id>`)는 조회수가 오르므로 갱신 대상에서 뺐다.
- **로그아웃**은 스토어를 비우고 `clearNuxtData()` 로 조회 캐시를 **전부** 버린다 — 다음 사용자에게 이전 사용자의 관리자 목록이 비치지 않게.

### 프론트 테스트 (vitest)

- `pnpm test`(= `vitest run`, jsdom). 설정은 `frontend/vitest.config.ts` — Nuxt 런타임 없이 도는 것만 대상이다:
  `app/lib/**` 순수 모듈(에디터 `richText`·`imageTransform`·`mediaHtml`·`upload`, `apiError`·`returnTo`·`bannerForm`)과
  **Nuxt 자동 import 에 기대지 않는 컴포넌트**(`components/editor/*`, `RichContent.vue`)를 `@vue/test-utils` 로 마운트한다.
- 에디터 컴포넌트는 그래서 `vue` API·하위 컴포넌트를 **명시 import** 한다(다른 컴포넌트는 Nuxt 자동 import 를 쓴다).
  jsdom 에는 `execCommand`·canvas 가 없어 테스트가 `document.execCommand` 를 Range 로 흉내 내고 `lib/editor/imageCanvas` 를 mock 한다.
- ⛔ 페이지·레이아웃·`useAsyncData` 를 쓰는 컴포넌트는 Nuxt 런타임(`@nuxt/test-utils`)이 필요해 이 설정으로 테스트하지 않는다 —
  화면 흐름은 실제 백엔드를 붙인 `pnpm dev` 로 확인한다(README "화면 구성").
- 테스트 파일은 `*.test.ts` 로 대상 옆에 둔다. `components/` 안의 `.test.ts` 는 Nuxt 기본 ignore 패턴이라 컴포넌트로 등록되지 않는다.

---

## 14. 프론트엔드 인증 흐름

- **토큰 보관**: access 토큰은 **Pinia 메모리에만** 둔다. ⛔ **`localStorage` 저장 금지** — XSS 한 방에 통째로
  털리는 저장소다. refresh 토큰은 **HttpOnly 쿠키**라 JS 에서 아예 보이지 않고, 브라우저가 알아서
  `/api/v1/auth/*` 요청에만 실어 보낸다(§9).
- **로그인**: `POST /api/v1/auth/login` 성공 → 바디의 access 토큰을 `auth.setSession(token)` 으로 메모리에 넣고
  (refresh 쿠키는 응답의 `Set-Cookie` 로 자동 저장, 바디의 `refresh_token` 은 항상 `null`), `setUser(await getMe())` 로 사용자 로드 →
  `?next=<원래 위치>` 로 복귀(없으면 홈). `next` 는 `lib/returnTo.ts` 의 `safeNext()` 로 **내부 경로만** 받는다(`//host`·`/\host`·절대 URL 거부).
  실패 문구는 상태 코드로 고른다 — 401 "아이디 또는 비밀번호가 올바르지 않습니다", **429 = 계정 잠금**
  (`LOGIN_MAX_FAILURES` 회 연속 실패 시 `LOGIN_LOCKOUT_MINUTES` 동안, §9) "로그인 시도가 너무 많습니다…".
  429 에는 `Retry-After` 가 없으므로 남은 시간을 계산·표시하지 않는다(`composables/useAuth.ts` 의 `useLogin`).
- **세션 복원(새로고침 대응)**: 메모리 토큰은 새로고침에 날아간다 → **`app/plugins/auth-init.ts`** 가 앱 부팅 시
  `POST /api/v1/auth/refresh` 를 한 번 호출해 쿠키가 살아 있으면 access 토큰을 재발급받는다(없으면 미인증으로 시작).
- **401 처리**: `$api` 가 401 을 받으면 **refresh 1회(single-flight) 후 원 요청을 재시도**하고,
  refresh 도 실패하면 세션을 비운다. 지금 화면이 로그인 필요 화면(`/admin/**`, `/me` — `requiresLogin()`)이면
  `/login?next=<원래 위치>` 로 하드 이동(메모리 캐시도 사라진다), 공개 화면(`/`, `/notices`)이면 그대로 둔다(§13).
  ⛔ 개별 컴포넌트에서 401 을 따로 처리하지 않는다.
- **로그아웃**: `POST /api/v1/auth/logout`(서버가 세션 revoke + 쿠키 삭제, 항상 204) → `auth.logout()`(메모리 비우기) →
  `clearNuxtData()`(조회 캐시 전부) → 홈(`/`, 공개 화면).
  세션이 폐기되면 그 세션의 access 토큰도 `sid` 검사로 **즉시 401** 이 된다 — 다른 탭의 메모리 토큰도 다음 요청에서
  401 → refresh 실패(쿠키 삭제됨) → (보호 화면이면) `/login` 으로 정리된다.
- **보호 라우트**: 라우트 미들웨어가 담당한다. 로그인만 필요한 페이지는 `definePageMeta({ middleware: 'auth' })`
  (미인증 → `/login?next=<원래 위치>`), 관리자 페이지는 `definePageMeta({ layout: 'admin', middleware: 'admin' })`
  (미인증 → 로그인, role≠admin → 403). 첫 화면 `/` 와 공지(`/notices`)는 **공개**라 가드가 없다.
- **SSO(선택)**: `app/pages/login.vue`에서 `window.location.href = ${config.public.backendUrl}/api/v1/auth/login`,
  `app/pages/auth/callback.vue`가 토큰 수신 → `auth.setSession(token)` → `/api/v1/auth/me`로 사용자 로드 → 홈 리다이렉트.
- ⚠️ 미들웨어는 **`import.meta.client` 일 때만** 리다이렉트한다. `ssr: false` 라도 빌드의 **정적 생성 단계는
  Node 에서 돌아** 인증 상태가 없다 — 서버(생성) 단계에서는 통과시켜 빈 셸만 만든다.
- ⚠️ 내부 이동은 `navigateTo()`(스크립트) / `<NuxtLink to="...">`(템플릿)를 쓴다. `router.push` 직접 호출·`<a href>` 하드코딩 금지.

```
app/
├── middleware/
│   ├── auth.ts              # ★ 로그인 가드 — /me
│   └── admin.ts             # ★ 관리자 가드 — /admin/** 모든 페이지
└── pages/
    ├── index.vue            # /              공개 홈
    ├── login.vue            # /login         layout: false, ?next 복귀
    ├── me.vue               # /me            middleware: 'auth'   (my.vue → /me 리다이렉트)
    ├── notices/…            # /notices·/:id  공개
    ├── admin/…              # /admin/**      layout: 'admin', middleware: 'admin'
    └── auth/callback.vue    # /auth/callback (SSO 콜백 — SSO 도입 시 추가, 스캐폴드에는 없음)
```

```ts
// app/middleware/admin.ts (요약)
// 정적 생성 단계(Node)에서는 import.meta.client 가 false 라 아무것도 하지 않고 빈 셸만 만든다.
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return
  const authStore = useAuthStore()   // 부팅 시 plugins/auth-init.ts 가 세션 복원을 먼저 끝낸다
  if (!authStore.isAuthenticated) return navigateTo(loginPath(to.fullPath), { replace: true })
  if (!authStore.user) authStore.setUser(await useAuthApi().getMe())   // (실패 처리는 본문 참조)
  // fatal 이어야 클라이언트 이동에서도 error.vue 가 뜬다(아니면 이동만 취소된다).
  if (authStore.user?.role !== "admin") return createError({ status: 403, statusText: "Forbidden", fatal: true })
})
```

```vue
<!-- app/pages/admin/system.vue — 관리자 페이지는 이 한 줄로 레이아웃과 가드가 붙는다 -->
<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" })

const { data: health, status } = useHealthStatus()
const isLoading = computed(() => isLoadingStatus(status.value))
</script>
```

### 화면 구성 · 레이아웃 · 관리자 가드

라우트는 `app/pages/` 파일 구조 그대로다. 레이아웃은 `app/layouts/default.vue`(사용자)·`admin.vue`(관리자 콘솔) 두 개이고,
로그인 화면만 `layout: false` 다.

| 경로 | 화면 | 접근 |
|------|------|------|
| `/` | 홈 — 배너 캐러셀(`GET /banners`, 없으면 기본 히어로) · 주요 서비스(자리표시) · 최신 공지 5건 · 내 계정 | 공개 |
| `/notices` · `/notices/:id` | 공지 목록(고정 우선·제목 검색·페이지, `page`·`q` 는 URL 쿼리) · 상세(본문 `RichContent`, 첨부 `download_url`) | 공개 |
| `/login` | 로그인 — 성공 시 `?next=` 로 복귀 | 공개 |
| `/me` (`/my` → 리다이렉트) | 내 정보 · 로그아웃 | 로그인 |
| `/admin` | 대시보드 — KPI(사용자·세션·잠금·공지·배너·DB/Alembic) · 최근 활성 세션 5건(강제 종료) · 잠긴 계정(잠금 해제) | admin |
| `/admin/notices` · `/new` · `/:id/edit` | 공지 목록(임시저장 포함) · 작성/수정(`RichTextEditor` + 첨부 패널 — 첫 저장 뒤 수정 URL 로 전환) | admin |
| `/admin/banners` · `/new` · `/:id/edit` | 배너 목록(활성 토글 = PUT 전체 본문, 위/아래 이동 = `PATCH /order`) · 작성/수정(이미지 업로드·미리보기, 대체 텍스트 필수) | admin |
| `/admin/users` · `/admin/sessions` · `/admin/login-throttles` | 사용자(검색·역할 필터·권한/활성 변경·세션 모두 종료) · 세션(`?user_id=` 필터·강제 종료) · 로그인 잠금(해제) | admin |
| `/admin/system` | 헬스 체크(`/health`, `/health/db`) + DB 상태·Alembic 리비전 (옛 `/landing` 의 상태 배지) | admin |
| 그 밖 | 404(`error.vue`, 사용자 레이아웃) · `/admin/<없는 경로>` → `/admin` | — |

- **사용자 레이아웃 `layouts/default.vue`** (디자인 A — 상단 내비 포털): 로고·홈·공지사항·자리표시 메뉴(`/#services`·`/#support`),
  오른쪽은 비로그인 "로그인"(현재 위치를 `next` 로) / 로그인 계정 메뉴(내 정보·로그아웃) + **role=admin 에게만** "관리자 콘솔".
- **관리자 레이아웃 `layouts/admin.vue`** (디자인 A — 그룹형 사이드바): 메뉴 정의는 `lib/adminNav.ts`(개요·콘텐츠·회원·보안·시스템).
  현재 메뉴는 `aria-current="page"` + 강조(대시보드만 정확히 일치, 나머지는 하위 경로도 활성), "로그인 잠금" 에 잠긴 계정 수 배지,
  하단 "사용자 화면으로"·현재 사용자. 1024px 미만은 상단 "메뉴" 버튼이 서랍으로 연다. 페이지·레이아웃은 Nuxt 가 라우트별 청크로 나눈다.
  메뉴를 추가하면 `lib/adminNav.ts` 와 `app/pages/admin/` 의 페이지(가드 `definePageMeta` 포함)를 함께 만든다.
- **관리자 가드** = `middleware/admin.ts`. 이것은 **화면 노출용 UX 장치**이고 권한 경계는 백엔드 `require_admin`(비로그인 401, 일반 사용자 403)이다.
- **이탈 확인**: 공지 작성·수정(`components/admin/NoticeForm.vue`)은 저장하지 않은 변경이 있으면 `onBeforeRouteLeave` 가
  확인 다이얼로그의 답을 기다리는 Promise 를 돌려 이동을 막고, 새로고침·닫기는 `beforeunload` 로 막는다. 저장·삭제 직후 이동은 막지 않는다.
  새 공지를 처음 저장하면 `/admin/notices/:id/edit` 로 바꾸고 안내 문구를 `useState("admin:notice-flash")` 로 넘긴다.
- **파괴적 작업**(삭제·강제 종료·비활성화·권한 변경)은 `UiConfirmDialog` 로 확인한다. 낙관적 갱신은 배너 활성 토글처럼 되돌리기 쉬운 곳에만 쓴다.
- **오류 문구**: `lib/apiError.ts` 가 도메인 `code`(`self_modification`·`last_admin`·`too_many_attachments`·`unsupported_file_type`…)·413·422 를
  한국어로 바꾼다. 업로드 전 사전 검사(`lib/uploadRules.ts`·`editorImageProblem`·`lib/linkUrl.ts`)는 백엔드 허용 목록·규칙과 같은 값이다 — 백엔드 설정을 바꾸면 함께 고친다.
- **업로드**: 모든 업로드는 공용 `$api` 로 `FormData` 필드 `file`(Bearer·401 refresh 가 그대로 적용). 에디터 이미지는
  `useEditorImageUpload()` 가 만든 함수를 `RichTextEditor` 의 `upload-image` prop 으로 넘긴다. 첨부는 여러 개를 고르면 하나씩 순서대로 올리며
  파일별 상태·오류를 보여 준다(`$fetch` 는 업로드 진행률 이벤트가 없어 "올리는 중" 만 표시). 관리자 첨부 다운로드는 Bearer 가 필요해
  blob(`responseType: "blob"`)으로 받아 원래 파일명으로 저장한다(`lib/download.ts`). 공개 첨부는 `download_url` 링크.
- **파일 URL**: 백엔드가 주는 공개 파일·첨부 URL 은 기본이 루트 상대(`/uploads/public/...`, `/api/v1/notices/.../attachments/...`)다.
  dev 는 `nitro.devProxy` 가 `/api`·`/uploads` 를 백엔드로 넘긴다. 운영(`nuxt generate` 정적 산출)은 ① 리버스 프록시(nginx 등)가 같은 오리진에서
  `/api`·`/uploads` 를 백엔드로 넘기거나 ② 백엔드 `.env` 의 `PUBLIC_FILES_BASE_URL` 에 백엔드 공개 주소를 넣어 절대 URL 을 받는다.
  `NUXT_PUBLIC_API_BASE_URL` 로 API 를 다른 오리진에 둔 경우 `useFileUrl()` 이 루트 상대 URL 앞에 그 오리진을 붙인다.
- **시각**: 서버 값은 KST naive 문자열이다. `lib/format.ts` 는 `Date` 로 재해석하지 않고 문자열로 자른다. 배너 기간 입력은 `datetime-local` → `YYYY-MM-DDTHH:mm:00`.
- **리치 에디터**: 라이브러리 없는 `contentEditable` + `execCommand`(`lib/editor/editorDom.ts` 의 `exec()` 한 곳). 프로그램적 변경(크기·대체 텍스트·교체·삽입·삭제)은
  대상 노드를 `Range.selectNode` 로 고른 뒤 `exec("insertHTML")`/`exec("delete")` 로 커밋해 브라우저 undo 스택에 남긴다. 저장 마크업은 태그·`class` 만(⛔ `style`),
  유튜브는 `youtube-nocookie` 임베드만. ⚠️ 에디터와 백엔드 정화 허용 목록(`core/sanitize.py`, §8)은 한 쌍이다.

---

## 15. 스타일 — Tailwind CSS v4

- **진입 CSS는 `app/assets/css/main.css`** 한 곳. `nuxt.config.ts`의 `css: ['~/assets/css/main.css']` 배열에 한 번만 등록한다.
  (컴포넌트에서 직접 import 하지 않는다.)
- **CSS-first**(`@import "tailwindcss"`) + `@theme`로 색상/폰트 토큰 정의. 별도 `tailwind.config.js` 지양.
- Nuxt 는 Vite 기반이므로 `@tailwindcss/vite` 플러그인을 `nuxt.config.ts`의 `vite.plugins`에 넣는다(설정 파일 불필요).
  PostCSS 파이프라인(autoprefixer 등)이 필요하면 `@tailwindcss/postcss` 허용.
- 공통 컴포넌트 클래스는 `@layer components`.
- 한글 UI 기본 폰트는 **Pretendard**(+ `Noto Sans KR` 폴백) 권장.

```css
@import "tailwindcss";
@theme {
  --font-sans: Pretendard, "Noto Sans KR", system-ui, sans-serif;
  --color-primary: #002045;
}
```

---

## 16. 네이밍 컨벤션 (요약)

| 대상 | 규칙 |
|------|------|
| Python 파일/함수/변수 | `snake_case` |
| Python 클래스 / Enum | `PascalCase` (Enum 멤버는 `UPPER_CASE`) |
| DB 테이블 | `snake_case` 복수형 |
| 서비스 파일 | `<domain>_service.py` |
| Vue 컴포넌트 파일/이름 | `PascalCase.vue`, 파일명 = 컴포넌트명 |
| 페이지 파일 | Nuxt 파일 라우팅 규약 고정(소문자) — `app/pages/index.vue`, `login.vue`, 동적은 `[id].vue` |
| 컴포저블 | `app/composables/use<Domain>.ts` 의 `useXxx()` |
| Pinia 스토어 | `app/stores/<domain>.ts` 의 `use<Domain>Store()` — setup store 형태 |
| TS 타입/인터페이스 | `PascalCase`, 유니온은 리터럴(`'active' | 'closed'`) |
| 경로 별칭 | `~/` (또는 `@/`) → `app/` (Nuxt 내장, 별도 설정 불필요) |
| API 경로 | `/api/v1/<resource>` (리소스 복수형) |

---

## 17. 환경변수 표준

> 모든 설정은 **`.env` 파일로 OS 독립적으로 주입**한다(강제 규칙은 §5 참조). 셸 환경변수에 의존하지 않는다.

### 백엔드 (`backend/.env`)
| 키 | 용도 |
|----|------|
| `DATABASE_URL` | PostgreSQL 연결 — 단일 지원(개별 `DB_*` 키 미지원), 미설정 시 기동에서 fail-fast |
| `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` | 토큰 서명키, access 토큰 만료(분, 기본 15). 스캐폴드가 키를 랜덤 생성 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | refresh 세션 절대 수명(일, 기본 14) — 회전해도 연장되지 않는다(§9) |
| `LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_MINUTES` | 로그인 시도 제한 — 계정별 연속 실패 임계치(기본 5)와 잠금 시간(분, 기본 15) (§9) |
| `REFRESH_TOKEN_TRANSPORT` | refresh 토큰 전달 방식 — `cookie`(브라우저 SPA: 백엔드가 httpOnly 쿠키 설정, 코드 기본값) / `body`(BFF: JSON 본문). 이 템플릿은 `cookie` (§9) |
| `COOKIE_SECURE` | refresh 쿠키의 `Secure` 속성. 로컬 `false`, 운영(HTTPS) `true` — cookie 방식 + `APP_ENV=production` 이면 `true` 필수(아니면 기동 거부) |
| `CORS_ORIGINS` | 콤마 구분 허용 출처 |
| `FRONTEND_URL`, `BACKEND_PUBLIC_URL` | 리다이렉트/콜백 |
| `UPLOAD_DIR` | 업로드 저장 위치(기본 `uploads` → `backend/uploads/`, 상대 경로는 backend 기준). `public/` 만 `/uploads/public` 으로 정적 서빙 (§8) |
| `PUBLIC_FILES_BASE_URL` | 공개 파일·첨부 다운로드 URL 접두사. 비우면 루트 상대 경로(같은 오리진 또는 `/uploads` 프록시), 다른 오리진이면 백엔드 공개 주소 (§8, §14 "파일 URL") |
| `MAX_IMAGE_UPLOAD_MB`, `MAX_ATTACHMENT_UPLOAD_MB` | 업로드 크기 상한(MB, 기본 5 / 20) — 초과 시 413. 바꾸면 `frontend/app/lib/uploadRules.ts` 도 맞춘다 |
| `APP_ENV` | `production` 이면 안전하지 않은 기본값(기본 `SECRET_KEY`, 관리자 시드, Secure 없는 refresh 쿠키)으로 기동을 거부한다 |
| `SEED_DEFAULT_ADMIN`, `DEFAULT_ADMIN_PASSWORD` | 기동 시 기본 관리자(admin) 시드 여부·초기 비밀번호. **코드 기본값은 꺼짐** — `.env` 에서만 켠다(스캐폴드가 무작위 비밀번호로 켜 준다, §9) |
| `OAUTH_*` | SSO 도입 시(authorize/token/userinfo URL, client id/secret, redirect uri) |
| `TZ` | 실행 환경 `Asia/Seoul` |

### 프론트엔드 (`.env`, `NUXT_PUBLIC_` 필수)
| 키 | 용도 |
|----|------|
| `NUXT_PUBLIC_API_BASE_URL` | API 호스트 (없으면 dev proxy `/api/v1`·`/uploads`). 주면 루트 상대 파일 URL(`/uploads/...`) 앞에도 붙인다(`useFileUrl()`) |
| `NUXT_PUBLIC_BACKEND_URL` | SSO 리다이렉트용 백엔드 호스트 |

- `NUXT_PUBLIC_*` 는 `nuxt.config.ts` 의 `runtimeConfig.public` 키를 덮어쓴다
  (`NUXT_PUBLIC_API_BASE_URL` → `runtimeConfig.public.apiBaseUrl`). 코드에서는 `useRuntimeConfig().public.*` 로만 읽는다.

- `.env`는 커밋 금지. `.env.example`에 **키만** 공유.

---

## 18. 개발 원칙 (TDD · Tidy First)

- **TDD 사이클**: Red → Green → Refactor. `PLAN.md` 순서대로 **한 번에 실패하는 테스트 하나**.
  결함도 API 레벨 실패 테스트부터 작성한다.
- **최소 구현**으로 Green을 만들고, **Refactor는 Green 상태에서만**.
- **Tidy First**: **구조 변경(Structural)과 동작 변경(Behavioral)을 분리**한다. 한 커밋에 섞지 않는다.
- **중복 제거**를 철저히, 메서드는 작게.
- **서비스 레이어**: 라우터는 얇게, 도메인 로직은 `services/`.
- **의존성 주입**: DB 세션·현재 주체는 `Depends()`로 주입.

---

## 19. 커밋 규칙

- **형식**: `[Category] <type>: <요약(한글, 50자 이내, 현재형)>`
- **Category**: `[Structural]`(구조 변경, 로직 불변) / `[Behavioral]`(기능·버그·로직 변경)
- **type**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- 모든 테스트 통과 + 린트 경고 0일 때만 커밋한다.

예) `[Behavioral] feat: 주문 생성 API 추가`, `[Structural] refactor: 의존성 dependencies.py로 이동`

---

## 20. 변경 반영 규칙 (GitHub)

> 기본 흐름은 **`main`에서 작업 → 로컬 검증 → 커밋 → push** 다. 브랜치와 PR은 **선택**이다.
> 커밋의 Structural/Behavioral 분리 원칙(§18, §19)은 그대로 지킨다.

### ⛔ push 전 로컬 검증이 유일한 게이트다

PR 리뷰 단계가 없으므로 **커밋·push 전 검증을 건너뛰면 깨진 코드가 곧바로 `main`에 남는다.** CI는 push 이후에 도는 **사후 안전망**이지 사전 게이트가 아니다.

push 전에 반드시 통과시킨다:

```powershell
cd backend;  .\.venv\Scripts\python -m pytest -q;  .\.venv\Scripts\python -m ruff check .
cd ..\frontend;  pnpm lint;  pnpm typecheck;  pnpm test;  pnpm build
```

- 실패했거나 확인하지 않았으면 push 하지 않는다.
- push 후 CI가 실패하면 **되돌리거나 즉시 고치는 커밋을 올린다.** 실패 상태를 방치하지 않는다.

### 커밋 단위
- **하나의 커밋은 Structural·Behavioral 중 하나만** 담는다(§18 Tidy First). 브랜치가 없어도 이 분리는 유지한다.
- **작게 유지**: 한 커밋은 한 가지 목적. 나중에 되돌릴 수 있는 크기로.
- 형식은 §19를 따른다.

### 브랜치·PR을 쓰는 경우 (선택)
다음이면 브랜치를 따고 PR을 만든다. 그 외에는 `main` 직접 커밋으로 충분하다.
- 되돌리기 어렵거나 광범위한 변경 — 마이그레이션이 얽힌 리팩터링, 의존성 대량 상향
- 여러 커밋에 걸쳐 진행 중이라 중간 상태를 `main`에 두고 싶지 않을 때
- 리뷰를 받고 싶을 때(협업자가 있거나 스스로 diff를 정리해 보고 싶을 때)

브랜치 명명은 `feat/<요약>`, `fix/<요약>`, `refactor/<요약>`, `docs/<요약>` (kebab-case).
PR 제목은 커밋과 동일 형식이고, **하나의 PR도 Structural·Behavioral 중 하나만** 담는다.
본문 템플릿은 `.github/pull_request_template.md`에 둔다:

```markdown
## 요약
<무엇을 왜 바꿨는지 1~3줄>

## 변경 유형
- [ ] Structural (구조 변경, 동작 불변)
- [ ] Behavioral (기능·버그·로직 변경)

## 테스트
- 추가/수정한 테스트와 결과 (pytest, 프론트 등)

## 체크리스트
- [ ] 모든 테스트 통과 + 린트 경고 0
- [ ] Structural/Behavioral 를 섞지 않음
- [ ] DB 변경 시 Alembic 마이그레이션 포함 (§11)
- [ ] 설정 변경 시 `.env.example` 갱신 (§5, §17)
```

### 예시 (PowerShell)
```powershell
# 기본 — main 직접 커밋
git pull --ff-only
# ... 작업 + 로컬 검증 ...
git add <파일>
git commit -m "[Behavioral] feat: 주문 생성 API 추가"
git push

# 선택 — 브랜치·PR (위 조건에 해당할 때만)
git switch -c feat/order-create
git push -u origin feat/order-create
gh pr create --fill --base main
gh pr merge --squash --delete-branch
```

> **협업자가 생기면** `main` 브랜치 보호와 필수 CI 검사를 켜고 PR 흐름을 기본으로 되돌리는 것을 권장한다. 위 규칙은 단독 개발을 전제로 한다.

---

## 21. 신규 프로젝트 부트스트랩 체크리스트

- [ ] 저장소 구조(§3) 생성, `PLAN.md` / `.env.example` / `ARCHITECTURE.md` / `.gitignore`(`.env` 제외) 작성
- [ ] 백엔드 `app/` 골격(§4): `main.py`, `config.py`, `dependencies.py`, `db/`, `core/security.py`
- [ ] `Settings` + `get_settings()` (§5) — **모든 설정은 `.env`로 주입, OS 독립 (MUST §5)**, CORS, `TZ=Asia/Seoul`
- [ ] PostgreSQL `connect_args` KST 고정 (§7, §10)
- [ ] Alembic 초기화 + 초기 마이그레이션 (§11) — **DB는 항상 Alembic으로만 관리, `create_all`은 테스트 전용 (MUST §11)**
- [ ] `pytest` + SQLite in-memory + `conftest.py` 픽스처 (§12)
- [ ] 프론트 `app/` 골격(§13): `app/plugins/api.ts`의 `$fetch` 인스턴스(`$api`), `app/plugins/auth-init.ts`(세션 복원), `app/stores/auth.ts`(Pinia), `app/app.vue`
- [ ] SPA 고정: `nuxt.config.ts`의 `ssr: false` + `nuxt generate` 정적 산출물 (§2, §13)
- [ ] `app/middleware/auth.ts` 가드 + 각 페이지 `definePageMeta({ middleware: 'auth' })` + 로그인/refresh/로그아웃 흐름 (§9, §14)
- [ ] Tailwind v4 `@theme`(`app/assets/css/main.css`), pnpm, ESLint + `nuxt typecheck` (§15, §2)
- [ ] `.github/workflows/ci.yml` 동작 확인 — push 이후 도는 **사후 안전망**이다. push 전 로컬 검증이 유일한 게이트 (§20)
- [ ] (협업자가 생기면) `.github/pull_request_template.md` 활용, `main` 보호 + CI 필수 검사 설정 (§20)
- [ ] 첫 실패 테스트 작성(TDD Red) → 구현(Green) (§18)

### 배포 전 체크리스트 (스타터 기본값 제거 — MUST)

skeleton 은 개발 편의를 위해 기본 관리자 계정을 자동 시드한다. **운영 배포 전 반드시 제거·변경한다.**

- [ ] `SECRET_KEY` 를 무작위 값으로 교체 — 기본값이면 개발에서는 경고, `APP_ENV=production` 에서는 **기동 실패**다 (§9)
- [ ] `APP_ENV=production` 설정 — 기본 `SECRET_KEY`·관리자 시드·`COOKIE_SECURE=false`(cookie 모드)면 기동이 실패한다 (§17)
- [ ] 기본 관리자 시드 정리 — 운영 `backend/.env`에서 `SEED_DEFAULT_ADMIN=false`, 시드된 admin 비밀번호 변경 (§9)
- [ ] HTTPS 뒤에서 `COOKIE_SECURE=true` 로 refresh 쿠키가 `Secure` 로 나가는지 확인 (§9)
