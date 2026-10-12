"""ステージ6の効果測定の1回目のプロジェクトの model を、ローカル DB から JSON に書き出す(一度だけ)。

stage6-effect の生成物(md と段階の JSON)には文書の model が無いため、文書から始まるシナリオを
実装の方式で測るのに使う。書き出した data/*.json を measure.py が読む(以後 DB は要らない)。

    python3 appendix/stage7-effect/impact/export_models.py

- 段階の model・文書の model(版の最新)・段階3の ER の意味モデルを、読むだけで取る。
- 段階7・8 は Phase 42 の移行で単位のキー(U-001…)が付いた後の形。それ以外は stage6-effect の
  JSON と同じ中身(measure.py が突き合わせて確かめる)。
"""

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = HERE.parent.parent / "stage6-effect" / "state.json"
CONTAINER = "devex-api-postgres-1"


def query(sql: str):
    out = subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER,
            "psql",
            "-U",
            "devex-user",
            "-d",
            "devex-app-db",
            "-At",
            "-c",
            sql,
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return json.loads(out) if out else None


def export(project_id: str) -> dict:
    stages = query(
        f"select json_object_agg(stage, model) from design_stages where project_id = '{project_id}'"
    )
    documents = query(
        "select json_object_agg(doc_type, model) from ("
        " select distinct on (doc_type) doc_type, model from generated_documents"
        f" where project_id = '{project_id}' order by doc_type, version desc) d"
    )
    er = query(
        "select semantic_model from uml_diagrams "
        f"where project_id = '{project_id}' and notation = 'er' and subject = ''"
    )
    return {
        "project_id": project_id,
        "stages": stages or {},
        "documents": documents or {},
        "er": er,
    }


def main() -> None:
    state = json.loads(STATE.read_text())
    for mode in ("detailed", "simple"):
        data = export(state[f"run1_{mode}"])
        path = HERE / "data" / f"{mode}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
        print(
            path.name, sorted(data["stages"]), sorted(k for k, v in data["documents"].items() if v)
        )


if __name__ == "__main__":
    main()
