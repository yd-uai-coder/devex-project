# 更新：Phase-52-5
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 52 で初めて samples に載せた
# (全文。タグの無い部分はテンプレートのまま)。
# Phase-52-5:追記 ── app.api.deps.SessionDep
# Phase-52-5:追記 ── app.schemas.user.ReviewSettingsUpdate
# Phase-52-5:追記 ── app.services.user.UserService
from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.user import ReviewSettingsUpdate, UserRead
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUserDep) -> UserRead:
    """アクセストークンから解決した、現在ログイン中のユーザー情報を返す。"""
    return UserRead.model_validate(current_user)


# Phase-52-5:追記
@router.put("/me/review-settings", response_model=UserRead)
async def update_review_settings(
    body: ReviewSettingsUpdate, session: SessionDep, current_user: CurrentUserDep
) -> UserRead:
    """設計レビューのオン・オフを本人が切り替える(superuser 以外は403 REVIEW_NOT_ALLOWED)。"""
    user = await UserService(session).update_review_setting(
        current_user, enabled=body.review_enabled
    )
    return UserRead.model_validate(user)
