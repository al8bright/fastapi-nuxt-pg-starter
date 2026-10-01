"""인증 유저플로우 테스트 (ARCHITECTURE.md §12).

로그인(access JWT + httpOnly refresh 쿠키), 회전, 재사용 감지, 로그아웃,
브루트포스 방어, 관리자 시드, 비밀번호 정책을 검증한다.
"""
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.core.security import now
from app.models.session import UserSession
from app.services import user_service
from app.services.exceptions import ServiceError

ADMIN_PW = "admin-test-pw"  # conftest 가 INITIAL_ADMIN_PASSWORD 로 주입한 값
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"


def _seed_admin(db_session):
    user_service.ensure_admin(db_session, get_settings())


def _login(client):
    return client.post(LOGIN, json={"username": "admin", "password": ADMIN_PW})


def _refresh_with(client, raw_token):
    """클라이언트 쿠키 저장소를 우회해 특정 refresh 토큰으로 /refresh 를 호출한다."""
    client.cookies.clear()
    return client.post(REFRESH, headers={"Cookie": f"refresh_token={raw_token}"})


# ---------- 관리자 시드 ----------


def test_ensure_admin_seeds_admin_idempotently(db_session):
    _seed_admin(db_session)
    admin = user_service.get_by_username(db_session, "admin")
    assert admin is not None
    assert admin.role == "admin"
    # 멱등성: 두 번 호출해도 중복 생성하지 않는다.
    _seed_admin(db_session)
    assert user_service.get_by_username(db_session, "admin") is not None


def test_ensure_admin_skips_without_password(db_session):
    from app.config import Settings

    settings = Settings(
        secret_key="x" * 32, initial_admin_password=None, _env_file=None
    )
    user_service.ensure_admin(db_session, settings)
    assert user_service.get_by_username(db_session, "admin") is None


def test_ensure_admin_uses_configured_password(db_session):
    from app.config import Settings

    settings = Settings(
        secret_key="x" * 32, initial_admin_password="s3cret-pw-12", _env_file=None
    )
    user_service.ensure_admin(db_session, settings)
    user = user_service.authenticate(db_session, "admin", "s3cret-pw-12")
    assert user.role == "admin"


# ---------- 비밀번호 정책 ----------


def test_create_user_rejects_short_password(db_session):
    with pytest.raises(ServiceError) as exc:
        user_service.create_user(db_session, username="u1", password="short")
    assert exc.value.code == "weak_password"


def test_create_user_rejects_over_72_bytes_password(db_session):
    # bcrypt 5 는 72바이트 초과 입력에 ValueError 를 던진다 → 정책 검증에서 먼저 막아 500 을 피한다.
    with pytest.raises(ServiceError) as exc:
        user_service.create_user(db_session, username="u1", password="a" * 73)
    assert exc.value.code == "weak_password"


# ---------- 로그인 ----------


def test_login_success_returns_access_token_and_refresh_cookie(client, db_session):
    _seed_admin(db_session)
    res = _login(client)
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    # refresh 토큰은 httpOnly 쿠키로만 내려간다.
    set_cookie = res.headers.get("set-cookie", "").lower()
    assert "refresh_token=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api/v1/auth" in set_cookie
    assert res.cookies.get("refresh_token")


def test_login_wrong_password_401(client, db_session):
    _seed_admin(db_session)
    res = client.post(LOGIN, json={"username": "admin", "password": "nope-nope"})
    assert res.status_code == 401


def test_login_over_72_bytes_password_is_clean_4xx(client, db_session):
    # bcrypt 5 의 72바이트 초과 ValueError 가 500 으로 새지 않아야 한다(스키마 검증 422).
    _seed_admin(db_session)
    res = client.post(LOGIN, json={"username": "admin", "password": "a" * 73})
    assert res.status_code == 422


# ---------- refresh 회전 ----------


def test_refresh_rotates_token(client, db_session):
    _seed_admin(db_session)
    old_access = _login(client).json()["access_token"]
    old_refresh = client.cookies.get("refresh_token")

    res = client.post(REFRESH)  # TestClient 가 쿠키를 자동 전송
    assert res.status_code == 200
    assert res.json()["access_token"]
    new_refresh = res.cookies.get("refresh_token")
    assert new_refresh and new_refresh != old_refresh
    assert old_access  # access 는 응답 본문으로만 전달된다


def test_refresh_reuse_detected_revokes_all_sessions(client, db_session):
    _seed_admin(db_session)
    _login(client)
    old_refresh = client.cookies.get("refresh_token")

    res = client.post(REFRESH)
    assert res.status_code == 200
    new_refresh = res.cookies.get("refresh_token")

    # 이전(회전된) 토큰 재사용 → 401 + 재사용 감지로 전체 세션 revoke
    assert _refresh_with(client, old_refresh).status_code == 401
    sessions = db_session.execute(select(UserSession)).scalars().all()
    assert sessions and all(s.revoked_at is not None for s in sessions)
    # 새 토큰도 이미 revoke 되어 쓸 수 없다.
    assert _refresh_with(client, new_refresh).status_code == 401


def test_refresh_expired_401(client, db_session):
    _seed_admin(db_session)
    _login(client)
    raw = client.cookies.get("refresh_token")
    session = db_session.execute(select(UserSession)).scalar_one()
    session.expires_at = now() - timedelta(seconds=1)
    db_session.commit()
    assert _refresh_with(client, raw).status_code == 401


def test_refresh_without_cookie_401(client, db_session):
    client.cookies.clear()
    assert client.post(REFRESH).status_code == 401


# ---------- 로그아웃 ----------


def test_logout_revokes_session_and_clears_cookie(client, db_session):
    _seed_admin(db_session)
    _login(client)
    raw = client.cookies.get("refresh_token")

    res = client.post(LOGOUT)
    assert res.status_code == 204
    # 쿠키 삭제 헤더가 내려간다 (만료 처리).
    assert "refresh_token=" in res.headers.get("set-cookie", "").lower()
    # revoke 된 토큰으로는 더 이상 회전할 수 없다.
    assert _refresh_with(client, raw).status_code == 401


def test_logout_without_cookie_is_noop_204(client, db_session):
    client.cookies.clear()
    assert client.post(LOGOUT).status_code == 204


# ---------- 브루트포스 방어 ----------


def test_login_bruteforce_blocked_with_retry_after(client, db_session):
    _seed_admin(db_session)
    for _ in range(5):
        res = client.post(LOGIN, json={"username": "admin", "password": "wrong-pw"})
        assert res.status_code == 401
    res = client.post(LOGIN, json={"username": "admin", "password": "wrong-pw"})
    assert res.status_code == 429
    assert int(res.headers["Retry-After"]) >= 1
    # 올바른 비밀번호라도 차단 중에는 거부된다.
    assert _login(client).status_code == 429


def test_login_success_clears_failure_counter(client, db_session):
    _seed_admin(db_session)
    for _ in range(4):
        client.post(LOGIN, json={"username": "admin", "password": "wrong-pw"})
    assert _login(client).status_code == 200
    # 카운터가 초기화되어 다음 실패는 다시 401 (429 아님).
    res = client.post(LOGIN, json={"username": "admin", "password": "wrong-pw"})
    assert res.status_code == 401


# ---------- me ----------


def test_me_with_token_returns_current_user(client, db_session):
    _seed_admin(db_session)
    token = _login(client).json()["access_token"]
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert body["is_active"] is True


def test_me_without_token_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401
