# 作成：Phase-15-2｜更新：Phase-16-4,20-3,21-3,22-5,23-3,23-4
# 写経レベル: 定型 ── サービスを呼ぶだけの薄いルート。
# Phase-16-4:追記 ── fastapi.BackgroundTasks, fastapi.status, app.services.design_stage_generation_service.DesignStageGenerationService, app.services.design_stage_generation_service.run_design_stage_generation
# Phase-20-3:追記 ── app.schemas.design_stage.DesignStageGenerate
# Phase-22-5:追記 ── fastapi.responses.Response, app.api.responses.content_disposition,
#   app.services.detailed_design_export_service.DetailedDesignExportService
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, status
from fastapi.responses import Response

from app.api.deps import CurrentProjectDep, SessionDep
from app.api.responses import content_disposition
from app.schemas.design_stage import (
    DesignStageApprove,
    DesignStageGenerate,
    DesignStageRead,
    DesignStageSave,
)
from app.services.design_stage_generation_service import (
    DesignStageGenerationService,
    run_design_stage_generation,
)
from app.services.design_stage_service import DesignStageService
from app.services.detailed_design_export_service import DetailedDesignExportService

# UMLと同じく、プロジェクト配下の独立したサブツリーとしてprefixにproject_idを含める
router = APIRouter(prefix="/projects/{project_id}/design-stages", tags=["design-stages"])

StageNumber = Annotated[int, Path(ge=1, le=7, description="段階番号(1〜7)")]


@router.get("", response_model=list[DesignStageRead])
async def list_design_stages(
    session: SessionDep, current_project: CurrentProjectDep
) -> list[DesignStageRead]:
    # Phase-16-4：更新
    # """詳細設計モードの段階1〜7の状態を取得する(未着手の段階も含む)。"""
    # ↓↓
    """詳細設計モードの段階1〜7の状態を取得する(未着手の段階も含む)。画面は下書きの生成の完了を
    この一覧のポーリングで待つため、止まった生成(15分超)はここで回収してから返す。"""
    await DesignStageGenerationService(session).recover_stale(current_project.id)
    return await DesignStageService(session).list_stages(current_project)


# Phase-16-4:追記
# Phase-22-5:追記
@router.get("/document")
async def download_detailed_design(
    session: SessionDep, current_project: CurrentProjectDep
) -> Response:
    # Phase-23-3：更新(docstring: zip に実装計画が入る)
    """詳細設計書(HTML・md)と載せた図(SVG・draw.io)、実装計画(HTML・md。Phase 23)を zip で
    ダウンロードする(Phase 22)。
    いつでもダウンロードでき、承認していない段階の章は「未承認」になる。zip に入れた図は
    `exported`になる。簡易ドキュメントモードのプロジェクトは409。"""
    bundle = await DetailedDesignExportService(session).bundle(current_project)
    return Response(
        content=bundle.content,
        media_type=bundle.media_type,
        headers={"Content-Disposition": content_disposition(bundle.filename)},
    )


@router.post(
    "/{stage}/generate", response_model=DesignStageRead, status_code=status.HTTP_202_ACCEPTED
)
async def generate_design_stage(
    stage: StageNumber,
    session: SessionDep,
    current_project: CurrentProjectDep,
    background_tasks: BackgroundTasks,
    # Phase-20-3:追記
    payload: DesignStageGenerate | None = None,
) -> DesignStageRead:
    # Phase-23-4：更新(docstring: 段階7も生成できる)
    """段階のAIの下書きの生成を受け付け、バックグラウンドで実行する(Phase 23 で段階1〜7のすべて)。
    段階は「生成中」になり、終わると`completed`/`failed`になる。background taskには値だけを渡す
    (doc生成・UML図の生成と同じ理由)。段階5は、本文の`function_ids`で下書きを作る処理を選べる。
    段階6は、本文の`logics`で下書きを作る関数を選べる。"""
    # Phase-20-3：更新
    # accepted = await DesignStageGenerationService(session).request_generation(
    #     current_project, stage=stage
    # )
    # background_tasks.add_task(
    #     run_design_stage_generation, current_project.id, current_project.user_id, stage
    # )
    # ↓↓
    function_ids = payload.function_ids if payload is not None else None
    # Phase-21-3：更新(段階6の対象の関数を受け取り、受け付けと実行へ渡す)
    # accepted = await DesignStageGenerationService(session).request_generation(
    #     current_project, stage=stage, function_ids=function_ids
    # )
    # background_tasks.add_task(
    #     run_design_stage_generation,
    #     current_project.id,
    #     current_project.user_id,
    #     stage,
    #     function_ids,
    # )
    # ↓↓
    logics = (
        [(t.module, t.function) for t in payload.logics]
        if payload is not None and payload.logics is not None
        else None
    )
    accepted = await DesignStageGenerationService(session).request_generation(
        current_project, stage=stage, function_ids=function_ids, logics=logics
    )
    background_tasks.add_task(
        run_design_stage_generation,
        current_project.id,
        current_project.user_id,
        stage,
        function_ids,
        logics,
    )
    # ── ここから Phase-16-4 の作成分 ──
    return accepted


@router.put("/{stage}", response_model=DesignStageRead)
async def save_design_stage(
    stage: StageNumber,
    payload: DesignStageSave,
    session: SessionDep,
    current_project: CurrentProjectDep,
) -> DesignStageRead:
    """段階の内容を保存する(楽観ロック。承認済みの段階はレビュー中に戻る)。"""
    return await DesignStageService(session).save(
        current_project, stage=stage, expected_version=payload.version, model=payload.model
    )


@router.post("/{stage}/approve", response_model=DesignStageRead)
async def approve_design_stage(
    stage: StageNumber,
    payload: DesignStageApprove,
    session: SessionDep,
    current_project: CurrentProjectDep,
) -> DesignStageRead:
    """段階を承認する(古い段階は、内容を変えずに承認し直せる)。"""
    return await DesignStageService(session).approve(
        current_project, stage=stage, expected_version=payload.version
    )
