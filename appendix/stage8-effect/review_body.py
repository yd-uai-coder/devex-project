"""ステージ8の効果測定(Phase 58-1): 本体のレビュー(入力の組み立て・スキーマ・モデル)を、
51-1 のベースラインと同じ題材に流し、出力をそのまま残す。

題材の読み込み・決定的な検証(L0)は ../stage8-baseline/review.py を再利用し、指示・入力・構造化出力・
LLM は本体(app.review・get_review_llm・invoke_structured_with_usage)を使う。

実行(.env を読むため devex-api で):
    cd devex-api
    PYTHONPATH=backend:../appendix/stage8-baseline uv run --project backend \
        python ../appendix/stage8-effect/review_body.py documents --subjects simple detailed --runs 3
    ... review_body.py stage6 --subjects detailed-full --runs 3   (stage7 も同じ)

出力は runs/<区切り>/<題材>/r<n>.md と r<n>.json(トークン・キャッシュ・費用・時間・指摘)。
既にある r<n>.md は飛ばす。当たりの判定は人が行う(results.md)。
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

import review as baseline  # ../stage8-baseline/review.py
from app.ai.llm.claude import get_review_llm
from app.core.config import settings
from app.detailed_design.validation import StageSources, validate_stage
from app.hearing import PointState, as_scale
from app.review import (
    DETAILED_DESIGN_DOC,
    DETAILED_PLAN_DOC,
    ReviewOutput,
    build_review_messages,
    only_reviewed_documents,
    render_findings,
    stage_known_issues,
)
from app.services.llm_retry import invoke_structured_with_usage

HERE = Path(__file__).resolve().parent
# 1M トークンあたりの価格(USD、入力・出力)
PRICES = {"claude-sonnet-5-5": (2.0, 10.0), "claude-opus-5-5": (4.0, 20.0)}
GATE_STAGES = {"stage6": range(1, 7), "stage7": range(1, 8)}
# 段階6の区切りの詳細設計書は 01〜06 章(07 横断事項は段階7)
CROSS_CUTTING_HEAD = "\n## 07 横断事項"


def load_states(subject: str) -> tuple[dict[str, PointState], str | None]:
    """元の回の観点の表(points.txt)を、本体の観点の状態と規模にする。"""
    lines = (baseline.ORIGINS[subject] / "points.txt").read_text().splitlines()
    scale = lines[0].split()[0].removeprefix("scale=")
    states = {}
    for line in lines[1:]:
        key, _required, status, *content = line.split(" ", 3)
        states[key] = PointState(key=key, status=status, summary=content[0] if content else "")  # type: ignore[arg-type]
    return states, scale


def stage_issues(subject: str, stages: range):
    """段階の検証の指摘(段階ごと)。図の要約は渡せないので「図がまだ無い」は除く(51-1 と同じ)。"""
    origin = baseline.ORIGINS[subject]
    raw = {
        int(p.stem.removeprefix("stage")): json.loads(p.read_text())
        for p in origin.glob("stages/stage*.json")
    }
    sources = StageSources(
        documents={d: (origin / f"{d}.md").read_text() for d in ("requirements", "external_design")},
        stages={n: s["model"] for n, s in raw.items() if s.get("model")},
        document_models=json.loads((origin / "regen/documents_v1.json").read_text()),
    )
    return {
        n: [i for i in validate_stage(n, raw[n].get("model"), sources) if not i.code.endswith("_MISSING")]
        for n in stages
    }


def gate_inputs(gate: str, subject: str) -> tuple[dict[str, str], list]:
    """区切りの文書(本体の文書の種類で)と既知の指摘。"""
    loaded = baseline.load_documents(subject)
    mode_docs = baseline.DOC_TYPES_BY_MODE[baseline.SUBJECTS[subject]]
    documents = {d: loaded[d] for d in mode_docs}
    issues = [(d, i) for d, i in baseline.deterministic_issues(subject) if d in documents]
    if gate in GATE_STAGES:
        design = loaded["detailed_design"]
        if gate == "stage6":
            design = design.split(CROSS_CUTTING_HEAD)[0]
        documents[DETAILED_DESIGN_DOC] = design
        if gate == "stage7":
            documents[DETAILED_PLAN_DOC] = loaded["implementation_plan"]
        issues += stage_known_issues(stage_issues(subject, GATE_STAGES[gate]))
    return documents, issues


async def run_once(gate: str, subject: str) -> tuple[str, dict]:
    documents, issues = gate_inputs(gate, subject)
    states, scale = load_states(subject)
    messages = build_review_messages(documents, states, as_scale(scale), issues)
    output, usage = await invoke_structured_with_usage(
        get_review_llm(), ReviewOutput, messages, method="json_schema"
    )
    findings = only_reviewed_documents(output.findings, documents.keys())
    model = settings.REVIEW_MODEL
    meta: dict = {"model": model, "gate": gate, "documents": list(documents), **usage}
    if model in PRICES:
        price_in, price_out = PRICES[model]
        meta["cost_usd"] = round(
            (usage.get("input_tokens", 0) * price_in + usage.get("output_tokens", 0) * price_out)
            / 1_000_000,
            4,
        )
    meta["known_issues"] = len(issues)
    meta["findings"] = [f.model_dump() for f in findings]
    return render_findings(findings) + "\n", meta


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("gate", choices=["documents", "stage6", "stage7"])
    parser.add_argument("--subjects", nargs="+", required=True, choices=sorted(baseline.SUBJECTS))
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--show-input", action="store_true", help="入力を表示して終わる")
    parser.add_argument("--tag", default="", help="出力先 runs/<区切り><tag>/(指示を直した後の流し直し)")
    args = parser.parse_args()

    for subject in args.subjects:
        if args.show_input:
            documents, issues = gate_inputs(args.gate, subject)
            states, scale = load_states(subject)
            print(build_review_messages(documents, states, as_scale(scale), issues)[1].content)
            continue
        out = HERE / "runs" / f"{args.gate}{args.tag}" / subject
        out.mkdir(parents=True, exist_ok=True)
        for n in range(1, args.runs + 1):
            if (out / f"r{n}.md").exists():
                print(f"skip {args.gate}/{subject}/r{n}")
                continue
            started = time.monotonic()
            text, meta = await run_once(args.gate, subject)
            meta["seconds"] = round(time.monotonic() - started, 1)
            (out / f"r{n}.md").write_text(text)
            (out / f"r{n}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
            print(f"done {args.gate}/{subject}/r{n} {meta['seconds']}s ${meta.get('cost_usd')}")


if __name__ == "__main__":
    asyncio.run(main())
