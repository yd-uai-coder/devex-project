# 作成：Phase-15-2｜更新：Phase-16-1,16-2,17-1,18-1,19-1,20-1,20-3
# 写経レベル: 定型 ── re-export のみ。
"""詳細設計モード(ステージ4)のドメインロジック(純粋関数)。"""

# Phase-16-1:追記 ── app.detailed_design.api_list.ApiEndpoint, endpoint_key, extract_api_endpoints, parse_trigger, trigger_key
# Phase-16-2:追記 ── app.detailed_design.function_list.FunctionDraft, FunctionListModel, FunctionRow, initial_group, merge_draft; app.detailed_design.validation.STAGE_VALIDATORS, StageIssue, StageSources, has_errors, validate_stage
# Phase-17-1:追記 ── app.detailed_design.data_flow.DATA_FLOW_STAGE, MAX_DFD_GROUPS, DataFlowModel, ProcessSummaryDraft, ProcessSummaryRow, dfd_subject, group_functions, merge_summaries; app.detailed_design.validation.DfdDiagramSummary
# Phase-18-1:追記 ── app.detailed_design.data_model.CRUD_OPS, DATA_MODEL_STAGE, ER_SUBJECT, CrudCell, CrudDraft, CrudModel, DfdAccess, confirm_drafts, dfd_accesses, er_table_names, merge_crud, normalize_ops, table_key, tables_without_primary_key; app.detailed_design.validation.ErDiagramSummary, selected_dfd_accesses
# Phase-19-1:追記 ── app.detailed_design.structure.STRUCTURE_STAGE, STRUCTURE_SUBJECT, ModuleDraft, ModuleListModel, ModuleRow, component_layers, merge_modules, module_ref_matches, path_variants(画面確認後の修正); app.detailed_design.validation.ComponentDiagramSummary
# Phase-20-1:追記 ── app.detailed_design.procedure.MAX_PROCEDURE_TARGETS, PROCEDURE_STAGE, Procedure, ProcedureDraft, ProcedureModel, ProcedureStep, is_external_actor, merge_procedure, number_steps, pending_function_ids, resolve_callee, step_id
# Phase-20-3:追記 ── app.detailed_design.procedure.generation_targets
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
from app.detailed_design.data_model import (
    CRUD_OPS,
    DATA_MODEL_STAGE,
    ER_SUBJECT,
    CrudCell,
    CrudDraft,
    CrudModel,
    DfdAccess,
    confirm_drafts,
    dfd_accesses,
    er_table_names,
    merge_crud,
    normalize_ops,
    table_key,
    tables_without_primary_key,
)
from app.detailed_design.function_list import (
    FunctionDraft,
    FunctionListModel,
    FunctionRow,
    initial_group,
    merge_draft,
)
from app.detailed_design.procedure import (
    MAX_PROCEDURE_TARGETS,
    PROCEDURE_STAGE,
    Procedure,
    ProcedureDraft,
    ProcedureModel,
    ProcedureStep,
    generation_targets,
    is_external_actor,
    merge_procedure,
    number_steps,
    pending_function_ids,
    resolve_callee,
    step_id,
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
from app.detailed_design.structure import (
    STRUCTURE_STAGE,
    STRUCTURE_SUBJECT,
    ModuleDraft,
    ModuleListModel,
    ModuleRow,
    component_layers,
    merge_modules,
    module_ref_matches,
    path_variants,
)
from app.detailed_design.validation import (
    STAGE_VALIDATORS,
    ComponentDiagramSummary,
    DfdDiagramSummary,
    ErDiagramSummary,
    StageIssue,
    StageSources,
    has_errors,
    selected_dfd_accesses,
    validate_stage,
)

# Phase-16-1・16-2：更新(__all__ に上の追記の名前を足した。並びはアルファベット順)
__all__ = [
    # Phase-18-1:追記
    "CRUD_OPS",
    # Phase-17-1:追記
    "DATA_FLOW_STAGE",
    # Phase-18-1:追記
    "DATA_MODEL_STAGE",
    # Phase-18-1:追記
    "ER_SUBJECT",
    # Phase-17-1:追記
    "MAX_DFD_GROUPS",
    # Phase-20-1:追記
    "MAX_PROCEDURE_TARGETS",
    "PROCEDURE_STAGE",
    "STAGES",
    "STAGE_INPUTS",
    "STAGE_VALIDATORS",
    # Phase-19-1:追記
    "STRUCTURE_STAGE",
    "STRUCTURE_SUBJECT",
    "ApiEndpoint",
    # Phase-19-1:追記
    "ComponentDiagramSummary",
    # Phase-18-1:追記
    "CrudCell",
    # Phase-18-1:追記
    "CrudDraft",
    # Phase-18-1:追記
    "CrudModel",
    # Phase-17-1:追記
    "DataFlowModel",
    # Phase-18-1:追記
    "DfdAccess",
    # Phase-17-1:追記
    "DfdDiagramSummary",
    # Phase-18-1:追記
    "ErDiagramSummary",
    "Fingerprint",
    "FunctionDraft",
    "FunctionListModel",
    "FunctionRow",
    # Phase-19-1:追記
    "ModuleDraft",
    "ModuleListModel",
    "ModuleRow",
    # Phase-20-1:追記
    "Procedure",
    "ProcedureDraft",
    "ProcedureModel",
    "ProcedureStep",
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
    # Phase-19-1:追記
    "component_layers",
    # Phase-18-1:追記
    "confirm_drafts",
    "current_inputs",
    "derive_states",
    # Phase-18-1:追記
    "dfd_accesses",
    # Phase-17-1:追記
    "dfd_subject",
    "doc_key",
    "endpoint_key",
    # Phase-18-1:追記
    "er_table_names",
    "extract_api_endpoints",
    # Phase-20-3:追記
    "generation_targets",
    # Phase-17-1:追記
    "group_functions",
    "has_errors",
    "initial_group",
    # Phase-20-1:追記
    "is_external_actor",
    # Phase-18-1:追記
    "merge_crud",
    "merge_draft",
    # Phase-19-1:追記
    "merge_modules",
    # Phase-20-1:追記
    "merge_procedure",
    # Phase-19-1:追記(画面確認後の修正)
    "module_ref_matches",
    # Phase-17-1:追記
    "merge_summaries",
    # Phase-18-1:追記
    "normalize_ops",
    # Phase-20-1:追記
    "number_steps",
    "parse_trigger",
    # Phase-19-1:追記(画面確認後の修正)
    "path_variants",
    # Phase-20-1:追記
    "pending_function_ids",
    "resolve_callee",
    # Phase-18-1:追記
    "selected_dfd_accesses",
    "stage_key",
    # Phase-20-1:追記
    "step_id",
    # Phase-18-1:追記
    "table_key",
    # Phase-18-1:追記
    "tables_without_primary_key",
    "trigger_key",
    "validate_stage",
]
