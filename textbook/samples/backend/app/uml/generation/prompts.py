# 作成：Phase-10-2｜更新：24(完了後の調整)
# 写経レベル: コア ── 記法ごとに入力の節を絞る(トークン節約)・layerの付け方を指示する設計判断。
"""UML図の生成のプロンプトに渡す、既存のデータ辞書の形。

詳細設計モードの段階2・3の下書き(app/detailed_design/data_flow_drafting.py・data_model_drafting.py)
が使う。
"""

# Phase-24：削除 ── app.uml.domain.NotationType, app.uml.generation.sections.DFD_SECTION_TITLE, app.uml.generation.sections.DfdSubject, app.uml.generation.sections.extract_er_table_blocks, app.uml.generation.sections.extract_section, app.uml.generation.sections.remove_subsection, app.uml.validation.structural.MAX_ELEMENTS, collections.abc.Sequence, langchain_core.messages.BaseMessage, langchain_core.messages.HumanMessage, langchain_core.messages.SystemMessage
from dataclasses import dataclass
# Phase-24：削除
#
# from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
#
# from app.uml.domain import NotationType
# from app.uml.generation.sections import (
#     DFD_SECTION_TITLE,
#     DfdSubject,
#     extract_er_table_blocks,
#     extract_section,
#     remove_subsection,
# )
# from app.uml.validation.structural import MAX_ELEMENTS
#
# _COMMON_RULES = (
#     f"- 要素(ノード)は合計{MAX_ELEMENTS}個以内に収める。収まらない場合は重要度の低いものを省く\n"
#     "- IDは図の中で一意にし、関係・フローのsource_id/target_idは必ず定義済みのIDを指す\n"
#     "- 入力に書かれていない要素を創作しない\n"
# )
#
# _SYSTEM_PROMPTS: dict[NotationType, str] = {
#     "component": (
#         "あなたはソフトウェアアーキテクトです。以下の内部設計書の抜粋から、"
#         "モジュール構成を表すコンポーネント図の意味モデルを作成してください。\n"
#         "ルール:\n"
#         "- modulesはディレクトリ構成・責務の分割方針に現れるモジュールとする\n"
#         "- dependenciesは呼び出し・importの向き(依存する側→依存される側)で表す\n"
#         "- layerは層の名前(api, service, repository, model, external等)で、"
#         "図のレーン(列)分けに使われる。同じ層には同じ文字列を使う\n" + _COMMON_RULES
#     ),
#     "er": (
#         "あなたはデータベース設計者です。以下の内部設計書のテーブル定義から、"
#         "ER図の意味モデルを作成してください。\n"
#         "ルール:\n"
#         "- tablesは定義されたテーブル、columnsはその全カラムとする(PK/FK/NULL可否を正しく付ける)\n"
#         "- relationsは外部キーから導く。source_idは参照される側、target_idは外部キーを持つ側\n"
#         + _COMMON_RULES
#     ),
#     "dfd": (
#         "あなたはシステムアナリストです。以下の内部設計書の抜粋から、指定した1つの処理の"
#         "データフロー図(DFD)の意味モデルを作成してください。\n"
#         "ルール:\n"
#         "- processesは処理(担当モジュールでの加工)、external_entitiesは利用者・外部サービス、"
#         "data_storesはテーブルとする\n"
#         "- flowsは必ず処理を介す(ストア同士・外部実体とストアを直接つながない)。"
#         "全ての処理に入力と出力を1つ以上持たせる\n"
#         "- 全てのフローにdata_item_nameを付け、data_itemsで定義する。"
#         "既存のデータ辞書にある名前はそのまま再利用し、新しいデータ項目だけを追加する\n"
#         "- processesのlayerは担当モジュールの層(api, service, repository等)で、"
#         "図のレーン(列)分けに使われる\n" + _COMMON_RULES
#     ),
# }


@dataclass(frozen=True)
class ExistingDataItem:
    """プロンプトに渡す既存データ辞書1件(名前とフィールド名)。"""

    name: str
    field_names: list[str]
# Phase-24：削除
#
#
# def build_source_text(
#     notation: NotationType,
#     internal_design: str,
#     *,
#     dfd_subject: DfdSubject | None = None,
#     er_tables: Sequence[str] | None = None,
# ) -> str:
#     """記法ごとに、内部設計書から生成に必要な節だけを取り出して連結する。"""
#     if notation == "component":
#         section_3_3 = remove_subsection(extract_section(internal_design, "3.3"), DFD_SECTION_TITLE)
#         return "\n\n".join(s for s in (extract_section(internal_design, "3.1"), section_3_3) if s)
#     if notation == "er":
#         if er_tables:
#             return extract_er_table_blocks(internal_design, list(er_tables))
#         return extract_section(internal_design, "3.2")
#     if dfd_subject is None:
#         raise ValueError("DFDの生成には対象の処理(dfd_subject)が必要です")
#     subject_text = f"#### {dfd_subject.code}: {dfd_subject.title}\n{dfd_subject.body}"
#     return "\n\n".join(s for s in (extract_section(internal_design, "3.2"), subject_text) if s)
#
#
# def build_generation_messages(
#     notation: NotationType,
#     internal_design: str,
#     *,
#     dfd_subject: DfdSubject | None = None,
#     er_tables: Sequence[str] | None = None,
#     data_items: Sequence[ExistingDataItem] = (),
# ) -> list[BaseMessage]:
#     """構造化出力の呼び出しに渡すメッセージ列(SystemMessage+HumanMessage)を組み立てる。"""
#     parts = [
#         "## 内部設計書(抜粋)\n"
#         + build_source_text(notation, internal_design, dfd_subject=dfd_subject, er_tables=er_tables)
#     ]
#     if notation == "dfd":
#         assert dfd_subject is not None  # build_source_textで検証済み
#         parts.append(f"## 対象の処理\n{dfd_subject.title}")
#         dictionary = "\n".join(
#             f"- {item.name}({', '.join(item.field_names)})" for item in data_items
#         )
#         parts.append("## 既存のデータ辞書\n" + (dictionary or "(まだありません)"))
#     return [
#         SystemMessage(content=_SYSTEM_PROMPTS[notation]),
#         HumanMessage(content="\n\n".join(parts)),
#     ]
