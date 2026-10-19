# 作成：Phase-82-1｜更新：Phase-83-1,85-2,86-3,86-4
# Phase-86-4：更新(docstring: 入れた束を CR と一緒に読む)
# Phase-86-3：更新(docstring: 結んだレビューの永続化と、CR と一緒に読むことを足した)
# Phase-85-2：更新(docstring: add_event の refs を足した)
# Phase-86-3:追記 ── app.models.change_request.ChangeRequestReview, app.models.review.ReviewRun
import uuid
from collections.abc import Collection
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.change_request import ChangeRequest, ChangeRequestEvent, ChangeRequestReview
from app.models.review import ReviewRun
from app.repositories.base import CRUDRepository


class ChangeRequestRepository(CRUDRepository[ChangeRequest]):
    """変更要求(CR)と時系列・結んだレビューの永続化。時系列・基準の束・入れた束・結んだレビュー
    (回と指摘)は CR と一緒に読む(selectinload)。
    状態を変えるのはサービスで、ここは行の作成・時系列の追記・読み出しを持つ。"""

    model = ChangeRequest

    def _default_options(self) -> tuple[Any, ...]:
        # Phase-86-3：更新
        # return (selectinload(ChangeRequest.events), selectinload(ChangeRequest.baseline))
        # ↓↓
        return (
            selectinload(ChangeRequest.events),
            selectinload(ChangeRequest.baseline),
            # Phase-86-4:追記
            selectinload(ChangeRequest.included_baseline),
            # Phase-86-3:追記
            selectinload(ChangeRequest.reviews)
            .selectinload(ChangeRequestReview.review_run)
            .selectinload(ReviewRun.findings),
        )

    async def next_number(self, project_id: uuid.UUID) -> int:
        """プロジェクトの次の番号(最初は1)。"""
        stmt = select(func.max(ChangeRequest.number)).where(
            ChangeRequest.project_id == project_id
        )
        current = (await self._session.execute(stmt)).scalar_one_or_none()
        return (current or 0) + 1

    async def create(
        self,
        *,
        project_id: uuid.UUID,
        number: int,
        baseline_id: uuid.UUID,
        title: str,
        content: str,
        background_source: str,
        status: str,
        action: str,
        background_date: date | None = None,
        background_memo: str = "",
        # Phase-83-1：更新
        # target_requirement_ids: list[str] | None = None,
        # ↓↓
        targets: list[dict] | None = None,
        adds_requirement: bool = False,
        derived_from_id: uuid.UUID | None = None,
        created_by: uuid.UUID | None = None,
        note: str = "",
    ) -> ChangeRequest:
        """CR を作り、時系列の最初の行(`action`で`status`になった)を足す。flushまで行う。
        日時はアプリで入れる(作った CR をそのまま返すとき、読み直さずに日時を出せるように)。"""
        now = datetime.now(UTC)
        change_request = ChangeRequest(
            project_id=project_id,
            number=number,
            baseline_id=baseline_id,
            title=title,
            content=content,
            background_source=background_source,
            background_date=background_date,
            background_memo=background_memo,
            # Phase-83-1：更新
            # target_requirement_ids=list(target_requirement_ids or []),
            # ↓↓
            targets=list(targets or []),
            adds_requirement=adds_requirement,
            status=status,
            derived_from_id=derived_from_id,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            # Phase-86-3:追記
            reviews=[],
            # Phase-86-4:追記
            included_baseline=None,
            events=[
                ChangeRequestEvent(
                    position=0,
                    action=action,
                    from_status=None,
                    to_status=status,
                    occurred_at=now,
                    actor_id=created_by,
                    note=note,
                )
            ],
        )
        self._session.add(change_request)
        await self._session.flush()
        return change_request

    async def add_event(
        self,
        change_request: ChangeRequest,
        *,
        action: str,
        to_status: str,
        actor_id: uuid.UUID | None = None,
        note: str = "",
        # Phase-85-2:追記
        refs: dict | None = None,
    ) -> ChangeRequestEvent:
        """時系列に1行足し、CR の状態と更新日時をそろえる。`refs`は行が指すもの(作った版など)。
        時系列は読み込み済みであること(このリポジトリで読んだ CR は常に読み込み済み)。flushまで
        行う。"""
        now = datetime.now(UTC)
        event = ChangeRequestEvent(
            position=len(change_request.events),
            action=action,
            from_status=change_request.status,
            to_status=to_status,
            occurred_at=now,
            actor_id=actor_id,
            note=note,
            # Phase-85-2:追記
            refs=refs,
        )
        change_request.events.append(event)
        change_request.status = to_status
        change_request.updated_at = now
        await self._session.flush()
        return event

    # Phase-86-3:追記
    async def link_review(
        self, change_request: ChangeRequest, run: ReviewRun, *, linked_by: uuid.UUID | None
    ) -> ChangeRequestReview:
        """CR にレビューの回を結ぶ。結んだレビューは読み込み済みであること。flushまで行う。"""
        link = ChangeRequestReview(
            review_run_id=run.id,
            review_run=run,
            linked_by=linked_by,
            linked_at=datetime.now(UTC),
        )
        change_request.reviews.append(link)
        await self._session.flush()
        return link

    async def list_for_project(self, project_id: uuid.UUID) -> list[ChangeRequest]:
        """プロジェクトの CR を新しい順に返す(時系列付き)。"""
        return await self.list_all(order_by=ChangeRequest.number.desc(), project_id=project_id)

    async def get_by_number(self, *, project_id: uuid.UUID, number: int) -> ChangeRequest | None:
        """プロジェクトの番号の CR(時系列付き)。無ければ None。"""
        return await self.find_one(project_id=project_id, number=number)

    async def list_by_statuses(
        self, project_id: uuid.UUID, statuses: Collection[str]
    ) -> list[ChangeRequest]:
        """プロジェクトの、状態が`statuses`のどれかの CR(番号の順)。重なりの候補を読むため。"""
        stmt = (
            select(ChangeRequest)
            .where(ChangeRequest.project_id == project_id, ChangeRequest.status.in_(statuses))
            .order_by(ChangeRequest.number)
            .options(*self._default_options())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def find_derived(self, change_request_id: uuid.UUID) -> list[ChangeRequest]:
        """この CR を写して作った CR(番号の順)。"""
        return await self.list_all(
            order_by=ChangeRequest.number, derived_from_id=change_request_id
        )
