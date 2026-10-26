# 作成：Phase-85-1｜更新：Phase-96-2,102-2,112-3
# Phase-112-3：更新(docstring: 競合のある対象に今の文を添えることを足した)
# Phase-96-2：更新(docstring: build_cr_instruction が起点の1行を足す)
"""合意した変更要求(CR)から、再生成の指示の文を組み立てる(純粋関数)。

docs/external_design.md 2.14節「反映」。設計レビューの採用した指摘(app/review/sendback.py)と
同じ経路で、文書・段階の生成のプロンプトの【修正指示】の節に入れる。CR は要件が起点なので、
文書・段階ごとに絞らず、どの生成にも同じ指示を渡す。指摘の指示と一緒に渡すときは、空行で並べる。
対象の要件が基準の束の後にほかの CR の反映で変わっていれば(競合。conflicts.py)、その要件の行の
下に今の文を添え、先の CR の変更を消さないよう頼む。
"""

# Phase-102-2:追記 ── app.change_requests.options.option_label
# Phase-112-3:追記 ── collections.abc.Sequence, app.change_requests.conflicts.Conflict
from collections.abc import Iterable, Sequence

from app.change_requests.conflicts import Conflict
from app.change_requests.explanation import ChangeRequestFacts
from app.change_requests.options import option_label
from app.change_requests.targets import TARGET_KIND_LABEL

CR_INSTRUCTION_HEAD = (
    "次の合意済みの変更要求(CR-{number})を反映して書き直す。対象の要件と、それに合わせて変える"
    "必要のある行だけを書き直し、変更要求に関係しない行は変えない(unchanged にする)。"
)
ADDS_REQUIREMENT_LINE = "- 新しい要件を足す(内容は上の「内容」のとおり。ID は既存の要件と重ねない)"
# Phase-96-2:追記
ORIGIN_LINE = "  - 新しい要件が関わる既存の要素(予測の起点): {origins}"
# Phase-102-2:追記
OPTION_LINE = "合意した案: {label} {name}(結果: {outcome})"
# Phase-112-3:追記
CONFLICT_LINE = (
    "  - 今の文は {numbers} の反映の後のもの「{current}」。{numbers} の変更を消さず、この文を土台に"
    "書き直す"
)
CONFLICT_REMOVED_LINE = (
    "  - この要件は {numbers} の反映で消えている。消したままにするかは上の内容に従う"
)


# Phase-112-3：更新
# def build_cr_instruction(facts: ChangeRequestFacts) -> str:
#     """指示の文(頭の1文 + タイトル・内容 + 合意した案があればその1行 + 対象1件1行 + 新しい要件を
#     足すなら1行と、起点があればその1行)。案のある CR では、合意で選んだ案の対象が CR の対象に
#     なっている。"""
# ↓↓
def build_cr_instruction(facts: ChangeRequestFacts, conflicts: Sequence[Conflict] = ()) -> str:
    """指示の文(頭の1文 + タイトル・内容 + 合意した案があればその1行 + 対象1件1行〈競合があれば
    今の文の1行を添える〉+ 新しい要件を足すなら1行と、起点があればその1行)。案のある CR では、
    合意で選んだ案の対象が CR の対象になっている。"""
    by_id = {c.requirement_id: c for c in conflicts}
    lines = [
        CR_INSTRUCTION_HEAD.format(number=facts.number),
        f"タイトル: {facts.title}",
        f"内容: {facts.content.strip() or '—'}",
    ]
    # Phase-102-2:追記
    number = facts.decision_option
    if number is not None and 1 <= number <= len(facts.options.items):
        option = facts.options.option(number)
        lines.append(
            OPTION_LINE.format(
                label=option_label(number),
                name=option.name,
                outcome=" ".join(option.outcome.split()),
            )
        )
    if facts.targets:
        lines.append("対象の要件:")
    for target in facts.targets:
        kind = TARGET_KIND_LABEL[target.kind]
        if target.kind == "delete":
            lines.append(f"- {target.requirement_id}({kind}): この要件を消す")
        elif target.proposed_text:
            lines.append(
                f"- {target.requirement_id}({kind}): 変更後の案「{target.proposed_text}」"
            )
        else:
            lines.append(f"- {target.requirement_id}({kind}): 上の「内容」のとおりに変える")
        # Phase-112-3:追記
        conflict = by_id.get(target.requirement_id)
        if conflict is not None:
            numbers = "・".join(f"CR-{n}" for n in conflict.by_numbers)
            if conflict.current_text is None:
                lines.append(CONFLICT_REMOVED_LINE.format(numbers=numbers))
            else:
                lines.append(CONFLICT_LINE.format(numbers=numbers, current=conflict.current_text))
    if facts.adds_requirement:
        lines.append(ADDS_REQUIREMENT_LINE)
        # Phase-96-2:追記
        if facts.origin_labels:
            lines.append(ORIGIN_LINE.format(origins="・".join(facts.origin_labels)))
    return "\n".join(lines)


def join_instructions(instructions: Iterable[str]) -> str:
    """指示の文を空行で並べる(空の指示は飛ばす)。どれも空なら空。"""
    return "\n\n".join(text for text in instructions if text)
