# 更新：Phase-52-3,66-1,74-1,79(完了後の調整)
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 52 で初めて samples に載せた
# (全文。タグの無い部分はテンプレートのまま)。
# Phase-52-3:追記 ── sqlalchemy.false
# Phase-79(完了後の調整)：削除 ── typing.TYPE_CHECKING, sqlalchemy.orm.relationship
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
# Phase-79(完了後の調整)：削除
#
# if TYPE_CHECKING:
#     from app.models.conversation import Conversation


class User(Base):
    """アプリケーションの利用者を表すORMモデル。"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Phase-74-1：更新
    # hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # ↓↓
    # Google だけで登録した利用者は null(パスワードでのログインはできない)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 連携した Google アカウントの識別子(ID トークンの sub)。連携していなければ null
    google_sub: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    # Phase-66-1：更新
    # full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # ↓↓
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Phase-52-3:追記
    # 設計レビューの設定(本人が切り替える。初期値はオフ)。使えるのは superuser だけで、実効値は
    # app/review/policy.py の review_effective がサーバーで判定する
    review_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Phase-79(完了後の調整)：削除
    #
    # # cascade="all, delete-orphan": ユーザー削除時に関連する会話も併せて削除する
    # conversations: Mapped[list["Conversation"]] = relationship(
    #     back_populates="user", cascade="all, delete-orphan"
    # )
