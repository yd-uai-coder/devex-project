"""ステージ12のベースライン(Phase 90-2): CR を渡さない再生成で、合意した行がどれだけ動くかを測る。

題材は開発環境のプロジェクト「トレンド追跡アプリ」(詳細設計モード。Phase 89-4 の実 LLM の一巡で、
CR-3 を反映した版 v5 が合意した状態)。再生成は利用者が画面で行う(LLM は Gemini 3.5 Flash-Lite)。
文書の版は巡回で消えるので、再生成のたびに `snapshot` で今の版を `data/` に書き出し、`report` は
書き出したものだけを読む(DB・LLM は使わない。同じ data からは同じ出力)。

    # 再生成の後に毎回(開発環境の postgres コンテナから読む)。起点の版は `snapshot 5` で書き出す
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/measure.py snapshot
    # 結果(stage12-baseline.md に写す)
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/measure.py report

`report` は起点の版(合意した版)と後の各版を比べ、次を出す。

1. 要件の行: 文の変化・出どころの変化・消えた行・増えた行。出どころの変化は、前の版の出どころに
   今の観点の状態で上限をかけ直した値(`cap_source`。行を写したときに本体がすること)と一致すれば
   「上限のかけ直しで説明できる」、違えば「それ以外(LLM の書き直し)」と分ける。LLM が同じ値を
   書き直した場合も前者に入る(文が同じなら区別できない)。
2. 利用者と使う場面(1.2)の行の変化。
3. 文書の要素(要件・画面・API)の差分(`diff_elements`)。
4. 段階に付いた印のうち、CR に結ばれないもの(出どころが `cr:` で始まらない)。
5. 推測の要件の数と、それが確認事項として出る場所(今はプレビューの一覧だけ)。
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from app.detailed_design.impact import DOCUMENT_STAGE, DesignModels, build_elements, diff_elements
from app.documents.requirements.assemble import cap_source
from app.hearing import PointState

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
PROJECT_ID = "7bbddf47-5f41-4642-b92e-522ebae50102"
START_VERSION = 5  # CR-3 を反映した版(合意した状態)
CONTAINER = "devex-api-postgres-1"
DB = ["-U", "devex-user", "-d", "devex-app-db"]

# 版を指定しないときは今の版と段階の印。指定したとき(起点の版を後から書き出す)は、その版の
# 文書だけ(段階の印はその時点のものが残っていないので null)。要件定義書と外部設計書は一度に
# 作り直すので、版の番号はそろう
SNAPSHOT_SQL = """
select json_build_object(
  'documents', (select json_object_agg(doc_type, json_build_object(
      'version', version, 'model', model, 'cr', change_request_id is not null,
      'generated_model', generated_model))
    from generated_documents g
    where project_id = '{project}' and doc_type in ('requirements', 'external_design')
      and version = {version}),
  'stages', {stages}
)
"""
LATEST = """(select max(version) from generated_documents
  where project_id = g.project_id and doc_type = g.doc_type)"""
STAGES = f"""(select json_object_agg(stage, json_build_object(
  'status', status, 'version', version, 'impact', impact))
  from design_stages where project_id = '{PROJECT_ID}')"""


def psql(sql: str) -> str:
    return subprocess.run(
        ["docker", "exec", CONTAINER, "psql", *DB, "-At", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def snapshot(version: str | None = None) -> None:
    sql = SNAPSHOT_SQL.format(
        project=PROJECT_ID,
        version=int(version) if version else LATEST,
        stages="null" if version else STAGES,
    )
    data = json.loads(psql(sql))
    version = data["documents"]["requirements"]["version"]
    DATA.mkdir(exist_ok=True)
    path = DATA / f"v{version}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(f"wrote {path.relative_to(HERE)}")


def load_snapshots() -> list[dict[str, Any]]:
    snaps = [json.loads(p.read_text()) for p in DATA.glob("v*.json")]
    snaps.sort(key=lambda s: s["documents"]["requirements"]["version"])
    return snaps


def req_model(snap: dict[str, Any]) -> dict[str, Any]:
    return snap["documents"]["requirements"]["model"]


def states_of(model: dict[str, Any]) -> dict[str, PointState]:
    return {
        key: PointState(key=key, status=status, summary="")  # type: ignore[arg-type]
        for key, status in model.get("point_statuses", {}).items()
    }


def doc_elements(snap: dict[str, Any]) -> list:
    documents = {k: v["model"] for k, v in snap["documents"].items()}
    return [
        e
        for e in build_elements(DesignModels.from_dicts({}, documents))
        if e.stage == DOCUMENT_STAGE
    ]


def compare_rows(prev: dict[str, Any], cur: dict[str, Any]) -> dict[str, list[str]]:
    before = {r["id"]: r for r in prev["rows"]}
    after = {r["id"]: r for r in cur["rows"]}
    states = states_of(cur)
    out: dict[str, list[str]] = {"text": [], "cap": [], "llm": [], "gone": [], "new": []}
    for rid, row in after.items():
        old = before.get(rid)
        if old is None:
            out["new"].append(rid)
            continue
        if row["text"] != old["text"]:
            out["text"].append(rid)
        if row["source"] != old["source"]:
            capped = cap_source(old["source"], old["points"], states, kind=old["kind"])
            out["cap" if capped == row["source"] else "llm"].append(
                f"{rid}({old['source']}→{row['source']})"
            )
    out["gone"] = [rid for rid in before if rid not in after]
    return out


def unlinked_marks(snap: dict[str, Any]) -> list[str]:
    found = []
    for stage, row in sorted(snap["stages"].items(), key=lambda kv: int(kv[0])):
        for mark in (row.get("impact") or {}).get("marks", []):
            if not any(s.startswith("cr:") for s in mark["sources"]):
                found.append(f"段階{stage} {mark['key']}({','.join(mark['sources'])})")
    return found


def fmt(items: list[str]) -> str:
    return f"{len(items)}" + (f"({', '.join(items)})" if items else "")


def report() -> None:
    snaps = load_snapshots()
    start = next(s for s in snaps if s["documents"]["requirements"]["version"] == START_VERSION)
    later = [s for s in snaps if s["documents"]["requirements"]["version"] > START_VERSION]
    print(f"起点: 要件定義書 v{START_VERSION}(CR を反映した版)。後の版: "
          + ", ".join(f"v{s['documents']['requirements']['version']}" for s in later))
    print()
    print("## 1. 要件の行(起点との比較 / 直前の版との比較)")
    print()
    print(
        "| 版 | 比較 | 文の変化 | 出どころ: 上限のかけ直しで説明できる "
        "| 出どころ: それ以外(LLM) | 消えた行 | 増えた行 |"
    )
    print("|---|---|---|---|---|---|---|")
    prev = start
    for snap in later:
        v = snap["documents"]["requirements"]["version"]
        for label, base in (("起点", start), ("直前", prev)):
            d = compare_rows(req_model(base), req_model(snap))
            print(f"| v{v} | {label} | {fmt(d['text'])} | {fmt(d['cap'])} | {fmt(d['llm'])} "
                  f"| {fmt(d['gone'])} | {fmt(d['new'])} |")
        prev = snap
    print()
    print("## 2. 利用者と使う場面(1.2)")
    print()
    for snap in [start, *later]:
        m = req_model(snap)
        users = [f"{u['user']}:{u['source']}" for u in m.get("users", [])]
        print(f"- v{snap['documents']['requirements']['version']}: {len(users)}件 {users}")
    print()
    print("## 3. 文書の要素の差分(直前の版との比較。要件・画面・API)")
    print()
    prev = start
    for snap in later:
        changes = diff_elements(doc_elements(prev), doc_elements(snap), stages=(DOCUMENT_STAGE,))
        kinds: dict[str, int] = {}
        for c in changes:
            kinds[c.change] = kinds.get(c.change, 0) + 1
        keys = ", ".join(c.key for c in changes)
        print(f"- v{snap['documents']['requirements']['version']}: {len(changes)}件 {kinds} {keys}")
        prev = snap
    print()
    print("## 4. 段階の印のうち CR に結ばれないもの(各時点の全部)")
    print()
    for snap in [start, *later]:
        if snap["stages"] is None:
            continue
        print(f"- v{snap['documents']['requirements']['version']}: {fmt(unlinked_marks(snap))}")
    print()
    print("## 5. 推測の要件")
    print()
    for snap in [start, *later]:
        rows = req_model(snap)["rows"]
        assumed = [r["id"] for r in rows if r["source"] == "assumed"]
        print(f"- v{snap['documents']['requirements']['version']}: {len(assumed)} / {len(rows)} 行")


if __name__ == "__main__":
    if sys.argv[1] == "snapshot":
        snapshot(*sys.argv[2:3])
    else:
        report()
