# Phase-96-2: 新しい要件の予測の起点からたどる(純粋関数)

## この章の目的

決定8-3([90-1](../Phase-90/Phase-90-1.md))の予測の部分を作る。新しい要件を足す CR は、起点になる要素が無いので予測に入らなかった(P83)。そのため、保存した予測に画面・API が無く、Phase 93 の保護が、新しい要件が載る既存の画面・API の変更まで合意の形へ戻しうる。この章で、人が選んだ起点(既存の要件・画面・API)から今のたどり方(`impact_of`)で予測する純粋関数と、説明書・反映の指示での見せ方を作る。起点の保存と API は 96-3。

自動実装モード: on([introduction](./Phase-96-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/prediction.py`](../samples/backend/app/change_requests/prediction.py) | 更新 | `predict(..., origins=)`・`PredictedOrigin`・`PredictedItem.origin_keys`・`Prediction.origins`・`origin_candidates`・`origin_candidates_from_snapshots`・`origin_name`・`ORIGIN_KINDS`・`ORIGIN_REASON` |
| [`app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 更新 | `ChangeRequestFacts.origin_labels`。2節・3節の起点 |
| [`app/change_requests/instruction.py`](../samples/backend/app/change_requests/instruction.py) | 更新 | `ORIGIN_LINE`(新しい要件の行の下に起点) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の名前の re-export |
| [`tests/unit/test_change_request_prediction.py`](../samples/backend/tests/unit/test_change_request_prediction.py) | 更新 | 起点からの予測・候補・保存の形 |
| [`tests/unit/test_change_request_explanation.py`](../samples/backend/tests/unit/test_change_request_explanation.py) | 更新 | 2節・3節の起点 |
| [`tests/unit/test_change_request_instruction.py`](../samples/backend/tests/unit/test_change_request_instruction.py) | 更新 | 起点の1行 |

## 1. 起点からたどる

```python
# app/change_requests/prediction.py(抜粋)
def predict(elements, targets, *, adds_requirement, texts=None, origins: Sequence[str] = ()) -> Prediction
```

- 起点は要素のキー(`req:FR-001`・`screen:SCR-001`・`api:POST /x`)。要素に無いキーは飛ばし、重なりは1つにまとめる。
- 起点ごとに `impact_of` でたどり、対象と同じ規則でまとめる(同じ要素に複数から届いたら短い道、同じ長さなら先。対象が先)。要素ごとに、届いた対象の要件(`requirement_ids`)と、届いた起点(`origin_keys`)を別に記録する。
- **起点の画面・API そのものも項目に入れる**(道は起点だけ、理由は `ORIGIN_REASON`「新しい要件の起点」)。新しい要件はその画面・API に載るので、見直しが要る。項目に入ると、保存した予測の文書の側の要素として、反映で書き換えてよい要素(`rewritable_keys`。Phase 93)と文書の側の確認の項目(Phase 86)に入る。これが無いと、保護が起点の画面の変更を戻してしまう。
- **起点の要件は項目に入れない**。起点に選んだ要件は「新しい要件の近くにある既存の要件」で、変えない(変えるなら対象にする)。合意のまま守る。
- 起点が1つでもあれば `unpredicted_new_requirement` は偽になる。保存の形(`to_dict`)に `origins`・`origin_keys` を足した。Phase 96 より前に保存した予測は、どちらも空として読む。

## 2. 起点に選べる要素

```python
# app/change_requests/prediction.py(抜粋)
ORIGIN_KINDS = ("requirement", "screen", "api")
def origin_candidates(elements) -> list[PredictedOrigin]          # 要素を組んだ順 = 文書の並び
def origin_candidates_from_snapshots(snapshots) -> list[PredictedOrigin]
```

- 要件・画面・API だけ(着手時の相談 (3)、決定8-3 の「既存の要件・画面・API」)。機能・作業単位などの設計の要素は、CR の段階ではまだ人に見せない粒度なので選ばせない。
- 候補は 96-3 の確かめと候補の API で共有する(#17)。

## 3. 説明書と反映の指示での見せ方

- 2節(対象の要件): 「このほかに、新しい要件を足します」の下に「新しい要件の予測の起点: SCR-001 予約画面・…。」(着手時の相談 (4))。
- 3節(影響の一覧): 冒頭の文を「対象の要件と新しい要件の起点からのつながり」にし、「届いた対象」の列に `新しい要件(起点 SCR-001)` を足す(`_reached_by`。名前は `origin_name` でキーの接頭辞を除く)。起点があれば「予測に入っていません」の注記は出ない。
- 反映の指示: 新しい要件の行の下に `ORIGIN_LINE`(「新しい要件が関わる既存の要素(予測の起点): …」)を1行足す。LLM が新しい要件を載せる場所の手がかりになる。
- 表示名は `ChangeRequestFacts.origin_labels` で渡す。反映の指示は予測を持たずに作るので、表示名は CR に保存したもの(96-3)を使う。
- 起点の無い CR の説明書は今までと同じ md になる(要約の fingerprint は変わらない)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_prediction.py`(更新) | `predict` の `origins`・`predict_from_snapshots`・`origin_candidates`・`origin_candidates_from_snapshots`・`origin_name`・`PredictedOrigin`・`ORIGIN_KINDS`・`ORIGIN_REASON`・保存の形・`rewritable_keys` との関係 | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_explanation.py`(更新) | `build_explanation` の2節・3節と `ChangeRequestFacts.origin_labels` | pytest のテスト関数 | スタブ不要(同上) |
| `test_change_request_instruction.py`(更新) | `build_cr_instruction` の `ORIGIN_LINE` | pytest のテスト関数 | スタブ不要(同上) |

- 起点の画面: それ自体が理由「新しい要件の起点」で入り、`impact_of` で届く要素と合わせた範囲になる。`rewritable_keys` に入る。
- 起点の要件: それ自体は入らず、届く範囲はその要件からのたどり方と同じ。
- 対象と起点が同じ要素に届いたら、短い道を残し、対象と起点を両方記録する。重なった起点は1つ。
- 要素に無い起点は飛ばし、すべて無ければ「予測なし」のまま。
- 保存の形の往復と、古い保存の形(起点の項目なし)の読み込み。
- 説明書の2節・3節、反映の指示の起点の行。新しい要件を足さない CR の指示に起点の行は出ない。
