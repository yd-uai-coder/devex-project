# Phase-86-1: 印の今の状態と検証の条件

## この章の目的

反映した CR を「検証済み」にできるかを決める純粋関数を作る。反映で付いた印の写し([85-2](../Phase-85/Phase-85-2.md) の `applied_impact`)を今の段階の印と突き合わせ、印ごとに今の確認の状態を決める。印の付かない文書の側の要素(画面・API)は、保存した予測から CR の確認の項目にする(着手時の相談のユーザー決定)。比較([85-4](../Phase-85/Phase-85-4.md))の確認の状態も、写しの時点の値でなく今の状態で出せるようにする。

自動実装モード: on([introduction](./Phase-86-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | 記録だけの操作 `link_review`・`baseline`、`CHECKABLE_STATUSES`(反映済み)・`INCLUDABLE_STATUSES`(検証済み) |
| [`app/change_requests/comparison.py`](../samples/backend/app/change_requests/comparison.py) | 更新 | `compare` に `document_checks`(文書の側の確認の状態) |
| [`app/change_requests/verification.py`](../samples/backend/app/change_requests/verification.py) | 新規 | `MarkState`・`DocumentItem`・`Verification`、`mark_states`・`document_items`・`checked_documents`・`verification_of`・`with_confirmations` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の re-export |
| [`tests/unit/test_change_request_verification.py`](../samples/backend/tests/unit/test_change_request_verification.py) | 新規 | 印の今の状態・文書の側の確認・検証の条件・比較の確認の状態 |
| [`tests/unit/test_change_request_states.py`](../samples/backend/tests/unit/test_change_request_states.py) | 更新 | 反映の後の状態の表 |

依存の向き: `verification.py` → `comparison.AppliedMark`(85-4)・`prediction.Prediction`(83-2)・`app.detailed_design.impact`(`DOCUMENT_STAGE`・`StageImpact`・`cr_source`。既存)。DB にも LLM にも触らない。

## 1. 印の今の確認の状態

```python
# app/change_requests/verification.py(抜粋)
MarkConfirmation = Literal["open", "reviewed", "approved"]

def mark_states(applied: Sequence[AppliedMark], current: Mapping[int, StageImpact],
                number: int) -> list[MarkState]
    # 写しの印ごとに、今の段階の印(同じキー)を引く。
    # cr:<番号> を持つ印があれば reviewed / open、無ければ approved。
```

| 状態 | いつ | 理由 |
|---|---|---|
| `open`(未確認) | 今の段階に同じキーの印があり、`cr:<番号>` を持ち、未確認 | まだ人が見ていない |
| `reviewed`(確認済み) | 同じ印があり確認済み | 段階の画面で「確認した」を押した([Phase 43](../Phase-43/Phase-43-introduction.md) の `review_marks`) |
| `approved`(承認で済んだ) | 上の2つ以外 | 段階を承認すると印は消える。承認は、他から届いた未確認の印があると止まる(`blocking_marks`)ので、消えたのは確かめて承認した後 |

- **写しでなく今の印を見る**: 写しは反映のときに作るので、ふつうは未確認のまま。人が確かめたのは段階の行(`design_stages.impact`)の方に残る。
- **`cr:<番号>` で CR の印を見分ける**: 85-2 で印の出どころに足した。同じ要素に後から別の変更の印が届くと、`record` は出どころを足して未確認に戻すので、`cr:<番号>` は残ったまま `open` に戻る(確かめ直すまで検証できない)。印が消えた後に、別の承認で同じキーの印が付き直した場合は `cr:<番号>` を持たないので `approved` のまま。
- **段階の承認で付く印は CR に結ばない**(ユーザー決定): 文書の反映の印は、`impact_of` で下流まで推移的に届いている。段階を作り直して承認したときの印の多くは、同じ要素に重なる(上の「未確認に戻る」)。漏れ(新しく生まれた要素から先)は、Phase 89 の効果測定の「実際だけ」の数で確かめる。

## 2. 文書の側の確認の項目

```python
def document_items(prediction: Prediction, checked: Iterable[str]) -> list[DocumentItem]
    # 保存した予測の置き場0(画面・API)の要素を、予測の順に確認の項目にする
def checked_documents(existing, keys, reviewed, known) -> list[str]
    # 確認済みのキーを足す / 外す。予測に無いキーは無視し、並びは予測の順
```

- **項目は保存した予測から作る**(初期化は要らない): 予測は判断の時点で保存してあり(Phase 83)、反映した CR はいつも持っている。CR に残すのは確認済みにしたキーだけ(86-2 の列 `document_checks`)。
- **予測に無いキーは捨てる**: 画面が古いまま押したときに、知らないキーを溜めないため(段階の `set_reviewed` も知らないキーを無視する)。
- **印の仕組みは変えない**(ユーザー決定。段階0の印を足す案は採らなかった): 文書の要素に印を付けると、承認の止め方(`blocking_marks`)と段階の画面の両方を変えることになる。

## 3. 検証の条件と比較

```python
@dataclass(frozen=True)
class Verification:
    marks: tuple[MarkState, ...]
    documents: tuple[DocumentItem, ...]
    open_marks / open_documents / complete   # complete = どちらも未確認が0件

def with_confirmations(applied, states) -> list[AppliedMark]
    # 写しの reviewed を、今の状態(open 以外は確認済み)に置き換える
```

- `complete` は CR の状態を見ない。「反映済みか」は遷移の表(`verify` は `applied → verified`)でサービスが確かめる。
- 比較(85-4 の申し送り「比較の確認の状態」): サービスが `with_confirmations` で印の確認の状態を今の状態にしてから `compare` に渡す。`compare` に足した `document_checks` を渡すと、「予測だけ(文書の側)」の要素に確認の一覧の状態を出す(渡さなければ今までどおり `None`)。

## 4. 遷移の表

- `ChangeRequestAction` に `link_review`(レビューを結ぶ。86-3)・`baseline`(束に入れる。86-4)を足した。どちらも状態を変えない記録だけの行で、写しの `copied` と同じく `TRANSITIONS` には持たない(`allowed_actions` にも出ない)。
- `CHECKABLE_STATUSES = {"applied"}`: 文書の側の確認とレビューを結ぶのは反映済みの間だけ。検証済みになったら記録を変えない。
- `INCLUDABLE_STATUSES = {"verified"}`: 新しい合意済みの版に入れられるのは検証済みだけ。

## テスト観点

SUT は試験対象、ドライバは SUT を呼ぶもの、スタブは SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_verification.py`(新規) | `mark_states`・`document_items`・`checked_documents`・`verification_of`・`with_confirmations`・`Verification`、`compare` の `document_checks` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_states.py`(更新) | `CHECKABLE_STATUSES`・`INCLUDABLE_STATUSES` と遷移の表 | pytest のテスト関数 | スタブ不要 ── 表を読むだけ |

- 印の今の状態: 未確認 / 確認済み / 承認で消えた / 別の出どころだけの印が付き直した / ほかの CR の番号の印。
- 文書の側: 置き場0だけが項目になる / 知らないキーを捨てる / 外す / 予測から消えたキーを残さない。
- 検証の条件: 印か文書の側に未確認があれば `complete` でない / 両方済めば `complete` / 何も無ければ `complete`。
- 比較: 写しの確認の状態を今の状態に置き換える / 文書の側の確認の状態 / 渡さなければ `None`。
- 表示名の表がすべての状態を覆う。
