# 作成：Phase-10-1｜更新：Phase-10-2,10-3,10-5,15-3
# 写経レベル: 定型 ── サブモジュールの公開シンボルをまとめるre-exportのみ。
"""UML図のAI生成(M1、Phase 10)。内部設計書の節抽出・LLM出力スキーマ・プロンプト組み立て・
ドメインモデルへの変換・失敗理由の分類を、いずれも純粋関数/純粋なデータとして持つ。
LLM呼び出しとDB操作はサービス層(app/services/uml_generation_service.py)が担う。"""

# Phase-15-3:追記 ── app.uml.generation.failures.STALE_MESSAGE
# Phase-10-5:追記 ── app.uml.generation.failures(SKIPPED_MESSAGE, GenerationFailure, ReasonCode,
#   classify_failure, unwrap_structured_result)
# Phase-10-3:追記 ── app.uml.generation.mapper(required_data_items, to_component, to_dfd, to_er,
#   to_semantic_model)
# Phase-10-2:追記 ── app.uml.generation.prompts(ExistingDataItem, build_generation_messages,
#   build_source_text), app.uml.generation.schemas(GENERATION_SCHEMAS, ComponentGenerationOutput,
#   DfdGenerationOutput, ErGenerationOutput, GenerationOutput)
from app.uml.generation.failures import (
    SKIPPED_MESSAGE,
    STALE_MESSAGE,
    GenerationFailure,
    ReasonCode,
    classify_failure,
    unwrap_structured_result,
)
from app.uml.generation.mapper import (
    required_data_items,
    to_component,
    to_dfd,
    to_er,
    to_semantic_model,
)
from app.uml.generation.prompts import (
    ExistingDataItem,
    build_generation_messages,
    build_source_text,
)
from app.uml.generation.schemas import (
    GENERATION_SCHEMAS,
    ComponentGenerationOutput,
    DfdGenerationOutput,
    ErGenerationOutput,
    GenerationOutput,
)
from app.uml.generation.sections import (
    DFD_SECTION_TITLE,
    DfdSubject,
    extract_dfd_subjects,
    extract_er_table_blocks,
    extract_er_tables,
    extract_section,
    remove_subsection,
)

__all__ = [
    # Phase-10-1:追記
    "DFD_SECTION_TITLE",
    "DfdSubject",
    "extract_dfd_subjects",
    "extract_er_table_blocks",
    "extract_er_tables",
    "extract_section",
    "remove_subsection",
    # Phase-10-2:追記
    "GENERATION_SCHEMAS",
    "ComponentGenerationOutput",
    "DfdGenerationOutput",
    "ErGenerationOutput",
    "ExistingDataItem",
    "GenerationOutput",
    "build_generation_messages",
    "build_source_text",
    # Phase-10-3:追記
    "required_data_items",
    "to_component",
    "to_dfd",
    "to_er",
    "to_semantic_model",
    # Phase-10-5:追記
    "SKIPPED_MESSAGE",
    # Phase-15-3:追記
    "STALE_MESSAGE",
    "GenerationFailure",
    "ReasonCode",
    "classify_failure",
    "unwrap_structured_result",
]
