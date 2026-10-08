# 作成：Phase-15-2｜更新：Phase-16-3,16-4,17-3,17-4,18-3,19-3,22-5,27-1,27-2,28-1,29-4,30-5,31-3,31-4
# 写経レベル: コア ── 承認の条件の順序と、承認時に入力の版を記録すること。
# Phase-31-4：更新(docstring: 簡易モードは段階8だけを持ち、入力は4文書)
# Phase-16-3:追記 ── app.detailed_design.validation.StageSources, app.detailed_design.validation.has_errors, app.detailed_design.validation.validate_stage, app.models.generated_document.GeneratedDocument, app.schemas.design_stage.StageIssueRead, app.services.errors.DesignStageGenerationInProgressError, app.services.errors.DesignStageInvalidError
# Phase-16-4:追記 ── app.detailed_design.Fingerprint
# Phase-17-3:追記 ── app.detailed_design.validation.DfdDiagramSummary, app.models.uml_diagram.UmlDiagram, app.repositories.uml_diagram.UmlDiagramRepository
# Phase-18-3:追記 ── app.detailed_design(DATA_MODEL_STAGE, ER_SUBJECT, confirm_drafts, dfd_accesses, er_table_names, table_key, tables_without_primary_key), app.detailed_design.validation(ErDiagramSummary, selected_dfd_accesses), app.schemas.design_stage.DfdAccessRead
# Phase-19-3:追記 ── app.detailed_design(STRUCTURE_SUBJECT, component_layers), app.detailed_design.validation.ComponentDiagramSummary
# Phase-28-1:追記 ── app.detailed_design(PLAN_STAGE, PROCEDURE_DOC_STAGE, PlanModel, find_unit), app.detailed_design.procedure_doc_refs.unit_context, app.schemas.design_stage(DesignRefRead, UnitContextRead), app.services.errors.DesignUnitNotFoundError
# Phase-29-4:追記 ── pydantic.ValidationError, app.detailed_design(PROCEDURE_STAGE, STRUCTURE_STAGE, ModuleListModel, ProcedureModel, module_dependencies), app.detailed_design.sequence.to_sequence, app.detailed_design.sequence_svg.to_sequence_svg, app.schemas.design_stage(SequenceIssueRead, SequenceRead), app.services.errors.DesignProcedureNotFoundError
# Phase-30-5:追記 ── app.detailed_design.procedure_output(count_by_level, procedure_output_source, to_ai_markdown, unit_findings), app.schemas.design_stage.UnitAiMarkdownRead, app.services.errors.DesignUnitProcedureNotFoundError
# Phase-31-3:追記 ── app.detailed_design.procedure_basis.procedure_basis
# Phase-31-4:追記 ── collections.abc.Mapping, app.detailed_design.procedure_basis.ProcedureBasis, app.detailed_design.stages(StageInputs, stage_inputs)
# Phase-31-4：削除 ── app.detailed_design(PLAN_STAGE, STAGE_INPUTS, PlanModel), app.detailed_design.procedure_doc_refs.unit_context
import uuid
from collections.abc import Mapping

import structlog
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.detailed_design import (
    DATA_MODEL_STAGE,
    ER_SUBJECT,
    PROCEDURE_DOC_STAGE,
    PROCEDURE_STAGE,
    STRUCTURE_STAGE,
    STRUCTURE_SUBJECT,
    Fingerprint,
    ModuleListModel,
    ProcedureModel,
    StageRecord,
    StageView,
    can_approve,
    component_layers,
    confirm_drafts,
    current_inputs,
    derive_states,
    dfd_accesses,
    er_table_names,
    find_unit,
    module_dependencies,
    table_key,
    tables_without_primary_key,
)
from app.detailed_design.procedure_basis import ProcedureBasis, procedure_basis
from app.detailed_design.procedure_output import (
    count_by_level,
    procedure_output_source,
    to_ai_markdown,
    unit_findings,
)
from app.detailed_design.sequence import to_sequence
from app.detailed_design.sequence_svg import to_sequence_svg
from app.detailed_design.stages import StageInputs, stage_inputs
from app.detailed_design.validation import (
    ComponentDiagramSummary,
    DfdDiagramSummary,
    ErDiagramSummary,
    StageSources,
    has_errors,
    selected_dfd_accesses,
    validate_stage,
)
from app.models.design_stage import DesignStage
from app.models.generated_document import GeneratedDocument
from app.models.project import Project
from app.models.uml_diagram import UmlDiagram
from app.repositories.design_stage import DesignStageRepository
from app.repositories.generated_document import GeneratedDocumentRepository
from app.repositories.uml_diagram import UmlDiagramRepository
from app.schemas.design_stage import (
    DesignRefRead,
    DesignStageRead,
    DfdAccessRead,
    SequenceIssueRead,
    SequenceRead,
    StageIssueRead,
    UnitAiMarkdownRead,
    UnitContextRead,
)
from app.services.errors import (
    DesignProcedureNotFoundError,
    DesignStageGenerationInProgressError,
    DesignStageInvalidError,
    DesignStageLockedError,
    DesignStageNotApprovableError,
    DesignStageNotFoundError,
    DesignStagesNotAvailableError,
    DesignStageVersionConflictError,
    DesignUnitNotFoundError,
    DesignUnitProcedureNotFoundError,
)

logger = structlog.get_logger(__name__)

# 人が保存した段階の状態('draft'はAIの下書きだけが作る。UML図のSTATUS_AFTER_EDITと同じ考え方)
STATUS_AFTER_EDIT = "reviewing"


class DesignStageService:
    """詳細設計モードの段階の取得・保存・承認を担当するサービス(全段階に共通の部分)。

    承認の条件は、全段階に共通の3つ(段階が開いている(入力がそろっている)、versionが一致する、
    承認できる状態で内容が空でない)と、段階ごとの検証(app/detailed_design/validation.py)で
    エラーが無いこと(Phase 16)。AIの下書きの生成はdesign_stage_generation_service.pyが担い、
    生成中の段階はここで保存・承認を断る。

    簡易ドキュメントモードのプロジェクトは段階8(実装手順書)だけを持ち、入力は4文書
    (`stage_inputs`)。他の段階を求められたら断る(`_ensure_stage`)。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._stages = DesignStageRepository(session)
        self._documents = GeneratedDocumentRepository(session)
        # Phase-17-3:追記
        self._diagrams = UmlDiagramRepository(session)

    async def list_stages(self, project: Project) -> list[DesignStageRead]:
        # Phase-27-1：更新
        # """段階1〜7の状態を返す(未着手の段階も含む)。"""
        # ↓↓
        # Phase-31-4：更新
        # """段階1〜8の状態を返す(未着手の段階も含む)。"""
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # sources = await self._sources(project.id, rows, views, documents)
        # return [_to_read(views[stage], rows.get(stage), sources) for stage in STAGE_INPUTS]
        # ↓↓
        """モードの全段階の状態を返す(未着手の段階も含む。詳細設計モードは段階1〜8、
        簡易モードは段階8だけ)。"""
        rows, views, documents = await self._load(project)
        sources = await self._sources(project, rows, views, documents)
        return [_to_read(views[stage], rows.get(stage), sources) for stage in views]

    async def stage_view(
        self, project: Project, stage: int
    ) -> tuple[DesignStage | None, StageView, StageSources]:
        """段階1つ分の行(未着手ならNone)・状態・入力(文書の本文・承認済みの段階の内容・DFD の
        要約)を返す(下書きの生成が使う)。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # sources = await self._sources(project.id, rows, views, documents)
        # ↓↓
        _ensure_stage(project, stage)
        rows, views, documents = await self._load(project)
        sources = await self._sources(project, rows, views, documents)
        return rows.get(stage), views[stage], sources

    # Phase-22-5:追記
    async def overview(self, project: Project) -> tuple[dict[int, StageView], StageSources]:
        """モードの全段階の状態と、承認済みの段階の内容(`StageSources.stages`)を返す(詳細設計書・
        実装手順書の組み立てが使う)。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # sources = await self._sources(project.id, rows, views, documents)
        # ↓↓
        rows, views, documents = await self._load(project)
        sources = await self._sources(project, rows, views, documents)
        return views, sources

    # Phase-16-4:追記
    async def current_fingerprint(self, project: Project, stage: int) -> Fingerprint:
        """段階が今入力にしているものの版(下書きの生成時に記録する。承認時と同じ規則)。"""
        # Phase-31-4：更新
        # rows, views, documents = await self._load(project.id)
        # ↓↓
        rows, views, documents = await self._load(project)
        return current_inputs(
            stage,
            approved_stage_versions=_approved_versions(rows, views),
            doc_versions=_doc_versions(documents),
            # Phase-31-4:追記
            inputs=stage_inputs(project.mode),
        )

    async def read(self, project_id: uuid.UUID, stage: int) -> DesignStageRead:
        # Phase-31-4：更新
        # """段階1つ分の今の状態を返す。"""
        # return await self._read_one(project_id, stage)
        # ↓↓
        """段階1つ分の今の状態を返す(モードを読むため、プロジェクトを読み直す)。"""
        project = await self._session.get(Project, project_id)
        if project is None:
            raise DesignStageNotFoundError(f"Project {project_id} does not exist")
        return await self._read_one(project, stage)

    async def save(
        self, project: Project, *, stage: int, expected_version: int | None, model: dict
    ) -> DesignStageRead:
        """段階の内容を人の編集として保存する。承認済みの段階を保存すると承認をやり直す
        (`reviewing`へ戻し、versionを増やす)。未着手の段階は、初めての保存で行を作る。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, _ = await self._load(project.id)
        # ↓↓
        _ensure_stage(project, stage)
        rows, views, _ = await self._load(project)
        _ensure_open(views[stage])
        row = rows.get(stage)
        # Phase-16-3:追記
        if row is not None:
            _ensure_not_generating(row)
        if row is None:
            if expected_version is not None:
                raise DesignStageVersionConflictError(f"Stage {stage} does not exist yet")
            row = await self._stages.create(
                project_id=project.id, stage=stage, model=model, status=STATUS_AFTER_EDIT
            )
        else:
            _ensure_version(row, expected_version)
            row.model = model
            row.status = STATUS_AFTER_EDIT
            row.version += 1
        await self._session.commit()
        await self._session.refresh(row)
        # Phase-31-4：更新
        # return await self._read_one(project.id, stage)
        # ↓↓
        return await self._read_one(project, stage)

    # Phase-17-4:追記
    async def mark_edited(self, project_id: uuid.UUID, stage: int) -> bool:
        """段階の内容のうち、段階の外に正本を持つもの(段階2の DFD・データ辞書)が直されたとき、
        承認済みの段階を人の編集と同じ扱いで差し戻す(`reviewing`へ戻し、versionを増やす)。
        差し戻したらTrue。

        段階の`model`の保存を経ずに内容が変わっても、承認をやり直させ、後ろの段階に「古い」を
        伝えるため(後ろの段階は、承認した版の番号で陳腐化を判定する)。承認済みでない段階は何も
        しない。行の無いプロジェクト(簡易ドキュメントモード)も何もしない。呼び出し元の保存と同じ
        トランザクションで使うため、commitしない(Phase 17)。"""
        row = await self._stages.get(project_id=project_id, stage=stage)
        if row is None or row.status != "approved":
            return False
        row.status = STATUS_AFTER_EDIT
        row.version += 1
        logger.info("design_stage_reopened", project_id=str(project_id), stage=stage)
        return True

    async def approve(
        self, project: Project, *, stage: int, expected_version: int
    ) -> DesignStageRead:
        """段階を承認する。承認したときの入力の版を`input_fingerprint`に記録する(後で前の段階・
        文書が変わったら「古い」と判定するため)。versionは増やさない。

        条件(この順に確かめる): 行がある / versionが一致する / 段階が開いている /
        承認できる状態(下書き・レビュー中・古い) / 内容が空でない / 段階ごとの検証でエラーが無い。
        生成中の段階は承認しない(生成の結果で内容が変わるため)。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # ↓↓
        _ensure_stage(project, stage)
        rows, views, documents = await self._load(project)
        row = rows.get(stage)
        if row is None:
            raise DesignStageNotFoundError(f"Stage {stage} has not been started")
        # Phase-16-3:追記
        _ensure_not_generating(row)
        _ensure_version(row, expected_version)
        view = views[stage]
        _ensure_open(view)
        if not can_approve(view.state):
            raise DesignStageNotApprovableError(f"Stage {stage} is already approved")
        if not row.model:
            raise DesignStageNotApprovableError(f"Stage {stage} has no content")
        # Phase-17-3：更新
        # if has_errors(validate_stage(stage, row.model, _sources(documents))):
        # ↓↓
        # Phase-31-4：更新
        # sources = await self._sources(project.id, rows, views, documents)
        # ↓↓
        sources = await self._sources(project, rows, views, documents)
        if has_errors(validate_stage(stage, row.model, sources)):
            raise DesignStageInvalidError(f"Stage {stage} has validation errors")

        # Phase-18-3:追記
        if stage == DATA_MODEL_STAGE:
            # 承認 = 人の確定なので、CRUD 図に残っている AI の下書きの印を外す(Phase 18)
            row.model = confirm_drafts(row.model)
        row.status = "approved"
        row.approved_version = row.version
        row.input_fingerprint = current_inputs(
            stage,
            approved_stage_versions=_approved_versions(rows, views),
            # Phase-16-3：更新
            # doc_versions=await self._doc_versions(project.id),
            # ↓↓
            doc_versions=_doc_versions(documents),
            # Phase-31-4:追記
            inputs=stage_inputs(project.mode),
        )
        await self._session.commit()
        await self._session.refresh(row)
        logger.info("design_stage_approved", project_id=str(project.id), stage=stage)
        # Phase-31-4：更新
        # return await self._read_one(project.id, stage)
        # ↓↓
        return await self._read_one(project, stage)

    # Phase-28-1:追記
    async def unit_context(self, project: Project, unit_id: str) -> UnitContextRead:
        """段階8の単位1つが参照する設計を展開して返す(画面の単位の詳細が使う)。中身は承認済みの
        段階1〜7(簡易モードは4文書)から毎回導き、保存しない。段階8が開いていなければ断る。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # ↓↓
        _ensure_stage(project, PROCEDURE_DOC_STAGE)
        rows, views, documents = await self._load(project)
        _ensure_open(views[PROCEDURE_DOC_STAGE])
        # Phase-31-4：更新
        # sources = await self._sources(project.id, rows, views, documents)
        # plan = PlanModel.model_validate(sources.stages.get(PLAN_STAGE) or {})
        # unit = find_unit(plan, unit_id)
        # ↓↓
        sources = await self._sources(project, rows, views, documents)
        basis = _basis(sources)
        unit = find_unit(basis.plan, unit_id)
        if unit is None:
            # Phase-31-4：更新
            # raise DesignUnitNotFoundError(f"Unit {unit_id} is not in stage {PLAN_STAGE}")
            # context = unit_context(unit, sources.stages)
            # ↓↓
            raise DesignUnitNotFoundError(f"Unit {unit_id} is not in the plan")
        context = basis.context(unit)
        return UnitContextRead(
            unit_id=unit.unit_id,
            refs=[DesignRefRead.model_validate(ref, from_attributes=True) for ref in context.refs],
            crosscutting=context.crosscutting,
            environment=context.environment,
        )

    # Phase-30-5:追記
    async def unit_ai_markdown(self, project: Project, unit_id: str) -> UnitAiMarkdownRead:
        """段階8の単位1つの AI 向けの版を、保存済みの手順書(下書き・レビュー中・古いものを含む)と
        承認済みの段階1〜7(簡易モードは4文書)から組み立てて返す(画面の「AI 向けにコピー」が
        使う)。段階8が承認済みでなければ、md の先頭で警告する。段階8が開いていなければ断り、
        作業単位に無い単位・手順書の無い単位は見つからないとする。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, documents = await self._load(project.id)
        # ↓↓
        _ensure_stage(project, PROCEDURE_DOC_STAGE)
        rows, views, documents = await self._load(project)
        view = views[PROCEDURE_DOC_STAGE]
        _ensure_open(view)
        # Phase-31-4：更新
        # sources = await self._sources(project.id, rows, views, documents)
        # plan = PlanModel.model_validate(sources.stages.get(PLAN_STAGE) or {})
        # if find_unit(plan, unit_id) is None:
        #     raise DesignUnitNotFoundError(f"Unit {unit_id} is not in stage {PLAN_STAGE}")
        # ↓↓
        sources = await self._sources(project, rows, views, documents)
        basis = _basis(sources)
        if find_unit(basis.plan, unit_id) is None:
            raise DesignUnitNotFoundError(f"Unit {unit_id} is not in the plan")
        row = rows.get(PROCEDURE_DOC_STAGE)
        model = row.model if row is not None else None
        try:
            source = procedure_output_source(
                project.title,
                view.state,
                # Phase-31-4：更新
                # sources.stages,
                # ↓↓
                basis,
                model,
                validate_stage(PROCEDURE_DOC_STAGE, model, sources),
                sources.documents.get("requirements", ""),
            )
        except ValidationError as exc:
            raise DesignUnitProcedureNotFoundError(
                f"Stage {PROCEDURE_DOC_STAGE} model is invalid"
            ) from exc
        key = unit_id.strip()
        if key not in source.procedures:
            raise DesignUnitProcedureNotFoundError(f"Unit {key} has no procedure document")
        findings = unit_findings(source, key)
        return UnitAiMarkdownRead(
            unit_id=key,
            markdown=to_ai_markdown(source, key),
            state=view.state,
            finding_total=len(findings),
            critical=count_by_level(findings)["critical"],
        )

    # Phase-29-4:追記
    async def procedure_sequence(self, project: Project, function_id: str) -> SequenceRead:
        """段階5の処理1つのシーケンス図を、保存した手順(下書き・レビュー中を含む)から導いて返す
        (画面の段階5のタブが使う)。図は保存しない。依存先の指摘は承認済みの段階4を使う。
        段階5が開いていなければ断り、段階5で選んでいない処理は見つからないとする。"""
        # Phase-31-4：更新
        # _ensure_detailed(project)
        # rows, views, _ = await self._load(project.id)
        # ↓↓
        _ensure_stage(project, PROCEDURE_STAGE)
        rows, views, _ = await self._load(project)
        _ensure_open(views[PROCEDURE_STAGE])
        row = rows.get(PROCEDURE_STAGE)
        try:
            model = ProcedureModel.model_validate(row.model if row is not None else {})
        except ValidationError as exc:
            raise DesignProcedureNotFoundError(f"Stage {PROCEDURE_STAGE} model is invalid") from exc
        procedure = next(
            (p for p in model.procedures if p.function_id.strip() == function_id.strip()), None
        )
        if procedure is None:
            raise DesignProcedureNotFoundError(
                f"Function {function_id} is not in stage {PROCEDURE_STAGE}"
            )
        structure = rows.get(STRUCTURE_STAGE)
        modules = (
            ModuleListModel.model_validate(structure.model)
            if structure is not None and views[STRUCTURE_STAGE].state == "approved"
            else None
        )
        diagram = to_sequence(procedure, module_dependencies(modules))
        return SequenceRead(
            function_id=procedure.function_id,
            svg=to_sequence_svg(diagram),
            issues=[
                SequenceIssueRead.model_validate(issue, from_attributes=True)
                for issue in diagram.issues
            ],
        )

    async def _load(
        # Phase-31-4：更新
        # self, project_id: uuid.UUID
        # ↓↓
        self, project: Project
    # Phase-16-3：更新
    # ) -> tuple[dict[int, DesignStage], dict[int, StageView]]:
    # ↓↓
    ) -> tuple[
        dict[int, DesignStage], dict[int, StageView], dict[str, GeneratedDocument | None]
    ]:
        # Phase-31-4：更新
        # rows = {row.stage: row for row in await self._stages.list_for_project(project_id)}
        # ↓↓
        """モードの段階の行・状態と、入力の文書。モードに無い段階の行は読まない。"""
        inputs = stage_inputs(project.mode)
        rows = {
            row.stage: row
            for row in await self._stages.list_for_project(project.id)
            if row.stage in inputs
        }
        records = {stage: _to_record(row) for stage, row in rows.items()}
        # Phase-16-3：更新
        # views = derive_states(records, await self._doc_versions(project_id))
        # return rows, views
        # ↓↓
        # Phase-31-4：更新
        # documents = await self._current_documents(project_id)
        # views = derive_states(records, _doc_versions(documents))
        # ↓↓
        documents = await self._current_documents(project.id, inputs)
        views = derive_states(records, _doc_versions(documents), inputs)
        return rows, views, documents

    # Phase-31-4：更新
    # async def _read_one(self, project_id: uuid.UUID, stage: int) -> DesignStageRead:
    #     rows, views, documents = await self._load(project_id)
    #     sources = await self._sources(project_id, rows, views, documents)
    # ↓↓
    async def _read_one(self, project: Project, stage: int) -> DesignStageRead:
        rows, views, documents = await self._load(project)
        sources = await self._sources(project, rows, views, documents)
        return _to_read(views[stage], rows.get(stage), sources)

    # Phase-17-3:追記
    async def _sources(
        self,
        # Phase-31-4：更新
        # project_id: uuid.UUID,
        # ↓↓
        project: Project,
        rows: dict[int, DesignStage],
        views: dict[int, StageView],
        documents: dict[str, GeneratedDocument | None],
    ) -> StageSources:
        """段階ごとの検証・下書きの生成に渡す入力。

        - 文書: 入力になる文書の表示中の版の本文。
        - 段階: 承認済み(古くない)段階の内容。後ろの段階は、承認済みの前の段階だけを入力にする。
        - DFD: 機能グループの DFD(段階2)の要約と、線から読み取った R/W(段階3)。詳細設計モードでは
          DFD はすべて段階2のもの。
        - ER: 段階3の ER(全体1枚)の要約。
        - 構成図: 段階4の構成図(全体1枚)の要約。

        簡易モード(段階8だけ)は、文書だけを渡す(図は段階8の入力にならない)。
        """
        # Phase-31-4:追記
        texts = {
            doc_type: document.content
            for doc_type, document in documents.items()
            if document is not None
        }
        approved = {
            stage: row.model
            for stage, row in rows.items()
            if views[stage].state == "approved" and row.model
        }
        if project.mode != "detailed":
            return StageSources(documents=texts, stages=approved, mode="simple")
        project_id = project.id
        diagrams = await self._diagrams.list_by_notation(project_id, "dfd")
        # Phase-18-3:追記
        er = await self._diagrams.get_by_subject(
            project_id=project_id, notation="er", subject=ER_SUBJECT
        )
        # Phase-19-3:追記
        component = await self._diagrams.get_by_subject(
            project_id=project_id, notation="component", subject=STRUCTURE_SUBJECT
        )
        return StageSources(
            # Phase-31-4：更新
            # documents={
            #     doc_type: document.content
            #     for doc_type, document in documents.items()
            #     if document is not None
            # },
            # stages={
            #     stage: row.model
            #     for stage, row in rows.items()
            #     if views[stage].state == "approved" and row.model
            # },
            # ↓↓
            documents=texts,
            stages=approved,
            dfd_diagrams={diagram.subject: _dfd_summary(diagram) for diagram in diagrams},
            # Phase-18-3:追記
            er_diagram=_er_summary(er) if er is not None else None,
            # Phase-19-3:追記
            component_diagram=_component_summary(component) if component is not None else None,
        )

    # Phase-16-3：更新
    # async def _doc_versions(self, project_id: uuid.UUID) -> dict[str, int | None]:
    #     """段階の入力になる文書の、表示中(is_current)の版。"""
    # ↓↓
    async def _current_documents(
        # Phase-31-4：更新
        # self, project_id: uuid.UUID
        # ↓↓
        self, project_id: uuid.UUID, inputs: Mapping[int, StageInputs]
    ) -> dict[str, GeneratedDocument | None]:
        """段階の入力になる文書の、表示中(is_current)の版(まだ無ければNone)。"""
        # Phase-31-4：更新
        # doc_types = {d for inputs in STAGE_INPUTS.values() for d in inputs.documents}
        # ↓↓
        doc_types = {d for stage_input in inputs.values() for d in stage_input.documents}
        # Phase-16-3：更新
        # versions: dict[str, int | None] = {}
        # for doc_type in sorted(doc_types):
        #     document = await self._documents.get_current(project_id=project_id, doc_type=doc_type)
        #     versions[doc_type] = document.version if document is not None else None
        # return versions
        # ↓↓
        return {
            doc_type: await self._documents.get_current(project_id=project_id, doc_type=doc_type)
            for doc_type in sorted(doc_types)
        }


def _doc_versions(documents: dict[str, GeneratedDocument | None]) -> dict[str, int | None]:
    return {
        doc_type: document.version if document is not None else None
        for doc_type, document in documents.items()
    }


# Phase-17-3：更新(入力の組み立ては、DFD を読むためにサービスのメソッド _sources へ移した)
# def _sources(documents: dict[str, GeneratedDocument | None]) -> StageSources:
#     """段階ごとの検証・下書きの生成に渡す、入力の文書の本文。"""
#     return StageSources(
#         documents={
#             doc_type: document.content
#             for doc_type, document in documents.items()
#             if document is not None
#         }
#     )
# ↓↓
def _dfd_summary(diagram: UmlDiagram) -> DfdDiagramSummary:
    elements = (diagram.semantic_model or {}).get("elements", [])
    return DfdDiagramSummary(
        status=diagram.status,
        generation_status=diagram.generation_status,
        process_ids=tuple(
            str(e.get("id")) for e in elements if e.get("element_type") == "process"
        ),
        # Phase-18-3:追記
        accesses=tuple(dfd_accesses([diagram.semantic_model or {}])),
    )


# Phase-18-3:追記
def _er_summary(diagram: UmlDiagram) -> ErDiagramSummary:
    return ErDiagramSummary(
        status=diagram.status,
        generation_status=diagram.generation_status,
        tables=tuple(er_table_names(diagram.semantic_model)),
        tables_without_pk=tuple(tables_without_primary_key(diagram.semantic_model)),
    )


# Phase-19-3:追記
def _component_summary(diagram: UmlDiagram) -> ComponentDiagramSummary:
    return ComponentDiagramSummary(
        status=diagram.status,
        generation_status=diagram.generation_status,
        layers=tuple(component_layers(diagram.semantic_model)),
    )


# ── ここから Phase-15-2 の作成分 ──
# Phase-31-4：更新
# def _ensure_detailed(project: Project) -> None:
#     if project.mode != "detailed":
# ↓↓
def _ensure_stage(project: Project, stage: int) -> None:
    """プロジェクトのモードに、その段階があるか(簡易モードは段階8だけ)。"""
    if stage not in stage_inputs(project.mode):
        raise DesignStagesNotAvailableError(
            # Phase-31-4：更新
            # f"Project {project.id} is not in detailed design mode (mode={project.mode})"
            # ↓↓
            f"Stage {stage} is not available for project {project.id} (mode={project.mode})"
        )


# Phase-31-4:追記
def _basis(sources: StageSources) -> ProcedureBasis:
    """段階8の土台(作業単位と参照の出どころ。モードで変わる)。"""
    return procedure_basis(sources.mode, sources.stages, sources.documents)


def _ensure_open(view: StageView) -> None:
    if not view.is_open:
        raise DesignStageLockedError(
            f"Stage {view.stage} is locked: missing {', '.join(view.missing_inputs)}"
        # Phase-16-3:追記
        )


def _ensure_not_generating(row: DesignStage) -> None:
    if row.generation_status == "generating":
        raise DesignStageGenerationInProgressError(
            f"Stage {row.stage} draft is being generated"
        )


def _ensure_version(row: DesignStage, expected_version: int | None) -> None:
    if expected_version != row.version:
        raise DesignStageVersionConflictError(
            f"Stage {row.stage} version mismatch "
            f"(expected {expected_version}, actual {row.version})"
        )


def _to_record(row: DesignStage) -> StageRecord:
    return StageRecord(
        status=row.status,  # type: ignore[arg-type]
        version=row.version,
        approved_version=row.approved_version,
        input_fingerprint=row.input_fingerprint,
    )


def _approved_versions(
    rows: dict[int, DesignStage], views: dict[int, StageView]
) -> dict[int, int | None]:
    """承認済み(古くない)段階の承認した版。derive_statesの「今の値」と同じ規則。"""
    return {
        stage: row.approved_version
        for stage, row in rows.items()
        if views[stage].state == "approved"
    }


# Phase-16-3：更新
# def _to_read(view: StageView, row: DesignStage | None) -> DesignStageRead:
# ↓↓
def _to_read(view: StageView, row: DesignStage | None, sources: StageSources) -> DesignStageRead:
    # Phase-27-2：更新
    # issues = validate_stage(view.stage, row.model, sources) if row is not None else []
    # ↓↓
    # Phase-31-4:追記
    # 段階8の作業単位(詳細設計モードは段階7、簡易モードは実装計画書の WBS)。画面の単位の一覧が使う
    plan = (
        _basis(sources).plan.model_dump(mode="json")
        if view.stage == PROCEDURE_DOC_STAGE and view.is_open
        else None
    )
    if row is not None:
        issues = validate_stage(view.stage, row.model, sources)
    elif view.is_open:
        # 内容の無い段階でも検証する段階がある(段階8は、手順書の無い単位にも指摘が出る)
        issues = validate_stage(view.stage, None, sources)
    else:
        issues = []
    return DesignStageRead(
        stage=view.stage,
        # Phase-31-4:追記
        mode=sources.mode,
        state=view.state,
        is_open=view.is_open,
        missing_inputs=list(view.missing_inputs),
        version=row.version if row is not None else None,
        approved_version=row.approved_version if row is not None else None,
        model=row.model if row is not None else None,
        updated_at=row.updated_at if row is not None else None,
        # Phase-16-3:追記
        generation_status=row.generation_status if row is not None else None,  # type: ignore[arg-type]
        generation_error=row.generation_error if row is not None else None,
        issues=[StageIssueRead.model_validate(issue, from_attributes=True) for issue in issues],
        # Phase-18-3:追記
        dfd_accesses=_dfd_access_reads(sources) if view.stage == DATA_MODEL_STAGE else [],
        # Phase-31-4:追記
        plan=plan,
    )


# Phase-18-3:追記
def _dfd_access_reads(sources: StageSources) -> list[DfdAccessRead]:
    """段階3の画面に渡す DFD の R/W。テーブル名は ER の名前に戻す(画面は ER の列の名前で引く)。"""
    names = {table_key(t): t for t in (sources.er_diagram.tables if sources.er_diagram else ())}
    return [
        DfdAccessRead(
            function_id=a.function_id, table=names.get(a.table, a.table), kind=a.kind
        )
        for a in selected_dfd_accesses(sources)
    ]
