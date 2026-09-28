# 作成：Phase-2-1｜更新：Phase-6-6
# Phase-6-6:追記 ── sqlalchemy.Boolean, sqlalchemy.false
# 写経レベル: 定型 ── 既存モデル群と同型のORMモデル定義(バージョニングロジック自体はrepositories/generated_document.pyのコア箇所を参照)。
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class GeneratedDocument(Base):
    """生成された設計書1バージョン分を表すORMモデル。

    doc_type: 'requirements' / 'external_design' / 'internal_design' / 'implementation_plan'。
    バージョニング方針: 再生成時は上書きせず新バージョンを追加する。同一project_id+doc_typeにつき
    直近3バージョンまで保管し、4件目の生成時に最も古いバージョンを削除する(app/repositories/
    generated_document.py の create_version が担う)。

    Phase-6-6:追記 ── is_current: 同一project_id+doc_typeの保管版のうち「現在表示中」の1件だけがTrue。
    新規生成(create_version)では新しい版がcurrentになり、バージョン履歴からの「復元」は
    新しい行を作らずcurrentの付け替えのみを行う(app/repositories/generated_document.py の set_current)。
    """

    __tablename__ = "generated_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Phase-6-6:追記
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="generated_documents")
