# 作成：Phase-2-3｜更新：Phase-2-4,2-5,6-1,6-3,6-6,8-5,12-4
# 写経レベル: 定型 ── ルーターは薄く保つ方針どおり、サービス呼び出し+スキーマ変換のみ。multipart/SSEの配線部分は各自コメントを参照。
# Phase-2-4:追記 ── BackgroundTasks, app.repositories.generated_document, app.schemas.document,
#                  app.services.doc_generator_service
# Phase-2-5:追記 ── uuid, urllib.parse.quote, fastapi.responses.Response, app.services.errors.DocumentNotFoundError
# Phase-6-1:追記 ── app.schemas.document.DocType, app.services.doc_generator_service.DocGeneratorService
# Phase-8-5：更新(「常にService経由、Repository直参照は層違反として禁止」という方針へ統一。
#   Repository4種・IntakeFileRead・DocumentNotFoundErrorへの直接importを削除し、
#   各Serviceの新設メソッド経由に置き換えた。詳細はPhase-8-5.md参照)
# from app.repositories.chat_history import ChatHistoryRepository
# from app.repositories.generated_document import GeneratedDocumentRepository
# from app.repositories.intake_file import IntakeFileRepository
# from app.repositories.project import ProjectRepository
# from app.schemas.project import IntakeFileRead, ProjectDetail, ProjectRead
# from app.services.errors import DocumentNotFoundError, GenerationFailedError, LLMQuotaExceededError
# ↓↓
# Phase-12-4：更新 ── urllib.parse.quote を削除し、app.api.responses.content_disposition を追記
#   (_content_disposition を UML 図の出力と共有するため app/api/responses.py へ移した)
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile, status
from fastapi.responses import Response, StreamingResponse

from app.api.deps import CurrentProjectDep, CurrentUserDep, SessionDep
from app.api.responses import content_disposition
from app.core.errors import BadRequestError
from app.schemas.document import DocType, GeneratedDocumentRead
from app.schemas.generation import HearingCompletionCheck
from app.schemas.hearing import ChatHistoryRead, HearingMessageRequest
from app.schemas.project import ProjectDetail, ProjectRead
from app.services.chat_service import ChatService
from app.services.doc_generator_service import DocGeneratorService, generate_documents
from app.services.errors import GenerationFailedError, LLMQuotaExceededError
from app.services.project import ProjectService, UploadedFileInput

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    session: SessionDep,
    current_user: CurrentUserDep,
    system_overview: Annotated[str, Form()],
    goals_raw: Annotated[str, Form()],
    notes_raw: Annotated[str | None, Form()] = None,
    environment: Annotated[str | None, Form()] = None,
    # Phase-6-3:追記 ── SCR-003で選択したテンプレートのID(任意)
    template_id: Annotated[uuid.UUID | None, Form()] = None,
    files: Annotated[list[UploadFile], File()] = [],
) -> ProjectRead:
    """初期ヒアリング入力(+添付ファイル最大3件、txt/md/pdfのみ)を受け取り、新規プロジェクトを作成する。"""
    intake: dict = {
        "system_overview": system_overview,
        "goals_raw": goals_raw,
        "notes_raw": notes_raw,
        "environment": _parse_environment(environment),
    }
    file_inputs = [
        UploadedFileInput(filename=f.filename or "unnamed", data=await f.read()) for f in files
    ]
    project = await ProjectService(session).create(
        user_id=current_user.id, intake=intake, files=file_inputs, template_id=template_id
    )
    try:
        await ChatService(session).generate_opening_reply(project)
    except (LLMQuotaExceededError, GenerationFailedError):
        # AIの最初の発話生成に失敗しても、プロジェクト作成自体は成功させる
        # (ユーザーは通常通りチャット欄から発話を始められる)
        pass
    return ProjectRead.model_validate(project)


@router.get("", response_model=list[ProjectRead])
async def list_projects(session: SessionDep, current_user: CurrentUserDep) -> list[ProjectRead]:
    """認証ユーザーのプロジェクト一覧を取得する。"""
    # Phase-8-5：更新(ルーターがRepositoryを直接参照しない方針へ統一)
    # projects = await ProjectRepository(session).list_for_user(current_user.id)
    # ↓↓
    projects = await ProjectService(session).list_for_user(current_user.id)
    return [ProjectRead.model_validate(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(session: SessionDep, current_project: CurrentProjectDep) -> ProjectDetail:
    """プロジェクトの詳細(初期ヒアリング入力・添付ファイルサマリを含む)を取得する。"""
    # Phase-8-5：更新(IntakeFileRepositoryの直接参照・ProjectDetailの組み立てを
    # ProjectService.get_detailへ集約)
    # intake_files = await IntakeFileRepository(session).list_for_project(current_project.id)
    # return ProjectDetail(
    #     id=current_project.id,
    #     title=current_project.title,
    #     status=current_project.status,  # type: ignore[arg-type]
    #     created_at=current_project.created_at,
    #     updated_at=current_project.updated_at,
    #     intake=current_project.intake,
    #     intake_files=[IntakeFileRead.model_validate(f) for f in intake_files],
    #     template_id=current_project.template_id,  # Phase-6-3:追記
    # )
    # ↓↓
    return await ProjectService(session).get_detail(current_project)


@router.post("/{project_id}/chat")
async def send_hearing_message(
    payload: HearingMessageRequest, session: SessionDep, current_project: CurrentProjectDep
) -> StreamingResponse:
    """ヒアリングチャットへメッセージを送信し、AI応答をSSE(Server-Sent Events)でストリーミング返却する。"""

    async def event_stream():
        async for chunk in ChatService(session).stream_reply(
            current_project, user_message=payload.message
        ):
            yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{project_id}/chat", response_model=list[ChatHistoryRead])
async def get_hearing_history(
    session: SessionDep, current_project: CurrentProjectDep
) -> list[ChatHistoryRead]:
    """プロジェクトのチャット履歴を取得する。"""
    # Phase-8-5：更新(ルーターがRepositoryを直接参照しない方針へ統一)
    # history = await ChatHistoryRepository(session).list_for_project(current_project.id)
    # ↓↓
    history = await ChatService(session).list_history(current_project.id)
    return [ChatHistoryRead.model_validate(entry) for entry in history]


# Phase-2-3:追記 ── check_completion自体はPhase-2-3で実装済みだったが、Phase 3-5
# 準備中の点検でこのルートが漏れていたことが判明したため、本来あるべき形として追記する
# (経緯はdecision-digest.md参照)。
@router.get("/{project_id}/hearing-completion", response_model=HearingCompletionCheck)
async def get_hearing_completion(
    session: SessionDep, current_project: CurrentProjectDep
) -> HearingCompletionCheck:
    """これまでの対話履歴から、ヒアリングが完了条件(5条件)を満たしたかどうかを判定する。
    is_sufficient=Trueでも生成へは自動で進まない(呼び出し側が構造化サマリを提示し、
    ユーザーの明示的な承認を得てから/generateを呼ぶ想定)。"""
    return await ChatService(session).check_completion(current_project)


# Phase-2-4：更新(所有者チェック無し専用メソッドを増やすのではなく、既存の所有者スコープ版
# get_by_idに統一する設計へ変更。理由はPhase-2-4.md「設計判断」参照)
# @router.post("/{project_id}/generate", status_code=status.HTTP_202_ACCEPTED)
# async def trigger_generation(
#     current_project: CurrentProjectDep, background_tasks: BackgroundTasks
# ) -> None:
#     """設計書4種の一括生成(+自己診断)をバックグラウンドでトリガーする。
#
#     project_idのみをbackground taskへ渡す(SessionDepのセッションはbackground task実行前に
#     クローズされるため、リクエストのセッションはそのまま渡さない。詳細は
#     doc_generator_service.generate_documentsのdocstring参照)。
#     """
#     background_tasks.add_task(generate_documents, current_project.id)
# ↓↓
@router.post("/{project_id}/generate", status_code=status.HTTP_202_ACCEPTED)
async def trigger_generation(
    current_project: CurrentProjectDep,
    current_user: CurrentUserDep,
    background_tasks: BackgroundTasks,
) -> None:
    """設計書4種の一括生成(+自己診断)をバックグラウンドでトリガーする。

    project_id・user_idの値のみをbackground taskへ渡す(SessionDepのセッションはbackground task
    実行前にクローズされるため、リクエストのセッションやORMオブジェクトはそのまま渡さない。詳細は
    doc_generator_service.generate_documentsのdocstring参照)。user_idも渡すのは、所有者チェック
    無しの専用メソッドを増やすのではなく、既存の所有者スコープ版get_by_idに統一するため。
    """
    background_tasks.add_task(generate_documents, current_project.id, current_user.id)


# Phase-2-4:追記
@router.get("/{project_id}/documents", response_model=list[GeneratedDocumentRead])
async def list_generated_documents(
    session: SessionDep, current_project: CurrentProjectDep
) -> list[GeneratedDocumentRead]:
    """生成された設計書(各doc_typeの現在表示中バージョンのみ)一覧を取得する。"""
    # Phase-6-6：更新(最新版ではなく表示中の版を返す。復元で表示中の版が最新版と異なりうるため)
    # documents = await GeneratedDocumentRepository(session).list_latest_for_project(
    #     current_project.id
    # )
    # ↓↓
    # Phase-8-5：更新(ルーターがRepositoryを直接参照しない方針へ統一)
    # documents = await GeneratedDocumentRepository(session).list_current_for_project(
    #     current_project.id
    # )
    # ↓↓
    documents = await DocGeneratorService(session).list_current_documents(current_project.id)
    return [GeneratedDocumentRead.model_validate(d) for d in documents]


# Phase-2-5:追記
@router.get("/{project_id}/documents/{doc_id}/download")
async def download_generated_document(
    doc_id: uuid.UUID, session: SessionDep, current_project: CurrentProjectDep
) -> Response:
    """指定したバージョンの設計書をMarkdownファイルとしてダウンロードする
    (docs/external_design.md 2.5節4項: 本リポジトリ`docs/`配下の実ファイル名
    `requirements.md`/`external_design.md`/`internal_design.md`/`implementation_plan.md`
    に合わせ`{document_type}.md`とする)。"""
    # Phase-8-5：更新(所有権チェックをDocGeneratorService.get_documentへ集約。ルーターが
    # Repositoryを直接参照しない方針へ統一)
    # document = await GeneratedDocumentRepository(session).get_by_id(doc_id)
    # if document is None or document.project_id != current_project.id:
    #     raise DocumentNotFoundError(f"Document {doc_id} not found")
    # ↓↓
    document = await DocGeneratorService(session).get_document(
        project=current_project, doc_id=doc_id
    )

    filename = f"{document.doc_type}.md"
    return Response(
        content=document.content,
        media_type="text/markdown",
        # Phase-12-4：更新
        # headers={"Content-Disposition": _content_disposition(filename)},
        # ↓↓
        headers={"Content-Disposition": content_disposition(filename)},
    )


# Phase-6-1:追記 ── SCR-006(バージョン履歴管理画面)向け
@router.get(
    "/{project_id}/documents/{doc_type}/versions", response_model=list[GeneratedDocumentRead]
)
async def list_document_versions(
    doc_type: DocType, session: SessionDep, current_project: CurrentProjectDep
) -> list[GeneratedDocumentRead]:
    """指定doc_typeの保管済み全バージョン(最大3件)を新しい順に取得する。"""
    versions = await DocGeneratorService(session).list_versions(current_project.id, doc_type)
    return [GeneratedDocumentRead.model_validate(v) for v in versions]


@router.post(
    "/{project_id}/documents/{doc_type}/versions/{version}/restore",
    response_model=GeneratedDocumentRead,
)
async def restore_document_version(
    doc_type: DocType, version: int, session: SessionDep, current_project: CurrentProjectDep
) -> GeneratedDocumentRead:
    """指定バージョンを表示中に切り替える(復元)。新しいバージョンは作らない(Phase-6-6：更新)。"""
    restored = await DocGeneratorService(session).restore_version(
        current_project.id, doc_type, version
    )
    return GeneratedDocumentRead.model_validate(restored)


# Phase-12-4：削除(app/api/responses.py の content_disposition へ移した)
# def _content_disposition(filename: str) -> str:
#     """日本語等の非ASCII文字を含むファイル名用のContent-Disposition値を組み立てる(RFC 5987)。
#     ASCII非対応のクライアント向けにfilename(置換フォールバック)とfilename*(UTF-8)の両方を含める。"""
#     ascii_fallback = filename.encode("ascii", errors="replace").decode("ascii")
#     return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _parse_environment(raw: str | None) -> dict | None:
    """environmentフォームフィールド(JSON文字列)をdictへ変換する。未入力ならNoneを返す。"""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise BadRequestError("environment must be a valid JSON object") from exc
