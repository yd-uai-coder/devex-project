# 作成：Phase-42-3｜更新：Phase-42-4
"""変更影響分析(ステージ7)の純粋関数。

- elements: 設計の要素と参照の導出(文書の model と段階1〜8 の model から)
- trace: 変更の影響のたどり方(処理を軸)と理由・再生成の候補
"""

# Phase-42-4:追記 ── app.detailed_design.impact.trace(EDGE_REASON, REGENERATION_STAGES, USER_REASON, Change, ChangeKind, ImpactItem, impact_of, regeneration_targets)
from app.detailed_design.impact.elements import (
    DOCUMENT_STAGE,
    DesignModels,
    EdgeKind,
    Element,
    ElementKind,
    Ref,
    build_elements,
    parse_db_tables,
)
from app.detailed_design.impact.trace import (
    EDGE_REASON,
    REGENERATION_STAGES,
    USER_REASON,
    Change,
    ChangeKind,
    ImpactItem,
    impact_of,
    regeneration_targets,
)

__all__ = [
    "DOCUMENT_STAGE",
    # Phase-42-4:追記
    "EDGE_REASON",
    "REGENERATION_STAGES",
    "USER_REASON",
    "Change",
    "ChangeKind",
    "ImpactItem",
    "DesignModels",
    "EdgeKind",
    "Element",
    "ElementKind",
    "Ref",
    "build_elements",
    # Phase-42-4:追記
    "impact_of",
    "parse_db_tables",
    # Phase-42-4:追記
    "regeneration_targets",
]
