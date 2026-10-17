"""Phase 71 の新しい警告を、保存済みの実行に当てて数える(LLM・DB は呼ばない)。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/stage8-effect/phase71/count.py [出力の md]

- `DFD_STORE_MISSING`: `stages/stage1〜3.json`・`stages/diagrams.json` がある実行に、本体の
  `validate_data_model` を当てる(DFD はすべて承認済みとして要約を作る。選んだグループは段階2のまま)。
- `GOAL_WITHOUT_TASK`: 段階7(`stages/stage7.json`)と、実装計画書の md(`parse_wbs` で読む)の
  マイルストーンに、本体の `uncovered_goal_terms` を当てる。

出力は引数の md(既定は同じフォルダの `count.md`)。手で書き換えない。
"""

import json
import sys
from pathlib import Path

from app.detailed_design.data_model import dfd_accesses
from app.detailed_design.plan import PlanModel, milestone_id
from app.detailed_design.plan_goal import uncovered_goal_terms
from app.detailed_design.simple_procedure import parse_wbs
from app.detailed_design.validation import (
    DfdDiagramSummary,
    ErDiagramSummary,
    StageSources,
    validate_data_model,
)

ROOT = Path(__file__).resolve().parents[2]
RUNS = [
    *sorted((ROOT / "stage7-effect" / "hearing").glob("*")),
    *sorted((ROOT / "stage8-effect" / "hearing").glob("*")),
    *sorted((ROOT / "stage8-effect" / "phase59").glob("*")),
]


def _stage(run: Path, n: int) -> dict | None:
    path = run / "stages" / f"stage{n}.json"
    return json.loads(path.read_text())["model"] if path.exists() else None


def dfd_store_missing(run: Path) -> list[str] | None:
    stages = {n: _stage(run, n) for n in (1, 2, 3)}
    diagrams_path = run / "stages" / "diagrams.json"
    if any(v is None for v in stages.values()) or not diagrams_path.exists():
        return None
    diagrams = json.loads(diagrams_path.read_text())
    dfds: dict[str, DfdDiagramSummary] = {}
    tables: tuple[str, ...] = ()
    for d in diagrams:
        model = d.get("semantic_model") or {}
        if d["notation"] == "dfd":
            elements = model.get("elements", [])
            dfds[d["subject"]] = DfdDiagramSummary(
                "approved",
                "completed",
                tuple(str(e["id"]) for e in elements if e.get("element_type") == "process"),
                tuple(dfd_accesses([model])),
            )
        elif d["notation"] == "er":
            tables = tuple(e["name"] for e in model.get("elements", []))
    sources = StageSources(
        stages={n: v for n, v in stages.items() if v is not None},
        dfd_diagrams=dfds,
        er_diagram=ErDiagramSummary("approved", "completed", tables),
    )
    assert stages[3] is not None
    return [
        i.target or ""
        for i in validate_data_model(stages[3], sources)
        if i.code == "DFD_STORE_MISSING"
    ]


def goal_rows(plan: PlanModel) -> list[str]:
    return [
        f"{milestone_id(i)}({'・'.join(terms)}): {m.goal}"
        for i, m in enumerate(plan.milestones)
        if (terms := uncovered_goal_terms(m))
    ]


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("count.md")
    lines = ["# Phase 71 の新しい警告(保存済みの実行)", "", "`count.py` の出力(手で書き換えない)。", ""]
    lines += ["## DFD_STORE_MISSING(段階3)", ""]
    for run in RUNS:
        found = dfd_store_missing(run)
        if found is not None:
            name = run.relative_to(ROOT)
            lines.append(f"- {name}: {len(found)}" + "".join(f"\n  - {t}" for t in found))
    lines += ["", "## GOAL_WITHOUT_TASK(段階7・実装計画書)", ""]
    for path in sorted(ROOT.glob("**/stages/stage7.json")):
        plan = PlanModel.model_validate(json.loads(path.read_text())["model"])
        rows = goal_rows(plan)
        name = path.relative_to(ROOT)
        lines.append(f"- {name}: {len(rows)}/{len(plan.milestones)}" + "".join(f"\n  - {r}" for r in rows))
    for path in sorted(ROOT.glob("**/implementation_plan.md")):
        plan = parse_wbs(path.read_text()).plan
        rows = goal_rows(plan)
        name = path.relative_to(ROOT)
        lines.append(f"- {name}: {len(rows)}/{len(plan.milestones)}" + "".join(f"\n  - {r}" for r in rows))
    out.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
