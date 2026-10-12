"""段階3・5 の件数を数える(Phase 49。Phase 48 の直しの効果)。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/stage7-effect/stage35.py <実行フォルダ> [...]

実行フォルダは drive.py の design が書き出したもの(`stages/stage1〜5.json`・`stages/diagrams.json`)。
外部の API・LLM は呼ばない。数えるもの:

- 段階3: DFD の書き込みの線(処理 → データストア)を処理ごとに。CRUD 図の補ったセル(`inferred`)と
  その文字。検証の `DFD_WRITE_INFERRED`・`DFD_WRITE_MISSING` の件数。読むだけの処理かどうかと、
  補った文字が正しいかは人が読む(処理の名前を並べて出す)。
- 段階5: シーケンス図の `MISSING_BRANCH_TARGET`(本体の`to_sequence`)、処理あたりの分岐の行の数と、
  分岐の行と直前の手順(置き場所が正しいかは人が読む)。
"""

import json
import sys
from pathlib import Path

from app.detailed_design.data_model import dfd_accesses, table_key
from app.detailed_design.procedure import ProcedureModel, number_steps
from app.detailed_design.sequence import module_dependencies, to_sequence
from app.detailed_design.structure import ModuleListModel


def load(run: Path, n: int) -> dict:
    return json.loads((run / "stages" / f"stage{n}.json").read_text())


def count(run: Path) -> tuple[dict, list[str]]:
    functions = {f["id"]: f["name"] for f in load(run, 1)["model"]["functions"]}
    diagrams = json.loads((run / "stages" / "diagrams.json").read_text())
    dfds = [d["semantic_model"] for d in diagrams if d["notation"] == "dfd" and d["semantic_model"]]
    writes: dict[str, list[str]] = {}
    for access in dfd_accesses(dfds):
        if access.kind == "write":
            writes.setdefault(access.function_id, []).append(access.table)
    stage3 = load(run, 3)
    cells = stage3["model"]["cells"]
    inferred = [c for c in cells if c.get("inferred")]
    codes3 = [i["code"] for i in stage3.get("issues") or []]

    stage5 = load(run, 5)
    procedures = ProcedureModel.model_validate(stage5["model"])
    deps = module_dependencies(ModuleListModel.model_validate(load(run, 4)["model"]))
    missing = [
        issue.step_id
        for p in procedures.procedures
        for issue in to_sequence(p, deps).issues
        if issue.code == "MISSING_BRANCH_TARGET"
    ]
    lines = [f"## {run.name}", "", "### 段階3", ""]
    for fid, name in functions.items():
        lines.append(f"- {fid} {name}: DFD の書き込み {', '.join(writes.get(fid, [])) or 'なし'}")
    lines.append("")
    lines.append(
        f"- CRUD のセル {len(cells)}、補ったセル {len(inferred)}"
        + "".join(
            f"\n  - {c['function_id']} {functions.get(c['function_id'], '')} × {c['table']} → {c['ops']}"
            for c in inferred
        )
    )
    lines.append(f"- 段階3の検証: {', '.join(codes3) or 'なし'}")
    # 逆向きの書き漏れ(49-2 で見つけた): CRUD に C/U/D があるのに、DFD にその書き込みの線が無い
    reverse = [
        c
        for c in cells
        if set(c.get("ops") or "") & set("CUD")
        and table_key(c["table"]) not in {table_key(t) for t in writes.get(c["function_id"], [])}
    ]
    lines.append(
        f"- CRUD に書き込みがあり DFD に線が無い(処理 × テーブル) {len(reverse)}"
        + "".join(f"\n  - {c['function_id']} × {c['table']} → {c['ops']}" for c in reverse)
    )
    lines += ["", "### 段階5", ""]
    branch_total = 0
    for p in procedures.procedures:
        numbers = number_steps(p.steps)
        branches = [(n, s) for n, s in zip(numbers, p.steps, strict=True) if s.is_branch]
        branch_total += len(branches)
        lines.append(f"- {p.function_id} {functions.get(p.function_id, '')}: 分岐の行 {len(branches)}")
        for n, s in branches:
            main = next(
                (m for m, t in zip(numbers, p.steps, strict=True) if m == n.rstrip("abcdefghij")),
                "",
            )
            parent = next(
                (t for m, t in zip(numbers, p.steps, strict=True) if m == main and not t.is_branch),
                None,
            )
            parent_text = f"{parent.action}({parent.branch})" if parent is not None else "?"
            lines.append(f"  - {n} {s.action} → {s.branch} / 直前の手順 {main}: {parent_text}")
    lines.append("")
    lines.append(
        f"- 処理 {len(procedures.procedures)}、分岐の行 {branch_total}"
        f"(処理あたり {branch_total / max(1, len(procedures.procedures)):.2f})"
    )
    lines.append(f"- MISSING_BRANCH_TARGET: {len(missing)} {', '.join(missing)}")
    lines.append(f"- 段階5の検証: {', '.join(i['code'] for i in stage5.get('issues') or []) or 'なし'}")
    summary = {
        "run": run.name,
        "dfd_write_inferred": codes3.count("DFD_WRITE_INFERRED"),
        "dfd_write_missing": codes3.count("DFD_WRITE_MISSING"),
        "inferred_cells": len(inferred),
        "crud_write_without_dfd": len(reverse),
        "procedures": len(procedures.procedures),
        "branch_rows": branch_total,
        "missing_branch_target": len(missing),
    }
    return summary, lines


def main() -> None:
    out_lines: list[str] = ["# 段階3・5 の件数", "", "`stage35.py` の出力(手で書き換えない)。", ""]
    summaries = []
    for arg in sys.argv[1:]:
        summary, lines = count(Path(arg))
        summaries.append(summary)
        out_lines += lines + [""]
    out_lines += ["## まとめ", "", "```json", json.dumps(summaries, ensure_ascii=False, indent=1), "```"]
    text = "\n".join(out_lines) + "\n"
    print(text)
    (Path(__file__).resolve().parent / "stage35.md").write_text(text)


if __name__ == "__main__":
    main()
