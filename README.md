# FastAPI + Nuxt + PostgreSQL 프로젝트 스타터 템플릿

신규 프로젝트를 **스크립트 한 번**으로 만든다.
모든 프로젝트의 기준(아키텍처·룰)의 원본(SSOT)은 이 폴더다.

```
_project-template/
├── scaffold.ps1            # ★ Windows (PowerShell) 스캐폴드
├── scaffold.sh             # ★ macOS / Linux (bash) 스캐폴드 — 동작 동일
├── README.md               # (이 파일)
└── skeleton/               # 새 프로젝트가 받는 골격 전체
    ├── README.md           # 사람용 개요·실행 방법
    ├── AGENTS.md           # AI 에이전트 공통 지침 (Codex·Cursor 등 공용)
    ├── CLAUDE.md           # Claude Code 진입점 — @AGENTS.md import
    ├── ARCHITECTURE.md     # 공통 아키텍처 가이드 (상세 기준)
    ├── DESIGN.md           # 디자인 토큰(색상/타이포) — 항상 포함, 테마 주입은 선택
    ├── PLAN.md             # TDD 작업 계획
    ├── docs/               # 프로젝트 고유 문서 (PRD·유저 플로우·기획서 등)
    ├── .gitignore / .gitattributes
    ├── .github/pull_request_template.md
    ├── backend/            # FastAPI + SQLAlchemy + Alembic + pytest
    └── frontend/           # Nuxt(SPA) + Vue 3 + TS + Tailwind v4 + $fetch/useAsyncData/Pinia
```

## 한눈에 보기

### 무엇이 들어 있나

```mermaid
mindmap
  root((FastAPI + Nuxt + PostgreSQL 스타터))
    백엔드
      FastAPI + Uvicorn
      SQLAlchemy 2.1
      Alembic 마이그레이션
      pytest + ruff
      PostgreSQL
    프론트엔드
      Nuxt SPA
      Vue 3
      Pinia
      useAsyncData
      $fetch ofetch
      Tailwind CSS v4
    기본 내장 기능
      access JWT + refresh 쿠키 로그인
      세션 회전·재사용 감지
      초기 관리자 .env 시드
      보호 라우트 가드
      백엔드·DB 상태 화면
    자동화
      scaffold.sh / scaffold.ps1
      런타임 부트스트랩
      GitHub Actions CI
      Claude 스킬 5종
    고정 규칙
      DB는 Alembic으로만
      설정은 .env로만
      시각은 KST 단일 기준
      TDD + Tidy First
```

### 스크립트 한 번으로 무슨 일이 일어나나

```mermaid
flowchart TD
    A["scaffold.sh / scaffold.ps1 실행"] --> B{"Python·Node·pnpm 이 하한을 충족하나?"}
    B -- 예 --> E["프로젝트명 입력 → snake_case 변환"]
    B -- 아니오 --> C["bootstrap 실행 — 핀 버전은 임시 폴더에 기록"]
    C --> D{"bootstrap 성공 + 재검증 통과?"}
    D -- 아니오 --> X["오류 안내 후 중단 — 골격을 만들지 않는다"]
    D -- 예 --> E
    E --> F{"DESIGN.md 적용?"}
    F -- 예 --> G["colors·typography → Tailwind @theme 생성"]
    F -- 아니오 --> H["기본 테마 사용"]
    G --> I["skeleton 복사 + 토큰 치환 + 핀 파일 이관"]
    H --> I
    I --> J["backend/.env · frontend/.env 생성"]
    J --> K{"--skip-install?"}
    K -- 아니오 --> L["백엔드 venv + pip install"]
    K -- 예 --> M{"--skip-db?"}
    L --> M
    M -- 아니오 --> N{"psql 로 DB 접속 가능?"}
    N -- 예 --> O["DB 생성 또는 재사용 → alembic upgrade head"]
    N -- 아니오 --> P["수동 DB 작업 안내"]
    M -- 예 --> Q["프론트 pnpm install"]
    O --> Q
    P --> Q
    Q --> R["실행 방법 안내 출력"]
```

> `--skip-db`·`--skip-install` 은 해당 단계만 건너뛴다.
> **런타임 사전 검사와 bootstrap 선행 실행은 두 옵션으로 생략되지 않는다.**

### 만들어진 앱이 실제로 도는 모습

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자
    participant F as Nuxt SPA
    participant A as FastAPI
    participant D as PostgreSQL

    U->>F: 루트 경로 접속
    F->>A: POST /api/v1/auth/refresh — auth-init 플러그인, 쿠키 자동 전송
    A-->>F: 쿠키 없음 → 401
    F-->>U: 미인증 → 로그인 화면
    U->>F: 아이디·비밀번호 입력
    F->>A: POST /api/v1/auth/login
    A->>D: 로그인 잠금 확인(login_throttles) + bcrypt 검증 + auth_sessions 세션 생성
    D-->>A: user
    A-->>F: access_token 바디(refresh_token 은 null) + refresh_token HttpOnly 쿠키
    F->>F: access 토큰을 Pinia 메모리에 두고 메인으로 이동
    F->>A: GET /api/v1/auth/me
    A-->>F: 사용자 정보
    U->>F: 시스템 상태 화면 열기
    F->>A: GET /api/v1/health 와 /api/v1/health/db
    A->>D: 연결 확인
    A-->>F: 정상 응답
    F-->>U: 백엔드·데이터베이스 상태 표시
```

### 요청이 흐르는 계층

```mermaid
flowchart LR
    subgraph FE["프론트엔드 app/"]
      PG["pages/ 화면"] --> CO["composables/ useAsyncData"]
      CO --> API["plugins/api.ts $fetch 인스턴스"]
      PG --> ST["stores/ Pinia 전역 상태"]
    end
    subgraph BE["백엔드 app/"]
      RR["api/v1/ 얇은 라우터"] --> SV["services/ 도메인 로직"]
      RR --> SC["schemas/ Pydantic 검증"]
      SV --> MD["models/ SQLAlchemy"]
    end
    API -->|"Bearer access JWT + refresh 쿠키 · /api/v1"| RR
    MD --> DB[("PostgreSQL")]
    AL["alembic/ 마이그레이션"] --> DB
```

> 계층 규칙: 라우터는 HTTP 만 얇게, 도메인 로직은 `services/`, 검증은 `schemas/`.
> 프론트는 서버 상태를 `composables/` 의 `useAsyncData` 로만 다루고 `ref` + `onMounted` 로 직접 패칭하지 않는다. 상세는 [`skeleton/ARCHITECTURE.md`](skeleton/ARCHITECTURE.md).

## 사용법 — OS별 스크립트

> 이 템플릿 폴더는 자신의 OS·작업 폴더로 복사해서 쓴다.
> 두 스크립트는 같은 `skeleton/` 을 사용하므로 어느 OS에서 만들어도 결과가 동일하다.

> **생성 위치(`-Target`/`--target`)를 지정하지 않으면** `_project-template` 의 **부모 폴더에 프로젝트명으로** 생성된다.
> 예: `project/_project-template/` 에서 실행하면 → `project/<프로젝트명>/` 에 생성. (대화형일 땐 기본값을 보여주고 Enter 로 수락)

### Windows (PowerShell) — `scaffold.ps1`

```powershell
# 대화형 (이름/위치/DB정보/DESIGN 적용여부를 물어봄)
.\scaffold.ps1

# 인자 지정
.\scaffold.ps1 -Name MyProject -Target C:\work\MyProject

# 골격만 빠르게 (DB·설치 생략)
.\scaffold.ps1 -Name Demo -Target .\Demo -SkipDb -SkipInstall
```

### macOS / Linux (bash) — `scaffold.sh`

```bash
chmod +x scaffold.sh          # 최초 1회 (실행 권한이 없을 때)

# 대화형
./scaffold.sh

# 인자 지정
./scaffold.sh --name MyProject --target ~/work/MyProject

# 골격만 빠르게
./scaffold.sh --name Demo --target ./Demo --skip-db --skip-install
```

| PowerShell | bash |
|-----------|------|
| `-Name` `-Target` | `--name` `--target` |
| `-SkipDb` `-SkipInstall` | `--skip-db` `--skip-install` |
| `-Design` `-NoDesign` | `--design` `--no-design` |
| `-DbHost/-DbPort/-DbUser/-DbPassword/-DbName` | `--db-host/--db-port/--db-user/--db-password/--db-name` |

### 스크립트가 하는 일 (전체 자동)

1. **런타임 사전 검사** → 하한 미달이면 bootstrap 실행 후 재검증, 실패하면 골격 복사 전에 중단
2. 이름/위치 입력 → `PascalCase`를 `snake_case`(DB명·토큰키)로 변환
3. **DESIGN.md 적용 여부 질문** → 적용 시 `colors`/`typography`를 Tailwind `@theme`로 변환해 `frontend/app/assets/css/main.css`에 주입(`DESIGN.md` 는 적용 여부와 무관하게 항상 포함)
4. `skeleton/` 복사 + 토큰 치환(`__PROJECT_NAME__`, `__PROJECT_SNAKE__`, 테마) + 런타임 핀 파일 이관
5. **PostgreSQL 접속정보(host/port/user/password/db) 질문** → `backend/.env`·`frontend/.env` 생성(`DATABASE_URL`·`SECRET_KEY`(랜덤)·`REFRESH_TOKEN_TRANSPORT=cookie`·`APP_ENV=development`·`SEED_DEFAULT_ADMIN=true`/`DEFAULT_ADMIN_PASSWORD`(랜덤 생성 후 출력) 주입, 기존 `backend/.env` 는 `.env.bak.<시각>` 으로 백업, 권한은 현재 사용자로 제한)
6. 백엔드: `python -m venv .venv` + `pip install -r requirements.txt`
7. **psql 로 DB 생성** → **Alembic `upgrade head` 로 테이블 생성**(DB는 항상 Alembic으로 관리 §11)
8. 프론트: `pnpm install`
9. 실행 방법(`uvicorn`, `pnpm dev`) 출력

### 옵션 플래그

| 플래그 | 효과 |
|--------|------|
| `-SkipDb` | psql DB 생성 + alembic 마이그레이션 생략 |
| `-SkipInstall` | venv/pip + pnpm install 생략 |
| `-Design` / `-NoDesign` | DESIGN.md 적용 강제 / 미적용 (질문 생략) |
| `-DbHost/-DbPort/-DbUser/-DbPassword/-DbName` | DB 접속정보 비대화형 지정 |

### 사전 요구사항 (PATH 에 있어야 함)

- Windows: `python` (3.13+), Node.js (24+), `pnpm` (11+), `psql` (PostgreSQL)
- macOS/Linux: `python3` (3.13+), Node.js (24+), `pnpm` (11+), `psql`
- 없으면 해당 단계는 안내 메시지와 함께 건너뛴다.

## 생성 직후

1. 스크립트가 출력한 대로 백엔드(`uvicorn`)·프론트(`pnpm dev`)를 실행
2. 브라우저 http://localhost:5173 → 랜딩 페이지에서 **백엔드·DB 연결 상태**가 "정상"이면 성공
3. AI 에이전트에게: "`AGENTS.md`·`ARCHITECTURE.md`·`PLAN.md` 따라 개발 시작" → TDD(Red→Green→Refactor)

## 기준이 바뀌면

- **원본만 수정**: `skeleton/ARCHITECTURE.md`(+ 필요 시 `skeleton/AGENTS.md`).
- `ARCHITECTURE.md` 상단의 **★ 핵심 MUST 요약**이 항상 최신 고정 규칙을 반영하도록 유지한다.
- 진행 중인 프로젝트는 필요할 때 변경분을 동기화한다.

> 작업 규칙(TDD / Tidy First / 커밋 형식 / PowerShell / pnpm / 한국어)은 `skeleton/AGENTS.md`에 직접 담는다 —
> 전역 설정(`~/.claude/CLAUDE.md` 등) 없이도 어떤 에이전트든 같은 규칙을 따르게 하기 위해서다.

## 검증 상태

**2026-10-02 공통 백엔드 교체 검증** (Windows 11, Python 3.13.14 / pnpm 11.28.3) —
`scaffold.ps1 -SkipDb -NoDesign` 으로 만든 임시 프로젝트 + PostgreSQL 16(docker)에서 확인했다.

- 백엔드: `skeleton/backend/` 가 공통 백엔드와 동일(`.env.example` 제외, `diff -r`), `ruff check .` 통과,
  `pytest -q` 83건 통과(`-W error::DeprecationWarning` 포함)
- PostgreSQL: `alembic upgrade head`(0001 → 0002 → `0003_auth_sessions`) 로 `app_meta`·`users`·`auth_sessions`·`login_throttles` 생성
- 실구동(Nuxt dev 출처 → devProxy → uvicorn, curl + 쿠키 저장소): 로그인 200(`Set-Cookie: refresh_token; HttpOnly; Path=/api/v1/auth;
  SameSite=lax`, 본문 `refresh_token: null`) → `/auth/me` Bearer 200 → 쿠키 refresh 200(쿠키 회전) → 유예(60초) 내 이전 쿠키 200,
  유예 후 이전 쿠키·위조 쿠키 401 + 쿠키 삭제(세션 폐기, 현재 쿠키도 401) → 로그아웃 204 + 쿠키 삭제 → 이전 access 401 · refresh 401,
  잘못된 비밀번호 5회 후 6번째 429(`Retry-After` 없음, 올바른 비밀번호도 429)
- 프론트: `pnpm install` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm generate` 모두 exit 0
- 브라우저 화면 렌더링(로그인 오류 문구 표시 포함)은 이번에 확인하지 않았다.

**2026-10-02 의존성 상향 재검증** (Windows 11, Python 3.13.12 / Node 24.14.0 / pnpm 11.28.3) —
`skeleton/` 복사 + 토큰 치환으로 만든 임시 프로젝트에서 확인했다(스캐폴드 스크립트는 이 환경에서 런타임 사전 점검·bootstrap 단계에서 중단됨).

- 백엔드: `ruff check .` 통과, `pytest -q` 31건 통과(`-W error::DeprecationWarning` 포함)
- PostgreSQL 16(docker): `alembic upgrade head`(0001 → 0003) · `downgrade base` 왕복 · `alembic check` 변경 없음,
  관리자 로그인 → `/auth/me` → `/auth/refresh` 200, 72바이트 초과 비밀번호 로그인 422
- 프론트: `pnpm install` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm generate` 모두 exit 0,
  install 후 `package.json`·`pnpm-workspace.yaml` 변경 없음

아래는 macOS(Darwin 25.5, Python 3.13.14 / Node 24.18.0 / pnpm 11.9.0)에서
`scaffold.sh` 로 실제 프로젝트를 생성해 확인한 결과다.

**통과 확인함**

- 스캐폴드: `--skip-db --skip-install --no-design` / `--design` 양쪽 exit 0.
  생성물에 `__PROJECT_NAME__` · `__PROJECT_SNAKE__` · `__THEME_CSS__` 잔재 없음
  (`.vue` 포함, 토큰을 담은 골격 파일의 확장자는 모두 치환 대상에 포함된다)
- 토큰 치환: `nuxt.config.ts` 의 `app.head.title`, `package.json` `name`(`my_project-frontend`),
  `main.py` FastAPI `title`(`MyProject API`) 모두 정상
- `.env` 생성: `backend/.env` 에 `DATABASE_URL`·`SECRET_KEY` 주입,
  `frontend/.env` 는 `NUXT_PUBLIC_API_BASE_URL=` (빈 값 → devProxy 사용) + `NUXT_PUBLIC_BACKEND_URL=http://localhost:8000`
- 테마: `--no-design` 은 기본 `@theme`, `--design` 은 DESIGN.md 의 색상(`--color-primary: #00478d` 등)이
  `frontend/app/assets/css/main.css` 에 주입됨 (`DESIGN.md` 는 두 경우 모두 포함)
- 백엔드: `pip install -r requirements.txt` + `ruff check .` (통과) + `pytest -q` (7건 통과).
  `.env` 의 `DATABASE_URL` 이 PostgreSQL 을 가리켜도 테스트는 SQLite in-memory 픽스처를 쓰므로 영향 없음 (§12)
- Alembic: SQLite 기준 `upgrade head` / `downgrade base` (0001_initial → 0002_users, `app_meta`·`users` 테이블)
- 프론트: `pnpm install` · `pnpm lint` · `pnpm typecheck`(`vue-tsc`) · `pnpm build` · `pnpm generate`
  다섯 개 모두 exit 0. `ERR_PNPM_IGNORED_BUILDS` 경고 없음(`pnpm-workspace.yaml` 의 `allowBuilds` 가 선제 대응),
  `pnpm install` 이 `pnpm-workspace.yaml` 을 수정하지 않는 것도 해시 비교로 확인
- 정적 산출물: `nuxt generate` 결과 `.output/public/` 에 SPA fallback `200.html` 과 `index.html`·`404.html` 생성됨
  (`ssr: false` 이므로 HTML 은 빈 셸이고 렌더링은 브라우저에서 한다)
- 구동: SQLite 로 `uvicorn app.main:app` 기동 후
  `GET /api/v1/health` → `{"status":"ok"}`, `GET /api/v1/health/db` → `{"db":"ok","table":"app_meta","rows":0}`,
  초기 관리자 시드 계정 로그인 → access token 발급 → `GET /api/v1/auth/me` 200,
  토큰 없음/잘못된 토큰/비밀번호 오류는 모두 401
- 프론트 dev 서버: `/login` 이 `<title>MyProject</title>` 를 가진 SPA HTML 셸을 반환하고
  `runtimeConfig.public` 이 `.env` 값대로 주입됨. `/api/v1/*` 요청은 nitro devProxy 로 백엔드에 전달되어
  health·login 응답이 그대로 돌아옴
- 브라우저(Chrome) 실제 렌더링: 4개 화면 확인 — `/login` 로그인 → 메인(`/`) 에 사용자명 표시 →
  `/landing` 의 백엔드·데이터베이스 배지 모두 "정상" → `/my` 의 아이디·권한 표시.
  DESIGN.md 테마가 실제 화면에 적용되고 콘솔 에러 없음
- 인증 가드: 로그아웃 시 세션이 폐기되고(메모리 access 토큰 제거 + 서버 refresh 세션 revoke),
  보호 라우트(`/my`) 재진입 시 `auth` 미들웨어가 `/login` 으로 리다이렉트함

**미검증**

- 인증 재설계 반영분: 위 macOS 검증은 인증 재설계(불투명 refresh 토큰 + HttpOnly 쿠키 + DB 세션 회전,
  `skeleton/ARCHITECTURE.md` §9) **이전** 골격으로 수행했다(재설계 이후 Windows 검증은 맨 위 항목 참조). refresh 회전·재사용 감지·429·
  초기 관리자 `.env` 시드는 macOS(`scaffold.sh`)에서는 아직 재검증하지 않았다.
- PostgreSQL 경로: `--skip-db` 로 검증했으므로 `psql` DB 생성 + PostgreSQL 상대 `alembic upgrade head` 는
  확인하지 못했다. 마이그레이션은 SQLite 로만 검증했다.
- `scaffold.ps1`(Windows/PowerShell): 실행 환경이 없어 검증하지 못했다. bash 판과 동일한
  `skeleton/` 을 사용하지만 결과 동일성은 확인되지 않았다.
- 스캐폴드의 자동 설치 단계(`--skip-install` 없이 실행)는 거치지 않았다. pip/pnpm 설치는 수동으로 확인했다.
- `pnpm preview` / `node .output/server/index.mjs` 로 빌드 산출물을 띄우는 경로는 확인하지 않았다.

**알려진 문제**

- `skeleton/scripts/bootstrap.sh` 는 `--project-root` 인자를 받지 않는다(`$1` 은 `--with-postgres` 만 해석).
  그래서 `scaffold.sh` 가 넘기는 임시 폴더를 무시하고 `PROJECT_ROOT` 를 `skeleton/` 으로 잡아
  템플릿의 `skeleton/.python-version`·`skeleton/.nvmrc` 를 덮어쓴다.
  pyenv·fnm 이 PATH 에 없는 셸에서 `scaffold.sh` 를 돌리면 재현된다.
- ~~`nuxt dev` 가 `[::1]`(IPv6) 에만 바인딩해 `127.0.0.1:5173` 접속이 거부되는 문제~~ →
  `nuxt.config.ts` 의 `devServer.host` 를 `0.0.0.0` 으로 지정해 해결했다. `localhost`·`127.0.0.1`·LAN 주소 모두 접속 확인.

버전은 caret 범위이므로 필요 시 `pnpm up` / `pip` 로 갱신 가능하다.
