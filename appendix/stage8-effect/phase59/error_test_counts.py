"""Phase 59 の効果の確認(59-6): dev の DB の簡易モードの実装手順書に、今の決定的な検証を流して
`NO_ERROR_TEST` を数え、出た単位のテスト観点と API のエラー欄を書き出す(読み取りだけ。rollback)。

実行: cd devex-api && DATABASE_URL=...(localhost) PYTHONPATH=backend \
    uv run --project backend python ../appendix/stage8-effect/phase59/error_test_counts.py
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.detailed_design.procedure_coverage import error_test_gap
from app.detailed_design.procedure_doc import ProcedureDocModel
from app.detailed_design.procedure_basis import procedure_basis
from app.detailed_design.simple_procedure import unit_error_statuses
from app.models.design_stage import DesignStage
from app.repositories.generated_document import DOC_TYPES_BY_MODE, GeneratedDocumentRepository
from app.models.project import Project
from app.services.design_stage_service import DesignStageService

HERE = Path(__file__).resolve().parent


async def main() -> None:
    rows, details = [], []
    async with AsyncSessionLocal() as session:
        projects = (
            await session.execute(
                select(Project, DesignStage.updated_at)
                .join(DesignStage, DesignStage.project_id == Project.id)
                .where(DesignStage.stage == 8, DesignStage.model.is_not(None), Project.mode == "simple")
                .order_by(DesignStage.updated_at)
            )
        ).all()
        for project, updated in projects:
            service = DesignStageService(session)
            stages = await service.list_stages(project)
            stage8 = next(s for s in stages if s.stage == 8)
            repo = GeneratedDocumentRepository(session)
            docs = {t: await repo.get_current(project_id=project.id, doc_type=t) for t in DOC_TYPES_BY_MODE["simple"]}
            texts = {t: d.content for t, d in docs.items() if d is not None}
            models = {t: d.model for t, d in docs.items() if d is not None and d.model}
            basis = procedure_basis("simple", {}, texts, models)
            parsed = ProcedureDocModel.model_validate(stage8.model or {})
            by_id = {u.unit_id: u for u in basis.units}
            feature = with_status = 0
            for doc in parsed.units:
                unit = by_id.get(doc.unit_id.strip())
                if unit is None or unit.task.kind != "feature":
                    continue
                feature += 1
                statuses = unit_error_statuses(unit.task, basis.book)
                with_status += bool(statuses)
                gap = error_test_gap(statuses, doc)
                if gap:
                    details.append({
                        "project": str(project.id)[:8], "unit": doc.unit_id, "statuses": statuses,
                        "tests": [t.viewpoint for t in doc.tests], "gwt": doc.gwt,
                    })
            count = sum(1 for i in stage8.issues or [] if i.code == "NO_ERROR_TEST")
            rows.append({"project": str(project.id)[:8], "title": project.title, "updated": updated.isoformat(timespec="minutes"),
                         "feature_units": feature, "with_status": with_status, "NO_ERROR_TEST": count})
        await session.rollback()
    out = HERE / "error_test_counts.json"
    out.write_text(json.dumps({"rows": rows, "details": details}, ensure_ascii=False, indent=2))
    print("| プロジェクト | 題名 | 更新 | 機能の単位 | エラー欄あり | NO_ERROR_TEST |")
    print("|---|---|---|---:|---:|---:|")
    for r in rows:
        print(f"| {r['project']} | {r['title'][:20]} | {r['updated']} | {r['feature_units']} | {r['with_status']} | {r['NO_ERROR_TEST']} |")
    print("合計", sum(r["NO_ERROR_TEST"] for r in rows), "/", sum(r["feature_units"] for r in rows), "エラー欄あり", sum(r["with_status"] for r in rows))


if __name__ == "__main__":
    asyncio.run(main())
