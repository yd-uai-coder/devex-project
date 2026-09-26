# 更新：Phase-2-1
# Phase-2-1:追記 ── sqlalchemy.JSON, sqlalchemy.dialects.postgresql.JSONB
from collections.abc import AsyncGenerator

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """全SQLAlchemy ORMモデルの共通基底クラス。"""


# Phase-2-1:追記
# JSONB列の型: Postgresでは JSONB として、それ以外(単体テストのSQLite等)では汎用 JSON として扱う。
# PostgresのJSONB型はSQLiteでは表現できないため、モデル側はこのバリアント型を共通で使う。
PortableJSON = JSON().with_variant(JSONB(), "postgresql")


engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """リクエスト単位の非同期DBセッションを生成するFastAPI依存関数。"""
    async with AsyncSessionLocal() as session:
        yield session
