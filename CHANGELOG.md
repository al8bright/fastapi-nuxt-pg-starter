# Changelog

스캐폴드 템플릿 `fastapi-nuxt-pg-starter` 의 변경 이력.
형식은 [Keep a Changelog](https://keepachangelog.com/) 를 느슨히 따른다.

---

## 2026-10-02 — 공지사항·배너·관리자 API + 업로드 저장소·본문 HTML 정화 (네 템플릿 공통 백엔드) + 사용자 화면·관리자 콘솔·자체 리치 에디터 (Nuxt)

### Added (추가)

- **테이블 3종** (alembic `0004_notices_banners`) — `notices`(정화된 `body_html`, 고정·게시·`published_at`·조회수, `author_id` SET NULL),
  `notice_attachments`(공지 CASCADE, 공지당 최대 10개), `banners`(이미지 key·크기, `link_url`, 노출 기간 `starts_at`/`ends_at`, 순서, 활성).
- **공개 API** — `GET /notices`(게시분만, 고정 먼저 → 게시일 최신순, `page·size·q`), `GET /notices/{id}`(조회수 +1, 첨부 목록),
  `GET /notices/{id}/attachments/{aid}`(attachment + RFC 5987 `filename*` 한글 파일명 + nosniff), `GET /banners`(활성 + KST 노출 기간 안).
- **관리자 API** (`/admin/*`, 라우터 단위 `require_admin` — 비로그인 401, 일반 사용자 403) — 대시보드 집계(사용자·세션·잠금·공지·배너·DB 상태·Alembic 리비전),
  사용자 목록·권한/활성 변경(자기 강등·비활성화 금지, 마지막 활성 관리자 보호 409, 비활성화 시 세션 전부 폐기), 세션 목록·강제 폐기,
  로그인 잠금 목록·해제, 공지 CRUD·첨부 업로드/다운로드/삭제, 배너 CRUD·이미지 업로드·순서 변경, 에디터 이미지 업로드(`POST /admin/editor/images` → `{key,url,width,height}`).
- **업로드 저장소** `app/core/storage.py` — `UPLOAD_DIR`(기본 `backend/uploads/`, `.gitignore`) 아래 서버 생성 키로만 저장.
  이미지는 시그니처 + Pillow 검증(PNG·JPEG·WebP·GIF), EXIF 방향 반영 후 메타데이터 없이 재인코딩, 긴 변 2000px 초과 축소, GIF 는 원본 그대로.
  첨부는 확장자 허용 목록·무작위 파일명(원본 이름은 DB). `public/` 만 `/uploads/public` 으로 정적 서빙하고 `private/` 첨부는 API 로만 내려간다.
- **본문 HTML 정화** `app/core/sanitize.py`(nh3) — 에디터 명세 §7 허용 목록. 유튜브 embed 외 iframe 제거 + sandbox 등 강제, `style`·`on*`·`javascript:`·`data:` 제거,
  링크 `rel="noopener noreferrer"`. 공지 저장 시 서비스 계층에서 항상 정화하고, 정화 후 빈 본문은 422.
- 새 설정 `UPLOAD_DIR`·`PUBLIC_FILES_BASE_URL`·`MAX_IMAGE_UPLOAD_MB`(5)·`MAX_ATTACHMENT_UPLOAD_MB`(20), 의존성 `nh3==0.3.7`·`pillow==12.3.0`.
- `ServiceError`·`StorageError` 전역 핸들러(`app/api/errors.py`) — 코드별 HTTP 상태 표 한 곳, 응답 `{"detail","code"}`.
- 백엔드 테스트 107 → **319** 건(`test_sanitize`·`test_storage`·`test_uploads_serving`·`test_notices`·`test_banners`·`test_admin`).

### Added (프론트엔드 — 사용자 화면 디자인 A · 관리자 콘솔 디자인 A)

- **공개 사용자 화면** (`layouts/default.vue` — 상단 내비 포털): 첫 화면 `/` 를 로그인 없이 공개. 홈은 배너 캐러셀(`GET /banners` — 이전/다음·점 버튼,
  6초 자동 넘김은 마우스 올림·포커스·일시정지 버튼으로 멈춤, `prefers-reduced-motion` 이면 자동 넘김 없음, 내부 링크는 `NuxtLink`·외부 링크는 새 창 `noopener`)
  — 배너가 없으면 기본 히어로, 주요 서비스(자리표시), 최신 공지 5건, 내 계정. `/notices`(고정 배지·첨부 표시·제목 검색·페이지, URL 쿼리),
  `/notices/:id`(게시일·조회수·`RichContent` 본문·첨부 `download_url`·검색 상태를 지킨 "목록으로"), `/me`(내 정보). 계정 메뉴(내 정보·로그아웃)와 **admin 에게만** "관리자 콘솔" 링크.
- **관리자 콘솔** (`/admin/**`, `layouts/admin.vue` — 그룹형 사이드바 개요·콘텐츠·회원·보안·시스템, 현재 메뉴 `aria-current`, "로그인 잠금" 잠긴 계정 수 배지,
  1024px 미만은 상단 메뉴 서랍): 대시보드(KPI·최근 세션 강제 종료·잠금 해제), 공지(목록·작성/수정 — 리치 에디터, 상단 고정·게시, 첫 저장 뒤 수정 URL 로 전환해 첨부 패널 —
  여러 파일 순차 업로드·파일별 상태/오류·확장자·용량·개수 사전 검사·Bearer blob 다운로드·삭제, 저장하지 않은 변경 이탈 확인),
  배너(썸네일·기간·활성 토글 = PUT 전체 본문(낙관적)·위/아래 이동 = `PATCH /order`·삭제, 작성/수정 — 이미지 업로드 미리보기·대체 텍스트 필수·`link_url` 백엔드와 같은 규칙·
  `datetime-local` KST 기간), 사용자(검색·역할 필터·권한/활성 변경·세션 모두 종료, 409 `self_modification`·`last_admin` 한국어 안내), 세션(`?user_id=` 필터·강제 종료),
  로그인 잠금(잠김 강조·해제), 시스템 상태(헬스 체크 + DB·Alembic 리비전). 없는 `/admin/...` 경로는 대시보드로.
- **자체 리치 텍스트 에디터** (`components/editor/*` + `lib/editor/*`, 라이브러리 없음 — `contentEditable` + `execCommand`, 호출은 `exec()` 한 곳):
  문단·제목·굵게/기울임/밑줄/취소선·형광펜·서식 지우기·정렬(`class` 로만 저장)·목록·인용·구분선·링크, 붙여넣기 정리, undo/redo, 툴바 roving tabindex.
  이미지(버튼·붙여넣기·드래그앤드롭, 업로드 전 긴 변 1600px·WebP 재인코딩, 자르기·회전 다이얼로그, 모서리 핸들·프리셋·폭 입력 크기 조절, 대체 텍스트, 다시 자르기, 교체·삭제),
  유튜브 임베드(`youtube-nocookie`, 16:9 크기 조절·링크 바꾸기). 프로그램적 변경은 `Range.selectNode` → `exec("insertHTML"|"delete")` 로 커밋해 undo 에 남긴다.
  업로드는 공용 `$api`(FormData `file`, Bearer·single-flight refresh 적용)로 `POST /admin/editor/images`. 순수 모듈(`richText`·`imageTransform`·`mediaHtml`)은 React 템플릿과 같은 코드다.
- **가드** — `middleware/admin.ts`: 비로그인 → `/login?next=<원래 위치>`, role≠admin → 403(`app/error.vue`, fatal 오류라 클라이언트 이동에서도 표시).
  `middleware/auth.ts`(`/me`)도 `next` 를 싣는다. 로그인 화면은 `next` 를 내부 경로만 받아(`lib/returnTo.ts` `safeNext`) 그 위치로 돌아간다.
  `app/error.vue` — 404(사용자 레이아웃 안)·403·그 밖 오류 화면.
- API 모듈 `api/notices.ts`·`banners.ts`·`admin.ts`·`common.ts`(계약과 같은 타입, `use<Domain>Api()`), 조회 컴포저블 `useNotices`·`useBanners`·`useAdmin`·`useListParams`
  (키에 파라미터, 갱신은 `invalidate*()` = 떠 있는 관련 키 `refreshNuxtData`), 명령 헬퍼 `useAction`, `useUploads`(`useFileUrl`·`useEditorImageUpload`),
  공용 UI `components/ui/*`(ConfirmDialog·Pagination·Chip·Loading·ErrorState·EmptyState·Notice·SearchForm·Icon), `lib/*`(`apiError` — FetchError·NuxtError 의 도메인 code·413·422 → 한국어,
  `format`·`linkUrl`·`uploadRules`·`bannerForm`·`download`·`site`·`ui`·`adminNav`).
- 확장 디자인 토큰 기본값(`primary-fixed`·`outline`·`surface-container-low/high/highest`·`tertiary`·`error` 등)과 `.rich-text`·`.editor` 본문 스타일을 `main.css` 에 추가 —
  기본 테마(`-NoDesign`)에서도 동작하고, DESIGN.md 테마가 주입되면 그 값이 이긴다.
- **프론트 단위 테스트 도입** — vitest 5 + jsdom + `@vue/test-utils` + `@vitejs/plugin-vue`(devDependencies), `pnpm test`, `frontend/vitest.config.ts`(Nuxt 와 별개).
  9 파일 **195** 건: 에디터 순수 모듈(React 와 같은 테스트), 업로드·`apiError`·`returnTo`·배너 폼 검증, `RichTextEditor`(붙여넣기 정리·유튜브·업로드 자리표시·자르기 값·
  선택 오버레이 크기 커밋·삭제·대체 텍스트·정렬·형광펜)·`RichContent` 컴포넌트. CI(생성 프로젝트·템플릿)와 push 전 검증 명령에 `pnpm test` 추가.
- dev 프록시에 `/uploads` 추가(`nitro.devProxy`, 백엔드 공개 파일을 같은 오리진으로). 운영은 리버스 프록시 또는 `PUBLIC_FILES_BASE_URL`(ARCHITECTURE §14 "파일 URL").

### Changed (프론트엔드)

- 첫 화면 `/` 가 공개 홈이 됐다(이전: 로그인 필수 메인). 옛 메인(`pages/index.vue`)·랜딩(`pages/landing.vue`) 삭제 — 시스템 상태는 관리자 콘솔 `/admin/system` 으로 옮겼다.
  `/my` 는 `/me` 로 리다이렉트. 로그인 화면에 "홈으로" 링크, 로그인 실패 문구를 상태코드별로 세분(네트워크·422·5xx).
- 로그아웃은 홈(`/`)으로 가고 `clearNuxtData()` 로 조회 캐시를 전부 비운다. `$api` 의 refresh 실패는 로그인 필요 화면(`/admin/**`·`/me`)에서만 `/login?next=` 로 보낸다
  (공개 화면에서는 세션만 비운다).
- 스캐폴드 완료 메시지·루트 README 의 확인 안내를 "홈 화면 → 관리자 콘솔 › 시스템 상태" 로 바꿨다.

### ⚠️ 기존 프로젝트에 반영할 때

- `pip install -r requirements.txt` → `alembic upgrade head`(0004) → `backend/.env` 에 위 4개 키 추가(없으면 기본값). `backend/uploads/` 를 `.gitignore` 에 추가한다.
- 프론트엔드: `frontend/app` 의 새 `api`·`composables`·`components`·`layouts`·`middleware`·`pages`·`lib`·`error.vue` 를 옮기고 `pages/landing.vue` 를 지운다.
  `main.css` 의 확장 토큰 `@theme` 블록과 `.rich-text` 스타일, `nuxt.config.ts` 의 `/uploads` devProxy, `vitest.config.ts` 와 `package.json` 의 `test` 스크립트·devDependencies 4종을 추가한다.

## 2026-10-02 — 백엔드 보안 보강 (네 템플릿 공통)

### Added (추가)

- **보안 응답 헤더** — 모든 응답에 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`. HSTS(`max-age=31536000`)는 `COOKIE_SECURE=true` 또는 `APP_ENV=production` 일 때만 보낸다.
- **`/api/v1/auth/*` 캐시 금지** — 성공·401/422/429·쿠키 삭제 응답 모두 `Cache-Control: no-store`.
- **로그인 잠금 429 의 `Retry-After`** — 남은 잠금 초(올림·최소 1). 미존재 계정도 동일하게 받아 계정 존재가 드러나지 않는다.
- `tests/test_security.py` 24건.

### Changed (변경)

- CORS `allow_methods`/`allow_headers` 를 `"*"` 에서 명시 목록(`GET·POST·PUT·PATCH·DELETE·OPTIONS` / `Authorization·Content-Type`)으로 좁히고 `Retry-After` 를 expose 한다.
- CSP 는 `/docs`·`/redoc` 을 깨뜨리므로 백엔드에서 붙이지 않는다(프론트엔드 호스팅 책임). `ARCHITECTURE.md` §9 에 정리했다.

## 2026-10-02 — 백엔드를 공통(canonical) 백엔드로 교체 — DB 세션·로그인 스로틀·refresh 전달 방식 스위치

### Changed (변경)

- **`skeleton/backend/` 를 공통 백엔드와 동일하게 교체** — nextjs·react·svelte·nuxt 템플릿이 같은 백엔드 코드를 쓴다
  (`backend/.env.example` 만 템플릿별 값). 이 템플릿은 `REFRESH_TOKEN_TRANSPORT=cookie` 로 기존 쿠키 계약을 그대로 유지한다 —
  httpOnly 쿠키 `refresh_token`, `Path=/api/v1/auth`, `SameSite=Lax`, `Secure=COOKIE_SECURE`, `/auth/refresh` 는 쿠키로만 받고
  실패 시 401 + 쿠키 삭제, `/auth/logout` 은 항상 204 + 쿠키 삭제, 로그인 잠금은 429.
- **응답 형태 확장** — `TokenResponse` 가 `{access_token, refresh_token, token_type, expires_in, refresh_expires_in}` 이 됐다.
  cookie 모드에서 `refresh_token` 은 항상 `null` 이다. 프론트 `TokenResponse` 타입을 맞췄다.
- **access JWT 에 `sid`(세션 id) 클레임** — `/auth/me` 등 인증 요청마다 세션 유효성을 검사하므로 로그아웃·세션 폐기 즉시
  access 토큰도 401 이 된다. `sid` 없는 기존 토큰은 401 이다.
- **refresh 회전에 직전 토큰 60초 유예** — 멀티 탭 동시 갱신을 재사용으로 오판하지 않는다. 유예 밖 재사용·위조 토큰은
  **그 세션만** 폐기한다(기존: 그 사용자의 모든 세션 폐기). 회전해도 절대 수명(`REFRESH_TOKEN_EXPIRE_DAYS`)은 연장되지 않는다.
- **로그인 시도 제한을 DB 로 이동** — 인메모리 `app/core/rate_limit.py`((username, IP)별 5분 창, `Retry-After`)를 제거하고
  계정별 DB 카운터 `login_throttles`(`LOGIN_MAX_FAILURES`=5, `LOGIN_LOCKOUT_MINUTES`=15)로 대체했다. 다중 워커에서도 공유되며,
  미존재 계정도 같은 429 를 받는다. **429 응답에 `Retry-After` 헤더는 더 이상 없다.**
- **초기 관리자 시드 키 변경** — `INITIAL_ADMIN_USERNAME`/`INITIAL_ADMIN_PASSWORD` → `SEED_DEFAULT_ADMIN`(코드 기본값 꺼짐) +
  `DEFAULT_ADMIN_PASSWORD`(기본값 없음, 아이디는 `admin` 고정). 스캐폴드가 개발 `.env` 에서만 무작위 비밀번호로 켠다.
- **`APP_ENV=production` fail-fast** — 공개 기본 `SECRET_KEY`, 관리자 시드, cookie 모드 + `COOKIE_SECURE=false` 면 기동을 거부한다.
  개발에서는 기본 `SECRET_KEY` 를 경고만 한다(기존: 32자 미만·기본값이면 항상 `Settings` 검증에서 기동 거부).
- **스캐폴드 `.env` 생성** (`scaffold.ps1`·`scaffold.sh`) — `LOGIN_*`·`REFRESH_TOKEN_TRANSPORT=cookie`·`APP_ENV=development`·
  `SEED_DEFAULT_ADMIN=true`·`DEFAULT_ADMIN_PASSWORD` 를 쓰고 `INITIAL_ADMIN_*` 를 제거했다. 재실행 시 기존 `backend/.env` 를
  `.env.bak.<시각>` 으로 백업하고, `backend/.env` 권한을 현재 사용자로 제한한다(PowerShell ACL / `chmod 600`).
- **프론트 로그인 오류 문구** — 429 이면 "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요." 를, 401/422 이면 자격증명 오류를
  보여준다(`useLogin().errorMessage`). 로그인 화면의 `admin / admin123` 안내 문구를 제거했다(그런 기본 계정은 없다).
- 문서: `ARCHITECTURE.md` §2·§5·§9(테이블·엔드포인트 계약·전달 방식·로그인 보호)·§12·§14·§17·§21(배포 전 체크리스트),
  `AGENTS.md`, `skeleton/README.md`, 루트 `README.md`, `stack-versions` 스킬.

### Removed (제거)

- 백엔드 보안 응답 헤더 미들웨어(`X-Content-Type-Options`·`X-Frame-Options`·`Referrer-Policy`·`Cross-Origin-Opener-Policy`·HSTS)와
  `/api/v1/auth` 응답의 `Cache-Control: no-store` — 공통 백엔드에 없다. 필요하면 리버스 프록시에서 설정한다.
- `app/models/session.py`·`alembic/versions/0003_sessions.py`·`app/core/rate_limit.py`·`tests/test_security.py`.

### ⚠️ Breaking (기존 생성 프로젝트)

- **DB 스키마**: 리비전 `0003_sessions`(테이블 `sessions`)가 `0003_auth_sessions`(테이블 `auth_sessions` + `login_throttles`)로
  바뀌었다. 이전 골격으로 만든 프로젝트에 이 백엔드를 옮기면 `alembic_version` 의 `0003_sessions` 를 찾지 못한다.
  옮기려면 먼저 이전 코드로 `alembic downgrade 0002_users`(→ `sessions` 삭제, 기존 로그인 세션은 모두 무효)를 한 뒤
  새 코드로 `alembic upgrade head` 를 실행한다. `0001_initial`·`0002_users` 는 리비전 id 가 같고, 새 판은
  `created_at`/`updated_at` 에 `server_default=now()` 가 추가된 차이뿐이다(기존 DB 에는 반영되지 않지만 ORM 이 값을 채우므로 동작 영향 없음).
- **`.env`**: `INITIAL_ADMIN_*` 는 무시된다. 시드가 필요하면 `SEED_DEFAULT_ADMIN=true` + `DEFAULT_ADMIN_PASSWORD` 를 넣고,
  `REFRESH_TOKEN_TRANSPORT=cookie`·`LOGIN_*`·`APP_ENV` 를 추가한다.

## 2026-10-02 — 골격 복사 시 빌드 산출물·`.env` 가 생성 프로젝트로 복사되던 문제 수정

### Fixed (수정)

- **골격 복사에서 산출물·비밀 제외** (`scaffold.ps1`·`scaffold.sh`) — 템플릿 저장소에서 개발/검증한 뒤 `skeleton/` 에 남은
  `node_modules`·`.venv`·`.nuxt`·`.output`·`.ruff_cache`·`.pytest_cache`·`__pycache__`·`.DS_Store`·`.env` 가 생성 프로젝트로 그대로
  복사됐다. 복사된 `node_modules` 때문에 `pnpm install` 이 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 로 중단됐고, 실제 `.env` 가
  있으면 템플릿의 `SECRET_KEY` 가 새 프로젝트로 샐 수 있었다. 이제 PowerShell 은 `robocopy /XD /XF`, bash 는 `tar --exclude` 로
  원천 제외한다(nextjs 저장소와 동일한 처리). robocopy 가 숨김 항목도 복사하므로 닷파일·`.claude` 누락 보강 단계는 제거했다.
  토큰 치환 단계도 같은 디렉터리(+ `.git`)를 걸러 재실행 시 산출물을 붙잡지 않는다.

## 2026-10-02 — pyenv 환경에서 스캐폴드가 Python 검증에 실패하던 문제 수정

### Fixed (수정)

- **pyenv 버전을 명시 선택** (`scaffold.ps1`) — 스캐폴드는 pyenv shim 을 PATH 앞에 올리지만 버전은 고르지 않아,
  `pyenv global` 이 비어 있거나 system 이면 `python` 이 실패하거나 옛 버전을 가리켰다. 그 결과 bootstrap 이 핀(3.13.x)을
  설치·재사용한 뒤에도 "Python 이 3.13 이상이 아닙니다" 로 중단됐다. 이제 골격의 `.python-version` 핀을 활성화보다 먼저 읽고,
  핀이 pyenv 에 설치돼 있으면 그 버전을, 없으면 하한을 충족하는 설치본 중 최신을 `PYENV_VERSION` 으로 지정한다.
- **bootstrap 에 핀 전달** — bootstrap 에 넘기는 임시 폴더에 골격의 `.python-version`·`.nvmrc` 를 미리 심어 핀이 존중되게 하고,
  bootstrap 이 실제로 고정한 버전을 다시 읽어 활성화한다. fnm 도 `.nvmrc` 핀을 우선 사용한다(nextjs 저장소와 동일한 처리).

## 2026-10-02 — Windows PowerShell 5.1 구문 검사 실패 수정

### Fixed (수정)

- **`skeleton/scripts/bootstrap.ps1` 에 UTF-8 BOM 추가** — BOM 이 없어 Windows PowerShell 5.1 이 한글을 ANSI 로 읽고
  구문 오류(6건)로 즉시 실패했다. Windows 에서 `scaffold.ps1` 이 bootstrap 단계에서 멈추던 원인이다.
- **PowerShell 구문 검사를 BOM 달린 스크립트 파일로 분리** — `.github/scripts/check-ps1-syntax.ps1`(템플릿·골격 양쪽).
  Actions 는 `shell: powershell` 인라인 스텝을 BOM 없는 UTF-8 임시 파일로 쓰고, Windows PowerShell 5.1 은 이를 ANSI 로 읽어
  한글 메시지에서 따옴표 짝이 무너진다. `template-ci.yml`·골격 `ci.yml` 의 `powershell-syntax` 잡은 이제 이 파일만 실행한다.

## 2026-10-02

의존성 전체를 최신 안정 버전으로 상향했다. 런타임 최소(Python ≥ 3.13 · Node ≥ 24 · pnpm ≥ 11)와 `.python-version`·`.nvmrc`·`scripts/versions.env` 는 그대로다.

### Changed (변경)

- **백엔드 핀**(`requirements.txt`) — FastAPI 0.137.2 → 0.142.2, Uvicorn 0.49.0 → 0.54.0, SQLAlchemy 2.0.51 → 2.1.1, Alembic 1.18.5 → 1.20.0, psycopg2-binary 2.9.12 → 2.9.13, Pydantic 2.13.4 → 2.13.5, pydantic-settings 2.14.2 → 2.15.0, PyJWT 2.13.0 → 2.15.1, bcrypt 4.3.0 → 5.0.0, httpx2 2.5.0 → 2.13.1, ruff 0.14.0 → 0.16.9. python-multipart 0.0.32 · pytest 9.1.1 은 이미 최신이다.
- **프론트 범위**(`package.json`) — @pinia/nuxt ^1.0.2, pinia ^4.0.3, vue ^3.5.43, vue-router ^5.3.1, eslint ^10.11.0, vue-tsc ^3.3.11, @types/node ^24.19.0, `packageManager` pnpm@11.28.3. nuxt 4.5.2 · @nuxt/eslint 1.17.0 · tailwindcss/@tailwindcss/vite 4.3.3 은 이미 최신이다. TypeScript 는 vue-tsc 의 TS 7 호환이 확인되지 않아 `~6.0.3` 을 유지한다.
- **`UserRole`** 을 `class UserRole(str, enum.Enum)` 에서 `enum.StrEnum` 으로 바꿨다. ruff 0.16 의 `UP042` 대응이며, 사용처가 모두 `.value` 를 쓰므로 동작은 같다.
- **`alembic.ini`** 에 `path_separator = os` 를 추가했다. Alembic 1.20 은 이 키가 없으면 `prepend_sys_path` 레거시 분리 방식에 대한 DeprecationWarning 을 낸다.
- **문서** — `README.md` 버전 표·기준일, `architecture.md` §2 스택 표기(FastAPI 0.142 · SQLAlchemy 2.1), `CLAUDE.md`, `stack-versions` 스킬의 스냅샷과 버전별 주의(SQLAlchemy 2.1/Alembic 1.20, bcrypt 5, ruff 0.16, 검증 절차)를 갱신했다.

### Added (추가)

- **72바이트 초과 비밀번호 회귀 테스트** — bcrypt 5 부터 `hashpw`/`checkpw` 가 72바이트 초과 입력에 `ValueError` 를 던진다. 기존 가드(로그인 스키마 422, `validate_password_policy`, `verify_password` 의 `False` 반환)가 500 을 막는지 확인하는 테스트 4건을 추가했다(로그인 422, 계정 생성 `weak_password`, `hash_password` 거부, `verify_password` False).

### 검증

- `skeleton/` 복사 + 토큰 치환으로 만든 임시 프로젝트(Windows, Python 3.13.12 / Node 24.14.0 / pnpm 11.28.3)에서 수행했다. `scaffold.ps1`·`scaffold.sh` 는 이 환경에서 런타임 사전 점검·bootstrap 단계에서 중단되어 사용하지 못했다.
- 백엔드: `ruff check .` 통과, `pytest -q` 31건 통과(`-W error::DeprecationWarning` 에서도 통과).
- PostgreSQL 16(docker): `alembic upgrade head` · `downgrade base` 왕복 · `alembic check`("No new upgrade operations detected") 통과. 관리자 로그인·`/auth/me`·`/auth/refresh` 200, 72바이트 초과 비밀번호 로그인 422.
- 프론트: `pnpm install` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm generate` 모두 exit 0. install 후 `package.json`·`pnpm-workspace.yaml` 변경 없음(빌드 스크립트 허용 대상은 기존 `esbuild`·`unrs-resolver` 그대로).

### 남은 후속 (미진행)

- `pnpm install` 시 nuxt CLI 의 전이 의존성 `@bomb.sh/tab` 이 `cac@^6` 을 peer 로 요구하나 `cac@7` 이 설치되어 peer 경고가 1건 남는다. 업스트림 사안이며 lint·typecheck·build 에는 영향이 없다.
- Windows PowerShell 5.1 에서 `scaffold.ps1` 이 `bootstrap.ps1` 파싱 오류(BOM 없는 UTF-8 파일의 한글 해석 문제로 추정)로 중단된다. 별도 수정이 필요하다.

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
