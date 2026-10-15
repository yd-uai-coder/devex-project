"""ステージ8の効果測定(Phase 58-3): dev の DB の実装手順書(段階8の model)に、今の決定的な検証を
流して、Phase 55 で足した4つの指摘を数える(読み取りだけ。トランザクションは rollback)。

実行(dev の DB はホストの 5432 に出ている。.env の host を localhost に読み替える):
    cd devex-api
    DATABASE_URL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/@postgres:/@localhost:/') \
        PYTHONPATH=backend uv run --project backend python ../appendix/stage8-effect/procedure_counts.py
"""

import asyncio
import json
from collections import Counter
from pathlib import Path

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.design_stage import DesignStage
from app.models.project import Project
from app.services.design_stage_service import DesignStageService

HERE = Path(__file__).resolve().parent
CODES = ("NO_TEST_FILE", "NO_SCHEMA_UNIT", "DEPENDENCY_BUILT_LATER", "TABLE_WITHOUT_UNIT")


async def main() -> None:
    rows = []
    async with AsyncSessionLocal() as session:
        projects = (
            await session.execute(
                select(Project, DesignStage.updated_at)
                .join(DesignStage, DesignStage.project_id == Project.id)
                .where(DesignStage.stage == 8, DesignStage.model.is_not(None))
                .order_by(DesignStage.updated_at)
            )
        ).all()
        for project, updated in projects:
            stages = await DesignStageService(session).list_stages(project)
            stage8 = next(s for s in stages if s.stage == 8)
            model = stage8.model or {}
            units = len(model.get("procedures") or model.get("units") or [])
            counts = Counter(i.code for i in stage8.issues or [] if i.code in CODES)
            rows.append(
                {
                    "project": str(project.id)[:8],
                    "mode": project.mode,
                    "updated": updated.isoformat(timespec="minutes"),
                    "units": units,
                    **{c: counts.get(c, 0) for c in CODES},
                }
            )
        await session.rollback()
    (HERE / "procedure_counts.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print("| プロジェクト | モード | 更新 | 単位 | " + " | ".join(CODES) + " |")
    print("|---" * (4 + len(CODES)) + "|")
    for r in rows:
        print(
            f"| {r['project']} | {r['mode']} | {r['updated']} | {r['units']} | "
            + " | ".join(str(r[c]) for c in CODES)
            + " |"
        )
    print("合計", {c: sum(r[c] for r in rows) for c in CODES}, "単位", sum(r["units"] for r in rows))


if __name__ == "__main__":
    asyncio.run(main())
