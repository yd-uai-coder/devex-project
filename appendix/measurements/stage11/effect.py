"""ステージ11の効果測定(Phase 89-1): ベースライン(measure.py)と同じ N2・同じ材料で、ステージ11 で
作った CR の部品(予測・説明書・反映の比較・検証)を純粋関数のまま一巡させる。

外部の API・LLM・DB は使わない。材料の読み出しと反映の模擬(FR-005 の文の書き換え)は measure.py を
そのまま使う(同じ材料・同じ変更で比べるため)。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage11/effect.py

標準出力に Markdown で出す(結果は stage11-effect.md に写す)。

1. 予測(合意の前): CR の対象(FR-005・内容の変更)から `predict`。保存の形の大きさも測る。
2. 説明書: 束の写しの形にした材料から5節の md を組み、大きさ・作業単位・要約の照合を見る。
3. 反映の模擬: 書き換えた要件定義書との差分から印を求め、本体と同じく出どころに `cr:1` を足して
   段階に記録する。予測と比べる(`compare`)。
4. 検証: 反映の直後(印も文書の側も未確認)と、印を確かめ・文書の側を確認済みにした後の確かめ。
"""

import json
from datetime import date
from typing import Any

from measure import NEW_TEXT, TARGET, apply_cr, elements_of, load_models

from app.change_requests.comparison import (
    COMPARISON_STATUS_LABEL,
    PREDICTED_ONLY_REASON_LABEL,
    AppliedMark,
    compare,
)
from app.change_requests.explanation import (
    ChangeRequestFacts,
    build_explanation,
    check_summary,
)
from app.change_requests.prediction import predict, requirement_texts
from app.change_requests.targets import Target
from app.change_requests.verification import verification_of
from app.detailed_design.impact import (
    DOCUMENT_STAGE,
    StageImpact,
    cr_source,
    diff_elements,
    group_by_stage,
    marks_for,
    record,
    set_reviewed,
)

CR_NUMBER = 1
BASELINE_NUMBER = 1
DOCUMENT_SOURCE = "doc:requirements"
# 要約の照合を見るための2つの文(1つ目は5節に合う、2つ目は件数と要件 ID を取り違えた)
SUMMARY_OK = f"{TARGET} の参考資料の上限を5件に変えます。見直しが要る要素は6件です。"
SUMMARY_NG = "FR-050 の参考資料の上限を10件に変えます。見直しが要る要素は7件です。"


def snapshots_of(models: dict[str, Any]) -> dict[str, Any]:
    """材料を束の写しの形(key → model)にする(説明書が読むのは要件定義書とテスト仕様書)。"""
    snapshots: dict[str, Any] = dict(models["documents"])
    for number, model in models["stages"].items():
        snapshots[f"stage:{number}"] = model
    return snapshots


def size(value: Any) -> int:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return len(text.encode("utf-8"))


def main() -> None:
    models = load_models()
    before = elements_of(models)
    after_models, before_text = apply_cr(models)
    after = elements_of(after_models)
    target = Target(TARGET, "content", NEW_TEXT)

    # 1. 予測
    texts = requirement_texts(models["documents"]["requirements"])
    prediction = predict(before, [target], adds_requirement=False, texts=texts)

    # 2. 説明書
    facts = ChangeRequestFacts(
        number=CR_NUMBER,
        title="参考資料の上限を5件にする",
        status="explained",
        content="参考資料は 5件まで読み込めるようにしてほしい。",
        background_source="meeting",
        background_date=date(2026, 10, 19),
        background_memo="定例の打ち合わせでクライアントから。",
        targets=(target,),
        adds_requirement=False,
        baseline_number=BASELINE_NUMBER,
    )
    explanation = build_explanation(facts, prediction, snapshots_of(models), [])
    markdown = explanation.markdown

    # 3. 反映の模擬(文書の再生成。本体の doc_generator_service と同じく cr:N を出どころに足す)
    changes = diff_elements(before, after, stages=(DOCUMENT_STAGE,))
    marks = marks_for(before, after, changes, DOCUMENT_SOURCE)
    current = {
        stage: record(
            StageImpact(),
            DOCUMENT_SOURCE,
            changes,
            stage_marks,
            extra_sources=(cr_source(CR_NUMBER),),
        )
        for stage, stage_marks in group_by_stage(marks).items()
    }
    applied = [AppliedMark(m.key, m.label, m.stage, m.reason, False) for m in marks]
    marked_stages = {int(n) for n in models["stages"]}
    document_keys = [i.key for i in prediction.items if i.stage == DOCUMENT_STAGE]
    comparison = compare(prediction, applied, marked_stages, document_checks=[])

    # 4. 検証(直後 / 確かめた後)
    fresh = verification_of(applied, current, CR_NUMBER, prediction, [])
    confirmed = {
        stage: set_reviewed(impact, [m.key for m in impact.marks], True)
        for stage, impact in current.items()
    }
    done = verification_of(applied, confirmed, CR_NUMBER, prediction, document_keys)

    print(f"# N2: {TARGET}(CR-{CR_NUMBER}・基準 B-{BASELINE_NUMBER})\n")
    print(f"- 合意済みの文: {before_text}")
    print(f"- 変更後の案: {NEW_TEXT}")
    print(f"- 要素の数: {len(before)}")
    print(f"- 差分(変わったもの): {', '.join(f'{c.change} {c.key}' for c in changes)}\n")

    print("## (c) 影響の一覧(予測・反映の印・比較・検証)\n")
    print("| 要素 | 置き場 | 予測 | 反映の印(出どころ) | 比較 | 検証の確認 | 理由(予測) |")
    print("|---|---|---|---|---|---|---|")
    sources = {m.key: m.sources for impact in current.values() for m in impact.marks}
    for item in comparison.items:
        status = COMPARISON_STATUS_LABEL[item.status]
        if item.predicted_only_reason:
            status += f"({PREDICTED_ONLY_REASON_LABEL[item.predicted_only_reason]})"
        check = "文書の側の確認" if item.stage == DOCUMENT_STAGE else "印の確認"
        mark = "・".join(sources.get(item.key, ())) or ""
        print(
            f"| `{item.key}` | {item.stage} | {'○' if item.status != 'actual_only' else ''} "
            f"| {mark} | {status} | {check} | {item.predicted_reason} |"
        )
    print(
        f"\n- 予測: {len(prediction.items)} 件 / 反映の印: {len(applied)} 件 / 文書の側の確認: "
        f"{len(document_keys)} 件"
    )
    print(
        "- 比較: "
        + " / ".join(
            f"{COMPARISON_STATUS_LABEL[s]} {comparison.count(s)} 件"
            for s in ("matched", "predicted_only", "actual_only")
        )
    )

    print("\n## 検証\n")
    print("| 時点 | 未確認の印 | 未確認の文書の側 | 検証済みにできるか |")
    print("|---|---|---|---|")
    for label, v in (("反映の直後", fresh), ("印と文書の側を確かめた後", done)):
        verdict = "できる" if v.complete else "できない"
        print(f"| {label} | {v.open_marks} | {v.open_documents} | {verdict} |")

    print("\n## 説明書\n")
    headings = [line for line in markdown.splitlines() if line.startswith("## ")]
    print(f"- 節: {' / '.join(headings)}")
    print(f"- 作業単位: {', '.join(explanation.units.units) or 'なし'}")
    print(f"- テスト仕様書: {'あり' if explanation.units.has_test_spec else '束に無い(数えない)'}")
    for label, summary in (("合う要約", SUMMARY_OK), ("取り違えた要約", SUMMARY_NG)):
        result = check_summary(summary, explanation)
        print(
            f"- 照合({label}): 5節に無い要件 ID {list(result.unknown_requirement_ids)}・"
            f"数字 {list(result.unknown_numbers)}"
        )

    print("\n## 応答の大きさ(UTF-8)\n")
    print("| もの | バイト |")
    print("|---|---|")
    print(f"| 予測(`Prediction.to_dict`) | {size(prediction.to_dict())} |")
    print(f"| 説明書の md | {size(markdown)} |")
    print(f"| 束の写し(文書2・段階8) | {size(snapshots_of(models))} |")


if __name__ == "__main__":
    main()
