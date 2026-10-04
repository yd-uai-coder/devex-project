# 作成：Phase-22-1｜更新：Phase-22-2,22-3,22-4
# 写経レベル: 定型 ── re-export のみ。章ごとに、その章で作るモジュールの名前を足す(前方 import を避けるため)。
"""詳細設計書(HTML・Markdown)の組み立て(純粋関数)。

承認済みの段階の意味モデルと図(`DocumentSource`)から、md と HTML を決定的に組み立てる。
DB の読み取り・図の描画・zip はサービス(app/services/detailed_design_export_service.py)が行う。

依存の向き: source ← views ← markdown / html(markdown と html は互いに import しない)。
親パッケージ(app.detailed_design)の`__init__`からは re-export しない ── 組み立てを使うのは
出力のサービスだけで、段階の検証・生成からは使わないため。
"""

# Phase-22-1:追記 ── app.detailed_design.document.source(CHAPTERS, Chapter, ChapterStatus, DataItemEntry,
#   DocumentSource, RenderedDiagram, chapter_status, chapter_statuses, document_source)
# Phase-22-2:追記 ── app.detailed_design.document.views(CrudMark, CrudMatrix, Involvement, LogicView,
#   StepView, anchor, crud_matrix, data_item_usage, involvement, linked_logic_ids, logic_ids,
#   logic_views, procedure_steps)
# Phase-22-3:追記 ── app.detailed_design.document.markdown.to_markdown
# Phase-22-4:追記 ── app.detailed_design.document.html.to_html
# (__all__ にも、各章で同じ名前を追記する)
from app.detailed_design.document.html import to_html
from app.detailed_design.document.markdown import to_markdown
from app.detailed_design.document.source import (
    CHAPTERS,
    Chapter,
    ChapterStatus,
    DataItemEntry,
    DocumentSource,
    RenderedDiagram,
    chapter_status,
    chapter_statuses,
    document_source,
)
from app.detailed_design.document.views import (
    CrudMark,
    CrudMatrix,
    Involvement,
    LogicView,
    StepView,
    anchor,
    crud_matrix,
    data_item_usage,
    involvement,
    linked_logic_ids,
    logic_ids,
    logic_views,
    procedure_steps,
)

__all__ = [
    "CHAPTERS",
    "Chapter",
    "ChapterStatus",
    "CrudMark",
    "CrudMatrix",
    "DataItemEntry",
    "DocumentSource",
    "Involvement",
    "LogicView",
    "RenderedDiagram",
    "StepView",
    "anchor",
    "chapter_status",
    "chapter_statuses",
    "crud_matrix",
    "data_item_usage",
    "document_source",
    "involvement",
    "linked_logic_ids",
    "logic_ids",
    "logic_views",
    "procedure_steps",
    "to_html",
    "to_markdown",
]
