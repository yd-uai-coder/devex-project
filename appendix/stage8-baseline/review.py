"""ステージ8のベースライン: 題材の文書にレビューの方式を流し、出力をそのまま残す(Phase 51-1)。

実行(.env を読むため devex-api で):
    cd devex-api
    PYTHONPATH=backend uv run --project backend python ../appendix/stage8-baseline/review.py self_diagnosis --runs 3

出力は runs/<方式>/<題材>/r<n>.md と、呼び出しの記録 runs/<方式>/<題材>/r<n>.json(時間・トークン)。
当たり・見落としの判定は judge の結果を見て人が行う(results.md)。
"""

import argparse
import asyncio
import json
import time
from pathlib import Path
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.ai.llm.gemini import extract_text_content, get_gemini_llm
from app.core.config import settings
from app.detailed_design.validation import StageIssue, StageSources, validate_stage
from app.documents.external_design import ExternalDesignModel, validate_external_design
from app.documents.implementation_plan import (
    ImplementationPlanModel,
    validate_implementation_plan,
)
from app.documents.internal_design import InternalDesignModel, validate_internal_design
from app.documents.issues import DocumentIssue
from app.documents.requirements import RequirementsModel, validate_requirements
from app.hearing.points import POINT_DEFS, STATUS_LABEL
from app.services.doc_generator_service import (
    _DOC_TYPE_LABELS,
    _SELF_DIAGNOSIS_SYSTEM_PROMPT,
    DOC_TYPES_BY_MODE,
)

HERE = Path(__file__).resolve().parent
# 1M トークンあたりの価格(USD、入力・出力)
PRICES = {
    "gemini-3.5-flash-lite": (0.30, 2.50),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
}
# 題材 → モード
SUBJECTS = {
    "simple": "simple",
    "detailed": "detailed",
    "detailed-full": "detailed",
    "simple-procedure": "simple",
}
# 題材の元の回(観点の表と、決定的な検証に使う model の出どころ)
ORIGINS = {
    "simple": HERE.parent / "stage7-effect/hearing/simple-2",
    "detailed": HERE.parent / "stage7-effect/hearing/detailed-3",
    "detailed-full": HERE.parent / "stage7-effect/hearing/detailed-3",
    "simple-procedure": HERE.parent / "stage7-effect/hearing/simple-2",
}
# (f) 生成のモデルを替えて作り直した文書(subjects/gen-<model>-<mode>-r<n>)。L0 は作った model に流す
for _folder in sorted((HERE / "subjects").glob("gen-*")):
    _mode = _folder.name.split("-")[2]
    SUBJECTS[_folder.name] = _mode
    ORIGINS[_folder.name] = ORIGINS[_mode]

# (e) で足す下流の文書(モードの文書の後ろに、この順で渡す)
EXTRA_DOCS = {
    "detailed-full": ["detailed_design", "implementation_plan"],
    "simple-procedure": ["procedure"],
}
EXTRA_LABELS = {"detailed_design": "詳細設計書", "procedure": "実装手順書"}
# (e) の区切りごとの方式: 区切りごとに渡す文書(上流もすべて渡す)
GATES = {
    "detailed-full": [
        ["requirements"],
        ["requirements", "external_design"],
        ["requirements", "external_design", "detailed_design"],
        ["requirements", "external_design", "detailed_design", "implementation_plan"],
    ],
    "simple-procedure": [
        ["requirements", "external_design", "internal_design", "implementation_plan"],
        ["requirements", "external_design", "internal_design", "implementation_plan", "procedure"],
    ],
}
# 仕込み S-SEED-2(md だけでなく model にも入れて、決定的な検証を md と揃える)
SEED_FR010 = {
    "id": "FR-010",
    "kind": "FR",
    "priority": "Must",
    "text": "生成した設計書を共有リンクで公開し、ログインしていない人も閲覧できるようにする",
    "source": "user",
    "points": ["core"],
}


def load_documents(subject: str) -> dict[str, str]:
    """題材の文書を、生成の順(DOC_TYPES_BY_MODE、(e) は下流の文書を後ろに)で読む。"""
    folder = HERE / "subjects" / subject
    documents = {}
    for doc_type in [*DOC_TYPES_BY_MODE[SUBJECTS[subject]], *EXTRA_DOCS.get(subject, [])]:
        if doc_type == "procedure":
            # 手順書は一覧と AI 向けの単位ごとの本文(人向けの要約は同じ中身なので渡さない)
            files = [folder / "procedure/index.md", *sorted((folder / "procedure/ai").glob("*.md"))]
            documents[doc_type] = "\n\n".join(f.read_text() for f in files)
        else:
            documents[doc_type] = (folder / f"{doc_type}.md").read_text()
    return documents


def doc_label(doc_type: str) -> str:
    return EXTRA_LABELS.get(doc_type) or _DOC_TYPE_LABELS[doc_type]


async def self_diagnosis(documents: dict[str, str], _subject: str) -> tuple[str, dict]:
    """今の自己診断(doc_generator_service._self_diagnose)と同じ入力・プロンプト・モデル。"""
    combined = "\n\n".join(
        f"## {_DOC_TYPE_LABELS[doc_type]}\n{content}" for doc_type, content in documents.items()
    )
    messages = [
        SystemMessage(content=_SELF_DIAGNOSIS_SYSTEM_PROMPT),
        HumanMessage(content=combined),
    ]
    response = await get_gemini_llm().ainvoke(messages)
    usage = dict(getattr(response, "usage_metadata", None) or {})
    return extract_text_content(response.content), {"model": settings.GEMINI_MODEL, **usage}


LEVEL_LABEL = {"critical": "最重要", "major": "中程度", "minor": "軽微"}
CAUSE_LABEL = {"hearing": "ヒアリング", "design": "設計", "inconsistency": "不整合"}


class ReviewFinding(BaseModel):
    """レビューの指摘1件。設計は書き換えず、指摘と改善案だけを返す。"""

    level: Literal["critical", "major", "minor"] = Field(
        description="critical=決まらないと実装に着手できない / major=実装はできるが手戻りになりうる"
        " / minor=細部"
    )
    cause: Literal["hearing", "design", "inconsistency"] = Field(
        description="hearing=ヒアリングで聞けていない・聞き方が浅い / design=1つの文書の中の誤り・抜け"
        " / inconsistency=文書どうし・要件と設計の食い違い"
    )
    targets: list[str] = Field(
        description="対象の ID(FR-001・NFR-006・SCR-002・DF-3・M-02-T01 など)や、ID の無いときは"
        "『POST /api/v1/projects』『テーブル users』『観点 セキュリティ』のような文書の中の名前"
    )
    problem: str = Field(description="何が問題か(1〜2文)")
    reason: str = Field(description="なぜ問題か。根拠の文書・節を挙げる(1〜2文)")
    suggestion: str = Field(description="どう直すかの案(1〜2文)")


class ReviewOutput(BaseModel):
    findings: list[ReviewFinding]


STRUCTURED_REVIEW_PROMPT = """あなたは、AI が生成したシステムの設計書のレビュアーです。
設計書は書き換えず、問題の指摘だけを返します。

## 入力
- 設計書(要件定義書・外部設計書、簡易モードでは内部設計書・実装計画書も)
- ヒアリングの観点の表(観点ごとの状態: ユーザーが決定 / AI の提案を採用 / 未決 / 対象外 と、その内容)
- 決定的な検証の指摘(システムが ID の結び付きなどを機械的に調べた結果)。**これらは既知なので、同じ中身を繰り返さない**

## 見る観点
1. 要件 → 設計の追跡: Must の機能要件と非機能要件(特にセキュリティ・アクセス制御・回数の上限・性能)が、画面・API・データ・処理で満たされているか
2. API の完全さ: 画面の操作ごとに API があるか / どのリソースが対象かを特定できるか / 認証・認可・エラーの応答がそろっているか
3. 文書の中・文書どうしの矛盾
4. 時間のかかる処理と、失敗したときの扱い
5. データモデルと処理の流れ: 受け取ったデータが使われているか、保存の方針が要件と合うか
6. 実装計画の網羅(実装計画書があるとき): 画面・基盤・デプロイ・非機能要件に当たるタスクがあるか
7. ヒアリング: 「AI の提案を採用」「未決」の観点や、内容が浅い観点で、要件に落ちていない事実がないか。原因がヒアリングにあるもの(利用者に聞き直さないと決められないもの)は cause を hearing にする

## 書き方
- 指摘ごとに、対象を文書の中の ID や名前で書く
- 一般論(「〜を強化すべき」「〜を検討するとよい」)や、MVP の対象外と決めたことへの指摘は書かない
- 同じ問題は1件にまとめる
"""


def load_points(subject: str) -> str:
    """元の回の観点の表(points.txt)を、観点 / 状態 / 内容 の表にする。"""
    labels = {d.key: d.label for d in POINT_DEFS}
    lines = (ORIGINS[subject] / "points.txt").read_text().splitlines()
    rows = ["| 観点 | 必須 | 状態 | 内容 |", "|---|---|---|---|"]
    for line in lines[1:]:
        key, required, status, *content = line.split(" ", 3)
        rows.append(
            f"| {labels.get(key, key)} | {required} | {STATUS_LABEL.get(status, status)} "
            f"| {content[0] if content else ''} |"
        )
    return f"{lines[0]}\n\n" + "\n".join(rows)


def deterministic_issues(subject: str) -> list[tuple[str, DocumentIssue]]:
    """元の回の model に今の決定的な検証を流す(S は仕込み S-SEED-2 を model にも入れる)。"""
    generated = HERE / "subjects" / subject / "models.json"
    source = generated if generated.exists() else ORIGINS[subject] / "regen/documents_v1.json"
    models = json.loads(source.read_text())
    if subject == "simple":
        models["requirements"]["rows"].append(SEED_FR010)
        for doc_type in ("external_design", "implementation_plan"):
            models[doc_type]["must_fr_ids"].append("FR-010")
            models[doc_type]["known_req_ids"] = [*models[doc_type].get("known_req_ids", []), "FR-010"]
    validators = {
        "requirements": lambda m: validate_requirements(RequirementsModel.model_validate(m)),
        "external_design": lambda m: validate_external_design(ExternalDesignModel.model_validate(m)),
        "internal_design": lambda m: validate_internal_design(InternalDesignModel.model_validate(m)),
        "implementation_plan": lambda m: validate_implementation_plan(
            ImplementationPlanModel.model_validate(m)
        ),
    }
    return [
        (doc_type, issue)
        for doc_type in DOC_TYPES_BY_MODE[SUBJECTS[subject]]
        for issue in validators[doc_type](models[doc_type])
    ]


def stage_issues(subject: str) -> list[tuple[str, StageIssue]]:
    """(e) 詳細設計書の段階1〜7に段階の検証を流す。図の要約は渡せないので「図がまだ無い」は除く。
    手順書(簡易)は実装可能性チェックの指摘が無かった(index.md 5節)ので渡すものは無い。"""
    if subject != "detailed-full":
        return []
    origin = ORIGINS[subject]
    stages = {
        int(p.stem.removeprefix("stage")): json.loads(p.read_text())
        for p in origin.glob("stages/stage*.json")
    }
    sources = StageSources(
        documents={d: (origin / f"{d}.md").read_text() for d in ("requirements", "external_design")},
        stages={n: s["model"] for n, s in stages.items() if s.get("model")},
        document_models=json.loads((origin / "regen/documents_v1.json").read_text()),
    )
    issues = []
    for n in range(1, 8):
        doc_type = "implementation_plan" if n == 7 else "detailed_design"
        for issue in validate_stage(n, stages[n].get("model"), sources):
            if not issue.code.endswith("_MISSING"):
                issues.append((doc_type, issue))
    return issues


def structured_input(subject: str, documents: dict[str, str]) -> str:
    combined = "\n\n".join(
        f"## {doc_label(doc_type)}\n{content}" for doc_type, content in documents.items()
    )
    issue_lines = [
        f"- [{doc_label(doc_type)}] {LEVEL_LABEL[i.level]} {i.code}: {i.message}"
        + (f"(対象: {', '.join(i.targets)})" if i.targets else "")
        for doc_type, i in deterministic_issues(subject)
        if doc_type in documents
    ] + [
        f"- [{doc_label(doc_type)}] {LEVEL_LABEL.get(i.level or '', 'エラー')} {i.code}: {i.message}"
        for doc_type, i in stage_issues(subject)
        if doc_type in documents
    ]
    issue_lines = issue_lines or ["- なし"]
    return (
        f"# 設計書\n\n{combined}\n\n# ヒアリングの観点の表\n\n{load_points(subject)}"
        f"\n\n# 決定的な検証の指摘(既知)\n\n" + "\n".join(issue_lines)
    )


def render_findings(output: ReviewOutput) -> str:
    lines = []
    for n, f in enumerate(output.findings, 1):
        lines += [
            f"{n}. **[{LEVEL_LABEL[f.level]} / {CAUSE_LABEL[f.cause]}]** {', '.join(f.targets)}",
            f"   - 問題: {f.problem}",
            f"   - 理由: {f.reason}",
            f"   - 改善案: {f.suggestion}",
        ]
    return "\n".join(lines) + "\n"


async def _structured_review(
    llm, model_name: str, documents: dict[str, str], subject: str
) -> tuple[str, dict]:
    """構造化レビューの指示・観点の表・決定的な検証を与え、ReviewOutput で受ける。"""
    messages = [
        SystemMessage(content=STRUCTURED_REVIEW_PROMPT),
        HumanMessage(content=structured_input(subject, documents)),
    ]
    result = await llm.with_structured_output(ReviewOutput, include_raw=True).ainvoke(messages)
    output = result["parsed"]
    if output is None:
        raise RuntimeError(f"構造化出力の解釈に失敗: {result.get('parsing_error')}")
    usage = dict(getattr(result["raw"], "usage_metadata", None) or {})
    meta = {"model": model_name, **usage}
    if model_name in PRICES:
        price_in, price_out = PRICES[model_name]
        meta["cost_usd"] = round(
            (usage.get("input_tokens", 0) * price_in + usage.get("output_tokens", 0) * price_out)
            / 1_000_000,
            4,
        )
    meta["findings"] = [f.model_dump() for f in output.findings]
    return render_findings(output), meta


async def structured_lite(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(d) 今と同じ flash-lite に、構造化レビューの指示・観点の表・決定的な検証を与える。"""
    return await _structured_review(get_gemini_llm(), settings.GEMINI_MODEL, documents, subject)


# (d') 出力の形だけを (d) から変える(構造化出力の代わりに書き方を指示する)
FREETEXT_SUFFIX = """
## 出力の書き方
指摘ごとに、次の形の Markdown の箇条書きで書く。前置きとまとめは書かない。
- **[重要度 / 原因]** 対象
  - 問題:
  - 理由:
  - 改善案:

重要度は 最重要(決まらないと実装に着手できない)/ 中程度(実装はできるが手戻りになりうる)/ 軽微(細部)。
原因は ヒアリング(聞けていない・聞き方が浅い)/ 設計(1つの文書の中の誤り・抜け)/ 不整合(文書どうし・要件と設計の食い違い)。
"""


async def freetext_lite(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(d') (d) と同じ指示・入力・モデルで、構造化出力を使わず自由文で返させる。"""
    messages = [
        SystemMessage(content=STRUCTURED_REVIEW_PROMPT + FREETEXT_SUFFIX),
        HumanMessage(content=structured_input(subject, documents)),
    ]
    response = await get_gemini_llm().ainvoke(messages)
    usage = dict(getattr(response, "usage_metadata", None) or {})
    return extract_text_content(response.content), {"model": settings.GEMINI_MODEL, **usage}


def anthropic_llm(model: str):
    """Claude を呼ぶ(devex-api の依存に無いので uv run --with langchain-anthropic で流す)。"""
    from dotenv import dotenv_values
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=model, max_tokens=16000, api_key=dotenv_values(".env")["ANTHROPIC_API_KEY"]
    )


async def l2_sonnet(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(a) (d) と同じ指示・入力・構造化出力を Sonnet 5.5 に与える。"""
    model = "claude-sonnet-5-5"
    return await _structured_review(anthropic_llm(model), model, documents, subject)


async def l2_haiku(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(a) (d) と同じ指示・入力・構造化出力を Haiku 4.5 に与える。"""
    model = "claude-haiku-4-5-20251001"
    return await _structured_review(anthropic_llm(model), model, documents, subject)


async def full_sonnet(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(e) 全文書を1回でレビューする(l2_sonnet と同じ。題材が下流の文書まで含む)。"""
    return await l2_sonnet(documents, subject)


async def gates_sonnet(documents: dict[str, str], subject: str) -> tuple[str, dict]:
    """(e) 承認の区切りごとに、それまでの文書をすべて渡してレビューする。"""
    model = "claude-sonnet-5-5"
    sections, gates = [], []
    for k, doc_types in enumerate(GATES[subject], 1):
        subset = {d: documents[d] for d in doc_types}
        text, meta = await _structured_review(anthropic_llm(model), model, subset, subject)
        sections.append(f"## 区切り{k}: {' + '.join(doc_label(d) for d in doc_types)}\n\n{text}")
        gates.append({"gate": k, "documents": doc_types, **meta})
    total = {
        key: round(sum(g.get(key, 0) for g in gates), 4)
        for key in ("input_tokens", "output_tokens", "cost_usd")
    }
    return "\n".join(sections), {"model": model, **total, "gates": gates}


METHODS = {
    "self_diagnosis": self_diagnosis,
    "structured_lite": structured_lite,
    "freetext_lite": freetext_lite,
    "l2_sonnet": l2_sonnet,
    "l2_haiku": l2_haiku,
    "full_sonnet": full_sonnet,
    "gates_sonnet": gates_sonnet,
}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("method", choices=sorted(METHODS))
    # 既定は 51-1 の題材((e) の題材は --subjects で指定する)
    parser.add_argument("--subjects", nargs="+", default=["detailed", "simple"], choices=sorted(SUBJECTS))
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--show-input", action="store_true", help="(d) の入力だけ表示して終わる")
    args = parser.parse_args()

    if args.show_input:
        for subject in args.subjects:
            print(structured_input(subject, load_documents(subject)).split("# ヒアリングの観点の表")[1])
        return

    for subject in args.subjects:
        documents = load_documents(subject)
        out = HERE / "runs" / args.method / subject
        out.mkdir(parents=True, exist_ok=True)
        for n in range(1, args.runs + 1):
            if (out / f"r{n}.md").exists():
                print(f"skip {args.method}/{subject}/r{n}")
                continue
            started = time.monotonic()
            text, meta = await METHODS[args.method](documents, subject)
            meta["seconds"] = round(time.monotonic() - started, 1)
            (out / f"r{n}.md").write_text(text)
            (out / f"r{n}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
            print(f"done {args.method}/{subject}/r{n} {meta['seconds']}s")


if __name__ == "__main__":
    asyncio.run(main())
