"""애플리케이션 설정 (ARCHITECTURE.md §5).

설정은 OS 무관하게 .env 로 주입한다. 접근은 항상 get_settings() 로 한다.
"""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SECRET_KEY_PLACEHOLDER = "change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # DB
    database_url: str | None = None

    # JWT / 세션
    secret_key: str = _SECRET_KEY_PLACEHOLDER
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    # 쿠키 (운영 HTTPS 환경에서는 true 로 — refresh 쿠키의 Secure 속성과 HSTS 를 켠다)
    cookie_secure: bool = False

    # 초기 관리자 시드 (password 미설정 시 시드를 건너뛴다)
    initial_admin_username: str = "admin"
    initial_admin_password: str | None = None

    # 로그인 브루트포스 방어 (core/rate_limit.py)
    login_max_failures: int = 5
    login_window_minutes: int = 5

    # CORS
    cors_origins: str = "http://localhost:5173"

    # URL
    frontend_url: str = "http://localhost:5173"
    backend_public_url: str = "http://localhost:8000"

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        # 기본값 그대로거나 너무 짧은 키로는 기동을 허용하지 않는다.
        # 스캐폴드가 .env 에 48자 hex 를 자동 생성하므로 정상 경로에서는 항상 통과한다.
        if self.secret_key == _SECRET_KEY_PLACEHOLDER or len(self.secret_key) < 32:
            raise ValueError(
                "SECRET_KEY 는 기본값이 아닌 32자 이상의 랜덤 문자열이어야 합니다. "
                "backend/.env 의 SECRET_KEY 를 확인하세요 (스캐폴드가 자동 생성)."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
