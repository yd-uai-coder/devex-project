# 作成：Phase-15-2｜更新：Phase-16-3,18-3,20-3,21-3,27-1,27-2
# 写経レベル: 定型 ── Pydantic スキーマ。
# Phase-16-3:追記 ── typing.Literal, pydantic.Field
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.detailed_design import StageState


# Phase-16-3:追記
# Phase-27-2：更新(docstring: 段階8の指摘だけが持つ欄を書いた)
class StageIssueRead(BaseModel):
    """段階ごとの検証の指摘1件(app/detailed_design/validation.py の StageIssue)。
    `error`があると承認できない。`warning`は承認を止めない。

    段階8(実装可能性チェック)の指摘だけが、重要度`level`(critical=最重要・major=中程度・
    minor=軽微)・直す先の段階`fix_stage`・指摘の出た作業単位の ID`unit`を持つ。"""

    severity: Literal["error", "warning"]
    code: str
    message: str
    target: str | None = None
    # Phase-27-2:追記
    level: Literal["critical", "major", "minor"] | None = None
    fix_stage: int | None = None
    unit: str | None = None


# Phase-18-3:追記
class DfdAccessRead(BaseModel):
    """段階2の DFD の線から決まる、処理とテーブルの関わり1つ(段階3の CRUD 図の固定部分。Phase 18)。
    `table`は ER のテーブル名(ER に無いデータストアは、正規化したデータストア名)。"""

    function_id: str
    table: str
    kind: Literal["read", "write"]


# Phase-27-1：更新(docstring: 段階1〜7 → 段階1〜8)
class DesignStageRead(BaseModel):
    """段階1つ分の状態。未着手の段階も含めて、段階1〜8を常に返す(行が無ければversion等はNone)。

    `missing_inputs`は、まだそろっていない入力(`stage:<n>`=承認されていない前の段階、
    `doc:<doc_type>`=まだ無い文書)。空なら段階は開いていて、保存・承認できる。

    `generation_status`はAIの下書きの生成の状態(None=まだ生成していない/generating/completed/
    failed)、`generation_error`は直近の生成が失敗した理由(ユーザー向けの文言)。`issues`は段階ごとの
    検証の結果(Phase 16)。`dfd_accesses`は段階3だけが持つ、DFD から決まる R/W(Phase 18。画面で
    DFD を読み直して導き直さないよう、導いた結果を渡す)。"""

    stage: int
    state: StageState
    is_open: bool
    missing_inputs: list[str]
    version: int | None
    approved_version: int | None
    model: dict[str, Any] | None
    updated_at: datetime | None
    # Phase-16-3:追記
    generation_status: Literal["generating", "completed", "failed"] | None = None
    generation_error: str | None = None
    issues: list[StageIssueRead] = Field(default_factory=list)
    # Phase-18-3:追記
    dfd_accesses: list[DfdAccessRead] = Field(default_factory=list)


class DesignStageSave(BaseModel):
    """段階の保存リクエスト。`version`は画面が見ていた版(未着手の段階を初めて保存するときはNone)。"""

    version: int | None
    model: dict[str, Any]


class DesignStageApprove(BaseModel):
    """段階の承認リクエスト。`version`は画面が見ていた版(見ていない内容を承認しないため)。"""

    version: int


# Phase-21-3:追記
class LogicTarget(BaseModel):
    """段階6で下書きを作る関数1つ(段階4のモジュール一覧のパスと、手順の呼ぶ関数。Phase 21)。"""

    module: str
    function: str


# Phase-20-3:追記
class DesignStageGenerate(BaseModel):
    """段階の下書きの生成リクエスト(本文は省略できる)。`function_ids`は段階5だけが使う、下書きを
    作る処理の処理ID(省略すると、選んだ処理のうちまだ手順の無いもの。Phase 20)。`logics`は段階6
    だけが使う、下書きを作る関数(省略すると、選んだ関数のうちまだ詳細の無いもの。Phase 21)。"""

    function_ids: list[str] | None = None
    # Phase-21-3:追記
    logics: list[LogicTarget] | None = None
