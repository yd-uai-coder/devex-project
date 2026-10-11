# 作成：Phase-36-1｜更新：Phase-37-1
"""要件定義書の意味モデル(model・組み立て・md・検証)。"""

# Phase-37-1：削除 ── app.documents.requirements.validation(IssueLevel, RequirementIssue)
from app.documents.requirements.assemble import (
    RequirementDraft,
    RequirementsDraft,
    UserSceneDraft,
    assign_ids,
    build_model,
    cap_source,
    known_points,
    mark_adopted,
)
from app.documents.requirements.markdown import render_requirements, source_cell
from app.documents.requirements.model import (
    PRIORITIES,
    REQUIREMENT_KINDS,
    SOURCE_LABEL,
    Priority,
    RequirementKind,
    RequirementRow,
    RequirementsModel,
    RequirementSource,
    UserScene,
    parse_requirement_id,
    requirement_id,
)
from app.documents.requirements.validation import source_counts, validate_requirements

__all__ = [
    "PRIORITIES",
    "REQUIREMENT_KINDS",
    "SOURCE_LABEL",
    # Phase-37-1：削除
    # "IssueLevel",
    "Priority",
    "RequirementDraft",
    # Phase-37-1：削除
    # "RequirementIssue",
    "RequirementKind",
    "RequirementRow",
    "RequirementSource",
    "RequirementsDraft",
    "RequirementsModel",
    "UserScene",
    "UserSceneDraft",
    "assign_ids",
    "build_model",
    "cap_source",
    "known_points",
    "mark_adopted",
    "parse_requirement_id",
    "render_requirements",
    "requirement_id",
    "source_cell",
    "source_counts",
    "validate_requirements",
]
