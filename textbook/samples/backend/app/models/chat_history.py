# 作成：Phase-2-1｜更新：Phase-35-1,35(完了後の調整)
# 写経レベル: 定型 ── 既存Conversation/Messageと同型のORMモデル定義。
import uuid
# Phase-35(完了後の調整):追記 ── datetime.UTC
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Phase-35-1:追記 ── app.core.database.PortableJSON
from app.core.database import Base, PortableJSON

if TYPE_CHECKING:
    from app.models.project import Project


class ChatHistory(Base):
    """プロジェクトのヒアリングチャットにおける1件の発言を表すORMモデル。

    sender: 'user'(利用者) / 'ai'(AI応答) / 'intake'(初期ヒアリング入力・添付ファイル抽出結果の記録)
    / 'others'(生成ドキュメントの自己診断結果の記録)。
    """

    __tablename__ = "chat_histories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    sender: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Phase-35-1:追記
    # 選択肢カード(AIの発言だけが持つ。app/hearing/cards.pyのcard_to_dictの形のリスト。
    # 選ばれた選択肢もここに書き込む)
    cards: Mapped[list | None] = mapped_column(PortableJSON, nullable=True)
    # Phase-35(完了後の調整)：更新(同じトランザクションの2行が同じ時刻になり、会話の順が入れ替わったため)
    # created_at: Mapped[datetime] = mapped_column(
    #     DateTime(timezone=True), server_default=func.now(), nullable=False
    # )
    # ↓↓
    # 送信日時。1回の送信で利用者の発言とAIの返信を同じトランザクションで保存するため、DBの
    # now()(トランザクションの開始時刻)では2行が同じ時刻になり、発生順に並ばない。行ごとに
    # アプリ側で時刻を入れる(server_defaultは、アプリを通らない挿入のために残す)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

    project: Mapped["Project"] = relationship(back_populates="chat_histories")
