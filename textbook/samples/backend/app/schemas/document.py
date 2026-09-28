# 作成：Phase-2-4｜更新：Phase-6-6
# 写経レベル: 定型 ── 既存schemas群と同型のPydanticスキーマ。
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

DocType = Literal["requirements", "external_design", "internal_design", "implementation_plan"]


class GeneratedDocumentRead(BaseModel):
    """生成された設計書1件をAPIレスポンスとして返す際のスキーマ(一覧では現在表示中のバージョン)。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doc_type: DocType
    content: str
    version: int
    created_at: datetime
    # Phase-6-6:追記 ── 現在表示中のバージョンかどうか(バージョン履歴の「表示中」バッジ用)
    is_current: bool
