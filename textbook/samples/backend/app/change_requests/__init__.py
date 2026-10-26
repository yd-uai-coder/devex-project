# 作成：Phase-82-2｜更新：Phase-83-1,83-2,84-2,84-3,84-4,85-1,85-4,86-1,86-3,86-4,89(完了後の調整),93-3,95-1,95-3,96-1,96-2,101-1,101-2,102-1,102-4,103-1,103-2,104-1,104-3,112-3
# Phase-112-3：更新(docstring: 重なる CR の競合を足した)
# Phase-104-1：更新(docstring: コメント欄の規則を足した)
# Phase-103-1：更新(docstring: 共有リンクの規則を足した)
# Phase-102-4：更新(docstring: 選択肢の LLM の下書きを足した)
# Phase-102-1：更新(docstring: 選択肢を足した)
# Phase-101-1：更新(docstring: 変更の規模を足した)
# Phase-96-1：更新(docstring: CR で作り直した段階の承認を足した)
# Phase-86-4：更新(docstring: 検証の条件(86-1)・レビューを結ぶ条件(86-3)・たどる記録(86-4)を足した)
# Phase-85-4：更新(docstring: 反映の指示(85-1)・予測と実際の比較(85-4)を足した)
# Phase-84-4：更新(docstring: 変更後の案(84-1)・説明書の組み立てと照合(84-2)・要約の入力と状態(84-4)を足した)
# Phase-83-2：更新(docstring: 対象の扱い(83-1)と影響の予測(83-2)を足した)
# """変更要求(CR)の状態・遷移・重なりの判定(純粋関数)。
# ↓↓
"""変更要求(CR)の状態・遷移・重なりの判定と、対象(要件 ID・変更の種類・変更後の案)の扱い・
影響の予測・変更の規模・選択肢とその LLM の下書き・説明書の組み立てと、任意の要約の入力・照合・
状態・反映の指示・予測と実際の比較・検証の条件・CR で作り直した段階の承認・レビューを結ぶ条件・
たどる記録・共有リンクの規則・コメント欄の規則・重なる CR の競合(純粋関数)。

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
# Phase-102-1:追記 ── app.change_requests.options.OPTION_NAME_MAX, app.change_requests.options.OPTION_OUTCOME_MAX, app.change_requests.options.OPTIONS_MAX, app.change_requests.options.OPTIONS_MIN, app.change_requests.options.RECOMMEND_REASON_MAX, app.change_requests.options.ChangeOption, app.change_requests.options.ChangeOptions, app.change_requests.options.OptionScale, app.change_requests.options.normalize_options, app.change_requests.options.option_label, app.change_requests.options.option_scales, app.change_requests.options.option_target_problems, app.change_requests.options.options_from_json, app.change_requests.options.options_from_rows, app.change_requests.options.options_to_json
# Phase-102-4:追記 ── app.change_requests.option_drafting.OPTION_DRAFT_STATUS_LABEL, app.change_requests.option_drafting.OptionDraftCheck, app.change_requests.option_drafting.OptionDraftItemOut, app.change_requests.option_drafting.OptionDraftOut, app.change_requests.option_drafting.OptionDraftStatus, app.change_requests.option_drafting.OptionDraftTargetOut, app.change_requests.option_drafting.build_option_draft_messages, app.change_requests.option_drafting.check_option_draft, app.change_requests.option_drafting.draft_to_json, app.change_requests.option_drafting.draft_to_options
# Phase-103-1:追記 ── app.change_requests.sharing.DEFAULT_EXPIRES_DAYS, app.change_requests.sharing.MAX_EXPIRES_DAYS, app.change_requests.sharing.READABLE_STATES, app.change_requests.sharing.SHARE_STATE_LABEL, app.change_requests.sharing.SectionChange, app.change_requests.sharing.ShareState, app.change_requests.sharing.expires_at_from, app.change_requests.sharing.explanation_changes, app.change_requests.sharing.new_token, app.change_requests.sharing.share_state, app.change_requests.sharing.token_hash
# Phase-103-2:追記 ── app.change_requests.sharing.SNAPSHOT_MARKDOWN_KEY, app.change_requests.sharing.ExplainedSnapshot, app.change_requests.sharing.explained_snapshots, app.change_requests.sharing.previous_snapshot, app.change_requests.sharing.snapshot_refs
# Phase-104-1:追記 ── app.change_requests.comments.COMMENT_BODY_MAX, app.change_requests.comments.DEVELOPER_LABEL, app.change_requests.comments.CommentFacts, app.change_requests.comments.CommentThread, app.change_requests.comments.can_reply, app.change_requests.comments.comment_threads, app.change_requests.sharing.DECISION_SOURCE_LABEL, app.change_requests.sharing.SHARE_AGREE_REASON, app.change_requests.sharing.WRITABLE_STATES, app.change_requests.sharing.DecisionSource, app.change_requests.sharing.WriteProblem, app.change_requests.sharing.share_decision_reason, app.change_requests.sharing.write_problem
# Phase-104-3:追記 ── app.change_requests.sharing.decision_source_label
# Phase-112-3:追記 ── app.change_requests.conflicts.Conflict, app.change_requests.conflicts.RecordFact, app.change_requests.conflicts.base_seq, app.change_requests.conflicts.changed_after, app.change_requests.conflicts.checks_for, app.change_requests.conflicts.conflicts, app.change_requests.conflicts.is_checked, app.change_requests.conflicts.unchecked
from app.change_requests.comments import (
    COMMENT_BODY_MAX,
    DEVELOPER_LABEL,
    CommentFacts,
    CommentThread,
    can_reply,
    comment_threads,
)
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
from app.change_requests.conflicts import (
    Conflict,
    RecordFact,
    base_seq,
    changed_after,
    checks_for,
    conflicts,
    is_checked,
    unchecked,
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
from app.change_requests.option_drafting import (
    OPTION_DRAFT_STATUS_LABEL,
    OptionDraftCheck,
    OptionDraftItemOut,
    OptionDraftOut,
    OptionDraftStatus,
    OptionDraftTargetOut,
    build_option_draft_messages,
    check_option_draft,
    draft_to_json,
    draft_to_options,
)
from app.change_requests.options import (
    OPTION_NAME_MAX,
    OPTION_OUTCOME_MAX,
    OPTIONS_MAX,
    OPTIONS_MIN,
    RECOMMEND_REASON_MAX,
    ChangeOption,
    ChangeOptions,
    OptionScale,
    normalize_options,
    option_label,
    option_scales,
    option_target_problems,
    options_from_json,
    options_from_rows,
    options_to_json,
)
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
from app.change_requests.sharing import (
    DECISION_SOURCE_LABEL,
    DEFAULT_EXPIRES_DAYS,
    MAX_EXPIRES_DAYS,
    READABLE_STATES,
    SHARE_AGREE_REASON,
    SHARE_STATE_LABEL,
    SNAPSHOT_MARKDOWN_KEY,
    WRITABLE_STATES,
    DecisionSource,
    ExplainedSnapshot,
    SectionChange,
    ShareState,
    WriteProblem,
    decision_source_label,
    expires_at_from,
    explained_snapshots,
    explanation_changes,
    new_token,
    previous_snapshot,
    share_decision_reason,
    share_state,
    snapshot_refs,
    token_hash,
    write_problem,
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
    # Phase-104-1:追記
    "DECISION_SOURCE_LABEL",
    "SHARE_AGREE_REASON",
    "WRITABLE_STATES",
    "DecisionSource",
    "WriteProblem",
    "share_decision_reason",
    "write_problem",
    "COMMENT_BODY_MAX",
    "DEVELOPER_LABEL",
    "CommentFacts",
    "CommentThread",
    "can_reply",
    "comment_threads",
    # Phase-104-3:追記
    "decision_source_label",
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
    # Phase-112-3:追記
    "Conflict",
    "Comparison",
    # Phase-112-3:追記
    "RecordFact",
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
    # Phase-112-3:追記
    "conflicts",
    "is_checked",
    "unchecked",
    # Phase-112-3:追記
    "base_seq",
    "changed_after",
    "checks_for",
    "compare_scale",
    "count_scale",
    "display_name",
    "predicted_scale",
    "sources_from_snapshots",
    "unlinked_requirements",
    # Phase-101-2:追記
    "needs_reconfirm",
    # Phase-102-1:追記
    "OPTIONS_MAX",
    "OPTIONS_MIN",
    "OPTION_NAME_MAX",
    "OPTION_OUTCOME_MAX",
    "RECOMMEND_REASON_MAX",
    "ChangeOption",
    "ChangeOptions",
    "OptionScale",
    "normalize_options",
    "option_label",
    "option_scales",
    "option_target_problems",
    "options_from_json",
    "options_from_rows",
    "options_to_json",
    # Phase-102-4:追記
    "OPTION_DRAFT_STATUS_LABEL",
    "OptionDraftCheck",
    "OptionDraftItemOut",
    "OptionDraftOut",
    "OptionDraftStatus",
    "OptionDraftTargetOut",
    "build_option_draft_messages",
    "check_option_draft",
    "draft_to_json",
    "draft_to_options",
    # Phase-103-1:追記
    "DEFAULT_EXPIRES_DAYS",
    "MAX_EXPIRES_DAYS",
    "READABLE_STATES",
    "SHARE_STATE_LABEL",
    "SectionChange",
    "ShareState",
    "expires_at_from",
    "explanation_changes",
    "new_token",
    "share_state",
    "token_hash",
    # Phase-103-2:追記
    "SNAPSHOT_MARKDOWN_KEY",
    "ExplainedSnapshot",
    "explained_snapshots",
    "previous_snapshot",
    "snapshot_refs",
]
