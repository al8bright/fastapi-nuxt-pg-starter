"""FastAPI 진입점 (ARCHITECTURE.md §4).

- /api/v1 버전 prefix
- CORS 미들웨어 (메서드/헤더 최소 허용)
- 보안 응답 헤더 미들웨어
- DB 스키마는 Alembic 으로만 관리한다 (§11). 여기서 create_all 을 호출하지 않는다.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  모델 메타데이터 등록
from app.api.v1.router import api_router
from app.config import get_settings
from app.core.rate_limit import login_limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 시작 훅: 초기 관리자 시드. DB 스키마 생성은 Alembic(upgrade head)으로 수행한다.
    # 시드 실패가 서버 기동을 막지는 않되, 조용히 삼키지 않고 경고를 남긴다.
    from app.db.session import SessionLocal
    from app.services import user_service

    s = get_settings()
    login_limiter.max_failures = s.login_max_failures
    login_limiter.window_minutes = s.login_window_minutes
    if s.initial_admin_password is None:
        logger.warning(
            "INITIAL_ADMIN_PASSWORD 미설정 — 초기 관리자 시드를 건너뜁니다. "
            "backend/.env 에 설정하면 다음 기동 시 생성됩니다."
        )
    else:
        try:
            with SessionLocal() as db:
                user_service.ensure_admin(db, s)
        except Exception:  # noqa: BLE001  시드 실패가 서버 기동을 막지 않게 한다.
            logger.warning("초기 관리자 시드 실패 — 서버 기동은 계속합니다.", exc_info=True)
    yield


settings = get_settings()
app = FastAPI(title="__PROJECT_NAME__ API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """모든 응답에 기본 보안 헤더를 붙인다 (ARCHITECTURE.md §9)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if get_settings().cookie_secure:
        # HTTPS 로 서비스할 때만 (COOKIE_SECURE=true) HSTS 를 켠다.
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    if request.url.path.startswith("/api/v1/auth"):
        # 토큰이 오가는 응답은 어떤 캐시에도 남기지 않는다.
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(api_router, prefix="/api/v1")
