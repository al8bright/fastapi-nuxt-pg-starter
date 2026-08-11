# 프로젝트 공통 아키텍처 가이드

> 본 문서는 **이 템플릿으로 만드는 모든 웹 프로젝트**가 따르는 공통 표준이다.
> 표준 스택은 **FastAPI(백엔드) + Nuxt(프론트엔드) + PostgreSQL**이며,
> 인증은 **자체 계정 또는 OIDC SSO**, 시각은 **KST 단일 기준**을 따른다.

---

## ★ 핵심 MUST 요약 (반드시 고정)

> 아래 항목은 **프로젝트마다 바뀌지 않는 고정 규칙**이다. 어기려면 `docs/architecture.md`에 사유를 남기되, ⛔ 표시 항목은 예외 없이 금지한다.
> 세부 내용은 각 섹션(§) 참조.

| # | 고정 규칙 (MUST) | § |
|---|------------------|---|
| 1 | **표준 스택 고정**: 백엔드 FastAPI 0.115 + SQLAlchemy 2.0 + Alembic, 프론트 Nuxt(SPA) + Vue 3 + TS, DB는 **PostgreSQL** | §2 |
| 2 | **DB는 항상 Alembic으로만 관리** — 모든 스키마 생성·변경은 마이그레이션. ⛔ dev/운영 런타임 `create_all`·자동 DDL·수동 `ALTER` 금지(테스트 in-memory만 예외) | §11 |
| 3 | **설정은 OS 무관하게 `.env`로 주입** — 동일 `.env`가 Windows/mac/Linux에서 동작. ⛔ 개발 중 `$env:`/`export`/`set` 셸 환경변수 의존 금지. ⛔ `.env` 커밋 금지(`.env.example`만) | §5, §17 |
| 4 | **시각은 KST 단일 기준** — `now()`는 naive `datetime.now()`, PostgreSQL `connect_args`에 `timezone=Asia/Seoul`, 런타임 `TZ=Asia/Seoul`. ⛔ UTC 변환/`ZoneInfo` 신규 도입 금지 | §10, §7 |
| 5 | **API 경로 `/api/v1` 고정** — 버전 prefix는 `main.py`에서, 라우터는 `api/v1/router.py`로 집계 | §4 |
| 6 | **설정 접근은 `get_settings()` + `@lru_cache`** — ⛔ 모듈 전역 `settings` 싱글톤 금지 | §5 |
| 7 | **공통 의존성은 `app/dependencies.py` 단일 파일** (`get_db`, `get_current_user` 등) | §6 |
| 8 | **계층 분리** — 라우터(`api/`)는 HTTP만 얇게, 도메인 로직은 `services/`, 검증/직렬화는 `schemas/` | §4, §8 |
| 9 | **프론트 표준 스택 고정**: `$fetch`(ofetch) + Nuxt `useAsyncData`/`useFetch` + Pinia. ⛔ 서버 상태를 `ref` + `onMounted`로 직접 패칭 금지 | §2, §13 |
| 10 | **패키지 매니저는 pnpm** — ⛔ npm 사용 금지 | §2 |
| 11 | **인증은 Bearer JWT** — `Authorization: Bearer <token>`, 검증 실패 시 401 | §9 |
| 12 | **테스트는 pytest + SQLite in-memory** — `get_settings.cache_clear()` autouse, `dependency_overrides`로 격리 | §12 |
| 13 | **TDD + Tidy First** — Red→Green→Refactor, 구조 변경과 동작 변경을 한 커밋에 섞지 않음 | §18 |
| 14 | **커밋 메시지**: `[Structural]`/`[Behavioral]` + conventional type, 테스트·린트 통과 시에만 | §19 |
| 15 | **변경은 브랜치→PR→CI 통과→머지** — ⛔ `main` 직접 푸시 금지, 1 PR은 Structural·Behavioral 중 하나만 | §20 |

---

## 0. 적용 범위 & 우선순위

- **MUST**: 신규 프로젝트는 반드시 따른다.
- **SHOULD**: 특별한 사유가 없으면 따른다. 벗어나면 `docs/architecture.md`에 사유를 남긴다.
- **MAY**: 프로젝트 성격에 따라 선택한다.
- 본 가이드와 개별 프로젝트 문서가 충돌하면 **본 가이드 우선**. 예외는 프로젝트 `docs/architecture.md`에 명시한다.

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
| **토큰 저장 키** | `<project>_token` / `<project>_access_token` 으로 충돌 방지 | `my_project_token`, `shop_access_token` |

> 프론트 환경변수는 **`VITE_` 가 아니라 `NUXT_PUBLIC_` 접두를 쓴다.** Nuxt 는 `nuxt.config.ts` 의
> `runtimeConfig.public` 을 단일 창구로 삼고, 그 값은 `NUXT_PUBLIC_*` 환경변수로 덮인다.
> 코드에서는 `import.meta.env` 가 아니라 **`useRuntimeConfig().public.*`** 로 접근한다(§17).

---

## 2. 기술 스택 표준

### 백엔드
- **언어/런타임**: Python 3.10+ (`X | None` 문법, `Mapped[]` 타입 힌트 사용)
- **프레임워크**: FastAPI 0.115.x + Uvicorn(`[standard]`)
- **ORM/마이그레이션**: SQLAlchemy 2.0 (`Mapped`/`mapped_column`) + Alembic
- **DB 드라이버**: PostgreSQL + `psycopg2-binary`
- **설정**: `pydantic-settings` (BaseSettings)
- **검증/직렬화**: Pydantic 2.x
- **인증**: JWT. **자체 계정 → `PyJWT`**, **OIDC/SSO 연동 → `python-jose[cryptography]`**
- **테스트**: `pytest` + SQLite in-memory
- **HTTP 클라이언트(서버↔서버)**: `httpx2` (httpx 의 유지보수 후속, Starlette 1.x TestClient 호환)
- **버전 고정**: `requirements.txt`에 **`==` 정확한 버전 핀** (재현성 우선)

### 프론트엔드
- **빌드/런타임**: Nuxt 4.5 (**SPA 모드**) + Vue 3.5 + TypeScript 6.0
  - SPA 고정: `nuxt.config.ts`의 `ssr: false` + 정적 생성(`nuxt generate` → `200.html` SPA fallback 포함).
    백엔드가 별도 FastAPI 서버이고 JWT를 `localStorage`에 두므로 **SSR을 쓰지 않는다.**
- **라우팅**: **Nuxt 파일 기반 라우팅**(`app/pages/`). 인증 가드는 `app/middleware/auth.ts`(§14)
- **HTTP**: **`$fetch`(ofetch) 인스턴스 + 인터셉터** — `app/plugins/api.ts`에서 `$fetch.create()`로
  `onRequest`(Bearer 주입)/`onResponseError`(401 일괄 처리)를 붙여 `$api`로 provide 한다. **axios 를 쓰지 않는다.**
- **서버 상태**: **Nuxt 내장 `useAsyncData` / `useFetch`** (키 기반 캐싱/재요청/무효화). 별도 쿼리 라이브러리를 쓰지 않는다.
- **클라이언트 상태**: **Pinia** 4.0 (`@pinia/nuxt`) — 토큰·세션 등 전역 상태는 `app/stores/*.ts`의 setup store 에 둔다.
- **스타일**: Tailwind CSS v4 4.3 (CSS-first `@theme`)
- **패키지 매니저**: **pnpm** (npm 금지)
- **타입 체크**: `pnpm typecheck` = `nuxt typecheck` (vue-tsc 기반) — `postinstall`의 `nuxt prepare`가
  `.nuxt/tsconfig.{app,server,shared,node}.json`을 만들어야 동작한다
- **린트**: ESLint + `@nuxt/eslint`

> 프론트 표준 스택은 **`$fetch`(ofetch) + `useAsyncData`/`useFetch` + Pinia**로 통일한다.
> 매우 단순한 화면만 있는 소규모 도구는 `$fetch` 직접 호출 + 컴포넌트 지역 `ref`만으로 처리하는 것을 MAY로 허용하되,
> 그 사유를 `docs/architecture.md`에 남긴다.

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
│   └── tests/
├── frontend/
│   ├── app/
│   ├── package.json
│   ├── nuxt.config.ts
│   └── tsconfig.json
├── docs/
│   ├── architecture.md          # 본 가이드에서 벗어난 결정/사유 기록
│   └── <연동>-가이드.md          # 선택 (SSO 등 외부 연동)
├── plan.md                      # TDD 작업 순서 (필수)
├── .env.example
└── README.md
```

- 루트에 `plan.md`를 두고 **TDD 작업 순서**(실패 테스트 단위)를 관리한다.
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
│   │   ├── auth.py         # SSO 시작 / 콜백 / 세션
│   │   ├── health.py
│   │   └── <domain>.py     # 도메인별 APIRouter (얇은 HTTP 계층)
│   └── ...
├── core/
│   └── security.py         # JWT 생성/검증, now() (KST naive)
├── db/
│   ├── base.py             # DeclarativeBase (Base)
│   ├── engine.py           # 엔진 팩토리 (SQLite/PG 분기, KST connect_args)
│   └── session.py          # get_db 세션 / SessionLocal
├── models/
│   ├── __init__.py         # 모든 모델 re-export (Alembic/메타데이터 등록용)
│   └── <domain>.py
├── schemas/
│   └── <domain>.py         # Pydantic BaseModel (요청/응답)
└── services/
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

    # DB
    database_url: str | None = None

    # JWT
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30

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

### 모델 (`models/`) — SQLAlchemy 2.0 `Mapped`
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

---

## 9. 인증 (JWT · SSO)

- `core/security.py`에 토큰 생성/검증과 `now()`를 둔다.
- **자체 계정**: access/refresh 토큰 분리(`typ` 클레임), `PyJWT`.
- **OIDC SSO 연동**: 백엔드가 authorize→callback→userinfo 처리 후 앱 세션 JWT 발급, `python-jose`.
- 토큰은 `Authorization: Bearer <token>` 헤더. 검증 실패는 401 + `WWW-Authenticate: Bearer`.
- 최초 로그인 시 `provision_from_userinfo()`로 사용자 upsert(없으면 생성, 식별정보 갱신).

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
  - `db_session`, `client`(`app.dependency_overrides[get_db]` 오버라이드).
  - 인증 통과용 `auth_client`/`admin_client` (현재 사용자 의존성 오버라이드).

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
├── nuxt.config.ts               # ssr:false(SPA) + devServer.port 5173 + nitro.devProxy + runtimeConfig
├── package.json
├── pnpm-workspace.yaml          # allowBuilds 맵 (pnpm 11 의 빌드 스크립트 허용 키)
├── tsconfig.json                # .nuxt/tsconfig.*.json 4개를 참조만 하는 껍데기 (nuxt prepare 가 생성)
├── public/.gitkeep              # 정적 자산
└── app/
    ├── app.vue                  # 앱 셸 — <NuxtLayout><NuxtPage /></NuxtLayout>
    ├── assets/css/main.css      # Tailwind v4 @import + @theme 토큰 + body 스타일
    ├── lib/
    │   └── token.ts             # getToken/setToken/clearToken — localStorage 래퍼 (client 가드 필수)
    ├── plugins/
    │   └── api.ts               # ★ $fetch.create + 인터셉터(토큰 주입/401) → provide('api', ...)
    ├── api/
    │   ├── auth.ts              # useAuthApi() — login()/getMe() + User/UserRole/TokenResponse 타입
    │   └── health.ts            # useHealthApi() — getHealth()/getDbHealth() + DbHealth 타입
    ├── composables/
    │   ├── useAuth.ts           # useMe() = useAsyncData 래퍼 / useLogin() = 수동 뮤테이션 헬퍼
    │   └── useHealth.ts         # useHealthStatus(), useDbHealthStatus()
    ├── stores/
    │   └── auth.ts              # Pinia setup store — 전역 인증 상태 (token, user)
    ├── middleware/
    │   └── auth.ts              # 인증 가드 — 토큰 없으면 navigateTo('/login')
    └── pages/
        ├── index.vue            # /          메인            (definePageMeta 가드)
        ├── login.vue            # /login     로그인 (가드 없음)
        ├── landing.vue          # /landing   백엔드·DB 상태  (가드)
        └── my.vue               # /my        내 정보·로그아웃 (가드)
```

`app/plugins/api.ts` (`$fetch` 인스턴스 표준 — axios 대체):
```ts
import { clearToken, getToken } from "~/lib/token"

// 앱 전역 HTTP 클라이언트 (architecture.md §13).
// axios 를 쓰지 않는다 — Nuxt 내장 $fetch(ofetch) 인스턴스에 인터셉터를 붙인다.
export default defineNuxtPlugin(() => {
  const { public: publicConfig } = useRuntimeConfig()
  const baseUrl = publicConfig.apiBaseUrl

  const api = $fetch.create({
    baseURL: baseUrl ? `${baseUrl}/api/v1` : "/api/v1",

    // 요청 인터셉터: Bearer 토큰 주입.
    onRequest({ options }) {
      const token = getToken()
      if (token) options.headers.set("Authorization", `Bearer ${token}`)
    },

    // 응답 인터셉터: 401 이면 토큰을 버리고 로그인 화면으로 보낸다.
    onResponseError({ response }) {
      if (response.status === 401) {
        clearToken()
        if (import.meta.client && location.pathname !== "/login") location.href = "/login"
      }
    },
  })

  // 사용처: const { $api } = useNuxtApp()  (provide 만으로 $api 타입이 자동 생성된다)
  return { provide: { api } }
})
```
- ⚠️ `onRequest({ options })` 의 **`options.headers` 는 `Headers` 인스턴스**다 → `options.headers.set(...)`.
  axios 식 `config.headers.Authorization = ...` 대입은 타입도 런타임도 틀린다.
- ofetch 는 4xx/5xx 를 throw 하므로 **401 처리는 `onResponse` 가 아니라 `onResponseError`** 에 둔다.

`app/stores/auth.ts` (Pinia setup store — 전역 클라이언트 상태):
```ts
import { defineStore } from "pinia"
import type { User } from "~/api/auth"           // ← app/api/* 는 auto-import 대상이 아니다
import { clearToken, getToken, setToken } from "~/lib/token"

// 클라이언트 전역 상태 (architecture.md §13).
// options store 가 아니라 setup store 형태로 통일한다.
export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(null)

  // 파생값은 computed 다 — 사용처에서 괄호 없이 `auth.isAuthenticated`.
  const isAuthenticated = computed(() => Boolean(token.value))

  function setSession(nextToken: string): void {
    setToken(nextToken)
    token.value = nextToken
  }

  function setUser(nextUser: User | null): void {
    user.value = nextUser
  }

  function logout(): void {
    clearToken()
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, setSession, setUser, logout }
})
```
- `@pinia/nuxt` 가 `app/stores/*` 를 스캔하므로 컴포넌트에서는 **import 없이 `useAuthStore()`** 로 쓴다.
  구조분해할 때 반응성을 유지하려면 **`storeToRefs(store)`** 를 거친다(액션은 그냥 꺼내 쓴다).

`app/composables/useHealth.ts` (`useAsyncData` 래퍼 — 서버 상태):
```ts
import { useHealthApi } from "~/api/health"   // ← app/api/* 는 auto-import 안 됨(명시 import)

// 서버 상태 컴포저블 (architecture.md §13).
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
  (top-level ref 만 자동 언랩된다) → `loginMutation.isPending.value`.

---

## 14. 프론트엔드 인증 흐름

- **SSO**: `app/pages/login.vue`에서 `window.location.href = ${config.public.backendUrl}/api/v1/auth/login`.
- **콜백**: `app/pages/auth/callback.vue`가 토큰 수신 → `auth.setSession(token)` → `/api/v1/auth/me`로 사용자 로드 → 홈 리다이렉트.
- **보호 라우트**: `app/middleware/auth.ts` 라우트 미들웨어가 담당한다(미인증 시 `navigateTo('/login', { replace: true })`).
  보호할 페이지마다 `definePageMeta({ middleware: 'auth' })` 한 줄을 선언한다 — 파일 위치를 옮길 필요가 없다.
- 토큰은 `localStorage`(키: `<project>_token`). 401은 `$api`의 `onResponseError`가 일괄 처리(§13).
- ⚠️ `app/lib/token.ts` 의 `getToken`/`setToken`/`clearToken` 에는 **`import.meta.client` 가드가 필수**다.
  `ssr: false` 라도 빌드의 **정적 생성 단계는 Node 에서 돌아** `localStorage` 가 없다(가드가 없으면 빌드가 깨진다).
- ⚠️ 미들웨어도 같은 이유로 **`import.meta.client` 일 때만** 리다이렉트한다. 서버(생성) 단계에서는 통과시켜 빈 셸만 만든다.
- ⚠️ 내부 이동은 `navigateTo()`(스크립트) / `<NuxtLink to="...">`(템플릿)를 쓴다. `router.push` 직접 호출·`<a href>` 하드코딩 금지.

```
app/
├── middleware/auth.ts       # ★ 인증 가드 (definePageMeta 로 페이지에 붙인다)
└── pages/
    ├── index.vue            # /          definePageMeta({ middleware: 'auth' })
    ├── login.vue            # /login     (가드 없음)
    ├── landing.vue          # /landing   definePageMeta({ middleware: 'auth' })
    ├── my.vue               # /my        definePageMeta({ middleware: 'auth' })
    └── auth/callback.vue    # /auth/callback (SSO 콜백 — SSO 도입 시 추가, 스캐폴드에는 없음)
```

```ts
// app/middleware/auth.ts
import { getToken } from "~/lib/token"

// 정적 생성 단계(Node)에서는 import.meta.client 가 false 라 리다이렉트하지 않고 빈 셸만 만든다.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  if (!getToken() && to.path !== "/login") return navigateTo("/login", { replace: true })
})
```

```vue
<!-- app/pages/landing.vue — 보호 페이지는 이 한 줄로 가드된다 -->
<script setup lang="ts">
definePageMeta({ middleware: "auth" })

const { data: health, status: healthStatus } = useHealthStatus()
const isLoading = computed(() => healthStatus.value === "idle" || healthStatus.value === "pending")
</script>

<template>
  <p v-if="isLoading">확인 중…</p>
  <p v-else>{{ health?.status }}</p>
  <NuxtLink to="/">← 메인으로</NuxtLink>
</template>
```

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

### 백엔드 (`.env`)
| 키 | 용도 |
|----|------|
| `DATABASE_URL` | PostgreSQL 연결 (또는 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`) |
| `SECRET_KEY` / `JWT_*` | 토큰 서명, 만료 |
| `CORS_ORIGINS` | 콤마 구분 허용 출처 |
| `FRONTEND_URL`, `BACKEND_PUBLIC_URL` | 리다이렉트/콜백 |
| `OAUTH_*` | SSO(authorize/token/userinfo URL, client id/secret, redirect uri) |
| `TZ` | 실행 환경 `Asia/Seoul` |

### 프론트엔드 (`.env`, `NUXT_PUBLIC_` 필수)
| 키 | 용도 |
|----|------|
| `NUXT_PUBLIC_API_BASE_URL` | API 호스트 (없으면 dev proxy `/api/v1`) |
| `NUXT_PUBLIC_BACKEND_URL` | SSO 리다이렉트용 백엔드 호스트 |

- `NUXT_PUBLIC_*` 는 `nuxt.config.ts` 의 `runtimeConfig.public` 키를 덮어쓴다
  (`NUXT_PUBLIC_API_BASE_URL` → `runtimeConfig.public.apiBaseUrl`). 코드에서는 `useRuntimeConfig().public.*` 로만 읽는다.

- `.env`는 커밋 금지. `.env.example`에 **키만** 공유.

---

## 18. 개발 원칙 (TDD · Tidy First)

- **TDD 사이클**: Red → Green → Refactor. `plan.md` 순서대로 **한 번에 실패하는 테스트 하나**.
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

## 20. 브랜치 · PR 규칙 (GitHub)

> 변경은 **브랜치 → PR → CI 통과 → 머지** 흐름으로 반영한다. `main` 직접 푸시는 금지.
> 커밋의 Structural/Behavioral 분리 원칙(§18, §19)을 **PR 단위에서도 그대로** 지킨다.

### 브랜치 명명
- `feat/<요약>`, `fix/<요약>`, `refactor/<요약>`, `docs/<요약>` (kebab-case)
- 예: `feat/order-create`, `refactor/move-deps`

### PR 작성
- **제목**: 커밋과 동일 형식 `[Category] <type>: <요약>`.
- **하나의 PR은 Structural·Behavioral 중 하나만** 담는다(섞지 않는다).
- **작게 유지**: 리뷰 가능한 크기로 쪼갠다.
- **본문 템플릿** (`.github/pull_request_template.md`로 저장소에 둔다):
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

### 머지 규칙
- **CI(테스트·린트) 통과**를 머지 게이트로 한다. ⛔ 실패 상태 머지 금지.
- 셀프 머지는 허용하되, 머지 전 **본인 diff 셀프 리뷰**를 거친다(팀 협업 시 리뷰어 지정).
- 머지 후 브랜치는 삭제한다.

### gh CLI 예시 (PowerShell)
```powershell
git switch -c feat/order-create
# ... 작업 + 커밋 ...
git push -u origin feat/order-create
gh pr create --fill --base main
gh pr view --web        # 상태/CI 확인
gh pr merge --squash --delete-branch
```

---

## 21. 신규 프로젝트 부트스트랩 체크리스트

- [ ] 저장소 구조(§3) 생성, `plan.md` / `.env.example` / `docs/architecture.md` / `.gitignore`(`.env` 제외) 작성
- [ ] 백엔드 `app/` 골격(§4): `main.py`, `config.py`, `dependencies.py`, `db/`, `core/security.py`
- [ ] `Settings` + `get_settings()` (§5) — **모든 설정은 `.env`로 주입, OS 독립 (MUST §5)**, CORS, `TZ=Asia/Seoul`
- [ ] PostgreSQL `connect_args` KST 고정 (§7, §10)
- [ ] Alembic 초기화 + 초기 마이그레이션 (§11) — **DB는 항상 Alembic으로만 관리, `create_all`은 테스트 전용 (MUST §11)**
- [ ] `pytest` + SQLite in-memory + `conftest.py` 픽스처 (§12)
- [ ] 프론트 `app/` 골격(§13): `app/plugins/api.ts`의 `$fetch` 인스턴스(`$api`), `app/stores/auth.ts`(Pinia), `app/app.vue`
- [ ] SPA 고정: `nuxt.config.ts`의 `ssr: false` + `nuxt generate` 정적 산출물 (§2, §13)
- [ ] `app/middleware/auth.ts` 가드 + 각 페이지 `definePageMeta({ middleware: 'auth' })` + SSO 로그인/콜백 흐름 (§14)
- [ ] Tailwind v4 `@theme`(`app/assets/css/main.css`), pnpm, ESLint + `nuxt typecheck` (§15, §2)
- [ ] `.github/pull_request_template.md` 추가, `main` 보호 + CI 머지 게이트 (§20)
- [ ] 첫 실패 테스트 작성(TDD Red) → 구현(Green) (§18)
