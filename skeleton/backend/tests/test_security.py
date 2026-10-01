"""보안 설정·헤더 테스트 (ARCHITECTURE.md §9, §12)."""
import pytest

from app.config import Settings
from app.core.security import hash_password, validate_password_policy, verify_password

# ---------- Settings 검증 ----------


def test_settings_rejects_default_secret_key():
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(secret_key="change-me-in-production", _env_file=None)


def test_settings_rejects_short_secret_key():
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(secret_key="short-key", _env_file=None)


def test_settings_accepts_random_secret_key():
    s = Settings(secret_key="a" * 48, _env_file=None)
    assert s.access_token_expire_minutes == 15
    assert s.refresh_token_expire_days == 14
    assert s.cookie_secure is False


# ---------- 비밀번호 정책 ----------


def test_password_policy_rejects_short():
    with pytest.raises(ValueError):
        validate_password_policy("1234567")


def test_password_policy_rejects_over_72_bytes():
    with pytest.raises(ValueError):
        validate_password_policy("한" * 25)  # 75바이트


def test_hash_password_rejects_over_72_bytes():
    with pytest.raises(ValueError):
        hash_password("a" * 73)


def test_verify_password_over_72_bytes_returns_false():
    # bcrypt 5 의 checkpw 는 72바이트 초과에 ValueError — verify_password 는 예외 없이 False.
    hashed = hash_password("a" * 72)
    assert verify_password("a" * 72, hashed) is True
    assert verify_password("a" * 73, hashed) is False


def test_password_policy_accepts_plain_long_password():
    # NIST 800-63B: 조합 규칙 없이 길이만 본다.
    validate_password_policy("justlowercaseletters")


# ---------- 보안 응답 헤더 ----------


def test_security_headers_present(client):
    res = client.get("/api/v1/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert res.headers["Cross-Origin-Opener-Policy"] == "same-origin"


def test_no_hsts_when_cookie_secure_false(client):
    # 기본값 COOKIE_SECURE=false 에서는 HSTS 를 내려보내지 않는다.
    res = client.get("/api/v1/health")
    assert "Strict-Transport-Security" not in res.headers


def test_auth_responses_are_no_store(client):
    res = client.post("/api/v1/auth/logout")
    assert res.headers["Cache-Control"] == "no-store"
    res = client.get("/api/v1/health")
    assert res.headers.get("Cache-Control") != "no-store"
