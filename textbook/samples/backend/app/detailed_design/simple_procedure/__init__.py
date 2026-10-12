# 作成：Phase-31-1｜更新：Phase-31-2,31-7,45-4
"""簡易ドキュメントモードの実装手順書の材料(純粋関数)。

簡易モードには段階1〜7が無いので、実装手順書の作業単位と参照する設計を、生成済みの4文書
(実装計画書の WBS・内部設計書)から決定的に読み取る。文書が model を持つ版は model から
読み(`book_from_model`・実装計画書の`to_plan`)、model の無い以前の版は md を解析する。
読み取った結果は段階7と同じ形(`PlanModel`)にそろえ、段階8の部品(検証・生成・出力)を詳細設計モードと共有する。

親パッケージ(app.detailed_design)の`__init__`からは re-export しない(使うのは段階8の部品だけ)。
"""

# Phase-31-2:追記 ── app.detailed_design.simple_procedure.internal_design(DataFlow, SimpleDesignBook, parse_internal_design), app.detailed_design.simple_procedure.refs(expand_simple_ref, simple_ref_label, simple_unit_context, simple_unit_refs)
# Phase-31-7:追記 ── app.detailed_design.simple_procedure.internal_design.module_layer
# Phase-45-4:追記 ── app.detailed_design.simple_procedure.internal_design.book_from_model
from app.detailed_design.simple_procedure.internal_design import (
    DataFlow,
    SimpleDesignBook,
    book_from_model,
    module_layer,
    parse_internal_design,
)
from app.detailed_design.simple_procedure.refs import (
    expand_simple_ref,
    simple_ref_label,
    simple_unit_context,
    simple_unit_refs,
)
from app.detailed_design.simple_procedure.wbs import (
    ENVIRONMENT_SECTION,
    WBS_SECTION,
    WbsIssue,
    WbsParse,
    parse_wbs,
)

__all__ = [
    "ENVIRONMENT_SECTION",
    "WBS_SECTION",
    # Phase-31-2:追記
    "DataFlow",
    "SimpleDesignBook",
    "WbsIssue",
    "WbsParse",
    # Phase-45-4:追記
    "book_from_model",
    "expand_simple_ref",
    # Phase-31-7:追記
    "module_layer",
    "parse_internal_design",
    "parse_wbs",
    "simple_ref_label",
    "simple_unit_context",
    "simple_unit_refs",
]
