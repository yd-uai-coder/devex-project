# 作成：Phase-52-1｜更新：Phase-53-1,53(完了後の調整),54-1,54-2,54-4,54-5
"""設計レビュー(生成とは別のモデルが指摘だけを返す)の入力・出力・判定(純粋関数)。

docs/internal_design.md 3.3節「8. AI 設計レビュー + テスト設計」。
"""

# Phase-53-1:追記 ── app.review.gates(DETAILED_DESIGN_DOC, DETAILED_PLAN_DOC, DOCUMENTS_GATE, GATE_LABEL, GATE_STAGES, GateStatus, ReviewGate, gate_status, gates_for_mode, stage_known_issues, stage_targets), app.review.render.render_notice
# Phase-53(完了後の調整):追記 ── app.review.schemas(REVIEW_DOCUMENTS, only_reviewed_documents)
# Phase-54-1:追記 ── app.review.fix_check.FixCheckOut, app.review.fix_check.FixVerdict, app.review.fix_check.VERDICT_LABEL, app.review.fix_check.build_fix_check_messages, app.review.fix_check.changed_rows_text, app.review.fix_check.target_rows_text, app.review.followup.FollowupState, app.review.followup.Row, app.review.followup.RowDiff, app.review.followup.document_model_rows, app.review.followup.element_rows, app.review.followup.followup_state, app.review.followup.version_keys, app.review.rehearing.REHEARING_HEAD, app.review.rehearing.can_rehear, app.review.rehearing.rehearing_message, app.review.rehearing.rehearing_points, app.review.sendback.INSTRUCTION_HEAD, app.review.sendback.SendbackFinding, app.review.sendback.build_instruction, app.review.sendback.can_regenerate, app.review.sendback.findings_for
from app.review.fix_check import (
    VERDICT_LABEL,
    FixCheckOut,
    FixVerdict,
    build_fix_check_messages,
    changed_rows_text,
    target_rows_text,
)
from app.review.followup import (
    FollowupState,
    Row,
    RowDiff,
    document_model_rows,
    element_rows,
    followup_state,
    version_keys,
)
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
from app.review.rehearing import (
    REHEARING_HEAD,
    can_rehear,
    rehearing_message,
    rehearing_points,
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
from app.review.sendback import (
    INSTRUCTION_HEAD,
    SendbackFinding,
    build_instruction,
    can_regenerate,
    findings_for,
)

__all__ = [
    "CAUSE_LABEL",
    # Phase-53-1:追記
    "DETAILED_DESIGN_DOC",
    "DETAILED_PLAN_DOC",
    "DOCUMENTS_GATE",
    # Phase-54-1:追記
    "FixCheckOut",
    "FixVerdict",
    "FollowupState",
    "GATE_LABEL",
    "GATE_STAGES",
    "GateStatus",
    # Phase-54-1:追記
    "INSTRUCTION_HEAD",
    "ReviewGate",
    "LEVEL_LABEL",
    # Phase-53(完了後の調整):追記
    # Phase-54-1:追記
    "REHEARING_HEAD",
    "REVIEW_DOCUMENTS",
    "REVIEW_LEVELS",
    "REVIEW_SYSTEM_PROMPT",
    # Phase-54-1:追記
    "VERDICT_LABEL",
    "ReviewCause",
    "ReviewFindingOut",
    "ReviewLevel",
    "ReviewOutput",
    # Phase-54-1:追記
    "Row",
    "RowDiff",
    "SendbackFinding",
    "build_fix_check_messages",
    "build_instruction",
    "build_points_table",
    "build_review_messages",
    # Phase-54-1:追記
    "can_regenerate",
    "can_rehear",
    "changed_rows_text",
    "document_model_rows",
    "element_rows",
    "findings_for",
    "followup_state",
    "format_known_issues",
    # Phase-53-1:追記
    "gate_status",
    "gates_for_mode",
    "known_issues",
    # Phase-53(完了後の調整):追記
    "only_reviewed_documents",
    # Phase-54-1:追記
    "rehearing_message",
    "rehearing_points",
    "render_findings",
    # Phase-53-1:追記
    "render_notice",
    "review_effective",
    "sort_findings",
    # Phase-53-1:追記
    "stage_known_issues",
    "stage_targets",
    # Phase-54-1:追記
    "target_rows_text",
    "version_keys",
]
