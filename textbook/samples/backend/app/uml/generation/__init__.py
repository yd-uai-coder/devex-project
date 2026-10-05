# 作成：Phase-10-1｜更新：Phase-10-2,10-3,10-5,15-3,24(完了後の調整)
# 写経レベル: 定型 ── サブモジュールの公開シンボルをまとめるre-exportのみ。
"""UML図の生成の部品(詳細設計モードの段階の下書きが使う。Phase 24 完了後に簡易モードの設計図を削除)。出力スキーマ・ドメインモデルへの変換・
失敗理由の分類・節の抽出を、いずれも純粋関数/純粋なデータとして持つ。
LLM呼び出しとDB操作はサービス層(app/services/design_stage_generation_service.py)が担う。"""

# Phase-15-3:追記 ── app.uml.generation.failures.STALE_MESSAGE
# Phase-10-5:追記 ── app.uml.generation.failures(SKIPPED_MESSAGE, GenerationFailure, ReasonCode,
#   classify_failure, unwrap_structured_result)
# Phase-10-3:追記 ── app.uml.generation.mapper(required_data_items, to_component, to_dfd, to_er,
#   to_semantic_model)
# Phase-10-2:追記 ── app.uml.generation.prompts(ExistingDataItem, build_generation_messages,
#   build_source_text), app.uml.generation.schemas(GENERATION_SCHEMAS, ComponentGenerationOutput,
#   DfdGenerationOutput, ErGenerationOutput, GenerationOutput)
# Phase-24：削除 ── STALE_MESSAGE, SKIPPED_MESSAGE, to_er, to_semantic_model, build_generation_messages,
#   build_source_text, GENERATION_SCHEMAS, ErGenerationOutput, GenerationOutput, および sections の
#   DFD_SECTION_TITLE, DfdSubject, extract_dfd_subjects, extract_er_table_blocks, extract_er_tables,
#   remove_subsection
from app.uml.generation.failures import (
    GenerationFailure,
    ReasonCode,
    classify_failure,
    unwrap_structured_result,
)
from app.uml.generation.mapper import required_data_items, to_component, to_dfd
from app.uml.generation.prompts import ExistingDataItem
from app.uml.generation.schemas import ComponentGenerationOutput, DfdGenerationOutput
from app.uml.generation.sections import extract_section

__all__ = [
    # Phase-24：削除(簡易モードの設計図の生成だけが使っていた名前)
    # "DFD_SECTION_TITLE",
    # "GENERATION_SCHEMAS",
    # "SKIPPED_MESSAGE",
    # "STALE_MESSAGE",
    # "DfdSubject",
    # "ErGenerationOutput",
    # "GenerationOutput",
    # "build_generation_messages",
    # "build_source_text",
    # "extract_dfd_subjects",
    # "extract_er_table_blocks",
    # "extract_er_tables",
    # "remove_subsection",
    # "to_er",
    # "to_semantic_model",
    # Phase-10-1:追記
    "extract_section",
    # Phase-10-2:追記
    "ComponentGenerationOutput",
    "DfdGenerationOutput",
    "ExistingDataItem",
    # Phase-10-3:追記
    "required_data_items",
    "to_component",
    "to_dfd",
    # Phase-10-5:追記
    "GenerationFailure",
    "ReasonCode",
    "classify_failure",
    "unwrap_structured_result",
]
