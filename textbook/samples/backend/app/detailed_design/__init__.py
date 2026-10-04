# 作成：Phase-15-2｜更新：Phase-16-1,16-2,17-1
# 写経レベル: 定型 ── re-export のみ。
"""詳細設計モード(ステージ4)のドメインロジック(純粋関数)。"""

# Phase-16-1:追記 ── app.detailed_design.api_list.ApiEndpoint, endpoint_key, extract_api_endpoints, parse_trigger, trigger_key
# Phase-16-2:追記 ── app.detailed_design.function_list.FunctionDraft, FunctionListModel, FunctionRow, initial_group, merge_draft; app.detailed_design.validation.STAGE_VALIDATORS, StageIssue, StageSources, has_errors, validate_stage
# Phase-17-1:追記 ── app.detailed_design.data_flow.DATA_FLOW_STAGE, MAX_DFD_GROUPS, DataFlowModel, ProcessSummaryDraft, ProcessSummaryRow, dfd_subject, group_functions, merge_summaries; app.detailed_design.validation.DfdDiagramSummary
from app.detailed_design.api_list import (
    ApiEndpoint,
    endpoint_key,
    extract_api_endpoints,
    parse_trigger,
    trigger_key,
)
from app.detailed_design.data_flow import (
    DATA_FLOW_STAGE,
    MAX_DFD_GROUPS,
    DataFlowModel,
    ProcessSummaryDraft,
    ProcessSummaryRow,
    dfd_subject,
    group_functions,
    merge_summaries,
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
    DfdDiagramSummary,
    StageIssue,
    StageSources,
    has_errors,
    validate_stage,
)

# Phase-16-1・16-2：更新(__all__ に上の追記の名前を足した。並びはアルファベット順)
__all__ = [
    # Phase-17-1:追記
    "DATA_FLOW_STAGE",
    # Phase-17-1:追記
    "MAX_DFD_GROUPS",
    "STAGES",
    "STAGE_INPUTS",
    "STAGE_VALIDATORS",
    "ApiEndpoint",
    # Phase-17-1:追記
    "DataFlowModel",
    # Phase-17-1:追記
    "DfdDiagramSummary",
    "Fingerprint",
    "FunctionDraft",
    "FunctionListModel",
    "FunctionRow",
    # Phase-17-1:追記
    "ProcessSummaryDraft",
    # Phase-17-1:追記
    "ProcessSummaryRow",
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
    # Phase-17-1:追記
    "dfd_subject",
    "doc_key",
    "endpoint_key",
    "extract_api_endpoints",
    # Phase-17-1:追記
    "group_functions",
    "has_errors",
    "initial_group",
    "merge_draft",
    # Phase-17-1:追記
    "merge_summaries",
    "parse_trigger",
    "stage_key",
    "trigger_key",
    "validate_stage",
]
