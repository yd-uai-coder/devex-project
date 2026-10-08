# 作成：Phase-22-5｜更新：Phase-23-3,24(完了後の調整),30-4,30-7,31-3,31-4
# 写経レベル: コア ── 承認済みの章の図だけを描いて載せ、出力した図を exported にする。
# Phase-23-3：更新(docstring: 実装計画と、入力を集める collect を段階7の生成も使うこと)
# Phase-30-4：更新(docstring: 段階8の実装手順書を`implementation_procedure/`に入れること)
# Phase-30-7：更新(docstring: 実装手順書を別の zip に。承認済みになるまで zip を断る。「いつでもダウンロードできる」を削除)
# Phase-31-4：更新(docstring: 実装手順書の zip は collect を通らず、簡易モードでも作れること)
"""詳細設計書(HTML+md+図)と実装計画を zip にまとめるユースケース(Phase 22・23)。

docs/internal_design.md 3.3節「4. 詳細設計モード」の「詳細設計書の組み立て」。

- 入力: 段階1〜7の状態と承認済みの内容(`DesignStageService.overview`)、承認済みの章が使う図
  (段階2の DFD・段階3の ER・段階4の構成図)、データ辞書。
- 組み立て: 純粋関数(`app.detailed_design.document`)が md と HTML を作る。図の描画は
  ステージ3の zip と同じ規則(`app.uml.export.render_diagram`)。
- zip に入れた図は`exported`にする(図のファイルを出力した記録。ステージ3の zip と同じ)。
- 段階7の実装計画は、詳細設計書とは別のファイル(implementation_plan.md・.html)にする(Phase 23)。
- 段階8の実装手順書は別の zip(`implementation_procedure.zip`。`index.md`・単位ごとの md・
  `ai/<単位ID>.md`・HTML 1枚)にする(組み立ては`app.detailed_design.procedure_output`)。

zip は、元になる段階が承認済み(古くない)になるまで断る(`DesignDocumentNotReadyError`、409)。
詳細設計書・実装計画は段階1〜7、実装手順書は段階8。章の「未承認」の書き方は組み立ての側に残す
(段階7の下書きの入力が、承認済みの章だけの詳細設計書の md を使うため)。

入力を集める部分(`collect`)は、段階7の下書きの生成も使う(Phase 23。#17: 消費者は段階7の
生成)。生成では図を描かず(`render=False`)、図を`exported`にもしない。
"""

# Phase-24：削除 ── app.services.uml_sync_service.BundleFile
# Phase-23-3:追記 ── dataclasses(dataclass, field), app.detailed_design.document(DocumentSource, to_plan_html, to_plan_markdown)
# Phase-30-4:追記 ── app.detailed_design.procedure_doc.PROCEDURE_DOC_STAGE, app.detailed_design.procedure_output(ProcedureOutputSource, procedure_output_source, to_ai_markdown, to_index_markdown, to_procedure_html, to_unit_markdown, unit_filename), app.detailed_design.validation.validate_stage
# Phase-30-7:追記 ── collections.abc(Iterable, Mapping), app.services.errors.DesignDocumentNotReadyError
# Phase-31-3:追記 ── app.detailed_design.procedure_basis.procedure_basis
# Phase-31-4:追記 ── app.detailed_design.validation.StageSources, app.services.errors.DesignStagesNotAvailableError
import uuid
import zipfile
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from io import BytesIO

from sqlalchemy.ext.asyncio import AsyncSession

from app.detailed_design.data_flow import DataFlowModel, dfd_subject
from app.detailed_design.data_model import ER_SUBJECT
from app.detailed_design.document import (
    DataItemEntry,
    DocumentSource,
    RenderedDiagram,
    document_source,
    to_html,
    to_markdown,
    to_plan_html,
    to_plan_markdown,
)
from app.detailed_design.procedure_basis import procedure_basis
from app.detailed_design.procedure_doc import PROCEDURE_DOC_STAGE
from app.detailed_design.procedure_output import (
    ProcedureOutputSource,
    procedure_output_source,
    to_ai_markdown,
    to_index_markdown,
    to_procedure_html,
    to_unit_markdown,
    unit_filename,
)
from app.detailed_design.stages import StageState
from app.detailed_design.structure import STRUCTURE_SUBJECT
from app.detailed_design.validation import StageSources, validate_stage
from app.models.project import Project
from app.models.uml_diagram import UmlDiagram
from app.repositories.data_item import DataItemRepository
from app.repositories.uml_diagram import UmlDiagramRepository
from app.services.design_stage_service import DesignStageService
from app.services.errors import DesignDocumentNotReadyError, DesignStagesNotAvailableError
from app.uml.domain import (
    STATUS_AFTER_EXPORT,
    ErSemanticModel,
    NotationType,
    SemanticModelAdapter,
    can_export,
    parse_status,
)
from app.uml.export import diagram_title, export_filename, render_diagram, unique_base

DOCUMENT_FILENAME = "detailed_design.zip"
DOCUMENT_HTML_NAME = "detailed_design.html"
DOCUMENT_MARKDOWN_NAME = "detailed_design.md"
DOCUMENT_DIAGRAM_DIR = "diagrams"
# Phase-23-3:追記
PLAN_HTML_NAME = "implementation_plan.html"
PLAN_MARKDOWN_NAME = "implementation_plan.md"
# Phase-30-4:追記
# Phase-30-7：更新
# PROCEDURE_DIR = "implementation_procedure"
# PROCEDURE_INDEX_NAME = f"{PROCEDURE_DIR}/index.md"
# PROCEDURE_HTML_NAME = f"{PROCEDURE_DIR}/implementation_procedure.html"
# PROCEDURE_AI_DIR = f"{PROCEDURE_DIR}/ai"
# ↓↓
PROCEDURE_FILENAME = "implementation_procedure.zip"
PROCEDURE_INDEX_NAME = "index.md"
PROCEDURE_HTML_NAME = "implementation_procedure.html"
PROCEDURE_AI_DIR = "ai"

# zip の元になる段階(承認済みになるまでダウンロードを断る)。詳細設計書(01〜07章)と実装計画は
# 段階1〜7、実装手順書は段階8
DOCUMENT_STAGES: tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7)
PROCEDURE_STAGES: tuple[int, ...] = (PROCEDURE_DOC_STAGE,)


# Phase-24:追記
@dataclass(frozen=True)
class BundleFile:
    """zipでまとめたダウンロード1件分(ルートがそのままレスポンスにする)。"""

    filename: str
    content: bytes
    media_type: str


# Phase-30-4：更新(docstring: `procedure`の欄)
@dataclass
class CollectedDocument:
    """組み立ての入力と、描いた図。`files`は zip の中のパス → 図の SVG・draw.io の本文、
    `rendered`は描いた図の行(zip に入れたら`exported`にする)。図を描かないときは両方空。
    `procedure`は実装手順書の組み立ての入力(段階8は承認済みの内容だけを使う)。"""

    source: DocumentSource
    # Phase-30-4:追記
    procedure: ProcedureOutputSource
    files: dict[str, str] = field(default_factory=dict)
    rendered: list[UmlDiagram] = field(default_factory=list)


class DetailedDesignExportService:
    """詳細設計書の組み立てと zip の作成を担当するサービス。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._stages = DesignStageService(session)
        self._diagrams = UmlDiagramRepository(session)
        self._data_items = DataItemRepository(session)

    # Phase-23-3：更新(bundle を、入力を集める collect と zip に書く bundle に分けた。図を描かない
    # collect(render=False) は段階7の下書きの生成が使う。#17)
    # async def bundle(self, project: Project) -> BundleFile:
    #     """詳細設計書の HTML・md と、載せた図の SVG・draw.io を zip にまとめる。
    #     簡易ドキュメントモードのプロジェクトは`DesignStagesNotAvailableError`(409)。"""
    #     views, sources = await self._stages.overview(project)
    #     states: dict[int, StageState] = {stage: view.state for stage, view in views.items()}
    #     approved = sources.stages
    #     items = await self._data_items.list_for_project(project.id)
    #     names = {item.id: item.name for item in items}
    #
    #     files: dict[str, str] = {}
    #     used: set[str] = set()
    #     exported: list[UmlDiagram] = []
    #
    #     def add(diagram: UmlDiagram | None) -> RenderedDiagram | None:
    #         """承認済みの図を描いて zip に足す(承認済みでない図・配置の無い図は載せない。図の
    #         承認には配置が要るので、配置の無い承認済みの図は通常は無い)。"""
    #         if diagram is None or not _is_approved(diagram) or diagram.layout_model is None:
    #             return None
    #         model = SemanticModelAdapter.validate_python(diagram.semantic_model)
    #         title = diagram_title(model.notation, diagram.subject)
    #         base = unique_base(
    #             export_filename(model.notation, diagram.subject, "svg").removesuffix(".svg"), used
    #         )
    #         svg_path = f"{DOCUMENT_DIAGRAM_DIR}/{base}.svg"
    #         svg = render_diagram(
    #             model, diagram.layout_model, names, "svg", diagram_id=str(diagram.id), title=title
    #         )
    #         files[svg_path] = svg
    #         files[f"{DOCUMENT_DIAGRAM_DIR}/{base}.drawio"] = render_diagram(
    #             model,
    #             diagram.layout_model,
    #             names,
    #             "drawio",
    #             diagram_id=str(diagram.id),
    #             title=title,
    #         )
    #         exported.append(diagram)
    #         return RenderedDiagram(title=title, path=svg_path, svg=svg)
    #
    #     # 段階2: 承認済みなら、選んだ機能グループの DFD を載せる
    #     dfd_diagrams: dict[str, RenderedDiagram] = {}
    #     dfd_models: list[dict] = []
    #     if 2 in approved:
    #         for group in DataFlowModel.model_validate(approved[2]).dfd_groups:
    #             diagram = await self._get(project.id, "dfd", dfd_subject(group))
    #             rendered = add(diagram)
    #             if diagram is not None and rendered is not None:
    #                 dfd_diagrams[group] = rendered
    #                 dfd_models.append(diagram.semantic_model or {})
    #
    #     # 段階3: 承認済みなら ER(図とテーブル定義の正本)
    #     er = er_diagram = None
    #     if 3 in approved:
    #         er_row = await self._get(project.id, "er", ER_SUBJECT)
    #         er_diagram = add(er_row)
    #         if er_row is not None and er_diagram is not None:
    #             er = ErSemanticModel.model_validate(er_row.semantic_model or {})
    #
    #     # 段階4: 承認済みなら構成図
    #     component_diagram = None
    #     if 4 in approved:
    #         component_diagram = add(await self._get(project.id, "component", STRUCTURE_SUBJECT))
    #
    #     source = document_source(
    #         project.title,
    #         states,
    #         approved,
    #         dfd_diagrams=dfd_diagrams,
    #         dfd_models=tuple(dfd_models),
    #         data_items=tuple(
    #             DataItemEntry(
    #                 id=str(item.id),
    #                 name=item.name,
    #                 fields=tuple(str(f.get("name", "")) for f in item.fields),
    #             )
    #             for item in items
    #         ),
    #         er=er,
    #         er_diagram=er_diagram,
    #         component_diagram=component_diagram,
    #     )
    #
    #     buffer = BytesIO()
    #     with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    #         archive.writestr(DOCUMENT_HTML_NAME, to_html(source))
    #         archive.writestr(DOCUMENT_MARKDOWN_NAME, to_markdown(source))
    #         for path, content in files.items():
    #             archive.writestr(path, content)
    #
    #     for diagram in exported:
    #         diagram.status = STATUS_AFTER_EXPORT
    #     await self._session.flush()
    #     await self._session.commit()
    #     return BundleFile(
    #         filename=DOCUMENT_FILENAME, content=buffer.getvalue(), media_type="application/zip"
    #     )
    # ↓↓
    # Phase-30-4：更新(docstring: 実装手順書も入れる)
    # Phase-30-7：更新(docstring: 実装手順書を外し、段階1〜7が承認済みでなければ断る)
    async def bundle(self, project: Project) -> BundleFile:
        """詳細設計書の HTML・md、実装計画の HTML・md と、載せた図の SVG・draw.io を zip に
        まとめる。段階1〜7のどれかが承認済みでなければ`DesignDocumentNotReadyError`(409。図も
        描かず`exported`にしない)、簡易ドキュメントモードのプロジェクトは
        `DesignStagesNotAvailableError`(409)。"""
        # Phase-31-4:追記
        _ensure_detailed(project)
        # Phase-30-7:追記
        await self._ensure_approved(project, DOCUMENT_STAGES)
        collected = await self.collect(project, render=True)
        source = collected.source

        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(DOCUMENT_HTML_NAME, to_html(source))
            archive.writestr(DOCUMENT_MARKDOWN_NAME, to_markdown(source))
            archive.writestr(PLAN_HTML_NAME, to_plan_html(source))
            archive.writestr(PLAN_MARKDOWN_NAME, to_plan_markdown(source))
            # Phase-30-4:追記
            # Phase-30-7：削除
            # for path, content in procedure_files(collected.procedure).items():
            #     archive.writestr(path, content)
            for path, content in collected.files.items():
                archive.writestr(path, content)

        for diagram in collected.rendered:
            diagram.status = STATUS_AFTER_EXPORT
        await self._session.flush()
        await self._session.commit()
        return BundleFile(
            filename=DOCUMENT_FILENAME, content=buffer.getvalue(), media_type="application/zip"
        )

    # Phase-30-7:追記
    async def bundle_procedure(self, project: Project) -> BundleFile:
        """実装手順書(`index.md`・単位ごとの md・`ai/<単位ID>.md`・HTML 1枚)を zip にまとめる。
        段階8が承認済みでなければ`DesignDocumentNotReadyError`(409)。図は描かない(手順の
        シーケンス図は手順から導くので、詳細設計書の図のファイルは要らない)。詳細設計書の
        組み立て(`collect`)は通らないので、簡易ドキュメントモードのプロジェクトも作れる。"""
        await self._ensure_approved(project, PROCEDURE_STAGES)
        # Phase-31-4：更新
        # collected = await self.collect(project, render=False)
        # ↓↓
        views, sources = await self._stages.overview(project)
        states: dict[int, StageState] = {stage: view.state for stage, view in views.items()}
        procedure = procedure_source(project.title, states, sources)
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            # Phase-31-4：更新
            # for path, content in procedure_files(collected.procedure).items():
            # ↓↓
            for path, content in procedure_files(procedure).items():
                archive.writestr(path, content)
        return BundleFile(
            filename=PROCEDURE_FILENAME, content=buffer.getvalue(), media_type="application/zip"
        )

    async def _ensure_approved(self, project: Project, stages: tuple[int, ...]) -> None:
        views, _ = await self._stages.overview(project)
        missing = missing_approvals({s: v.state for s, v in views.items()}, stages)
        if missing:
            names = "・".join(str(s) for s in missing)
            raise DesignDocumentNotReadyError(f"段階{names}が承認されていません")

    async def collect(self, project: Project, *, render: bool) -> CollectedDocument:
        """組み立ての入力を集める。`render`なら承認済みの図を描く(zip 用)。描かないときも、
        図の意味モデル(DFD の線・ER のテーブル)は表の導出に使うので読む。DB は書き換えない。
        簡易ドキュメントモードのプロジェクトは`DesignStagesNotAvailableError`(409)。"""
        # Phase-31-4:追記
        _ensure_detailed(project)
        views, sources = await self._stages.overview(project)
        states: dict[int, StageState] = {stage: view.state for stage, view in views.items()}
        approved = sources.stages
        items = await self._data_items.list_for_project(project.id)
        names = {item.id: item.name for item in items}
        collected_files: dict[str, str] = {}
        rendered: list[UmlDiagram] = []
        used: set[str] = set()

        def usable(diagram: UmlDiagram | None) -> bool:
            """載せられる図か(承認済みで、描くなら配置がある。図の承認には配置が要るので、
            配置の無い承認済みの図は通常は無い)。"""
            if diagram is None or not _is_approved(diagram):
                return False
            return not render or diagram.layout_model is not None

        def draw(diagram: UmlDiagram) -> RenderedDiagram | None:
            """図を描いて zip のファイルに足す(`render`でなければ描かない)。"""
            if not render:
                return None
            model = SemanticModelAdapter.validate_python(diagram.semantic_model)
            title = diagram_title(model.notation, diagram.subject)
            base = unique_base(
                export_filename(model.notation, diagram.subject, "svg").removesuffix(".svg"), used
            )
            svg_path = f"{DOCUMENT_DIAGRAM_DIR}/{base}.svg"
            svg = render_diagram(
                model, diagram.layout_model, names, "svg", diagram_id=str(diagram.id), title=title
            )
            collected_files[svg_path] = svg
            collected_files[f"{DOCUMENT_DIAGRAM_DIR}/{base}.drawio"] = render_diagram(
                model,
                diagram.layout_model,
                names,
                "drawio",
                diagram_id=str(diagram.id),
                title=title,
            )
            rendered.append(diagram)
            return RenderedDiagram(title=title, path=svg_path, svg=svg)

        # 段階2: 承認済みなら、選んだ機能グループの DFD を載せる
        dfd_diagrams: dict[str, RenderedDiagram] = {}
        dfd_models: list[dict] = []
        if 2 in approved:
            for group in DataFlowModel.model_validate(approved[2]).dfd_groups:
                diagram = await self._get(project.id, "dfd", dfd_subject(group))
                if diagram is None or not usable(diagram):
                    continue
                dfd_models.append(diagram.semantic_model or {})
                drawn = draw(diagram)
                if drawn is not None:
                    dfd_diagrams[group] = drawn

        # 段階3: 承認済みなら ER(図とテーブル定義の正本)
        er = er_diagram = None
        if 3 in approved:
            er_row = await self._get(project.id, "er", ER_SUBJECT)
            if er_row is not None and usable(er_row):
                er = ErSemanticModel.model_validate(er_row.semantic_model or {})
                er_diagram = draw(er_row)

        # 段階4: 承認済みなら構成図
        component_diagram = None
        if 4 in approved:
            component = await self._get(project.id, "component", STRUCTURE_SUBJECT)
            if component is not None and usable(component):
                component_diagram = draw(component)

        source = document_source(
            project.title,
            states,
            approved,
            dfd_diagrams=dfd_diagrams,
            dfd_models=tuple(dfd_models),
            data_items=tuple(
                DataItemEntry(
                    id=str(item.id),
                    name=item.name,
                    fields=tuple(str(f.get("name", "")) for f in item.fields),
                )
                for item in items
            ),
            er=er,
            er_diagram=er_diagram,
            component_diagram=component_diagram,
        )
        # Phase-30-4：更新
        # return CollectedDocument(source=source, files=collected_files, rendered=rendered)
        # ↓↓
        # Phase-31-4：更新
        # procedure = procedure_output_source(
        #     project.title,
        #     states[PROCEDURE_DOC_STAGE],
        #     approved,
        #     approved.get(PROCEDURE_DOC_STAGE),
        #     validate_stage(PROCEDURE_DOC_STAGE, approved.get(PROCEDURE_DOC_STAGE), sources)
        #     if PROCEDURE_DOC_STAGE in approved
        #     else [],
        #     sources.documents.get("requirements", ""),
        # )
        # ↓↓
        procedure = procedure_source(project.title, states, sources)
        return CollectedDocument(
            source=source, procedure=procedure, files=collected_files, rendered=rendered
        )

    async def _get(
        self, project_id: uuid.UUID, notation: NotationType, subject: str
    ) -> UmlDiagram | None:
        return await self._diagrams.get_by_subject(
            project_id=project_id, notation=notation, subject=subject
        )


# Phase-31-4:追記
def _ensure_detailed(project: Project) -> None:
    """詳細設計書は詳細設計モードのプロジェクトだけが持つ(簡易モードは段階8だけ)。"""
    if project.mode != "detailed":
        raise DesignStagesNotAvailableError(
            f"Project {project.id} is not in detailed design mode (mode={project.mode})"
        )


def procedure_source(
    title: str, states: Mapping[int, StageState], sources: StageSources
) -> ProcedureOutputSource:
    """実装手順書の組み立ての入力。段階8は承認済みの内容だけを使い(未承認なら手順書は空)、
    作業単位と参照はモードの土台(`procedure_basis`)から取る。"""
    model = sources.stages.get(PROCEDURE_DOC_STAGE)
    return procedure_output_source(
        title,
        states[PROCEDURE_DOC_STAGE],
        procedure_basis(sources.mode, sources.stages, sources.documents),
        model,
        validate_stage(PROCEDURE_DOC_STAGE, model, sources) if model is not None else [],
        sources.documents.get("requirements", ""),
    )


# Phase-30-7:追記
def missing_approvals(states: Mapping[int, StageState], stages: Iterable[int]) -> list[int]:
    """`stages`のうち、承認済み(古くない)でない段階(zip を断る理由)。"""
    return [stage for stage in stages if states.get(stage) != "approved"]


# Phase-30-4:追記
# Phase-30-7：更新(docstring: zip の直下に置く。承認済みでないと zip を断ること)
def procedure_files(source: ProcedureOutputSource) -> dict[str, str]:
    """実装手順書の zip のファイル(パス → 本文)。段階8が承認済みでなければ、「未承認」と書いた
    `index.md`と HTML だけ(zip は承認済みでないと断るので、組み立ての側の守り)。単位の md と
    AI 向けの版は、手順書のある単位だけ。"""
    files = {
        PROCEDURE_INDEX_NAME: to_index_markdown(source),
        PROCEDURE_HTML_NAME: to_procedure_html(source),
    }
    if not source.approved:
        return files
    for unit in source.units:
        if unit.unit_id not in source.procedures:
            continue
        # Phase-30-7：更新
        # files[f"{PROCEDURE_DIR}/{unit_filename(unit)}"] = to_unit_markdown(source, unit.unit_id)
        # ↓↓
        files[unit_filename(unit)] = to_unit_markdown(source, unit.unit_id)
        files[f"{PROCEDURE_AI_DIR}/{unit.unit_id}.md"] = to_ai_markdown(source, unit.unit_id)
    return files


def _is_approved(diagram: UmlDiagram) -> bool:
    """載せられる図か(承認済み・出力済みで、AI生成中でない)。ステージ3の zip と同じ条件。"""
    return diagram.generation_status != "generating" and can_export(parse_status(diagram.status))
