# 更新：Phase-2-3,6-3,8-4,15-2,52-5,67-3,79(完了後の調整),81-3,82-3,91-4,94-3,103-3,113-1
# Phase-2-3:追記 ── app.api.routes.projects
# Phase-6-3:追記 ── app.api.routes.prompt_templates
# Phase-8-4:追記 ── app.api.routes.uml
# Phase-15-2:追記 ── app.api.routes.design_stages
# Phase-52-5:追記 ── app.api.routes.reviews.reviews_router
# Phase-67-3:追記 ── app.api.routes.llm.llm_router
# Phase-79(完了後の調整)：削除 ── app.api.routes.chat.router(chat_router)
# Phase-81-3:追記 ── app.api.routes.baselines.router(baselines_router)
# Phase-82-3:追記 ── app.api.routes.change_requests.router(change_requests_router)
# Phase-91-4:追記 ── app.api.routes.agreements.router
# Phase-94-3:追記 ── app.api.routes.confirmations.router
# Phase-103-3:追記 ── app.api.routes.share.router
# Phase-113-1:追記 ── app.api.routes.materials.router
from fastapi import APIRouter

from app.api.routes.agreements import router as agreements_router
from app.api.routes.auth import router as auth_router
from app.api.routes.baselines import router as baselines_router
from app.api.routes.change_requests import router as change_requests_router
from app.api.routes.confirmations import router as confirmations_router
from app.api.routes.design_stages import router as design_stages_router
from app.api.routes.llm import router as llm_router
from app.api.routes.materials import router as materials_router
from app.api.routes.projects import router as projects_router
from app.api.routes.prompt_templates import router as prompt_templates_router
from app.api.routes.reviews import router as reviews_router
from app.api.routes.share import router as share_router
from app.api.routes.uml import router as uml_router
from app.api.routes.users import router as users_router

# 各機能別ルーターを1つのAPIRouterに集約し、main.pyから一括でincludeできるようにする
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
# Phase-79(完了後の調整)：削除
# api_router.include_router(chat_router)
# Phase-2-3:追記
api_router.include_router(projects_router)
# Phase-6-3:追記
api_router.include_router(prompt_templates_router)
# Phase-8-4:追記
api_router.include_router(uml_router)
# Phase-15-2:追記
api_router.include_router(design_stages_router)
# Phase-52-5:追記
api_router.include_router(reviews_router)
# Phase-81-3:追記
api_router.include_router(baselines_router)
# Phase-82-3:追記
api_router.include_router(change_requests_router)
# Phase-67-3:追記
# Phase-91-4:追記
api_router.include_router(agreements_router)
# Phase-94-3:追記
api_router.include_router(confirmations_router)
# Phase-113-1:追記
api_router.include_router(materials_router)
api_router.include_router(llm_router)
# Phase-103-3:追記
api_router.include_router(share_router)
