# 作成：Phase-82-2｜更新：Phase-83-1,83-2,84-2,84-3,84-4,85-1,85-4,86-1,86-3,86-4,89(完了後の調整),93-3,95-1,95-3,96-1,96-2,101-1,101-2
# Phase-101-1：更新(docstring: 変更の規模を足した)
# Phase-96-1：更新(docstring: CR で作り直した段階の承認を足した)
# Phase-86-4：更新(docstring: 検証の条件(86-1)・レビューを結ぶ条件(86-3)・たどる記録(86-4)を足した)
# Phase-85-4：更新(docstring: 反映の指示(85-1)・予測と実際の比較(85-4)を足した)
# Phase-84-4：更新(docstring: 変更後の案(84-1)・説明書の組み立てと照合(84-2)・要約の入力と状態(84-4)を足した)
# Phase-83-2：更新(docstring: 対象の扱い(83-1)と影響の予測(83-2)を足した)
# """変更要求(CR)の状態・遷移・重なりの判定(純粋関数)。
# ↓↓
"""変更要求(CR)の状態・遷移・重なりの判定と、対象(要件 ID・変更の種類・変更後の案)の扱い・
影響の予測・変更の規模・説明書の組み立てと、任意の要約の入力・照合・状態・反映の指示・予測と実際の比較・
検証の条件・CR で作り直した段階の承認・レビューを結ぶ条件・たどる記録(純粋関数)。

docs/internal_design.md 3.3節「11. 合意と変更の一巡」。
"""

# Phase-83-2:追記 ── app.change_requests.prediction.PredictedItem, app.change_requests.prediction.PredictedTarget, app.change_requests.prediction.Prediction, app.change_requests.prediction.baseline_models, app.change_requests.prediction.predict, app.change_requests.prediction.predict_from_snapshots, app.change_requests.prediction.requirement_texts
# Phase-83-1:追記 ── app.change_requests.targets.TARGET_KIND_LABEL, app.change_requests.targets.TARGET_KINDS, app.change_requests.targets.Target, app.change_requests.targets.TargetKind, app.change_requests.targets.normalize_targets, app.change_requests.targets.target_ids, app.change_requests.targets.targets_from_json, app.change_requests.targets.targets_to_json
# Phase-83-1：更新 ── normalize_targets の import 元を app.change_requests.states から app.change_requests.targets へ
# Phase-84-2:追記 ── app.change_requests.explanation.AffectedUnits, app.change_requests.explanation.ChangeRequestFacts, app.change_requests.explanation.Explanation, app.change_requests.explanation.SummaryCheck, app.change_requests.explanation.affected_units, app.change_requests.explanation.build_explanation, app.change_requests.explanation.check_summary, app.change_requests.explanation.with_summary
# Phase-84-3:追記 ── app.change_requests.explanation.explanation_filename
# Phase-84-4:追記 ── app.change_requests.summary.SUMMARY_MAX, app.change_requests.summary.SUMMARY_STATE_LABEL, app.change_requests.summary.SummaryState, app.change_requests.summary.SummaryStatus, app.change_requests.summary.build_summary_messages, app.change_requests.summary.clip_summary, app.change_requests.summary.summary_state
# Phase-85-1:追記 ── app.change_requests.instruction.build_cr_instruction, app.change_requests.instruction.join_instructions, app.change_requests.states.DOCUMENT_REFLECTABLE_STATUSES, app.change_requests.states.STAGE_REFLECTABLE_STATUSES
# Phase-85-4:追記 ── app.change_requests.comparison(COMPARISON_STATUS_LABEL, COMPARISON_STATUSES, PREDICTED_ONLY_REASON_LABEL, AppliedMark, ComparedItem, Comparison, ComparisonStatus, PredictedOnlyReason, applied_marks_from_json, compare)
# Phase-86-1:追記 ── app.change_requests.states(CHECKABLE_STATUSES, INCLUDABLE_STATUSES), app.change_requests.verification(MARK_CONFIRMATION_LABEL, MARK_CONFIRMATIONS, DocumentItem, MarkConfirmation, MarkState, Verification, checked_documents, document_items, mark_states, verification_of, with_confirmations)
# Phase-86-3:追記 ── app.change_requests.reviews(LINKABLE_RUN_STATUS, aware, first_applied_at, review_link_problem)
# Phase-86-4:追記 ── app.change_requests.trace(ACTION_LABEL, EventFacts, ReviewFacts, TraceDocument, TraceEntry, TraceStage, trace_entries)
# Phase-89(完了後の調整):追記 ── app.change_requests.trace(DecisionFacts, decision_note)
# Phase-93-3:追記 ── app.change_requests.prediction.rewritable_keys
# Phase-95-1:追記 ── app.change_requests.prediction.predicted_document_keys
# Phase-95-3:追記 ── app.change_requests.trace.EDITED_FIELD_LABEL
# Phase-96-1:追記 ── app.change_requests.comparison.merge_applied_marks, app.change_requests.stage_approvals.APPROVE_STAGE_ACTION, app.change_requests.stage_approvals.StageFacts, app.change_requests.stage_approvals.pending_stages, app.change_requests.stage_approvals.stage_apply_versions
# Phase-96-2:追記 ── app.change_requests.prediction.ORIGIN_KINDS, app.change_requests.prediction.ORIGIN_REASON, app.change_requests.prediction.PredictedOrigin, app.change_requests.prediction.origin_candidates, app.change_requests.prediction.origin_candidates_from_snapshots, app.change_requests.prediction.origin_name
# Phase-101-1:追記 ── app.change_requests.scale.SCALE_KIND_LABEL, app.change_requests.scale.SCALE_KINDS, app.change_requests.scale.Scale, app.change_requests.scale.ScaleComparisonRow, app.change_requests.scale.ScaleCount, app.change_requests.scale.ScaleKind, app.change_requests.scale.ScaleRemark, app.change_requests.scale.ScaleSources, app.change_requests.scale.compare_scale, app.change_requests.scale.count_scale, app.change_requests.scale.display_name, app.change_requests.scale.predicted_scale, app.change_requests.scale.sources_from_snapshots, app.change_requests.scale.unlinked_requirements
# Phase-101-2:追記 ── app.change_requests.summary.needs_reconfirm
# Phase-101-2：削除 ── app.change_requests.explanation.AffectedUnits, app.change_requests.explanation.affected_units
from app.change_requests.comparison import (
    COMPARISON_STATUS_LABEL,
    COMPARISON_STATUSES,
    PREDICTED_ONLY_REASON_LABEL,
    AppliedMark,
    ComparedItem,
    Comparison,
    ComparisonStatus,
    PredictedOnlyReason,
    applied_marks_from_json,
    compare,
    merge_applied_marks,
)
from app.change_requests.explanation import (
    ChangeRequestFacts,
    Explanation,
    SummaryCheck,
    build_explanation,
    check_summary,
    explanation_filename,
    with_summary,
)
from app.change_requests.instruction import build_cr_instruction, join_instructions
from app.change_requests.prediction import (
    ORIGIN_KINDS,
    ORIGIN_REASON,
    PredictedItem,
    PredictedOrigin,
    PredictedTarget,
    Prediction,
    baseline_models,
    origin_candidates,
    origin_candidates_from_snapshots,
    origin_name,
    predict,
    predict_from_snapshots,
    predicted_document_keys,
    requirement_texts,
    rewritable_keys,
)
from app.change_requests.reviews import (
    LINKABLE_RUN_STATUS,
    aware,
    first_applied_at,
    review_link_problem,
)
from app.change_requests.scale import (
    SCALE_KIND_LABEL,
    SCALE_KINDS,
    Scale,
    ScaleComparisonRow,
    ScaleCount,
    ScaleKind,
    ScaleRemark,
    ScaleSources,
    compare_scale,
    count_scale,
    display_name,
    predicted_scale,
    sources_from_snapshots,
    unlinked_requirements,
)
from app.change_requests.stage_approvals import (
    APPROVE_STAGE_ACTION,
    StageFacts,
    pending_stages,
    stage_apply_versions,
)
from app.change_requests.states import (
    ACTIVE_STATUSES,
    BACKGROUND_SOURCE_LABEL,
    BACKGROUND_SOURCES,
    CHECKABLE_STATUSES,
    COPYABLE_STATUSES,
    DECISION_ACTIONS,
    DOCUMENT_REFLECTABLE_STATUSES,
    INCLUDABLE_STATUSES,
    INITIAL_STATUS,
    STAGE_REFLECTABLE_STATUSES,
    STATUS_LABEL,
    STATUSES,
    TRANSITIONS,
    BackgroundSource,
    ChangeRequestAction,
    ChangeRequestStatus,
    Overlap,
    allowed_actions,
    next_status,
    overlaps,
)
from app.change_requests.summary import (
    SUMMARY_MAX,
    SUMMARY_STATE_LABEL,
    SummaryState,
    SummaryStatus,
    build_summary_messages,
    clip_summary,
    needs_reconfirm,
    summary_state,
)
from app.change_requests.targets import (
    TARGET_KIND_LABEL,
    TARGET_KINDS,
    Target,
    TargetKind,
    normalize_targets,
    target_ids,
    targets_from_json,
    targets_to_json,
)
from app.change_requests.trace import (
    ACTION_LABEL,
    EDITED_FIELD_LABEL,
    DecisionFacts,
    EventFacts,
    ReviewFacts,
    TraceDocument,
    TraceEntry,
    TraceStage,
    decision_note,
    trace_entries,
)
from app.change_requests.verification import (
    MARK_CONFIRMATION_LABEL,
    MARK_CONFIRMATIONS,
    DocumentItem,
    MarkConfirmation,
    MarkState,
    Verification,
    checked_documents,
    document_items,
    mark_states,
    verification_of,
    with_confirmations,
)

__all__ = [
    "ACTIVE_STATUSES",
    "BACKGROUND_SOURCES",
    "BACKGROUND_SOURCE_LABEL",
    "COPYABLE_STATUSES",
    "DECISION_ACTIONS",
    "INITIAL_STATUS",
    "STATUSES",
    "STATUS_LABEL",
    "TRANSITIONS",
    "BackgroundSource",
    "ChangeRequestAction",
    "ChangeRequestStatus",
    "Overlap",
    "allowed_actions",
    "next_status",
    "normalize_targets",
    "overlaps",
    # Phase-83-1:追記
    "TARGET_KINDS",
    "TARGET_KIND_LABEL",
    "Target",
    "TargetKind",
    "target_ids",
    "targets_from_json",
    "targets_to_json",
    # Phase-83-2:追記
    "PredictedItem",
    "PredictedTarget",
    "Prediction",
    "baseline_models",
    "predict",
    "predict_from_snapshots",
    "requirement_texts",
    # Phase-84-2:追記
    # Phase-101-2：削除
    # "AffectedUnits",
    "ChangeRequestFacts",
    "Explanation",
    "SummaryCheck",
    # Phase-101-2：削除
    # "affected_units",
    "build_explanation",
    "check_summary",
    "with_summary",
    # Phase-84-3:追記
    "explanation_filename",
    # Phase-84-4:追記
    "SUMMARY_MAX",
    "SUMMARY_STATE_LABEL",
    "SummaryState",
    "SummaryStatus",
    "build_summary_messages",
    "clip_summary",
    "summary_state",
    # Phase-85-1:追記
    "DOCUMENT_REFLECTABLE_STATUSES",
    "STAGE_REFLECTABLE_STATUSES",
    "build_cr_instruction",
    "join_instructions",
    # Phase-85-4:追記
    "COMPARISON_STATUSES",
    "COMPARISON_STATUS_LABEL",
    "PREDICTED_ONLY_REASON_LABEL",
    # Phase-95-3:追記
    "EDITED_FIELD_LABEL",
    "AppliedMark",
    "ComparedItem",
    "Comparison",
    "ComparisonStatus",
    "PredictedOnlyReason",
    "applied_marks_from_json",
    "compare",
    # Phase-86-1:追記
    "CHECKABLE_STATUSES",
    "INCLUDABLE_STATUSES",
    "MARK_CONFIRMATIONS",
    "MARK_CONFIRMATION_LABEL",
    "DocumentItem",
    # Phase-89(完了後の調整):追記
    "DecisionFacts",
    "MarkConfirmation",
    "MarkState",
    "Verification",
    "checked_documents",
    "document_items",
    "mark_states",
    "verification_of",
    "with_confirmations",
    # Phase-86-3:追記
    "LINKABLE_RUN_STATUS",
    "aware",
    "first_applied_at",
    "review_link_problem",
    # Phase-86-4:追記
    "ACTION_LABEL",
    "EventFacts",
    "ReviewFacts",
    "TraceDocument",
    "TraceEntry",
    "TraceStage",
    "decision_note",
    # Phase-95-1:追記
    "predicted_document_keys",
    # Phase-93-3:追記
    "rewritable_keys",
    "trace_entries",
    # Phase-96-1:追記
    "APPROVE_STAGE_ACTION",
    "StageFacts",
    "merge_applied_marks",
    "pending_stages",
    "stage_apply_versions",
    # Phase-96-2:追記
    "ORIGIN_KINDS",
    "ORIGIN_REASON",
    "PredictedOrigin",
    "origin_candidates",
    "origin_candidates_from_snapshots",
    "origin_name",
    # Phase-101-1:追記
    "SCALE_KINDS",
    "SCALE_KIND_LABEL",
    "Scale",
    "ScaleComparisonRow",
    "ScaleCount",
    "ScaleKind",
    "ScaleRemark",
    "ScaleSources",
    "compare_scale",
    "count_scale",
    "display_name",
    "predicted_scale",
    "sources_from_snapshots",
    "unlinked_requirements",
    # Phase-101-2:追記
    "needs_reconfirm",
]
