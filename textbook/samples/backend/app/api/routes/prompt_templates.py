# 作成：Phase-6-3｜更新：Phase-8-5
# 写経レベル: 定型 ── users.pyと同型の薄いGET一覧ルート。
# Phase-8-5：更新(ルーターがRepositoryを直接参照しない方針へ統一。app.services.prompt_template
#   新設に伴いPromptTemplateRepositoryの直接importを削除)
# from app.repositories.prompt_template import PromptTemplateRepository
# ↓↓
from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.prompt_template import PromptTemplateRead
from app.services.prompt_template import PromptTemplateService

router = APIRouter(prefix="/prompt-templates", tags=["prompt-templates"])


@router.get("", response_model=list[PromptTemplateRead])
async def list_prompt_templates(
    session: SessionDep, current_user: CurrentUserDep
) -> list[PromptTemplateRead]:
    """選択可能なプロンプトテンプレート一覧(固定シードデータ)を取得する。
    プロジェクトに紐づかない一覧のため、CurrentProjectDepではなくCurrentUserDepのみで認証する。"""
    # Phase-8-5：更新(ルーターがRepositoryを直接参照しない方針へ統一)
    # templates = await PromptTemplateRepository(session).list_all_templates()
    # ↓↓
    templates = await PromptTemplateService(session).list_all()
    return [PromptTemplateRead.model_validate(t) for t in templates]
