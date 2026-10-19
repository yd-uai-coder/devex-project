# 作成：Phase-2-1｜更新：Phase-2-4,6-3,15-1,64-1,65-1
# 写経レベル: 定型 ── ConversationRepositoryと同型のowner scoped CRUD。
# Phase-64-1:追記 ── datetime(UTC, datetime), sqlalchemy(delete, select)
# Phase-65-1:追記 ── collections.abc.Sequence, sqlalchemy.func
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import delete, func, select

from app.models.project import Project
from app.repositories.base import CRUDRepository


# Phase-65-1:追記
def _escape_like(text: str) -> str:
    """LIKE のワイルドカード(`%`・`_`)とエスケープの文字(`\\`)を、文字として一致させる形にする。"""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ProjectRepository(CRUDRepository[Project]):
    """Projectモデルに対する永続化操作をまとめるリポジトリ。"""

    model = Project

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        title: str,
        intake: dict | None = None,
        # Phase-6-3:追記 ── SCR-003で選択したテンプレートのID(任意)
        template_id: uuid.UUID | None = None,
        # Phase-15-1:追記
        mode: str = "simple",
    ) -> Project:
        """新規プロジェクトをセッションに追加し、flushしてIDを確定させた状態で返す。"""
        # Phase-15-1：更新
        # project = Project(user_id=user_id, title=title, intake=intake, template_id=template_id)
        # ↓↓
        project = Project(
            user_id=user_id, title=title, intake=intake, template_id=template_id, mode=mode
        )
        self._session.add(project)
        await self._session.flush()
        return project

    async def get_by_id(self, project_id: uuid.UUID, *, user_id: uuid.UUID) -> Project | None:
        # Phase-64-1：更新
        # """プロジェクトIDと所有者IDの両方が一致するプロジェクトのみを取得する(他ユーザーのプロジェクトは取得できない)。"""
        # return await self.find_one(id=project_id, user_id=user_id)
        # ↓↓
        """プロジェクトIDと所有者IDの両方が一致するプロジェクトのみを取得する(他ユーザーのプロジェクトは取得できない)。
        削除の印が付いたプロジェクトは取得しない。"""
        return await self.find_one(id=project_id, user_id=user_id, deleted_at=None)

    # Phase-65-1：更新
    # async def list_for_user(self, user_id: uuid.UUID) -> list[Project]:
    #     """指定ユーザーのプロジェクト一覧を更新日時の降順で取得する(削除の印が付いたものは除く)。"""
    #     return await self.list_all(
    #         order_by=Project.updated_at.desc(), user_id=user_id, deleted_at=None
    # ↓↓
    async def search_for_user(
        self,
        user_id: uuid.UUID,
        *,
        q: str | None = None,
        mode: str | None = None,
        statuses: Sequence[str] = (),
        offset: int = 0,
        limit: int | None = None,
    ) -> tuple[list[Project], int]:
        """指定ユーザーのプロジェクトを条件で絞り、更新日時の降順で1ページ分と、条件に合う全件数を返す
        (削除の印が付いたものは除く)。`q`はタイトルの部分一致(大文字・小文字を区別しない。
        `%`・`_`も文字として扱う)、`statuses`はどれかに一致(空なら絞らない)、条件どうしは AND。"""
        conditions = [Project.user_id == user_id, Project.deleted_at.is_(None)]
        if q:
            conditions.append(Project.title.ilike(f"%{_escape_like(q)}%", escape="\\"))
        if mode is not None:
            conditions.append(Project.mode == mode)
        if statuses:
            conditions.append(Project.status.in_(statuses))

        total_stmt = select(func.count()).select_from(Project).where(*conditions)
        total = (await self._session.execute(total_stmt)).scalar_one()
        # 更新日時が同じ行でもページの境目が揺れないよう、id でも並べる
        stmt = (
            select(Project)
            .where(*conditions)
            .order_by(Project.updated_at.desc(), Project.id.desc())
            .offset(offset)
            .limit(limit)
        )
        # Phase-65-1:追記
        items = list((await self._session.execute(stmt)).scalars())
        return items, total

    # Phase-64-1:追記
    async def mark_deleted(self, project: Project) -> None:
        """削除の印を付ける。印だけの更新なので、生成中のジョブが持つ外部キーのロックを待たない。"""
        project.deleted_at = datetime.now(UTC)
        await self._session.flush()

    async def is_live(self, project_id: uuid.UUID) -> bool:
        """プロジェクトの行があり、削除の印が無いか。identity map を使わずに DB へ問い合わせる
        (バックグラウンドの処理が、別のリクエストで消された・印が付いたことを見分けるため)。"""
        stmt = select(Project.id).where(Project.id == project_id, Project.deleted_at.is_(None))
        return (await self._session.execute(stmt)).scalar_one_or_none() is not None

    async def purge_deleted(self) -> int:
        """削除の印が付いた行を物理削除し、消した数を返す(子・孫の行は DB の CASCADE で消える)。
        ほかのトランザクションがロックしている行(生成中のジョブが子の行を書いた後など)は飛ばす。"""
        stmt = (
            select(Project.id)
            .where(Project.deleted_at.is_not(None))
            .with_for_update(skip_locked=True)
        )
        ids = list((await self._session.execute(stmt)).scalars())
        if ids:
            await self._session.execute(delete(Project).where(Project.id.in_(ids)))
        return len(ids)

    # Phase-2-4：削除(BackgroundTasksへuser_idも渡し、既存の所有者スコープ版get_by_idに統一する
    # 設計へ変更したため。「専用の所有者チェック無しメソッドを増やす」か「呼び出し側にuser_idを
    # 持たせて既存メソッドに統一する」かの比較検討の結果、後者を採用した。理由の詳細はPhase-02-4.md
    # 「設計判断」参照)
    # # Phase-2-4:追記
    # # BackgroundTasksから呼ばれるdoc_generator_service向けの追加。get_by_id は所有者スコープに
    # # override済みのため、所有権チェック不要な場面(HTTPリクエスト時に既にCurrentProjectDepで
    # # 検証済みのproject_idをBackgroundTaskへ渡す場合)向けに別名で用意する。
    # async def get_by_id_unscoped(self, project_id: uuid.UUID) -> Project | None:
    #     """所有者チェックを行わずIDのみでプロジェクトを取得する(CRUDRepository.get_by_idと同義)。"""
    #     return await self._session.get(self.model, project_id)
