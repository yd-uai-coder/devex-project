"""ステージ11のベースライン(Phase 80-2): CR のシナリオ N2 に、今の変更影響分析を当てる。

外部の API・LLM は呼ばない。材料は、ステージ7の効果測定で書き出した詳細設計モードの段階・文書の
model(`appendix/stage7-effect/impact/data/detailed.json`)。2026-10-19 の整理(0c7a7f3)で
リポジトリから消したので、その親のコミットから `git show` で読み出す(リポジトリには戻さない)。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage11/measure.py

次の2つを求め、標準出力に Markdown で出す(結果は stage11-baseline.md に写す)。

1. 予測(合意の前): 変わる要件 `req:FR-005` を `Change` として `impact_of` に渡した結果。
   今の本体は、この経路を画面にも API にも出していない(関数としてはある)。
2. 実際(反映の後): FR-005 の文を書き換えた model と元の model の差分(`diff_elements`)から、
   今の本体が段階に付ける印(`marks_for`)。今の本体が、文書を再生成したときに出すもの。
"""

import copy
import json
import subprocess
from pathlib import Path
from typing import Any

from app.detailed_design.data_model import er_table_definitions
from app.detailed_design.impact import (
    DOCUMENT_STAGE,
    DesignModels,
    build_elements,
    diff_elements,
    marks_for,
)
from app.detailed_design.impact.trace import Change, impact_of

ROOT = Path(__file__).resolve().parents[3]
SOURCE_COMMIT = "0c7a7f3^"
SOURCE_PATH = "appendix/stage7-effect/impact/data/detailed.json"
TARGET = "FR-005"
NEW_TEXT = "参考資料のファイルを最大5件までアップロードできる。"


def load_models() -> dict[str, Any]:
    raw = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(raw)


def elements_of(models: dict[str, Any]) -> list:
    stages = {int(n): v for n, v in models["stages"].items()}
    er = er_table_definitions(models["er"])
    return build_elements(DesignModels.from_dicts(stages, models["documents"], er))


def apply_cr(models: dict[str, Any]) -> tuple[dict[str, Any], str]:
    after = copy.deepcopy(models)
    for row in after["documents"]["requirements"]["rows"]:
        if row["id"] == TARGET:
            before_text = row["text"]
            row["text"] = NEW_TEXT
            return after, before_text
    raise KeyError(TARGET)


def main() -> None:
    models = load_models()
    before = elements_of(models)
    after_models, before_text = apply_cr(models)
    after = elements_of(after_models)
    stage_of = {e.key: e.stage for e in before}

    predicted = impact_of(before, Change(f"req:{TARGET}"))
    changes = diff_elements(before, after, stages=(DOCUMENT_STAGE,))
    marks = marks_for(before, after, changes, "doc:requirements")

    predicted_keys = {i.key for i in predicted}
    mark_keys = {m.key for m in marks}

    print(f"# N2: {TARGET}\n")
    print(f"- 合意済みの文: {before_text}")
    print(f"- 変更後の文: {NEW_TEXT}")
    print(f"- 要素の数: {len(before)}")
    print(f"- 差分(変わったもの): {', '.join(f'{c.change} {c.key}' for c in changes)}\n")
    print("| 要素 | 置き場 | 予測 | 実際の印 | 理由(予測) |")
    print("|---|---|---|---|---|")
    reasons = {i.key: i.reason for i in predicted}
    for key in sorted(predicted_keys | mark_keys, key=lambda k: (stage_of.get(k, 99), k)):
        print(
            f"| `{key}` | {stage_of.get(key, '-')} | {'○' if key in predicted_keys else ''} "
            f"| {'○' if key in mark_keys else ''} | {reasons.get(key, '')} |"
        )
    print(f"\n- 予測: {len(predicted_keys)} 件 / 実際の印: {len(mark_keys)} 件")
    print(f"- 予測だけ: {len(predicted_keys - mark_keys)} 件 / 印だけ: {len(mark_keys - predicted_keys)} 件")


if __name__ == "__main__":
    main()
