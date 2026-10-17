# Phase-71-3: 画面の文の変更の波及を絞る

## この章の目的

変更の影響のたどり方では、画面が変わると、その画面のすべての処理に見直しの印が付く(Phase 49 の規則)。画面の UI 仕様は1つの文なので、どの部分が変わったかは画面の ID からは分からない。そのため、「参考資料の上限を5件に」の再生成で画面の文に「5件」が入ると、同じ画面のチャット・生成の処理にも印が付いた(Phase 49 の過剰 7 のうち 4。[49-4](../Phase-49/Phase-49-4.md))。

この章では、画面の変更が UI 仕様の本文だけのとき、同じ差分で一緒に変わった要件・API が届いた処理に、画面からの印を絞る。

自動実装モード: on([introduction](./Phase-71-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/impact/diff.py`](../samples/backend/app/detailed_design/impact/diff.py) | 更新 | `ui_spec_only` |
| [`app/detailed_design/impact/trace.py`](../samples/backend/app/detailed_design/impact/trace.py) | 更新 | `path_axis` |
| [`app/detailed_design/impact/marks.py`](../samples/backend/app/detailed_design/impact/marks.py) | 更新 | `marks_for` が `_narrowed_screen_text` で絞る |
| [`tests/unit/test_impact_marks.py`](../samples/backend/tests/unit/test_impact_marks.py) | 更新 | 絞る・絞らない(ほかの変更なし・本文の外の変更)・道の上の処理 |

## 1. 調べて分かったこと

- 画面の要素の内容(`Element.body`)は、行のキー以外の欄(名前・役割・優先度・要件・UI 仕様)の JSON で、1つの文字列として比べる。どこが変わっても「内容の変更」1件になる。
- 画面の行は、呼ぶ API や処理を持たない。画面 → API・処理のつながりは、API の `screens` と処理の `screens` の側にある。
- Phase 49 の過剰の2回では、変わったのは UI 仕様の本文だけだった。同じ差分の要件(FR-003)と API(アップロード)が、正解の処理に別の道で届いていた。
  - detailed-3: SCR-003 から F-05(チャット)の手順・単位にまで印が付いた。
  - simple-2: SCR-002 から DF-4・DF-5 にまで印が付いた。
- `impact_of` は変更を1つずつたどる。差分全体を見ているのは `marks_for` だけである。

## 2. 同じ差分の変更で絞る

```python
# app/detailed_design/impact/diff.py
def ui_spec_only(change: ElementChange) -> bool:
    """画面の内容の変更が、UI 仕様の本文(ui_spec)だけか(名前・役割・要件は同じ)。"""

# app/detailed_design/impact/trace.py
def path_axis(path: Sequence[str], by_key: Mapping[str, Element]) -> str | None:
    """道の上にある最初の軸(処理・処理別データフロー・文書のタスク)。"""

# app/detailed_design/impact/marks.py
def marks_for(before, after, changes, source) -> list[Mark]:
    reached = {c.key: impact_of(graph, c) for c in to_trace_changes(changes)}
    text_only = {c.key for c in changes if ui_spec_only(c)}
    for items in _narrowed_screen_text(reached, text_only, by_key).values(): ...

def _narrowed_screen_text(reached, text_only, by_key) -> dict[str, list[ImpactItem]]:
    others = {本文だけの画面以外の変更が届いた軸}
    for key in text_only:
        kept = {この画面が届いた軸} & others
        if kept:   # 届いていなければ絞らない
            reached[key] = [処理を通らない印 + kept の処理の印]
```

- 依存の向き: `marks` → `diff`・`trace`(今までと同じ)。`trace.path_axis` は既存の `_is_axis` を道に当てるだけである。
- 非自明な判断:
  - **`impact_of` は変えなかった**。変更1つのたどり方の意味(画面が変われば画面の処理すべて)は保つ。絞り込みは、差分全体を見る `marks_for` で行う。画面だけを変えた場合は、今までどおりすべての処理に届く。
  - **どの処理にも届いていなければ絞らない**。本文のどこが変わったかは分からないので、ほかの手がかりが無いときは見落としを作らないほうに倒す。
  - **名前・役割・要件が変わった画面は絞らない**(`ui_spec_only` が偽)。画面そのものの意味が変わったとみなす。
  - 本文だけの画面どうしでは絞り合わない(`others` に入れない)。2つの画面の変更が互いの根拠になると、どちらの変わった部分も分からないまま絞ることになるため。
  - 処理を通らない印(画面を参照する API そのものなど)は残す。
- 文の照合(変わった UI 仕様の行と、処理の名前・API の要約を語で比べる)は取らなかった。日本語の言い回しで外れやすいため。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_screen_text_change_is_narrowed_to_processes_reached_by_co_changes` | `marks_for`・`ui_spec_only` | pytest の関数 | スタブ不要 ── fixture の model を書き換えて `build_elements` で作る純粋関数 | UI 仕様の本文 + FR-001(F-01 だけ)→ 印は F-01 の側だけ |
| `test_screen_text_change_alone_reaches_all_screen_processes` | `marks_for` | 同上 | 同上 | ほかに変わったものが無ければ F-01・F-02 の両方 |
| `test_screen_change_beyond_text_is_not_narrowed` | `marks_for`・`ui_spec_only` | 同上 | 同上 | 名前も変わった画面は絞らない |
| `test_path_axis_finds_the_first_process_on_a_path` | `path_axis` | 同上 | 同上 | 道の上の最初の処理 / 処理の無い道は None |

- 既存の `test_impact_trace.py`(`impact_of` の単体。画面の変更は画面の処理すべて)は変えていない。たどり方そのものは変わっていないためである。
- この章で更新した本体のファイルは、すべて `test_impact_marks.py` が import している(`diff.ui_spec_only`・`trace.path_axis` は直接、`marks.py` は `app.detailed_design.impact` の `marks_for` から)。テストが新しく import するのは、この章の `ui_spec_only`・`path_axis` だけである。前方 import は無い。
- 効果は、Phase 49 の再生成の6回の記録に今の本体を当てて確かめた([71-4](./Phase-71-4.md))。
