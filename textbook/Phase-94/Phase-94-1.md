# Phase-94-1: 確認事項を組み立てる純粋関数

## この章の目的

確認事項の一覧に出す項目(推測の要件・推測の利用者・根拠が未決の観点)を、今の要件定義書の model と観点の表から決定的に並べる純粋関数と、推測の採用率の数え方を作る。今はプレビューに推測の要件が出るだけで、推測の利用者と、根拠が未決の観点は出ない([ベースライン](../../appendix/measurements/stage12-baseline.md) の判定 △)。

自動実装モード: on([introduction](./Phase-94-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | 根拠の観点の規則 `grounding_points` と `USER_POINTS` を公開、`mark_user_adopted` |
| [`app/documents/requirements/__init__.py`](../samples/backend/app/documents/requirements/__init__.py) | 更新 | 上の3つの re-export |
| [`app/confirmations/items.py`](../samples/backend/app/confirmations/items.py) | 新規 | 項目・キー・`confirmation_items`・`adoption_counts` |
| [`app/confirmations/__init__.py`](../samples/backend/app/confirmations/__init__.py) | 新規 | re-export |
| [`tests/unit/test_confirmation_items.py`](../samples/backend/tests/unit/test_confirmation_items.py) | 新規 | 並び・根拠の規則・未決だけ・refs・利用者の採用・採用率 |

## 1. 根拠の観点の規則を共有する(`assemble.py`)

```python
# app/documents/requirements/assemble.py(抜粋)
USER_POINTS = ("users", "daily_flow")

def grounding_points(points: Sequence[str], kind: str = "") -> list[str]
def mark_user_adopted(model: RequirementsModel, user: str) -> RequirementsModel | None
```

- 「根拠が未決の観点」の「根拠」は、出どころの上限(`cap_source`)を決める観点と同じでなければならない。違えば、一覧に出ない観点のせいで行が推測に下がる、といったずれが起きる。そこで `cap_source` の中にあった「規模は除く。ただし制約の行は規模も含む」を `grounding_points` に出し、`cap_source` と確認事項の両方で使う(#17。消費者 = 確認事項の組み立て)。1.2 の根拠の観点 `_USER_POINTS` も公開名にした。
- `mark_user_adopted` は `mark_adopted` の 1.2 版。1.2 の行には ID が無いので、利用者の名前で指す(94-3 で確認済みにしたときに使う)。

## 2. 項目と並び(`app/confirmations/items.py`)

```python
# app/confirmations/items.py(抜粋)
ConfirmationKind = Literal["requirement", "user", "point"]
ConfirmationStatus = Literal["unconfirmed", "confirmed", "rejected"]
Opportunity = Literal["next_meeting", "email", "implementation", "none"]

@dataclass(frozen=True)
class ConfirmationItem:
    key: str; kind: ConfirmationKind; label: str; refs: tuple[str, ...] = ()

def confirmation_items(model: RequirementsModel | None,
                       states: Mapping[str, PointState]) -> list[ConfirmationItem]
def adoption_counts(entries: Iterable[tuple[ConfirmationKind, ConfirmationStatus, bool]]
                    ) -> AdoptionCounts
```

- **キー**(Claude の判断): 推測の要件は `req:<ID>`(合意の記録のキーと同じ)、推測の利用者は `user:<名前>`(行に ID が無い)、観点は `point:<観点のキー>`。`requirement_item`・`user_item` が表示名つきの項目を作る(94-3 の採用からも使い、表示名をそろえる)。
- **並び**: 推測の要件(文書の順)→ 推測の利用者 → 根拠が未決の観点(観点の表の順)。
- **根拠が未決の観点**: すべての要件の行(推測の行だけではない)の `grounding_points` と、1.2 に行があるときの `USER_POINTS` のうち、**今の観点の表**で `open` のもの。観点の表に行が無い観点は未決とみなす(`load_states` と同じ)。`refs` に、その観点に頼っている要件 ID(1.2 は `1.2`)を付ける。説明書(Phase 84)は束の写しの `point_statuses` を読むが、確認事項は「今、何を決めるか」なので今の表を読む。
- 対象外(`not_applicable`)の観点は出さない。観点の表の「対象外(後で決める)」で、利用者が既に扱いを決めたものだからである。

## 3. 推測の採用率

- `AdoptionCounts.rate` = 確認済み ÷(確認済み + 却下)。分母が0なら None(ユーザー決定)。
- 数えるのは推測の要件・推測の利用者だけ(観点は行ではない)。
- 確認済み・却下は、今の一覧から消えたもの(採用にして推測でなくなった行)も数える。未確認は今の一覧にあるものだけ数える(消えた行の未確認を数えると、使われなくなった行が残り続ける)。
- docs の当初の定義「後で採用・修正された割合」は、文の修正を追うには一覧を保存して行の行方を追う必要があった。ユーザーは状態から数える形を選び、定義を「一覧で確認済みにした割合」に改めた。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_confirmation_items.py`(新規) | `confirmation_items`・`adoption_counts`・項目とキーの関数・`grounding_points`・`mark_user_adopted` | pytest のテスト関数 | スタブ不要 ── 純粋関数(副作用なし)で、LLM・DB を呼ばないため。観点の表は `PointState` を直接作って渡す |

- 統合スモーク: 推測の要件2行・推測の利用者1行・決まった観点1つの model で、項目の並びが「要件 → 利用者 → 観点」になる。
- 規模は制約の行だけ根拠に数える(FR の `scale` は出ない)。決定・採用・対象外の観点は出ない。表に行の無い観点は未決。model が無ければ空。
- 採用率: 消えた確認済みは数え、消えた未確認は数えない。観点は数えない。分母0は None。
- 既存の `test_requirements_doc.py`(`cap_source` を含む)が、`grounding_points` へ出したリファクタの番人。
