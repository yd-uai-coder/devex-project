# 作成：Phase-82-2｜更新：Phase-83-1,83-2,84-2,84-3,84-4
# Phase-84-4：更新(docstring: 変更後の案(84-1)・説明書の組み立てと照合(84-2)・要約の入力と状態(84-4)を足した)
# Phase-83-2：更新(docstring: 対象の扱い(83-1)と影響の予測(83-2)を足した)
# """変更要求(CR)の状態・遷移・重なりの判定(純粋関数)。
# ↓↓
"""変更要求(CR)の状態・遷移・重なりの判定と、対象(要件 ID・変更の種類・変更後の案)の扱い・
影響の予測・説明書の組み立てと、任意の要約の入力・照合・状態(純粋関数)。

docs/internal_design.md 3.3節「11. 合意と変更の一巡」。
"""

# Phase-83-2:追記 ── app.change_requests.prediction.PredictedItem, app.change_requests.prediction.PredictedTarget, app.change_requests.prediction.Prediction, app.change_requests.prediction.baseline_models, app.change_requests.prediction.predict, app.change_requests.prediction.predict_from_snapshots, app.change_requests.prediction.requirement_texts
# Phase-83-1:追記 ── app.change_requests.targets.TARGET_KIND_LABEL, app.change_requests.targets.TARGET_KINDS, app.change_requests.targets.Target, app.change_requests.targets.TargetKind, app.change_requests.targets.normalize_targets, app.change_requests.targets.target_ids, app.change_requests.targets.targets_from_json, app.change_requests.targets.targets_to_json
# Phase-83-1：更新 ── normalize_targets の import 元を app.change_requests.states から app.change_requests.targets へ
# Phase-84-2:追記 ── app.change_requests.explanation.AffectedUnits, app.change_requests.explanation.ChangeRequestFacts, app.change_requests.explanation.Explanation, app.change_requests.explanation.SummaryCheck, app.change_requests.explanation.affected_units, app.change_requests.explanation.build_explanation, app.change_requests.explanation.check_summary, app.change_requests.explanation.with_summary
# Phase-84-3:追記 ── app.change_requests.explanation.explanation_filename
# Phase-84-4:追記 ── app.change_requests.summary.SUMMARY_MAX, app.change_requests.summary.SUMMARY_STATE_LABEL, app.change_requests.summary.SummaryState, app.change_requests.summary.SummaryStatus, app.change_requests.summary.build_summary_messages, app.change_requests.summary.clip_summary, app.change_requests.summary.summary_state
from app.change_requests.explanation import (
    AffectedUnits,
    ChangeRequestFacts,
    Explanation,
    SummaryCheck,
    affected_units,
    build_explanation,
    check_summary,
    explanation_filename,
    with_summary,
)
from app.change_requests.prediction import (
    PredictedItem,
    PredictedTarget,
    Prediction,
    baseline_models,
    predict,
    predict_from_snapshots,
    requirement_texts,
)
from app.change_requests.states import (
    ACTIVE_STATUSES,
    BACKGROUND_SOURCE_LABEL,
    BACKGROUND_SOURCES,
    COPYABLE_STATUSES,
    DECISION_ACTIONS,
    INITIAL_STATUS,
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
    "AffectedUnits",
    "ChangeRequestFacts",
    "Explanation",
    "SummaryCheck",
    "affected_units",
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
]
