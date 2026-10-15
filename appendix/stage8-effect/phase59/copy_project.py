"""dev の DB のプロジェクトを丸ごと複製する(Phase 59 の効果の確認用。本体には入れない)。

プロジェクトと、project_id で結ばれた行(レビューの回の下の指摘・「直ったか」も)を新しい ID で
写す。JSON・本文の中の古い ID(観点の根拠の発言の ID・カードの ID など)も新しい ID に置き換える。

usage: DATABASE_URL=... python copy_project.py <project_id> <題名の末尾> [<持ち主の user_id>]
"""

import asyncio
import json
import os
import sys
import uuid

from sqlalchemy import MetaData, select
from sqlalchemy.ext.asyncio import create_async_engine

DIRECT = [
    "chat_histories",
    "data_items",
    "design_stages",
    "generated_documents",
    "hearing_points",
    "intake_files",
    "review_runs",
    "uml_diagrams",
    "uml_generation_runs",
]


def _replace(value, mapping: dict[str, str]):
    if isinstance(value, uuid.UUID):
        return uuid.UUID(mapping.get(str(value), str(value)))
    if isinstance(value, str):
        for old, new in mapping.items():
            if old in value:
                value = value.replace(old, new)
        return value
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False)
        return json.loads(_replace(text, mapping))
    return value


async def main(project_id: str, suffix: str, owner: str | None) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    meta = MetaData()
    async with engine.begin() as conn:
        await conn.run_sync(meta.reflect)
        t = meta.tables
        rows: dict[str, list[dict]] = {}
        project = (await conn.execute(select(t["projects"]).where(t["projects"].c.id == project_id))).mappings().one()
        rows["projects"] = [dict(project)]
        for name in DIRECT:
            rows[name] = [dict(r) for r in (await conn.execute(select(t[name]).where(t[name].c.project_id == project_id))).mappings()]
        run_ids = [r["id"] for r in rows["review_runs"]]
        rows["review_findings"] = [dict(r) for r in (await conn.execute(select(t["review_findings"]).where(t["review_findings"].c.run_id.in_(run_ids)))).mappings()] if run_ids else []
        finding_ids = [r["id"] for r in rows["review_findings"]]
        rows["review_fix_checks"] = [dict(r) for r in (await conn.execute(select(t["review_fix_checks"]).where(t["review_fix_checks"].c.finding_id.in_(finding_ids)))).mappings()] if finding_ids else []
        mapping: dict[str, str] = {}
        for name, items in rows.items():
            for r in items:
                if "id" in r and isinstance(r["id"], uuid.UUID):
                    mapping[str(r["id"])] = str(uuid.uuid4())
        new_project = mapping[str(project["id"])]
        for name in ["projects", *DIRECT, "review_findings", "review_fix_checks"]:
            for r in rows[name]:
                copied = {k: (_replace(v, mapping) if k != "user_id" and k != "template_id" else v) for k, v in r.items()}
                if name == "projects":
                    copied["title"] = f"{r['title']}{suffix}"
                    if owner:
                        copied["user_id"] = uuid.UUID(owner)
                await conn.execute(t[name].insert().values(**copied))
        print(new_project, {k: len(v) for k, v in rows.items()})
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
