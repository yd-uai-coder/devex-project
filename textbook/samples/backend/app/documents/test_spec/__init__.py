# 作成：Phase-56-1｜更新：Phase-57-2
"""テスト仕様書の意味モデル(model・必要なテスト・対応・組み立て・md・検証)。両モードで生成する。"""

from app.documents.test_spec.assemble import CaseDraft, TestSpecDraft, api_key, build_model
from app.documents.test_spec.links import ApiLink, api_links, detailed_links, simple_links
from app.documents.test_spec.markdown import render_test_spec
from app.documents.test_spec.model import (
    VIEWPOINTS,
    CaseLevel,
    SpecCase,
    SpecPolicy,
    TestSpecModel,
    Viewpoint,
    case_id,
)
from app.documents.test_spec.obligations import (
    Obligation,
    error_statuses,
    obligation_rows,
    required_tests,
)
# Phase-57-2:追記 ── app.documents.test_spec.validation.design_gap_count
from app.documents.test_spec.validation import (
    design_gap_count,
    is_outdated,
    row_counts,
    validate_test_spec,
)

__all__ = [
    "VIEWPOINTS",
    "ApiLink",
    "CaseDraft",
    "CaseLevel",
    "Obligation",
    "SpecCase",
    "SpecPolicy",
    "TestSpecDraft",
    "TestSpecModel",
    "Viewpoint",
    "api_key",
    "api_links",
    "build_model",
    "case_id",
    # Phase-57-2:追記
    "design_gap_count",
    "detailed_links",
    "error_statuses",
    "is_outdated",
    "obligation_rows",
    "render_test_spec",
    "required_tests",
    "row_counts",
    "simple_links",
    "validate_test_spec",
]
