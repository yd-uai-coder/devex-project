# Phase-95-1: 要素1つの履歴を組み立てる純粋関数

## この章の目的

合意の記録(Phase 91 の表⑳)は追記型なので、要素のキーごとに並べれば「いつ・何で・どう変わったか」が引ける(決定7)。この章では、その記録と、再生成の後に合意の形へ戻した版(版の `protection`。Phase 92・93)と、要素に関わる CR から、要素1つの履歴を組み立てる純粋関数を作る。DB を読むのは 95-2。

自動実装モード: on([introduction](./Phase-95-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/prediction.py`](../samples/backend/app/change_requests/prediction.py) | 更新 | `predicted_document_keys`(保存した予測の文書の側のキー)を出し、`rewritable_keys` がそれを使う |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `predicted_document_keys` の re-export |
| [`app/agreements/history.py`](../samples/backend/app/agreements/history.py) | 新規 | `element_history` と、入力の事実・出力の型 |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | `history` の re-export |
| [`tests/unit/test_agreement_history.py`](../samples/backend/tests/unit/test_agreement_history.py) | 新規 | 記録の分け方・戻しの挟み方・CR の拾い方 |

## 1. 材料と出力

```python
# app/agreements/history.py(抜粋)
def element_history(
    key: str,
    records: Sequence[RecordFacts],      # このキーの合意の記録(どの順でもよい)
    versions: Sequence[VersionFacts],    # 合意を守った版(protection = [{key, reason}])
    change_requests: Sequence[ChangeRequestRef],  # プロジェクトの CR
) -> ElementHistory  # key・kind・label・current・entries・change_requests
```

- 入力は DB の行でなく、行から写した dataclass(`RecordFacts`・`VersionFacts`・`ChangeRequestRef`)にした。CR のたどる記録(`trace.py` の `EventFacts`)と同じ形で、純粋関数を DB なしで試せるようにするためである。
- 合意の対象でないキー(`stage:3`・`unit:U-001` など。`kind_of` が None)は `ValueError`。API では 422 にする(95-2)。
- `label` は最新の記録の表示名、記録が無ければキーそのもの。`current` は最新の記録の中身(外れたなら None)。

## 2. 記録の分け方

| `event` | 条件 |
|---|---|
| `agreed` | 最初の記録、または「外れた」の後の記録 |
| `changed` | 前の合意と中身が違う |
| `reaffirmed` | 前の合意と同じ中身(束を作り直すと、変わっていない要素にも記録が足される) |
| `removed` | 中身が NULL(束に入らなかった・CR で無くなった) |

- 中身は `body_of`(Phase 91)で比べる。保存した形の欠けた欄(既定値)で「変わった」にならないようにするためである。
- 出どころの名前(B-n・採用にする・CR-n)は、記録の行から写して持つ。

## 3. 戻した版を挟む

- 版の `protection` にキーがある版を `restored` の行にする(戻した理由は「書き換えを戻した」/「落ちた要素を戻した」、CR を反映した版なら CR-n)。形の正しくない値は読まない。
- 並びは日時の順。同じ日時なら戻しの行を先に置く(CR の反映では、版を作ってから同じトランザクションで合意を更新するため)。
- **戻しは残っている版の分だけ**(着手時の相談 (3))。版は巡回(直近3件。CR の反映・束が指す版は残る)で消える。合意の中身の変化は消えない記録で追えるので、戻しは「LLM が変えようとしたが、守った」という補助の情報とみなした。

## 4. 関わる CR

- 要件のキー(`req:<ID>`)は、CR の対象(変更の種類つき)で拾う。画面・API のキーは、保存した予測(`predicted_impact`)の文書の側(置き場0)で拾う。
- 予測の文書の側のキーは、CR の反映で書き換えてよい要素(`rewritable_keys`。Phase 93)と同じ規則なので、`predicted_document_keys` に出して共有した(#17。消費者はこの履歴)。
- 状態は問わない。却下・取り下げも「その要素の変更が議論された」記録として出す。並びは番号の順。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_history.py`(新規) | `element_history`・`HISTORY_EVENT_LABEL`・`RESTORE_REASON_LABEL`(パッケージ `app.agreements` から)、`predicted_document_keys`・`rewritable_keys` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |

- 統合スモーク: 合意 → 同じ中身 → 中身が変わった → 外れた → もう一度合意、が順に分かれる(記録は逆順で渡す)。
- 既定値の欠けた保存の形は「同じ中身」。
- 戻した版は日時の順に挟まり、キーの無い版・知らない理由・形の悪い値は読まない。
- CR は対象(内容の変更・削除)と予測で拾い、無関係の CR は出ない。`rewritable_keys` の結果は今までと同じ。
- 利用者と使う場面(`users`)も同じ形。合意の対象でないキーは `ValueError`。
