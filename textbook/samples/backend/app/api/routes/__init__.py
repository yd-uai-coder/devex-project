# 更新：Phase-2-3,6-3,8-4
# Phase-2-3:追記 ── app.api.routes.projects
# Phase-6-3:追記 ── app.api.routes.prompt_templates
# Phase-8-4:追記 ── app.api.routes.uml
from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.projects import router as projects_router
from app.api.routes.prompt_templates import router as prompt_templates_router
from app.api.routes.uml import router as uml_router
from app.api.routes.users import router as users_router

# 各機能別ルーターを1つのAPIRouterに集約し、main.pyから一括でincludeできるようにする
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(chat_router)
# Phase-2-3:追記
api_router.include_router(projects_router)
# Phase-6-3:追記
api_router.include_router(prompt_templates_router)
# Phase-8-4:追記
api_router.include_router(uml_router)
