"""ステージ14のベースライン(Phase 111-2): 素朴なプロンプトの LLM は、資料から合意済みの内容と
違う点をどれだけ拾えるか。

題材は開発環境のプロジェクト「トレンド追跡アプリ」。合意済みの内容は、要件定義書・外部設計書の
最新の版(CR-6 を反映した v13。今の段階で束を作ればこの内容が入る)。資料は
議事録・メール・運用メモ(セット A は `materials-a/`、難しい資料のセット B は `materials-b/`)で、
仕込んだ違いは `answer.md` にある。DB は読むだけ(最後に `rollback`)。

本体のサービスを使うので、開発環境の backend コンテナの中で動かす(`/app` は devex-api/backend の
バインドマウント)。資料のフォルダはコンテナの `/tmp/` に写してから、その名前を引数で渡す。

    # 合意済みの内容の書き出し(LLM を使わない。決定的)
    docker exec -i devex-api-backend-1 python - export < appendix/measurements/stage14/measure.py \
        > appendix/measurements/stage14/data/agreed.md
    # 素朴なプロンプトで実 LLM を1回呼ぶ(利用者の生成の用途のモデル)
    docker cp appendix/measurements/stage14/materials-a devex-api-backend-1:/tmp/materials-a
    docker exec -i devex-api-backend-1 python - run materials-a \
        < appendix/measurements/stage14/measure.py \
        > appendix/measurements/stage14/data/baseline-a-run1.json

開発環境のログ(LLM の呼び出しの debug の1行)が標準出力の先頭に混ざるので、`run` の結果は
`---JSON---` の行の後だけを読む。`run` の出力は
{provider, model, usage, prompt_chars, materials, output}。拾い漏れと誤りは、Claude が
`answer.md` の数え方で数え、[stage14-baseline.md](../stage14-baseline.md) に記録する。

効果測定(Phase 117-1)は、同じ資料をステージ14 の取り込み(資料 → 違いの取り出し)に通す。
`baseline` は束 B-7 を作って鮮度を出し(LLM なし。1回だけ)、`effect <フォルダ> <回>` は、
フォルダの資料ごとに、題材に同じ題の資料が無ければ足し(あれば使い回す)、最新の束と比べて
違いを取り出す(実 LLM。資料ごとに1回。前の回の未確認の違いは置き換わる)。弾かれなかった
追加・変更・削除からは、資料ごとに CR の下書きを作れるかを確かめ、作った CR は rollback で
戻す(題材の CR の番号を乱さない)。結果は [stage14-effect.md](../stage14-effect.md) に記録する。

    docker exec -i devex-api-backend-1 python - baseline < appendix/measurements/stage14/measure.py
    docker cp appendix/measurements/stage14/materials-a devex-api-backend-1:/tmp/materials-a
    docker exec -i devex-api-backend-1 python - effect materials-a 1 \
        < appendix/measurements/stage14/measure.py \
        > appendix/measurements/stage14/data/effect-a-run1.json

`scale` は、題材の資料ごとに、残っている未確認の追加・変更・削除をすべて選んで CR の下書きを作り、
説明書の規模(種類ごとの数と状態)を書き出して rollback する(LLM なし。判断基準 5)。
"""

import asyncio
import dataclasses
import json
import sys
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

from langchain_core.callbacks import get_usage_metadata_callback
from langchain_core.messages import HumanMessage
from sqlalchemy import select

from app.ai.llm.catalog import Purpose
from app.ai.llm.content import extract_text_content
from app.core.database import AsyncSessionLocal, engine
from app.models.project import Project
from app.repositories.generated_document import GeneratedDocumentRepository
from app.schemas.baseline import BaselineCreate
from app.schemas.material import MaterialCreate
from app.services.baseline_service import BaselineService
from app.services.change_request_service import ChangeRequestService
from app.services.llm_resolver import LlmResolver
from app.services.llm_retry import invoke_with_retry
from app.services.material_difference_service import MaterialDifferenceService
from app.services.material_service import MaterialService

PROJECT_ID = uuid.UUID("7bbddf47-5f41-4642-b92e-522ebae50102")
DOC_TYPES = ("requirements", "external_design")
MATERIAL_LABELS = {"minutes.md": "議事録", "email.md": "メール", "memo.md": "運用メモ"}

# 効果測定で題材に足す資料(フォルダ → ファイル → 種類・題・日付)。セット B は Phase 114 で足した2件
MATERIAL_META = {
    "materials-a": {
        "minutes.md": ("minutes", "定例打ち合わせ 議事録(セット A)", date(2026, 11, 2)),
        "email.md": ("email", "背景解説の書き方について(セット A)", date(2026, 11, 5)),
        "memo.md": ("document", "運用メモ(セット A)", date(2026, 11, 6)),
    },
    "materials-b": {
        "minutes.md": ("minutes", "定例打ち合わせ 議事録(セット B)", date(2026, 11, 16)),
        "email.md": ("email", "外部向けの API について(セット B)", date(2026, 11, 18)),
    },
}
DRAFTABLE = ("add", "change", "delete")

# 素朴なプロンプト: 合意済みの内容と資料を渡し、違いを挙げさせるだけ(形・規則を決めない)
PROMPT = """以下は、クライアントと合意済みの要件定義書と外部設計書です。

{agreed}

その後に、次の資料を受け取りました。

{materials}

資料を読み、合意済みの内容と違う点をすべて挙げてください。各点について、種類(追加・変更・削除)、
対象(合意済みの内容の ID。新しいものなら「新規」)、内容、資料の根拠の引用を書いてください。"""


async def agreed_markdown(session) -> str:
    repo = GeneratedDocumentRepository(session)
    parts = []
    for doc_type in DOC_TYPES:
        document = await repo.get_latest(project_id=PROJECT_ID, doc_type=doc_type)
        assert document is not None, doc_type
        parts.append(document.content.strip())
    return "\n\n".join(parts) + "\n"


def materials_markdown(folder: Path) -> str:
    """資料のフォルダの md を、議事録・メール・運用メモの順に並べる。"""
    paths = sorted(folder.glob("*.md"), key=lambda p: list(MATERIAL_LABELS).index(p.name))
    return "\n\n".join(
        f"--- {MATERIAL_LABELS[p.name]}({p.name}) ---\n{p.read_text(encoding='utf-8').strip()}"
        for p in paths
    )


async def load_project(session) -> Project:
    return (await session.execute(select(Project).where(Project.id == PROJECT_ID))).scalar_one()


async def create_baseline() -> None:
    """束 B-7 を作り、鮮度を書き出す(段階は今の状態のまま写す)。"""
    async with AsyncSessionLocal() as session:
        project = await load_project(session)
        service = BaselineService(session)
        payload = BaselineCreate(
            counterpart="発注側の担当者(企画)",
            reason="Phase 117 の効果測定(CR-6 を反映した文書で、資料と比べる相手を新しくする)",
            agreed_at=datetime.now(UTC),
        )
        baseline = await service.create(project, payload, recorded_by=project.user_id)
        fresh = await service.freshness(project, baseline.number)
    out = {**dataclasses.asdict(fresh), "fresh": fresh.fresh}
    sys.stdout.write("---JSON---\n")
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2, default=str)
    sys.stdout.write("\n")


def read_folder(folder: Path) -> list[tuple[str, str]]:
    """資料のフォルダの (ファイル名, 本文)。議事録・メール・運用メモの順。"""
    paths = sorted(folder.glob("*.md"), key=lambda p: list(MATERIAL_LABELS).index(p.name))
    return [(p.name, p.read_text(encoding="utf-8")) for p in paths]


async def material_id_for(
    session, project: Project, folder: str, name: str, body: str
) -> uuid.UUID:
    """題が同じ資料があれば使い回し、無ければ貼り付けで足す(commit する)。"""
    kind, title, material_date = MATERIAL_META[folder][name]
    service = MaterialService(session)
    for summary in await service.list_for_project(project):
        if summary.material.title == title:
            return summary.material.id
    payload = MaterialCreate(kind=kind, title=title, material_date=material_date, body=body)
    view = await service.create_from_text(project, payload, created_by=project.user_id)
    return view.material.id


def difference_row(view) -> dict:
    d = view.difference
    return {
        "id": str(d.id),
        "kind": d.kind,
        "target_key": d.target_key,
        "origin_key": d.origin_key,
        "content": d.content,
        "quote": d.quote,
        "status": d.status,
        "reasons": d.reasons,
        "requirement_candidates": list(view.requirement_candidates),
    }


async def try_draft(session, project: Project, material_id: uuid.UUID, rows: list[dict]) -> dict:
    """弾かれなかった追加・変更・削除から CR の下書きを作れるかを確かめて、rollback で戻す。"""
    ids = [
        uuid.UUID(r["id"]) for r in rows if r["status"] == "unconfirmed" and r["kind"] in DRAFTABLE
    ]
    if not ids:
        return {"differences": 0}
    service = MaterialDifferenceService(session)
    real_commit = session.commit
    session.commit = session.flush  # 作った CR を確定させない(最後に rollback)
    try:
        cr = await service.create_change_request(
            project, material_id, ids, requirement_ids=None, created_by=project.user_id
        )
        result = {
            "differences": len(ids),
            "ok": True,
            "title": cr.change_request.title,
            "targets": cr.change_request.targets,
            "origins": list(cr.change_request.origins or []),
            "adds_requirement": cr.change_request.adds_requirement,
            "background_source": cr.change_request.background_source,
            "background_memo": cr.change_request.background_memo,
            "content": cr.change_request.content,
        }
    except Exception as exc:  # 組み立てられない理由をそのまま残す
        result = {"differences": len(ids), "ok": False, "error": f"{type(exc).__name__}: {exc}"}
    finally:
        await session.rollback()
        session.commit = real_commit
    return result


async def effect(folder: Path, run: int) -> None:
    """フォルダの資料ごとに違いを取り出し、一覧と下書きの確かめを書き出す。"""
    results = []
    for name, body in read_folder(folder):
        async with AsyncSessionLocal() as session:
            project = await load_project(session)
            material_id = await material_id_for(session, project, folder.name, name, body)
            service = MaterialDifferenceService(session)
            with get_usage_metadata_callback() as usage:
                view = await service.extract(project, material_id, user_id=project.user_id)
            rows = [difference_row(v) for v in view.differences]
            extraction = view.extraction
            results.append(
                {
                    "file": name,
                    "title": view.material.title,
                    "baseline_number": extraction.baseline_number if extraction else None,
                    "model": extraction.generated_model if extraction else None,
                    "fresh": (extraction.freshness or {}).get("fresh") if extraction else None,
                    "usage": usage.usage_metadata,
                    "differences": rows,
                    "draft": await try_draft(session, project, material_id, rows),
                }
            )
    sys.stdout.write("---JSON---\n")
    json.dump(
        {"materials": folder.name, "run": run, "results": results},
        sys.stdout,
        ensure_ascii=False,
        indent=2,
        default=str,
    )
    sys.stdout.write("\n")


async def draft_scales() -> None:
    """資料ごとに、未確認の追加・変更・削除から下書きを作って規模を数え、rollback で戻す。"""
    results = []
    async with AsyncSessionLocal() as session:
        project = await load_project(session)
        materials = [
            (v.material.id, v.material.title)
            for v in await MaterialService(session).list_for_project(project)
        ]
        for material_id, title in materials:
            project = await load_project(session)  # rollback で読み直す
            service = MaterialDifferenceService(session)
            view = await service.list_for(project, material_id)
            ids = [
                v.difference.id
                for v in view.differences
                if v.difference.status == "unconfirmed" and v.difference.kind in DRAFTABLE
            ]
            if not ids:
                results.append({"title": title, "differences": 0})
                continue
            real_commit = session.commit
            session.commit = session.flush  # 作った CR を確定させない(最後に rollback)
            try:
                cr = await service.create_change_request(
                    project, material_id, ids, requirement_ids=None, created_by=project.user_id
                )
                explanation = await ChangeRequestService(session).explanation(
                    project, cr.change_request.number
                )
                results.append(
                    {
                        "title": title,
                        "differences": len(ids),
                        "targets": [t["requirement_id"] for t in cr.change_request.targets],
                        "origins": [o["key"] for o in cr.change_request.origins or []],
                        "background_source": cr.change_request.background_source,
                        "scale": [
                            {
                                "kind": c.kind,
                                "count": len(c.names),
                                "state": c.state,
                                "uncountable": [r.code for r in c.uncountable],
                                "notes": [r.code for r in c.notes],
                            }
                            for c in explanation.explanation.scale.counts
                        ],
                    }
                )
            finally:
                await session.rollback()
                session.commit = real_commit
    sys.stdout.write("---JSON---\n")
    json.dump(results, sys.stdout, ensure_ascii=False, indent=2, default=str)
    sys.stdout.write("\n")


async def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "export"
    engine.sync_engine.echo = False  # 開発環境の DEBUG の SQL の出力が標準出力に混ざらないように
    if mode == "baseline":
        await create_baseline()
        return
    if mode == "scale":
        await draft_scales()
        return
    if mode == "effect":
        await effect(Path("/tmp") / sys.argv[2], int(sys.argv[3]))
        return
    async with AsyncSessionLocal() as session:
        agreed = await agreed_markdown(session)
        if mode == "export":
            sys.stdout.write(agreed)
            await session.rollback()
            return
        query = select(Project).where(Project.id == PROJECT_ID)
        project = (await session.execute(query)).scalar_one()
        resolved = await LlmResolver(session).resolve(project.user_id, Purpose.GENERATION)
        await session.rollback()
    folder = Path("/tmp") / sys.argv[2]
    prompt = PROMPT.format(agreed=agreed.strip(), materials=materials_markdown(folder))
    messages = [HumanMessage(content=prompt)]
    response = await invoke_with_retry(lambda: resolved.llm.ainvoke(messages), messages=messages)
    result = {
        "provider": str(resolved.provider),
        "model": resolved.model,
        "usage": getattr(response, "usage_metadata", None),
        "prompt_chars": len(prompt),
        "materials": folder.name,
        "output": extract_text_content(response.content),
    }
    sys.stdout.write("---JSON---\n")
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


asyncio.run(main())
