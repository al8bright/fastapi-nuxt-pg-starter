"""로그인 브루트포스 방어 — 슬라이딩 윈도우 실패 카운터 (architecture.md §9).

(username, client_ip) 키별로 최근 실패 시각을 기록하고, 윈도우 안에서 실패가
max_failures 에 도달하면 차단한다. 시각은 core.security.now()(KST naive)를 쓴다.

⚠️ 프로세스 내 메모리 방식이다. uvicorn 다중 워커나 다중 인스턴스 배포에서는
워커마다 카운터가 따로 돌아 방어가 약해지므로, 그런 환경에서는 Redis 등
공유 저장소 기반 구현으로 교체해야 한다.
"""
import math
import threading
from datetime import datetime, timedelta

from app.core.security import now

Key = tuple[str, str]  # (username, client_ip)


class LoginRateLimiter:
    def __init__(self, max_failures: int = 5, window_minutes: int = 5) -> None:
        self.max_failures = max_failures
        self.window_minutes = window_minutes
        self._failures: dict[Key, list[datetime]] = {}
        self._lock = threading.Lock()

    @property
    def _window(self) -> timedelta:
        return timedelta(minutes=self.window_minutes)

    def _prune(self, key: Key) -> list[datetime]:
        """윈도우를 벗어난 실패 기록을 버리고 남은 목록을 반환한다 (락 안에서 호출)."""
        cutoff = now() - self._window
        kept = [t for t in self._failures.get(key, []) if t > cutoff]
        if kept:
            self._failures[key] = kept
        else:
            self._failures.pop(key, None)
        return kept

    def retry_after(self, key: Key) -> int | None:
        """차단 중이면 재시도까지 남은 초, 아니면 None."""
        with self._lock:
            failures = self._prune(key)
            if len(failures) < self.max_failures:
                return None
            remaining = (failures[0] + self._window - now()).total_seconds()
            return max(1, math.ceil(remaining))

    def record_failure(self, key: Key) -> None:
        with self._lock:
            failures = self._prune(key)
            self._failures[key] = [*failures, now()]

    def clear(self, key: Key) -> None:
        """로그인 성공 시 해당 키의 실패 카운터를 초기화한다."""
        with self._lock:
            self._failures.pop(key, None)

    def reset(self) -> None:
        """전체 초기화 (테스트용)."""
        with self._lock:
            self._failures.clear()


# 모듈 싱글턴 — 라우터에서 공유한다.
login_limiter = LoginRateLimiter()
