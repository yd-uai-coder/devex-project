# 作成：Phase-52-1｜更新：Phase-53-1,53(完了後の調整)
"""設計レビュー(生成とは別のモデルが指摘だけを返す)の入力・出力・判定(純粋関数)。

docs/internal_design.md 3.3節「8. AI 設計レビュー + テスト設計」。
"""

# Phase-53-1:追記 ── app.review.gates(DETAILED_DESIGN_DOC, DETAILED_PLAN_DOC, DOCUMENTS_GATE, GATE_LABEL, GATE_STAGES, GateStatus, ReviewGate, gate_status, gates_for_mode, stage_known_issues, stage_targets), app.review.render.render_notice
# Phase-53(完了後の調整):追記 ── app.review.schemas(REVIEW_DOCUMENTS, only_reviewed_documents)
from app.review.gates import (
    DETAILED_DESIGN_DOC,
    DETAILED_PLAN_DOC,
    DOCUMENTS_GATE,
    GATE_LABEL,
    GATE_STAGES,
    GateStatus,
    ReviewGate,
    gate_status,
    gates_for_mode,
    stage_known_issues,
    stage_targets,
)
from app.review.known_issues import known_issues
from app.review.policy import review_effective
from app.review.prompt import (
    REVIEW_SYSTEM_PROMPT,
    build_points_table,
    build_review_messages,
    format_known_issues,
)
from app.review.render import render_findings, render_notice, sort_findings
from app.review.schemas import (
    CAUSE_LABEL,
    LEVEL_LABEL,
    REVIEW_DOCUMENTS,
    REVIEW_LEVELS,
    ReviewCause,
    ReviewFindingOut,
    ReviewLevel,
    ReviewOutput,
    only_reviewed_documents,
)

__all__ = [
    "CAUSE_LABEL",
    # Phase-53-1:追記
    "DETAILED_DESIGN_DOC",
    "DETAILED_PLAN_DOC",
    "DOCUMENTS_GATE",
    "GATE_LABEL",
    "GATE_STAGES",
    "GateStatus",
    "ReviewGate",
    "LEVEL_LABEL",
    # Phase-53(完了後の調整):追記
    "REVIEW_DOCUMENTS",
    "REVIEW_LEVELS",
    "REVIEW_SYSTEM_PROMPT",
    "ReviewCause",
    "ReviewFindingOut",
    "ReviewLevel",
    "ReviewOutput",
    "build_points_table",
    "build_review_messages",
    "format_known_issues",
    # Phase-53-1:追記
    "gate_status",
    "gates_for_mode",
    "known_issues",
    # Phase-53(完了後の調整):追記
    "only_reviewed_documents",
    "render_findings",
    # Phase-53-1:追記
    "render_notice",
    "review_effective",
    "sort_findings",
    # Phase-53-1:追記
    "stage_known_issues",
    "stage_targets",
]
