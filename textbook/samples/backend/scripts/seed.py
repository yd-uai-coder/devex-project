# 更新：Phase-6-3,51-2,66-1,67-2
# 写経レベル: 定型 ── 既存のログインテストユーザー作成に、固定シードデータの投入を追加するのみ。
"""開発用のシードデータ ── `/docs` からログインを試すテストユーザー(一般・superuser)を作り、
用途ごとのモデルのシステムの既定値を `.env` のモデルで書く。
また、SCR-003(プロンプトテンプレート選択)向けの固定テンプレート2件を投入する。

使い方:
    uv run python -m scripts.seed
    # docker:
    docker compose run --rm backend uv run python -m scripts.seed

冪等 ── 既に居れば何もしない。既定のモデルは実行のたびに `.env` の値で上書きする
(`.env` が正)。**dev 専用**(本番 DB では実行しない)。
"""

from __future__ import annotations

# Phase-67-2:追記 ── app.core.config.settings, app.repositories.user_model_setting.UserModelSettingRepository, app.services.llm_defaults.env_default_models
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.prompt_template import PromptTemplate
from app.repositories.prompt_template import PromptTemplateRepository
from app.repositories.user_model_setting import UserModelSettingRepository
from app.services.errors import UserAlreadyExistsError
from app.services.llm_defaults import env_default_models
from app.services.user import UserService

# Phase-66-1：更新
# # ログインフォームに入れる固定ユーザー(full_name = 表示名。ログインは email + password)
# ↓↓
# ログインフォームに入れる固定ユーザー(user_name = ユーザーネーム。ログインは email + password)
SEED_USER = {
    # Phase-66-1：更新
    # "full_name": "sample-user",
    # ↓↓
    "user_name": "sample-user",
    "email": "example-user@example.com",
    "password": "Sample-user-0123",
}

# Phase-51-2:追記 ── superuser の固定ユーザー(本番の superuser は登録したアカウントを手で昇格させる)
# superuser(レビュー機能のオン・オフを切り替えられるアカウント)
SEED_SUPERUSER = {
    # Phase-66-1：更新
    # "full_name": "sample-super-user",
    # ↓↓
    "user_name": "sample-super-user",
    "email": "example-super-user@example.com",
    "password": "Sample-super-user-0123",
}

# Phase-6-3:追記 ── SCR-003向けの固定テンプレート(内部設計書3.2節⑤: CRUD機能は設けず固定シードデータのみ)
SEED_PROMPT_TEMPLATES = [
    {
        "name": "Webアプリケーション標準",
        "target_type": "SaaS・BtoC/BtoB Webサービス",
        "system_prompt": (
            "あなたは優秀なシステムアーキテクトです。一般的なWebアプリケーション"
            "(ブラウザから利用するSaaS/BtoC・BtoBサービス)を前提に、画面遷移・認証・"
            "権限設計の観点も含めてヒアリングを進めてください。"
        ),
        "default_environment": {
            "languages": ["TypeScript", "Python"],
            "frameworks": ["Next.js", "FastAPI"],
            "databases": ["PostgreSQL"],
            "deploy_targets": [],
        },
    },
    {
        "name": "API向け",
        "target_type": "バックエンドAPI・サービス間連携",
        "system_prompt": (
            "あなたは優秀なバックエンドアーキテクトです。画面を持たないAPI・"
            "サービス間連携を前提に、エンドポイント設計・認証方式・レート制限・"
            "外部システムとの連携方式の観点も含めてヒアリングを進めてください。"
        ),
        "default_environment": {
            "languages": ["Python"],
            "frameworks": ["FastAPI"],
            "databases": ["PostgreSQL"],
            "deploy_targets": [],
        },
    },
]


async def seed() -> None:
    # Phase-51-2：更新
    # """テストユーザーを1人登録し、固定プロンプトテンプレートを投入する(いずれも既存ならスキップ)。"""
    # ↓↓
    # Phase-67-2：更新
    # """テストユーザー(一般・superuser)を登録し、固定プロンプトテンプレートを投入する(いずれも既存ならスキップ)。"""
    # ↓↓
    """テストユーザー(一般・superuser)を登録し、固定プロンプトテンプレートを投入する
    (いずれも既存ならスキップ)。
    用途ごとのモデルの既定値は `.env` の値で書く(既存なら上書き)。"""
    async with AsyncSessionLocal() as session:
        # Phase-51-2：更新
        # await _seed_user(session)
        # ↓↓
        await seed_users(session)
        await seed_prompt_templates(session)
        # Phase-67-2:追記
        await seed_default_models(session)


# Phase-51-2：更新
# async def _seed_user(session: AsyncSession) -> None:
# ↓↓
async def seed_users(session: AsyncSession) -> None:
    """一般ユーザーと superuser を作る(email 一致で冪等判定。既存ユーザーの権限は変えない)。"""
    service = UserService(session)
    # Phase-51-2：更新
    # try:
    #     user = await service.create_user(
    #         email=SEED_USER["email"],
    #         password=SEED_USER["password"],
    #         full_name=SEED_USER["full_name"],
    #     )
    #     print(f"created user: {user.email} ({user.id})")
    # except UserAlreadyExistsError:
    #     print(f"user already exists: {SEED_USER['email']} (skip)")
    # ↓↓
    for data, is_superuser in ((SEED_USER, False), (SEED_SUPERUSER, True)):
        try:
            user = await service.create_user(
                email=data["email"],
                password=data["password"],
                # Phase-66-1：更新
                # full_name=data["full_name"],
                # ↓↓
                user_name=data["user_name"],
            )
        except UserAlreadyExistsError:
            print(f"user already exists: {data['email']} (skip)")
            continue
        if is_superuser:
            # 登録の経路(create_user)からは superuser を作れないため、作成後に昇格させる
            user.is_superuser = True
            await session.commit()
        print(f"created user: {user.email} ({user.id}, superuser={user.is_superuser})")


async def seed_prompt_templates(session: AsyncSession) -> None:
    """SEED_PROMPT_TEMPLATESの各テンプレートを、同名のものが無ければ作成する(name一致で冪等判定)。"""
    repo = PromptTemplateRepository(session)
    for data in SEED_PROMPT_TEMPLATES:
        existing = await repo.find_one(name=data["name"])
        if existing is not None:
            print(f"prompt template already exists: {data['name']} (skip)")
            continue
        template = PromptTemplate(**data)
        session.add(template)
        await session.flush()
        print(f"created prompt template: {template.name} ({template.id})")
    await session.commit()


# Phase-67-2:追記
async def seed_default_models(session: AsyncSession) -> None:
    """用途ごとのモデルのシステムの既定値(user_id が null の行)を、`.env` のモデルで書く。
    値は seed に書かず、設定から読む。既にある行は上書きする
    (`.env` を変えて流し直せば反映される)。"""
    repo = UserModelSettingRepository(session)
    for purpose, (provider, model) in env_default_models(settings).items():
        await repo.upsert_default(purpose=purpose, provider=provider, model=model)
        print(f"default model: {purpose} = {provider}/{model}")
    await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
