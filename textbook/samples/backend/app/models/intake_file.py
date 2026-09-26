# 作成：Phase-2-1
# 写経レベル: 定型 ── 既存モデル群と同型のORMモデル定義。
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class IntakeFile(Base):
    """初期ヒアリング入力時にアップロードされた添付ファイル(txt/md/pdf)のテキスト化結果を表すORMモデル。

    file_type: 'txt' / 'md' / 'pdf'。
    status: 'processed'(テキスト化成功) / 'failed'(失敗)。
    保存方針: 元ファイルの実体(バイナリ)は保持しない。テキスト化後は破棄し、extracted_textのみ永続化
    する(オブジェクトストレージ非依存)。extracted_textは最大20,000文字で切り詰める。
    """

    __tablename__ = "intake_files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processed")
    error_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="intake_files")
