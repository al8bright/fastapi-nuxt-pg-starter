"""인증 라우터 (architecture.md §4, §9) — 얇은 HTTP 계층.

자체 계정 username/password 로그인 → access JWT(응답 본문) + refresh 토큰(httpOnly 쿠키).
refresh 토큰은 DB 세션(services/session_service.py)으로 관리하며 매 회전마다 교체된다.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.rate_limit import login_limiter
from app.core.security import create_token
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserRead
from app.services import session_service, user_service
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"  # refresh/logout 에만 전송되도록 경로를 좁힌다


def _client_ip(request: Request) -> str:
    """클라이언트 IP — 리버스 프록시 뒤에서는 X-Forwarded-For 첫 값을 우선한다."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _set_refresh_cookie(response: Response, raw_token: str, settings: Settings) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        raw_token,
        max_age=settings.refresh_token_expire_days * 86400,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


def _delete_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


def _unauthorized_clearing_cookie(settings: Settings, detail: str) -> JSONResponse:
    """401 응답 + refresh 쿠키 삭제 (raise 하면 쿠키 삭제 헤더가 실리지 않으므로 직접 만든다)."""
    response = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": detail},
        headers={"WWW-Authenticate": "Bearer"},
    )
    _delete_refresh_cookie(response, settings)
    return response


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    key = (body.username, _client_ip(request))
    retry = login_limiter.retry_after(key)
    if retry is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
            headers={"Retry-After": str(retry)},
        )
    try:
        user = user_service.authenticate(db, body.username, body.password)
    except ServiceError as e:
        login_limiter.record_failure(key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    login_limiter.clear(key)
    refresh_raw = session_service.issue(db, user)
    _set_refresh_cookie(response, refresh_raw, settings)
    token = create_token(
        subject=str(user.id),
        secret=settings.secret_key,
        expires_minutes=settings.access_token_expire_minutes,
    )
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw is None:
        return _unauthorized_clearing_cookie(settings, "인증이 필요합니다.")
    try:
        user, new_raw = session_service.rotate(db, raw)
    except ServiceError as e:
        return _unauthorized_clearing_cookie(settings, e.message)
    token = create_token(
        subject=str(user.id),
        secret=settings.secret_key,
        expires_minutes=settings.access_token_expire_minutes,
    )
    response = JSONResponse(
        content=TokenResponse(access_token=token).model_dump(),
    )
    _set_refresh_cookie(response, new_raw, settings)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    """세션 revoke + 쿠키 삭제. 인증 없이도 호출 가능 (멱등)."""
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw is not None:
        session_service.revoke(db, raw)
    _delete_refresh_cookie(response, settings)


@router.get("/me", response_model=UserRead)
def me(current: User = Depends(get_current_user)) -> User:
    return current
