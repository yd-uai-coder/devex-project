"""追加測定 (f): 生成のモデルを替えて、同じヒアリングから文書を作り直す(Phase 51-1)。

本体の DocGeneratorService.generate と同じ順・同じ部品(build_*_messages → 構造化出力 → build_*_model →
render_*)で、DB を使わずに作る(前の版なし・上流の変わった行なし)。自己診断は呼ばない。

実行(.env を読むため devex-api で):
    cd devex-api
    PYTHONPATH=backend uv run --project backend python ../appendix/stage8-baseline/generate.py lite --modes simple --runs 1

出力は subjects/gen-<model>-<mode>-r<n>/<doc_type>.md・models.json・calls.json(呼び出しごとの所要・トークン・429)。
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

from dotenv import dotenv_values
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.documents.external_design import build_model as build_external_design_model
from app.documents.external_design import render_external_design
from app.documents.external_design.drafting import (
    ExternalDesignGenerationOutput,
    build_external_design_messages,
)
from app.documents.external_design.drafting import to_draft as to_external_design_draft
from app.documents.implementation_plan import build_model as build_implementation_plan_model
from app.documents.implementation_plan import render_implementation_plan
from app.documents.implementation_plan.drafting import (
    ImplementationPlanGenerationOutput,
    build_implementation_plan_messages,
)
from app.documents.implementation_plan.drafting import to_draft as to_implementation_plan_draft
from app.documents.internal_design import build_model as build_internal_design_model
from app.documents.internal_design import render_internal_design
from app.documents.internal_design.drafting import (
    InternalDesignGenerationOutput,
    build_internal_design_messages,
)
from app.documents.internal_design.drafting import to_draft as to_internal_design_draft
from app.documents.requirements import build_model, render_requirements
from app.documents.requirements.drafting import (
    RequirementsGenerationOutput,
    build_requirements_messages,
    to_draft,
)
from app.hearing import as_scale
from app.hearing.points import PointState
from app.uml.generation.failures import unwrap_structured_result

HERE = Path(__file__).resolve().parent
ORIGINS = {
    "simple": HERE.parent / "stage7-effect/hearing/simple-2",
    "detailed": HERE.parent / "stage7-effect/hearing/detailed-3",
}
SPEAKERS = {"user": "ユーザー", "ai": "AI", "intake": "初期入力", "attachment": "添付資料"}
# 呼び出しの間隔(秒)。3.8 Flash の無料枠は RPM 5 なので 13 秒(3.6 も分からないので同じにする)
INTERVAL = {"lite": 0.0, "36f": 13.0, "38f": 13.0}


def model_names() -> dict[str, str]:
    env = dotenv_values(".env")
    return {"lite": settings.GEMINI_MODEL, "36f": env["GEMINI_MODEL_36f"], "38f": env["GEMINI_MODEL_38f"]}


def load_transcript(origin: Path) -> str:
    """chat_history_before_generation.txt を、本体の _render_transcript と同じ形にする。"""
    lines, sender, body = [], None, []
    for line in (origin / "chat_history_before_generation.txt").read_text().splitlines():
        if line.startswith("--- "):
            if sender:
                lines.append(f"[{SPEAKERS.get(sender, sender)}] " + "\n".join(body).strip())
            sender, body = line[4:].strip(), []
        else:
            body.append(line)
    if sender:
        lines.append(f"[{SPEAKERS.get(sender, sender)}] " + "\n".join(body).strip())
    return "\n".join(lines)


def load_points(origin: Path):
    head, *rows = (origin / "points.txt").read_text().splitlines()
    scale = dict(part.split("=", 1) for part in head.split())["scale"]
    states = {}
    for row in rows:
        key, _required, status, *summary = row.split(" ", 3)
        states[key] = PointState(key, status, summary[0] if summary else "")
    return states, as_scale(scale)


class Caller:
    """構造化出力を呼び、所要・トークン・429 を記録する。呼び出しの間隔を空ける。"""

    def __init__(self, llm, interval: float):
        self.llm, self.interval, self.calls, self.last = llm, interval, [], 0.0

    async def __call__(self, name: str, schema, messages):
        wait = self.interval - (time.monotonic() - self.last)
        if self.last and wait > 0:
            await asyncio.sleep(wait)
        structured = self.llm.with_structured_output(schema, include_raw=True)
        record = {"doc": name, "quota_429": 0, "busy_503_504": 0}
        for attempt in (1, 2):
            started = time.monotonic()
            try:
                result = await structured.ainvoke(messages)
                break
            except Exception as exc:  # 429・混雑(503・504)は記録して1回だけ待って再試行する
                text = str(exc)
                quota = "429" in text or "RESOURCE_EXHAUSTED" in text
                busy = any(s in text for s in ("503", "504", "UNAVAILABLE", "DEADLINE_EXCEEDED"))
                if attempt == 1 and (quota or busy):
                    record["quota_429" if quota else "busy_503_504"] += 1
                    await asyncio.sleep(60)
                    continue
                record["error"] = text[:300]
                self.calls.append(record)
                raise
        self.last = time.monotonic()
        record["seconds"] = round(self.last - started, 1)
        record.update({k: v for k, v in (getattr(result["raw"], "usage_metadata", None) or {}).items() if k in ("input_tokens", "output_tokens")})
        self.calls.append(record)
        return unwrap_structured_result(result, schema)


async def generate(mode: str, call: Caller) -> tuple[dict[str, str], dict]:
    origin = ORIGINS[mode]
    transcript = load_transcript(origin)
    states, scale = load_points(origin)
    docs, models = {}, {}

    output = await call("requirements", RequirementsGenerationOutput, build_requirements_messages(transcript, states, scale, None))
    requirements = build_model(to_draft(output), None, states, scale)
    docs["requirements"], models["requirements"] = render_requirements(requirements), requirements

    output = await call("external_design", ExternalDesignGenerationOutput, build_external_design_messages(docs["requirements"], None, []))
    external = build_external_design_model(to_external_design_draft(output), None, requirements)
    docs["external_design"], models["external_design"] = render_external_design(external), external
    if mode == "detailed":
        return docs, models

    output = await call("internal_design", InternalDesignGenerationOutput, build_internal_design_messages(docs["requirements"], docs["external_design"], None, []))
    internal = build_internal_design_model(to_internal_design_draft(output), None, [a.label for a in external.apis])
    docs["internal_design"], models["internal_design"] = render_internal_design(internal), internal

    output = await call("implementation_plan", ImplementationPlanGenerationOutput, build_implementation_plan_messages(docs["requirements"], docs["internal_design"], None, []))
    plan = build_implementation_plan_model(
        to_implementation_plan_draft(output), None, dataflow_ids=[f.id for f in internal.dataflows], requirements=requirements
    )
    docs["implementation_plan"], models["implementation_plan"] = render_implementation_plan(plan), plan
    return docs, models


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="+", choices=["lite", "36f", "38f"])
    parser.add_argument("--modes", nargs="+", default=["simple", "detailed"], choices=["simple", "detailed"])
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    names = model_names()
    for key in args.models:
        llm = ChatGoogleGenerativeAI(model=names[key], api_key=settings.GOOGLE_API_KEY, temperature=0.7, timeout=180, max_retries=0)
        call = Caller(llm, INTERVAL[key])
        for mode in args.modes:
            for n in range(1, args.runs + 1):
                out = HERE / "subjects" / f"gen-{key}-{mode}-r{n}"
                if (out / "requirements.md").exists():
                    print(f"skip {out.name}")
                    continue
                call.calls = []
                started = time.monotonic()
                try:
                    docs, models = await generate(mode, call)
                except Exception as exc:  # noqa: BLE001 -- 失敗も記録して次へ進む
                    out.mkdir(parents=True, exist_ok=True)
                    (out / "calls.json").write_text(json.dumps({"model": names[key], "failed": str(exc)[:300], "calls": call.calls}, ensure_ascii=False, indent=2))
                    print(f"FAILED {out.name}: {str(exc)[:120]}")
                    continue
                out.mkdir(parents=True, exist_ok=True)
                for doc_type, content in docs.items():
                    (out / f"{doc_type}.md").write_text(content)
                (out / "models.json").write_text(json.dumps({k: m.model_dump(mode="json") for k, m in models.items()}, ensure_ascii=False, indent=2))
                total = round(time.monotonic() - started, 1)
                (out / "calls.json").write_text(json.dumps({"model": names[key], "seconds": total, "calls": call.calls}, ensure_ascii=False, indent=2))
                print(f"done {out.name} {total}s {[c.get('seconds') for c in call.calls]}")


if __name__ == "__main__":
    asyncio.run(main())
