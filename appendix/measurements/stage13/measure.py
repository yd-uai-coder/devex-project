"""ステージ13のベースライン(Phase 100-2): 説明書だけでクライアント役が合意・却下を判断できるか。

題材は開発環境のプロジェクト「トレンド追跡アプリ」(詳細設計モード)の CR-3・CR-4。今の Devex が
出力する説明書(ダウンロードと同じ md。確認済みで古くない要約があれば載る)を `data/` に書き出す。
読むだけで、DB は変えない。LLM も使わない。

本体のサービスを使うので、開発環境の backend コンテナの中で動かす(`/app` は devex-api/backend の
バインドマウント)。

    docker exec -i devex-api-backend-1 python - < appendix/measurements/stage13/measure.py \
        > appendix/measurements/stage13/data/explanations.json

出力は CR ごとの {number, status, title, output}。クライアント役の判断は `client.md` の規則で
Claude が行い、[stage13-baseline.md](../stage13-baseline.md) に記録する。
"""

import asyncio
import json
import sys
import uuid

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.models.project import Project
from app.services.change_request_service import ChangeRequestService

PROJECT_ID = uuid.UUID("7bbddf47-5f41-4642-b92e-522ebae50102")
NUMBERS = (3, 4)


async def main() -> None:
    engine.sync_engine.echo = False  # 開発環境の DEBUG の SQL の出力が標準出力に混ざらないように
    async with AsyncSessionLocal() as session:
        query = select(Project).where(Project.id == PROJECT_ID)
        project = (await session.execute(query)).scalar_one()
        service = ChangeRequestService(session)
        result = []
        for number in NUMBERS:
            view = await service.explanation(project, number)
            result.append(
                {
                    "number": number,
                    "status": view.change_request.status,
                    "title": view.change_request.title,
                    "output": view.output,
                }
            )
        await session.rollback()
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


asyncio.run(main())
