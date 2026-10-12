"""再生成の実際の印を、正解と比べて数える(Phase 49-2)。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/stage7-effect/regen.py <実行フォルダ> [--export]

- `<実行フォルダ>/regen/impact.json`(drive.py impact)の印を、`regen/truth.md` の表の正解と比べる。
- 過剰を「意図した変更から届いた印」と「揺れ(頼んでいない変わったもの)からだけ届いた印」に分ける。
  意図した変更は、truth.md の「意図した変更」の行に書いた要素のキー(例: req:FR-005)。
  本体と同じ要素・たどり方(`build_elements`/`build_simple_elements` → `marks_for`)を、意図した
  変更だけに当てて求める。
- 「今の本体で求め直した印」: 版1・版2 の文書の model の差分(`diff_elements`)から、今の本体の
  たどり方で印を求め直したもの(サーバーが記録した印は、再生成した時点の本体のもの)。Phase 49 で
  たどり方・要素の内容を直した後に、同じ生成物で効果を確かめるために足した。
- `--export` を付けると、ローカル DB から文書の版1・版2 の model を `regen/documents_v<n>.json` に
  書き出す(一度だけ)。
"""

import json
import re
import subprocess
import sys
from pathlib import Path

from app.detailed_design.data_model import er_table_definitions
from app.detailed_design.impact import (
    DOCUMENT_STAGE,
    DesignModels,
    ElementChange,
    SimpleModels,
    build_elements,
    build_simple_elements,
    diff_elements,
    marks_for,
)

HERE = Path(__file__).resolve().parent
KEY = re.compile(r"^\|\s*([a-z]+:[^|]+?)\s*\|", re.M)
INTENDED = re.compile(r"^- 意図した変更: (.+)$", re.M)


def export(run: Path) -> None:
    pid = json.loads((HERE / "state.json").read_text())[f"project_{run.name}"]
    for version in (1, 2):
        sql = (
            "select json_object_agg(doc_type, model) from generated_documents "
            f"where project_id = '{pid}' and version = {version}"
        )
        out = subprocess.run(
            ["docker", "exec", "devex-api-postgres-1", "psql", "-U", "devex-user",
             "-d", "devex-app-db", "-At", "-c", sql],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        (run / "regen" / f"documents_v{version}.json").write_text(out + "\n")


def elements(run: Path, documents: dict) -> list:
    stages = {
        n: json.loads(p.read_text())["model"]
        for n in range(1, 9)
        if (p := run / "stages" / f"stage{n}.json").exists()
    }
    if run.name.startswith("simple"):
        return build_simple_elements(SimpleModels.from_dicts(stages.get(8), documents))
    diagrams = json.loads((run / "stages" / "diagrams.json").read_text())
    er = next((d["semantic_model"] for d in diagrams if d["notation"] == "er"), None)
    return build_elements(DesignModels.from_dicts(stages, documents, er_table_definitions(er)))


def main() -> None:
    run = Path(sys.argv[1])
    if "--export" in sys.argv:
        export(run)
    truth_md = (run / "regen" / "truth.md").read_text()
    truth = set(KEY.findall(truth_md))
    intended = [k.strip() for k in INTENDED.search(truth_md).group(1).split(",")]
    impact = json.loads((run / "regen" / "impact.json").read_text())
    marks = {m["key"] for st in impact["stages"] for m in st.get("marks") or []}
    changes = {c["key"] for st in impact["stages"] for c in st.get("changes") or []}

    before = elements(run, json.loads((run / "regen" / "documents_v1.json").read_text()))
    after = elements(run, json.loads((run / "regen" / "documents_v2.json").read_text()))
    by_key = {e.key: e for e in before}
    only_intended = [
        ElementChange(k, "content", DOCUMENT_STAGE, by_key[k].label) for k in intended
    ]
    intended_marks = {m.key for m in marks_for(before, after, only_intended, "doc")}

    doc_changes = diff_elements(before, after, stages=[DOCUMENT_STAGE])
    now_marks = {m.key for m in marks_for(before, after, doc_changes, "doc")}
    now_changes = sorted(c.key for c in doc_changes)

    over = marks - truth
    lines = [
        f"## {run.name} の再生成の印",
        "",
        f"- 変わったもの {len(changes)}(意図した変更 {', '.join(intended)}、"
        f"揺れ {len(changes - set(intended))}: {', '.join(sorted(changes - set(intended)))})",
        f"- 印 {len(marks)} / 正解 {len(truth)} / 当たり {len(marks & truth)} / "
        f"過剰 {len(over)} / 見落とし {len(truth - marks)} {', '.join(sorted(truth - marks))}",
        f"- 意図した変更だけを当てたときの印 {len(intended_marks)}"
        f"(当たり {len(intended_marks & truth)}・過剰 {len(intended_marks - truth)}: "
        f"{', '.join(sorted(intended_marks - truth))})",
        f"- 揺れからだけ届いた印 {len(marks - intended_marks)}",
        f"- 今の本体で求め直した印 {len(now_marks)}(当たり {len(now_marks & truth)}・"
        f"過剰 {len(now_marks - truth)}・見落とし {len(truth - now_marks)}。"
        f"変わったもの {len(now_changes)}: {', '.join(now_changes)})",
    ]
    text = "\n".join(lines) + "\n"
    print(text)
    (run / "regen" / "result.md").write_text(text)


if __name__ == "__main__":
    main()
