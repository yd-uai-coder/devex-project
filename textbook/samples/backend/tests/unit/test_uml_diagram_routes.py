# 作成：Phase-8-4｜更新：Phase-9-5,10-6,11-1,12-1,12-4,24(完了後の調整)
# Phase-9-5:追記 ── app.api.routes.uml.compute_diagram_layout
# Phase-10-6:追記 ── fastapi.BackgroundTasks, tests.fixtures.uml(create_empty_diagram, create_project,
#   create_project_with_internal_design), app.api.routes.uml(generate_diagrams, list_diagrams,
#   list_generation_candidates, list_generation_runs), app.schemas.uml_generation(UmlGenerateRequest,
#   UmlSubjectSpec), app.services.uml_generation_service.run_uml_generation
# Phase-10-6：削除 ── uuid, app.api.routes.uml.create_diagram, app.models.project.Project,
#   app.models.user.User, app.schemas.uml_diagram.UmlDiagramCreate
# Phase-10-6：更新 ── 全テストの`create_diagram(UmlDiagramCreate(notation=...), db_session, project)`を
#   `create_empty_diagram(db_session, project.id, ...)`へ一括置換した(各行へのタグは省略)。
# Phase-11-1:追記 ── app.uml.layout.LayoutModel
# Phase-12-1:追記 ── app.api.routes.uml.approve_diagram, app.schemas.uml_diagram.UmlDiagramApprove,
#   app.services.errors.UmlLayoutRequiredError
# Phase-12-4:追記 ── uuid, app.api.responses.content_disposition,
#   app.api.routes.uml(export_diagram_drawio, export_diagram_svg),
#   app.services.errors.UmlDiagramNotApprovedError

# Phase-24：削除 ── app.api.routes.uml.generate_diagrams, app.api.routes.uml.list_generation_candidates, app.api.routes.uml.list_generation_runs, app.schemas.uml_generation.UmlGenerateRequest, app.schemas.uml_generation.UmlSubjectSpec, app.services.uml_generation_service.run_uml_generation, fastapi.BackgroundTasks, tests.fixtures.uml.create_project_with_internal_design
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.fixtures.uml import (
    create_empty_diagram,
    create_project,
)

from app.api.responses import content_disposition
from app.api.routes.uml import (
    approve_diagram,
    compute_diagram_layout,
    export_diagram_drawio,
    export_diagram_svg,
    get_diagram,
    list_diagrams,
    update_diagram,
    validate_diagram,
)
from app.core.errors import BadRequestError
from app.schemas.uml_diagram import UmlDiagramApprove, UmlDiagramUpdate
from app.services.errors import (
    UmlDiagramNotApprovedError,
    UmlDiagramNotFoundError,
    UmlDiagramVersionConflictError,
    UmlLayoutRequiredError,
)
from app.uml.domain import ComponentSemanticModel, DfdSemanticModel
from app.uml.layout import LayoutModel


# Phase-10-6：削除(POST /diagramsはAI生成の受け付けに差し替え)
# async def _create_project(session: AsyncSession) -> Project:
#     user = User(email=f"owner-{uuid.uuid4()}@example.com", hashed_password="x")
#     session.add(user)
#     await session.flush()
#     project = Project(user_id=user.id, title="備品予約システム")
#     session.add(project)
#     await session.flush()
#     return project
#
#
# async def test_create_diagram_returns_draft_with_empty_model(db_session: AsyncSession) -> None:
#     project = await _create_project(db_session)
#
#     result = await create_diagram(UmlDiagramCreate(notation="component"), db_session, project)
#
#     assert result.status == "draft"
#     assert result.version == 1
#     assert isinstance(result.semantic_model, ComponentSemanticModel)


async def test_get_diagram_raises_not_found_for_other_project(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    other_project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")

    with pytest.raises(UmlDiagramNotFoundError):
        await get_diagram(created.id, db_session, other_project)


async def test_update_diagram_increments_version(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    new_model = ComponentSemanticModel.model_validate(
        {"elements": [{"id": "c1", "name": "auth"}], "relations": []}
    )

    result = await update_diagram(
        created.id, UmlDiagramUpdate(version=1, semantic_model=new_model), db_session, project
    )

    assert result.version == 2
    assert len(result.semantic_model.elements) == 1


# Phase-11-1:追記
async def test_update_diagram_passes_layout_model_to_service(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    new_model = ComponentSemanticModel.model_validate(
        {"elements": [{"id": "c1", "name": "auth"}], "relations": []}
    )
    layout = LayoutModel.model_validate(
        {
            "width": 200,
            "height": 100,
            "nodes": {"c1": {"x": 40, "y": 20, "w": 100, "h": 40, "lane": 0, "row": 0}},
            "edges": {},
            "metrics": {"crossings": 0, "overlaps": 0, "collisions": 0},
        }
    )

    result = await update_diagram(
        created.id,
        UmlDiagramUpdate(version=1, semantic_model=new_model, layout_model=layout),
        db_session,
        project,
    )

    assert result.version == 2
    assert result.layout_model is not None
    assert result.layout_model.nodes["c1"].x == 40


async def test_update_diagram_raises_conflict_on_stale_version(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    new_model = ComponentSemanticModel.model_validate({"elements": [], "relations": []})

    with pytest.raises(UmlDiagramVersionConflictError):
        await update_diagram(
            created.id, UmlDiagramUpdate(version=999, semantic_model=new_model), db_session, project
        )


async def test_update_diagram_raises_bad_request_on_notation_mismatch(
    db_session: AsyncSession,
) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    dfd_model = DfdSemanticModel.model_validate({"elements": [], "relations": []})

    with pytest.raises(BadRequestError):
        await update_diagram(
            created.id, UmlDiagramUpdate(version=1, semantic_model=dfd_model), db_session, project
        )


async def test_validate_diagram_returns_valid_result_for_empty_model(
    db_session: AsyncSession,
) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")

    result = await validate_diagram(created.id, db_session, project)

    assert result.is_valid


# Phase-9-5:追記
async def test_compute_diagram_layout_returns_layout_model(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    model = ComponentSemanticModel.model_validate(
        {
            "elements": [{"id": "c1", "name": "a"}, {"id": "c2", "name": "b"}],
            "relations": [{"id": "r1", "source_id": "c1", "target_id": "c2"}],
        }
    )
    await update_diagram(
        created.id, UmlDiagramUpdate(version=1, semantic_model=model), db_session, project
    )

    result = await compute_diagram_layout(created.id, db_session, project)

    assert result.layout_model is not None
    assert set(result.layout_model.nodes) == {"c1", "c2"}


# Phase-10-6:追記
# Phase-24：更新
# async def test_generate_diagrams_accepts_and_schedules_background_generation(
#     db_session: AsyncSession,
# ) -> None:
#     project = await create_project_with_internal_design(db_session)
#     background_tasks = BackgroundTasks()
#     payload = UmlGenerateRequest(
#         notation="dfd", subjects=[UmlSubjectSpec(subject="POST /api/v1/reservations")]
#     )
#
#     run = await generate_diagrams(payload, db_session, project, background_tasks)
#
#     assert run.status == "running"
#     assert run.results == []
#     assert len(background_tasks.tasks) == 1
#     task = background_tasks.tasks[0]
#     assert task.func is run_uml_generation
#     assert task.args == (project.id, run.id)
#
#
# async def test_list_diagrams_includes_generation_state(db_session: AsyncSession) -> None:
#     project = await create_project_with_internal_design(db_session)
#     await generate_diagrams(
#         UmlGenerateRequest(notation="component"), db_session, project, BackgroundTasks()
#     )
# ↓↓
async def test_list_diagrams_returns_project_diagrams(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    await create_empty_diagram(db_session, project.id, "component")

    diagrams = await list_diagrams(db_session, project)

    # Phase-24：更新
    # assert [(d.notation, d.subject, d.generation_status) for d in diagrams] == [
    #     ("component", "", "generating")
    # ]
    #
    #
    # async def test_list_generation_candidates_returns_dfd_subjects_and_er_tables(
    # db_session: AsyncSession,
    # ) -> None:
    # project = await create_project_with_internal_design(db_session)
    #
    # candidates = await list_generation_candidates(db_session, project)
    #
    # assert candidates.internal_design_version == 1
    # assert candidates.dfd_subjects[0].code == "DF-1"
    # assert candidates.er_tables == ["users", "reservations"]
    #
    #
    # async def test_list_generation_runs_returns_requested_history(db_session: AsyncSession) -> None:
    # project = await create_project_with_internal_design(db_session)
    # await generate_diagrams(
    #     UmlGenerateRequest(notation="component"), db_session, project, BackgroundTasks()
    # )
    #
    # runs = await list_generation_runs(db_session, project)
    #
    # assert len(runs) == 1
    # assert runs[0].notation == "component"
    # assert runs[0].status == "running"
    # ↓↓
    assert [(d.notation, d.generation_status) for d in diagrams] == [("component", "completed")]


# Phase-12-1:追記 ── 承認
async def test_approve_diagram_returns_approved_diagram(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")
    model = ComponentSemanticModel.model_validate(
        {
            "elements": [{"id": "c1", "name": "a"}, {"id": "c2", "name": "b"}],
            "relations": [{"id": "r1", "source_id": "c1", "target_id": "c2"}],
        }
    )
    await update_diagram(
        created.id, UmlDiagramUpdate(version=1, semantic_model=model), db_session, project
    )
    await compute_diagram_layout(created.id, db_session, project)

    result = await approve_diagram(created.id, UmlDiagramApprove(version=2), db_session, project)

    assert result.status == "approved"
    assert result.version == 2


async def test_approve_diagram_without_layout_is_bad_request(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")

    with pytest.raises(UmlLayoutRequiredError):
        await approve_diagram(created.id, UmlDiagramApprove(version=1), db_session, project)


# Phase-12-4:追記 ── 出力
async def _approved_diagram_id(db_session: AsyncSession, project) -> uuid.UUID:
    created = await create_empty_diagram(db_session, project.id, "component")
    model = ComponentSemanticModel.model_validate(
        {
            "elements": [{"id": "c1", "name": "認証API"}, {"id": "c2", "name": "認証サービス"}],
            "relations": [{"id": "r1", "source_id": "c1", "target_id": "c2"}],
        }
    )
    await update_diagram(
        created.id, UmlDiagramUpdate(version=1, semantic_model=model), db_session, project
    )
    await compute_diagram_layout(created.id, db_session, project)
    await approve_diagram(created.id, UmlDiagramApprove(version=2), db_session, project)
    return created.id


async def test_export_diagram_drawio_returns_attachment(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    diagram_id = await _approved_diagram_id(db_session, project)

    response = await export_diagram_drawio(diagram_id, db_session, project)

    assert response.media_type == "application/xml"
    assert response.headers["Content-Disposition"] == content_disposition("component.drawio")
    assert b"<mxfile" in response.body


async def test_export_diagram_svg_returns_svg(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    diagram_id = await _approved_diagram_id(db_session, project)

    response = await export_diagram_svg(diagram_id, db_session, project)

    assert response.media_type == "image/svg+xml"
    assert bytes(response.body).startswith(b"<svg")


async def test_export_diagram_rejects_unapproved_diagram(db_session: AsyncSession) -> None:
    project = await create_project(db_session)
    created = await create_empty_diagram(db_session, project.id, "component")

    with pytest.raises(UmlDiagramNotApprovedError):
        await export_diagram_svg(created.id, db_session, project)
