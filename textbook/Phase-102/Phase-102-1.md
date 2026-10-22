# Phase-102-1: 案の形と案ごとの規模(純粋関数)

## この章の目的

CR に2〜3の案(選択肢)を持たせるための、案の型・整え方・保存の形と、案ごとの規模の数え方を純粋関数で作る。クライアントは案を手間で比べて選ぶ。案ごとに変える要件が違えば予測も違うので、規模は案の対象で数え直す(決定2。[100-1](../Phase-100/Phase-100-1.md))。規模の数え方そのものは [Phase 101](../Phase-101/Phase-101-1.md) の `predicted_scale` をそのまま使う。

自動実装モード: on([introduction](./Phase-102-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/options.py`](../samples/backend/app/change_requests/options.py) | 新規。案の型・規則・CR の対象との照らし合わせ・保存の形・案ごとの規模 |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 案の名前を re-export |
| [`backend/tests/unit/test_change_request_options.py`](../samples/backend/tests/unit/test_change_request_options.py) | 新規。案の純粋関数のテスト |

## 1. 型

```python
# app/change_requests/options.py(抜粋)
@dataclass(frozen=True)
class ChangeOption:
    name: str
    targets: tuple[Target, ...]   # この案で変える対象(CR の対象の部分集合。種類・変更後の案つき)
    outcome: str                  # 結果(手間・影響・トレードオフを書く自由記述)


@dataclass(frozen=True)
class ChangeOptions:
    items: tuple[ChangeOption, ...] = ()
    recommended: int | None = None   # おすすめの案の番号(1始まり)
    reason: str = ""

    @property
    def empty(self) -> bool: ...
    def option(self, number: int) -> ChangeOption: ...   # 範囲の外は IndexError
```

- 案は位置の番号(`案1`〜`案3`。`option_label`)で呼ぶ。案の順を変えると番号も変わるが、案を直せるのは合意の前だけ(下書き・説明済み)で、合意で選んだ番号は後で変わらない。
- 対象は `targets.Target`(Phase 83・84)をそのまま使う。案の対象は CR の対象の中から選び、案ごとに種類(内容の変更・削除)と変更後の案を持てる(相談の決定2)。
- 新しい要件を足す印と予測の起点は CR に1つで、どの案にも共通。案ごとに起点を変えると、2節・影響の一覧の起点の出し方まで案ごとに分かれるからである。
- 結果は1つの欄(相談の決定4)。ステージ6 の選択肢カードと同じ形で、数は規模の表が決定的に出す。

## 2. 規則 `normalize_options` と、CR の対象との照らし合わせ `option_target_problems`

```python
# app/change_requests/options.py(抜粋)
def normalize_options(options: ChangeOptions) -> ChangeOptions:
    """名前の空白をまとめ、結果・理由の前後の空白を除き、各案の対象を整える(normalize_targets)。
    案の数が2〜3でない・名前か結果が空・名前が重なる・おすすめの番号が範囲の外・
    番号があるのに理由が空・番号が無いのに理由がある → ValueError。案が0件なら空。"""


def option_target_problems(options, targets, adds_requirement) -> list[str]:
    """案の対象が CR の対象に無い / 対象の無い案(新しい要件を足さない CR)を、文で返す。"""
```

- 規則を2つに分けた。`normalize_options` は案だけで決まる規則で、スキーマ(102-2)が 422 の検証の誤りにする。`option_target_problems` は CR の対象が要るので、サービス(102-2)と下書きの照合(102-4)が呼ぶ。
- 案の数は0件か2〜3件。1件だけの案は選ぶものが無く、説明書の選択肢の節の意味が無い。

## 3. 保存の形

- `options_to_json` は `{items: [{name, targets, outcome}], recommended, reason}`。`targets` は `targets_to_json` と同じ形。案が無ければ `None`(列は NULL)。
- `options_from_json` は `None`・空を案なしとして読む。`options_from_rows` は (名前, 対象, 結果) の並びから組む(スキーマと LLM の下書きから使う)。

## 4. 案ごとの規模 `option_scales`

```python
# app/change_requests/options.py(抜粋)
@dataclass(frozen=True)
class OptionScale:
    number: int
    name: str
    scale: Scale
    recommended: bool = False


def option_scales(options, snapshots, stage_states, *, adds_requirement, origins=()) -> tuple[OptionScale, ...]:
    for number, option in enumerate(options.items, start=1):
        prediction = predict_from_snapshots(snapshots, option.targets,
                                            adds_requirement=adds_requirement, origins=origins)
        ... predicted_scale(option.targets, prediction, snapshots, stage_states) ...
```

- 規模は Phase 101 の `predicted_scale` をそのまま、案の対象で呼ぶ(#17。数え方を案のために複製しない)。予測は案ごとに束の写しから求める(案は2〜3件なので、要素を組み直す手間は小さい)。
- 対象の無い案(新しい要件を足すだけ)は、CR に共通の起点で予測する。起点が無ければ、すべての種類が「数えられない」(Phase 101 と同じ規則)。

## テスト観点

**SUT / ドライバ / スタブ**(#14):

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_options.py` の全テスト | `normalize_options`・`option_target_problems`・`options_to_json`・`options_from_json`・`options_from_rows`・`option_scales`・`option_label` と、`ChangeOption`・`ChangeOptions`・`OptionScale` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。規模の入力は、変更の影響の fixture(`tests/fixtures/change_impact.py`。要件3件・段階1〜8)を束の写しの形に並べたもの |

- 整え方: 名前の空白・結果と理由の前後の空白。案と対象の順はそのまま。
- 規則: 案の数(1件・4件)・名前の重なり・空の結果・おすすめの番号と理由の組・削除の対象の案の文。
- CR の対象との照らし合わせ: CR に無い要件・対象の無い案(新しい要件を足す CR なら許す)。
- 保存の形: 往復・案なしは `None`。
- 案ごとの規模: FR-001 だけの案より FR-001・FR-002 の案のほうが作業単位が多い。おすすめの印。対象の無い案は起点が無ければ数えられない。

`__init__.py` の re-export は、このテストが `app.change_requests` から import して通る(#15)。
