"""refresh 세션 서비스 (architecture.md §8, §9) — 비즈니스 로직.

httpOnly 쿠키로 전달되는 refresh 토큰의 발급·회전·폐기를 담당한다.
- DB 에는 토큰 원문이 아니라 sha256 해시만 저장한다.
- 회전(rotate)은 매번 새 토큰을 발급하고 이전 세션을 revoke 한다 (sliding expiry).
- revoke 된 세션의 재사용은 토큰 탈취 신호로 보고 해당 사용자의 모든 세션을 폐기한다.
"""
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import generate_refresh_token, hash_refresh_token, now
from app.models.session import UserSession
from app.models.user import User
from app.services.exceptions import ServiceError


def _get_by_raw_token(db: Session, raw_token: str) -> UserSession | None:
    token_hash = hash_refresh_token(raw_token)
    return db.execute(
        select(UserSession).where(UserSession.refresh_token_hash == token_hash)
    ).scalar_one_or_none()


def _new_session(db: Session, user_id: int) -> str:
    """새 세션 레코드를 만들고 토큰 원문을 반환한다 (commit 은 호출부 책임)."""
    settings = get_settings()
    raw = generate_refresh_token()
    db.add(
        UserSession(
            user_id=user_id,
            refresh_token_hash=hash_refresh_token(raw),
            expires_at=now() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    return raw


def issue(db: Session, user: User) -> str:
    """로그인 성공 시 세션을 생성하고 refresh 토큰 원문을 반환한다."""
    raw = _new_session(db, user.id)
    db.commit()
    return raw


def rotate(db: Session, raw_token: str) -> tuple[User, str]:
    """refresh 토큰을 검증하고 회전한다. 성공 시 (user, 새 토큰 원문).

    실패는 모두 ServiceError:
    - invalid_refresh: 알 수 없는 토큰, 사용자 없음/비활성
    - refresh_reused:  revoke 된 토큰 재사용 → 해당 사용자의 모든 세션 폐기
    - expired_refresh: 만료된 세션
    """
    session = _get_by_raw_token(db, raw_token)
    if session is None:
        raise ServiceError("invalid_refresh", "유효하지 않은 세션입니다.")
    if session.revoked_at is not None:
        # 재사용 감지 — 탈취 가능성이 있으므로 이 사용자의 세션을 전부 폐기한다.
        revoke_all(db, session.user_id)
        raise ServiceError("refresh_reused", "세션이 재사용되어 모든 세션을 종료했습니다.")
    if session.expires_at < now():
        raise ServiceError("expired_refresh", "세션이 만료되었습니다. 다시 로그인하세요.")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise ServiceError("invalid_refresh", "유효하지 않은 세션입니다.")
    t = now()
    session.revoked_at = t
    session.last_used_at = t
    new_raw = _new_session(db, user.id)  # 만료 재설정 (sliding)
    db.commit()
    return user, new_raw


def revoke(db: Session, raw_token: str) -> None:
    """로그아웃 — 세션이 있으면 revoke, 없으면 조용히 무시한다."""
    session = _get_by_raw_token(db, raw_token)
    if session is None:
        return
    if session.revoked_at is None:
        session.revoked_at = now()
        db.commit()


def revoke_all(db: Session, user_id: int) -> None:
    """해당 사용자의 살아있는 세션을 전부 revoke 한다."""
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now())
    )
    db.commit()
