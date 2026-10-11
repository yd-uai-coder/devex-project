# 作成：Phase-2-1｜更新：Phase-6-6,15-3,36-1,37-1
# Phase-6-6:追記 ── sqlalchemy.Boolean, sqlalchemy.false
# Phase-15-3:追記 ── sqlalchemy.UniqueConstraint
# 写経レベル: 定型 ── 既存モデル群と同型のORMモデル定義(バージョニングロジック自体はrepositories/generated_document.pyのコア箇所を参照)。
# Phase-36-1:追記 ── app.core.database.PortableJSON
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, PortableJSON

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
    # Phase-15-3:追記
    # 版の番号は(プロジェクト, 種別)の中で一意。生成の二重実行は409と画面のボタンの無効化で
    # 塞ぐが、それをすり抜けた並行実行もDBで止める(Phase 15、気づき#4)
    __table_args__ = (
        UniqueConstraint(
            "project_id", "doc_type", "version", name="uq_generated_documents_project_type_version"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Phase-36-1:追記
    # Phase-37-1：更新
    # # 意味モデル(要件定義書だけ。app/documents/requirements/model.pyのRequirementsModelの形)。
    # ↓↓
    # 意味モデル(要件定義書・外部設計書。app/documents/requirements/model.pyのRequirementsModel、
    # app/documents/external_design/model.pyのExternalDesignModelの形)。
    # contentはこれから組み立てたmd。modelを持たない文書・以前の版はNULL(mdのまま使う)
    model: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Phase-6-6:追記
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="generated_documents")
