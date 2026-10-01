"""테스트 공통 픽스처 (ARCHITECTURE.md §12).

DB 는 SQLite in-memory 를 쓰고, get_db 의존성을 오버라이드한다.
create_all 은 테스트에서만 허용된다 (§11 예외).

Settings 검증(SECRET_KEY 32자 이상)과 관리자 시드가 동작하도록,
app 을 import 하기 전에 환경변수를 주입한다.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef0123456789abcdef")
os.environ.setdefault("INITIAL_ADMIN_PASSWORD", "admin-test-pw")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: F401, E402
from app.config import get_settings  # noqa: E402
from app.core.rate_limit import login_limiter  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_login_limiter():
    login_limiter.reset()
    yield
    login_limiter.reset()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
