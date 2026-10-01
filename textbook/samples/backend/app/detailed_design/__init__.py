# 作成：Phase-15-2｜更新：Phase-16-1,16-2
# 写経レベル: 定型 ── re-export のみ。
"""詳細設計モード(ステージ4)のドメインロジック(純粋関数)。"""

# Phase-16-1:追記 ── app.detailed_design.api_list.ApiEndpoint, endpoint_key, extract_api_endpoints, parse_trigger, trigger_key
# Phase-16-2:追記 ── app.detailed_design.function_list.FunctionDraft, FunctionListModel, FunctionRow, initial_group, merge_draft; app.detailed_design.validation.STAGE_VALIDATORS, StageIssue, StageSources, has_errors, validate_stage
from app.detailed_design.api_list import (
    ApiEndpoint,
    endpoint_key,
    extract_api_endpoints,
    parse_trigger,
    trigger_key,
)
from app.detailed_design.function_list import (
    FunctionDraft,
    FunctionListModel,
    FunctionRow,
    initial_group,
    merge_draft,
)
from app.detailed_design.stages import (
    STAGE_INPUTS,
    STAGES,
    Fingerprint,
    StageInputs,
    StageRecord,
    StageState,
    StageView,
    StoredStatus,
    can_approve,
    current_inputs,
    derive_states,
    doc_key,
    stage_key,
)
from app.detailed_design.validation import (
    STAGE_VALIDATORS,
    StageIssue,
    StageSources,
    has_errors,
    validate_stage,
)

# Phase-16-1・16-2：更新(__all__ に上の追記の名前を足した。並びはアルファベット順)
__all__ = [
    "STAGES",
    "STAGE_INPUTS",
    "STAGE_VALIDATORS",
    "ApiEndpoint",
    "Fingerprint",
    "FunctionDraft",
    "FunctionListModel",
    "FunctionRow",
    "StageInputs",
    "StageIssue",
    "StageRecord",
    "StageSources",
    "StageState",
    "StageView",
    "StoredStatus",
    "can_approve",
    "current_inputs",
    "derive_states",
    "doc_key",
    "endpoint_key",
    "extract_api_endpoints",
    "has_errors",
    "initial_group",
    "merge_draft",
    "parse_trigger",
    "stage_key",
    "trigger_key",
    "validate_stage",
]
