"""59-6 の重複の確認: 同じプロジェクトの「直ったか」の判定を3つ並行に走らせ、記録が (指摘, 版) ごとに
1件になるかを見る(承認を続けたときと同じ形。Redis・DB は dev のもの)。"""

import asyncio
import sys
import uuid

from app.services.fix_check_service import run_fix_checks


async def main(project_id: str, user_id: str) -> None:
    await asyncio.gather(*(run_fix_checks(uuid.UUID(project_id), uuid.UUID(user_id)) for _ in range(3)))


asyncio.run(main(sys.argv[1], sys.argv[2]))
