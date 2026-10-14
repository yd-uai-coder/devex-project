# 作成：Phase-34-1｜更新：Phase-36-2,54-4
# Phase-36-2:追記 ── collections.abc.Sequence, app.hearing(initial_states, to_state)
# Phase-54-4:追記 ── dataclasses.replace
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import replace

from app.hearing import PointState, initial_states, to_state
from app.models.hearing_point import HearingPoint
from app.repositories.base import CRUDRepository


class HearingPointRepository(CRUDRepository[HearingPoint]):
    """HearingPointモデルに対する永続化操作をまとめるリポジトリ。取り込みの規則・完了の判定は
    純粋関数(app/hearing/points.py)が担う。"""

    model = HearingPoint

    async def list_for_project(self, project_id: uuid.UUID) -> list[HearingPoint]:
        return await self.list_all(project_id=project_id)

    # Phase-36-2:追記
    async def load_states(self, project_id: uuid.UUID) -> dict[str, PointState]:
        """プロジェクトの観点の表(行の無い観点は未決)。"""
        return states_from_rows(await self.list_for_project(project_id))

    async def save_states(self, project_id: uuid.UUID, states: Iterable[PointState]) -> None:
        """観点の状態を、観点のキーで突き合わせて更新する(無い観点は行を足す)。flushまで行う。"""
        rows = {row.point_key: row for row in await self.list_for_project(project_id)}
        for state in states:
            row = rows.get(state.key)
            if row is None:
                row = HearingPoint(project_id=project_id, point_key=state.key)
                self._session.add(row)
            row.status = state.status
            row.summary = state.summary
            row.evidence = list(state.evidence)
            # Phase-54-4:追記
            row.reopened_after = state.reopened_after
        await self._session.flush()


# Phase-36-2:追記
def states_from_rows(rows: Sequence[HearingPoint]) -> dict[str, PointState]:
    """hearing_pointsの行を観点の表に直す(行の無い観点・知らないキーの行は除いて、未決で埋める)。"""
    states = initial_states()
    for row in rows:
        state = to_state(row.point_key, row.status, row.summary, row.evidence or ())
        if state is not None:
            # Phase-54-4：更新
            # states[state.key] = state
            # ↓↓
            states[state.key] = replace(state, reopened_after=row.reopened_after)
    return states
