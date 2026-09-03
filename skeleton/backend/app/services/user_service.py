"""사용자/인증 서비스 (architecture.md §8) — 비즈니스 로직.

라우터는 얇게 두고, 사용자 조회·인증·시드는 여기서 처리한다.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.core.security import hash_password, validate_password_policy, verify_password
from app.models.user import User, UserRole
from app.services.exceptions import ServiceError


def get_by_username(db: Session, username: str) -> User | None:
    return db.execute(select(User).where(User.username == username)).scalar_one_or_none()


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    role: UserRole = UserRole.USER,
) -> User:
    if get_by_username(db, username) is not None:
        raise ServiceError("user_exists", "이미 존재하는 사용자입니다.")
    try:
        validate_password_policy(password)
    except ValueError as e:
        raise ServiceError("weak_password", str(e)) from e
    user = User(
        username=username,
        hashed_password=hash_password(password),
        role=role.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, username: str, password: str) -> User:
    """성공 시 User, 실패 시 ServiceError("invalid_credentials")."""
    user = get_by_username(db, username)
    if user is None or not verify_password(password, user.hashed_password):
        raise ServiceError("invalid_credentials", "아이디 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise ServiceError("inactive_user", "비활성화된 계정입니다.")
    return user


def ensure_admin(db: Session, settings: Settings) -> None:
    """관리자 계정이 하나도 없으면 settings 의 초기 관리자를 생성한다 (idempotent).

    initial_admin_password 가 None 이면 아무것도 만들지 않는다 (호출부에서 경고 로그).
    스캐폴드가 .env 에 랜덤 비밀번호를 생성해 주며, 운영에서는 로그인 후 변경을 권고한다.
    """
    if settings.initial_admin_password is None:
        return
    has_admin = db.execute(
        select(User.id).where(User.role == UserRole.ADMIN.value).limit(1)
    ).first()
    if has_admin is not None:
        return
    if get_by_username(db, settings.initial_admin_username) is not None:
        return
    create_user(
        db,
        username=settings.initial_admin_username,
        password=settings.initial_admin_password,
        role=UserRole.ADMIN,
    )
