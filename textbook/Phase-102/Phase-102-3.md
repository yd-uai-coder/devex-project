# Phase-102-3: 説明書の選択肢の節

## この章の目的

案のある CR の説明書に「選択肢」の節を入れ、規模の節を案ごとに比べられる表にする。クライアントは説明書だけで、案の中身(変える要件と変更後の文・結果)と手間(規模)を並べて見て、1つを選べる(決定2・6)。案の無い CR の md は1文字も変えない。変えると、以前に確かめた要約がすべて「古い」になるからである。

自動実装モード: on([introduction](./Phase-102-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 選択肢の節・種類 × 案の規模の表・節の番号の送り・`Explanation.option_scales` |
| [`backend/app/change_requests/summary.py`](../samples/backend/app/change_requests/summary.py) | 要約のプロンプトに、案ごとの違いとおすすめ |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 説明書の応答に `option_scales`(`OptionScaleRead`) |
| [`backend/tests/unit/test_change_request_explanation.py`](../samples/backend/tests/unit/test_change_request_explanation.py) | 6節の並び・選択肢の節・規模の表・合意の後・案が無いときの md |
| [`backend/tests/unit/test_change_request_summary.py`](../samples/backend/tests/unit/test_change_request_summary.py) | 要約のプロンプト |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 説明書の応答の `option_scales`(`test_option_routes` に足した分) |

## 1. 節の組み立て

```python
# app/change_requests/explanation.py(抜粋。build_explanation)
choosing = not options.empty and facts.decision_option is None
if choosing:
    scales = option_scales(options, snapshots, stage_states or {},
                           adds_requirement=facts.adds_requirement,
                           origins=[o.key for o in prediction.origins])
sections = [_section_request(facts), _section_targets(facts, rows, choosing=choosing)]
if not options.empty:
    sections.append(_section_options(facts))          # 3. 選択肢
first = len(sections) + 1                              # 案が無ければ3、あれば4
sections += [
    _section_option_scale(scales, first) if choosing else _section_scale(scale, first),
    _section_impact(prediction, excluded, first + 1, all_options=choosing),
    _section_questions(..., first + 2),
]
```

| CR | 節 |
|---|---|
| 案なし | 1 内容と背景 / 2 対象の要件 / 3 変更の規模 / 4 影響の一覧 / 5 合意の前に確かめたい点(Phase 101 のまま) |
| 案あり・合意の前 | 1 / 2 / **3 選択肢** / **4 規模(種類 × 案)** / 5 影響(すべての案を合わせた範囲)/ 6 確かめたい点 |
| 案あり・合意の後 | 1 / 2 / 3 選択肢(合意した案)/ 4 規模(今の表)/ 5 影響 / 6 確かめたい点 |

- 節の番号は引数で渡し、見出しの文字列だけを変える。案の無い CR は既定の番号(3・4・5)と今までの文のままなので、md は Phase 101 と同じになる(テストで `ChangeOptions()` を渡したときと渡さないときを比べ、開発 DB の17件の CR で指紋が変わらないことも確かめた)。
- 起点は、CR の予測の `origins`(キー)から渡す。`ChangeRequestFacts.origin_labels` は表示名だけで、予測にはキーが要るからである。

## 2. 選択肢の節

```
## 3. 選択肢

この節は、変更の進め方の案です。案ごとに変える要件と結果が違います。1つを選んで合意してください。
おすすめは案1です。理由: 早く出せる。

### 案1 登録だけ(おすすめ)

| 要件 ID | 変更の種類 | 変更後の案 |
|---|---|---|
| FR-001 | 内容の変更 | 備考を付けて登録できる |

結果: 小さく 済む
```

- 案ごとに見出し(`### 案1 名前(おすすめ・合意した案)`)・変える要件の表・結果。対象の無い案は「既存の要件は変えません(新しい要件を足すだけです)。」。
- 合意の後は、おすすめの行の代わりに「合意した案: 案1 名前。」を置く。
- 2節の「変更後の案」が空のとき、合意の前は「(3節の案を参照)」にする(案ごとに文が違うため)。

## 3. 規模の節(種類 × 案)

```
| 種類 | 案1 登録だけ | 案2 登録と一覧 |
|---|---|---|
| 作業単位 | 1件 | 2件 |
| ファイル | 3件 | 3件 |
...
- 案2の作業単位・ファイル: 設計の処理につながらない要件がある(FR-003)
```

- 数えられない種類があれば頭に1文足す(Phase 101 の規模の節と同じ扱い)。内訳(作業単位の名前など)は表に入れない。案を手間で比べるのが目的で、内訳は合意の後の規模の表で読める。
- 理由と注記は、案ごとに同じ理由の種類をまとめて1行にする(Phase 101 の「種類をまとめる」を案の中で行う)。
- 影響の一覧は、CR の対象(= すべての案の対象を合わせたもの)の予測のまま。頭に「すべての案を合わせた範囲です」を足し、どの案から届いたかは「届いた対象」の要件 ID で読む。

## 4. 応答と要約のプロンプト

- `Explanation.option_scales` を、説明書の応答の `option_scales`(案ごとの番号・呼び名・名前・おすすめ・規模)に出す。合意の前の案のある CR だけで、ほかは空。`scale` はすべての案を合わせた範囲のまま(画面は Phase 107)。
- 要約のプロンプトに「選択肢の節があれば、案ごとの違い(変える要件と規模)と、おすすめの案と理由を書く」を足した。プロンプトだけで、説明書の md は変わらない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_explanation.py`(選択肢の4本) | `build_explanation`・`Explanation.option_scales`・`ChangeRequestFacts`(`options`・`decision_option`) | pytest のテスト関数 | スタブ不要 ── 純粋。入力は変更の影響の fixture を束の写しの形に並べたもの |
| `test_change_request_summary.py`(プロンプト) | `build_summary_messages` | pytest のテスト関数 | スタブ不要 ── 純粋 |
| `test_change_requests_api.py`(`test_option_routes` の 102-3 の分) | ルート `get_change_request_explanation`・スキーマ `OptionScaleRead` | pytest のテスト関数 | SQLite のセッションと fixture |

- 案あり・合意の前: 6節の見出しの順、2節の「(3節の案を参照)」、おすすめの1文、案の見出しと表(削除は「(削除)」)、結果の改行をまとめる、種類 × 案の表の数が `option_scales` と同じ、影響の頭の1文。
- 合意の後: 「合意した案」、見出しの「おすすめ・合意した案」、規模は今の表、`option_scales` は空。
- 対象の無い案の文。おすすめが無ければ1文を出さない。
- 案が無いとき: 空の案を渡しても、渡さないときと同じ md。
- 応答: 合意の前は案ごとの規模、案を選んだ後は空で、md に合意した案。
