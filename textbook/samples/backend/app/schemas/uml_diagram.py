# 作成：Phase-8-4｜更新：Phase-9-5,10-6
# 写経レベル: コア ── semantic_modelを型付きdiscriminated unionのまま公開するという設計判断そのもの。
# Phase-9-5:追記 ── app.uml.layout.model.LayoutModel
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.uml.domain import NotationType, SemanticModel
from app.uml.layout.model import LayoutModel


class UmlDiagramRead(BaseModel):
    """UML図1件をAPIレスポンスとして返す際のスキーマ。`semantic_model`/`layout_model`は
    生dictではなくapp.uml.domain/app.uml.layoutの型付きモデルをそのまま使う(既存の
    project.intake等の「生dict」パターンとは異なる新規パターン。Pydanticネイティブに
    構造を検証できるため)。`layout_model`は`POST .../layout`実行前、
    またはAIで再生成した直後はNone。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    view: str
    notation: NotationType
    # Phase-10-6:追記
    # subject: 同じ記法の中で図を識別するキー(component: ''、ER: ''またはグループ名、DFD: 処理名)
    subject: str
    # scope: AIに渡した対象の選択(ER部分図の{"tables": [...]})
    scope: dict | None
    semantic_model: SemanticModel
    # Phase-9-5:追記
    layout_model: LayoutModel | None
    status: str
    version: int
    # Phase-10-6:追記
    # generation_status: 'generating'/'completed'/'failed'(FEはgeneratingの間ポーリングする)
    generation_status: str
    generation_error: str | None
    source_doc_versions: dict | None
    created_at: datetime
    updated_at: datetime


# Phase-10-6：削除(生成リクエストはapp/schemas/uml_generation.pyのUmlGenerateRequestへ)
# class UmlDiagramCreate(BaseModel):
#     """UML図の生成トリガーリクエストのスキーマ。Phase 8時点ではnotationのみを受け取り、
#     要素・関係が空のdraftを作成する(実AI生成はPhase 10で追加)。"""
#
#     notation: NotationType


class UmlDiagramUpdate(BaseModel):
    """UML図の全体更新リクエストのスキーマ。`version`は楽観ロック用
    (更新対象を最後に取得した時点のUmlDiagramRead.versionをそのまま返す想定)。"""

    version: int
    semantic_model: SemanticModel
