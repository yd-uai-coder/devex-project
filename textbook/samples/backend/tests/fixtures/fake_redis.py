# 更新：Phase-53(完了後の調整),59-3,66-2
# 注: この Phase で初めて samples に載せた(delete を足した)。delete より前は以前の Phase の作成物。
"""レート制限テスト用の最小 FakeRedis。RateLimiter が使う incr / expire / pipeline / get / set
と、リフレッシュトークンの失効(AuthService)が使う exists / scan_iter / delete を実装する
(既存 tests/unit/test_auth_service.py の FakeRedis(set/exists/delete)とは別物)。
"""

from __future__ import annotations

# Phase-66-2:追記 ── collections.abc.AsyncIterator, fnmatch.fnmatchcase
from collections.abc import AsyncIterator
from fnmatch import fnmatchcase


class _FakePipeline:
    """`redis.asyncio` の Pipeline の代替。コマンドは積むだけで、execute で順に実行する。"""

    def __init__(self, redis: FakeRedis) -> None:
        self._redis = redis
        self._queue: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    async def __aenter__(self) -> _FakePipeline:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        return None

    def incr(self, key: str) -> _FakePipeline:
        self._queue.append(("incr", (key,), {}))
        return self

    def expire(self, key: str, seconds: int, nx: bool = False) -> _FakePipeline:
        self._queue.append(("expire", (key, seconds), {"nx": nx}))
        return self

    async def execute(self) -> list[object]:
        results: list[object] = []
        for name, args, kwargs in self._queue:
            results.append(await getattr(self._redis, name)(*args, **kwargs))
        self._queue.clear()
        return results


class FakeRedis:
    """redis.asyncio.Redis の incr / expire / pipeline / get / set / delete / exists / scan_iter
    だけを模したインメモリ実装。"""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._values: dict[str, str] = {}

    async def incr(self, key: str) -> int:
        """key のカウンタを 1 増やして増加後の値を返す。"""
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]

    async def expire(
        self,
        key: str,  # noqa: ARG002
        seconds: int,  # noqa: ARG002
        nx: bool = False,  # noqa: ARG002
    ) -> bool:
        """TTL 設定。テストでは寿命を管理しないので何もしない。"""
        return True

    def pipeline(self, transaction: bool = True) -> _FakePipeline:  # noqa: ARG002
        """MULTI/EXEC の代わり。積んだ incr / expire を execute でまとめて実行する。"""
        return _FakePipeline(self)

    async def get(self, key: str) -> str | None:
        """key の値を返す(無ければ None)。"""
        return self._values.get(key)

    # Phase-59-3：更新
    # async def set(self, key: str, value: str, *, ex: int | None = None) -> bool:  # noqa: ARG002
    #     """key に値を設定する。`ex`(TTL秒)はテストでは失効させないので記録しない。"""
    # ↓↓
    async def set(
        self,
        key: str,
        value: str,
        *,
        ex: int | None = None,  # noqa: ARG002
        nx: bool = False,
    ) -> bool | None:
        """key に値を設定する。`ex`(TTL秒)はテストでは失効させないので記録しない。
        `nx`なら key が無いときだけ設定し、あれば None を返す(redis-py と同じ)。"""
        if nx and key in self._values:
            return None
        self._values[key] = value
        return True

    # Phase-53(完了後の調整):追記
    # Phase-66-2：更新
    # async def delete(self, key: str) -> int:
    #     """key を消す。消した数を返す。"""
    #     return 1 if self._values.pop(key, None) is not None else 0
    # ↓↓
    async def delete(self, *keys: str) -> int:
        """keys を消す。消した数を返す。"""
        return sum(1 for key in keys if self._values.pop(key, None) is not None)

    # Phase-66-2:追記
    async def exists(self, key: str) -> int:
        """key があれば 1、無ければ 0。"""
        return int(key in self._values)

    async def scan_iter(self, match: str = "*") -> AsyncIterator[str]:
        """glob の match に合う key を順に返す(SCAN の代わり。値を持つ key だけを見る)。"""
        for key in list(self._values):
            if fnmatchcase(key, match):
                yield key
