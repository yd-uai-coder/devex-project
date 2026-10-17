# Phase-70-3: 再生成のきっかけを入力の節から作る

## この章の目的

再生成は前の版の行を変えないのが基本で(Phase 49)、「変更のきっかけ」に関係する行だけを書き直す。きっかけは共通の規則の文(`REVISION_RULE`)に3つ並べていたので、新しい入力を足すたびに一覧を直す必要があった(Phase 59 で、観点の表の変化がきっかけに入っておらず、聞き直した値が要件定義書に写らなかった)。この章では、各文書がプロンプトの節を「前の版・きっかけ・参照」に分けて持ち、規則の文をそこから組み立てる。テストが節と分け方の一致を確かめるので、節を足して分け方を決め忘れると落ちる。あわせて、要件定義書の写した行にも出どころの上限をかけ直す。

自動実装モード: on([introduction](./Phase-70-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/revision.py`](../samples/backend/app/documents/revision.py) | 更新 | `REVISION_RULE` → `RevisionInputs`・`revision_rule` |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | 写した行にも `cap_source` |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 更新 | `REVISION`(観点の表・修正指示・会話)。Phase 59 の1行を畳む |
| [`app/documents/external_design/drafting.py`](../samples/backend/app/documents/external_design/drafting.py) | 更新 | `REVISION`(上流の変わった行・修正指示。要件定義書は参照) |
| [`app/documents/internal_design/drafting.py`](../samples/backend/app/documents/internal_design/drafting.py) | 更新 | `REVISION`(同上。要件定義書・外部設計書は参照) |
| [`app/documents/implementation_plan/drafting.py`](../samples/backend/app/documents/implementation_plan/drafting.py) | 更新 | `REVISION`(同上。要件定義書・内部設計書は参照) |
| [`tests/unit/test_document_revision.py`](../samples/backend/tests/unit/test_document_revision.py) | 更新 | 規則の文・節の分け方・観点の表のきっかけ・写した行の出どころ |
| [`tests/unit/test_review_sendback.py`](../samples/backend/tests/unit/test_review_sendback.py) | 更新 | `REVISION_RULE` の import を外す |

## 1. 調べて分かったこと

| 文書 | 入力の節 | 前の規則が名指ししたきっかけ | 食い違い |
|---|---|---|---|
| 要件定義書 | 観点の表・前の版の要件・修正指示・会話 | 会話・上流の変わった行・修正指示 + Phase 59 の「観点の表の決めたこと」 | 【上流の変わった行】の節が無い。観点の状態・規模の変化はきっかけに無い |
| 外部設計書 | 前の版の画面・API・上流の変わった行・修正指示・要件定義書 | 会話・上流の変わった行・修正指示 | 【会話】の節が無い |
| 内部設計書・実装計画書 | 前の版・上流の変わった行・修正指示・上流の md | 同上 | 同上 |

- 要件定義書の写した行(`unchanged`)は前の版の行をそのまま使うので、観点が「決定」から「採用」に変わっても出どころが「ユーザー」のまま残った(`cap_source` は新しく書いた行にだけかけていた)。

## 2. 節の分け方から規則を作る(`revision.py`)

```python
# app/documents/revision.py
@dataclass(frozen=True)
class RevisionInputs:
    previous: tuple[str, ...]        # 前の版の行の節
    triggers: Mapping[str, str]      # きっかけの節 → 何が変わったら書き直すか
    context: tuple[str, ...] = ()    # 読むだけの節

    @property
    def sections(self) -> set[str]: ...

def revision_rule(inputs: RevisionInputs) -> str:
    """「【前の版の…】(前の版)があるときは…変更のきっかけは【A】(…)・【B】(…)。
    どのきっかけにも関係しない行は…unchanged を true…【参照】は読むだけ…」"""
```

```python
# app/documents/requirements/drafting.py
REVISION = RevisionInputs(
    previous=("前の版の要件",),
    triggers={
        "観点の表": "決めたこと・状態・規模が前の版の要件と食い違う(値・方式が具体になった・"
        "変わった、対象外になった・戻った)。その観点を points に持つ要件を書き直し、…",
        "修正指示": "設計レビューの採用した指摘。指示が指す要件を書き直す",
        "会話": "前の版の後の新しい依頼。関係する要件を書き直す・足す",
    },
)
SYSTEM_PROMPT = (... f"{revision_rule(REVISION)}")

# app/documents/external_design/drafting.py(内部・計画も同じ形)
REVISION = RevisionInputs(
    previous=("前の版の画面", "前の版の API"),
    triggers={"上流の変わった行": "…", "修正指示": "…"},
    context=("要件定義書",),
)
```

- 依存の向き: 各文書の `drafting` → `revision`(今までと同じ)。`revision` は文書を知らない。
- 非自明な判断: きっかけを並べるのをやめる案(「今回の入力のどれとも食い違わないなら unchanged」)は取らなかった。Phase 49 の狙い(頼んでいない行を言い換えない)が弱まるおそれがあるため。代わりに、並べる一覧を文書ごとのデータにして、テストで節と突き合わせる。
- 参照の節(上流の md)は「読むだけで、それ自体はきっかけにしない」と書く。上流の変化は【上流の変わった行】で渡すので、md 全体をきっかけにすると、変わっていない上流の行に引きずられて書き直す行が増える。

## 3. 写した行にも出どころの上限をかける(`assemble.py`)

```python
# app/documents/requirements/assemble.py(build_model の抜粋)
if r.unchanged and same is not None and same.kind == kind:
    source = cap_source(same.source, same.points, states, kind=kind)
    rows.append(same if source == same.source else same.model_copy(update={"source": source}))
    continue
```

- `cap_source` は上限なので、下がることはあっても上がらない(写した行の「採用」が、観点が決定になっても「ユーザー」には上がらない)。上げるのは、その行を書き直したとき(観点の表がきっかけ)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_revision_rule_names_previous_triggers_and_context` | `revision_rule` | pytest の関数 | スタブ不要 ── 純粋関数 | 前の版・きっかけ・参照の書き方、参照が無いとき |
| `test_every_prompt_section_is_classified_as_previous_trigger_or_context` | 4文書の `REVISION`・`SYSTEM_PROMPT`・`build_*_messages` | pytest の関数 | スタブ不要 ── メッセージを組み立てるだけの純粋関数 | プロンプトの `## 節` = 分け方の全部 / 規則の文がプロンプトに入る / 修正指示がきっかけ / 要件定義書は【上流の変わった行】・外部設計書は【会話】を名指ししない |
| `test_requirements_prompt_rewrites_rows_whose_point_was_decided_again`(更新) | 要件定義書の `REVISION` | pytest の関数 | スタブ不要 ── 定数 | 観点の表のきっかけが決めたこと・状態・規模を見る |
| `test_unchanged_requirement_source_is_capped_again_by_current_points` | `build_model`(要件定義書) | pytest の関数 | スタブ不要 ── 下書きの見本(fixtures)から作る純粋関数 | 写した行の出どころが観点の表で下がり、上がらない・本文は写したまま |
| `test_builders_put_instruction_section`(更新) | 4文書の `build_*_messages` | pytest の関数 | スタブ不要 | `REVISION_RULE` の確かめを外した(修正指示がきっかけであることは上のテストへ) |

- 節の名前は、テストが本文の `## ` で始まる行から読む。入力の md(見出しを持つ)は見出しの無い文にして渡す。
- この章で更新した本体のファイルは、すべて `test_document_revision.py` が import している(`assemble.py` は `app.documents.requirements.build_model` から)。テストが新しく import するのは、この章の `RevisionInputs`・`revision_rule`・各文書の `REVISION`、既存の `SYSTEM_PROMPT`・`build_requirements_messages`・`PointState`・`initial_states` で、前方 import は無い。
