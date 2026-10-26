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
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

from langchain_core.messages import HumanMessage
from sqlalchemy import select

from app.ai.llm.catalog import Purpose
from app.ai.llm.content import extract_text_content
from app.core.database import AsyncSessionLocal, engine
from app.models.project import Project
from app.repositories.generated_document import GeneratedDocumentRepository
from app.services.llm_resolver import LlmResolver
from app.services.llm_retry import invoke_with_retry

PROJECT_ID = uuid.UUID("7bbddf47-5f41-4642-b92e-522ebae50102")
DOC_TYPES = ("requirements", "external_design")
MATERIAL_LABELS = {"minutes.md": "議事録", "email.md": "メール", "memo.md": "運用メモ"}

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


async def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "export"
    engine.sync_engine.echo = False  # 開発環境の DEBUG の SQL の出力が標準出力に混ざらないように
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
