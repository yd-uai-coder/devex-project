# 更新：Phase-4-1
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 1・Phase 2の
# 時点でも存在したが、いずれもsamplesへは反映されていなかった(今回が初のsamples反映)。
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import Base, engine
from app.infrastructure.redis import get_redis_pool
from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    """FastAPI -> PostgreSQL -> Redisの実スタックに疎通するテスト用HTTPクライアントを提供する。

    DATABASE_URL / REDIS_URLが実サービス（例：`docker compose up postgres redis`で
    起動したもの）を指している必要がある。

    このフィクスチャは毎回`Base.metadata.create_all`/`drop_all`でテーブルを作り直すため、
    開発用DBと同じDBに向けて実行すると開発中のデータ・スキーマを消してしまう
    (Phase 4完了後に実際に発生。詳細はdecision-digest.md「Phase 4完了後 ──
    統合テスト用DBの分離」節参照)。必ず`docker-compose.test.yml`で`DATABASE_URL`を
    テスト専用DBへ差し替えて実行すること（`devex-api/CLAUDE.md`「テストの分離」節参照）:

        docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm --no-deps backend \\
          uv run pytest -m integration tests/integration
    """
    async with engine.begin() as conn:
        # テスト用DBに毎回まっさらな状態でテーブルを作り直す
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    async with engine.begin() as conn:
        # テスト終了後にテーブルを破棄し、次のテストに影響を残さないようにする
        await conn.run_sync(Base.metadata.drop_all)

    # Phase-4-1：更新([Phase-1-1.md](../../../Phase-1/Phase-1-1.md)で発見・Phase 2でも
    # 個別実行という回避策のまま持ち越されていた既知課題の根本修正)
    # 従来はここで何も後始末していなかった。engine・get_redis_pool()はいずれも
    # モジュールレベルのシングルトンで、内部のコネクションプールは生成時のイベントループに
    # 紐づく。pytest-asyncioは既定でテスト関数ごとに新しいイベントループを作るため、
    # dispose/disconnectしないままだと次のテストが別のループからこのプールの
    # コネクションを再利用しようとして"Event loop is closed"/"attached to a different loop"に
    # なる(1ファイルに複数の統合テストがあると、2件目以降で必ず発生する)。
    # ↓↓
    await engine.dispose()
    await get_redis_pool().disconnect()
    get_redis_pool.cache_clear()
