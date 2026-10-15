# Phase-59-4: 簡易モードの手順書に異常系のテスト観点を入れる

## この章の目的

簡易モードの実装手順書は、テスト観点が正常系だけになる([58-3](../Phase-58/Phase-58-3.md)。機能の3単位すべて)。詳細設計モードは段階5 の手順の分岐を観点に写すので、異常系が出る。簡易モードの参照は流れの表だけで、分岐が無い。着手時の相談で、生成の指示に足すだけでなく、**決定的な検証 `NO_ERROR_TEST` も足す**と決めた(推奨は指示だけ。ユーザーの選択)。

調べると、簡易の参照(外部設計書 2.6 の行)にはエラーの欄が渡っていなかった。そのため、指示を足す前に、参照にエラー欄を載せる必要があった。

自動実装モード: on([introduction](./Phase-59-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/api_list.py`](../samples/backend/app/detailed_design/api_list.py) | 更新 | `ApiEndpoint.errors`(「エラー」の列)・`error_statuses`(テスト仕様書から移した) |
| [`app/documents/test_spec/obligations.py`](../samples/backend/app/documents/test_spec/obligations.py) | 更新 | `error_statuses` を `api_list` から import する |
| [`app/detailed_design/simple_procedure/refs.py`](../samples/backend/app/detailed_design/simple_procedure/refs.py) | 更新 | 2.6 の行にエラー欄・`unit_error_statuses` |
| [`app/detailed_design/simple_procedure/__init__.py`](../samples/backend/app/detailed_design/simple_procedure/__init__.py) | 更新 | `unit_error_statuses` の re-export |
| [`app/detailed_design/procedure_coverage.py`](../samples/backend/app/detailed_design/procedure_coverage.py) | 更新 | `error_test_gap` |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `_error_test_issues`(`NO_ERROR_TEST`) |
| [`app/detailed_design/procedure_doc_drafting.py`](../samples/backend/app/detailed_design/procedure_doc_drafting.py) | 更新 | 簡易の指示に、正常系に加えてステータスごとの異常系 |
| [`tests/unit/test_external_api_list.py`](../samples/backend/tests/unit/test_external_api_list.py) | 更新 | エラーの列の読み取り |
| [`tests/unit/test_simple_procedure_refs.py`](../samples/backend/tests/unit/test_simple_procedure_refs.py) | 更新 | 2.6 の行のエラー欄・単位のステータス |
| [`tests/unit/test_procedure_coverage.py`](../samples/backend/tests/unit/test_procedure_coverage.py) | 更新 | `error_test_gap` の判定表 |
| [`tests/unit/test_simple_procedure_validation.py`](../samples/backend/tests/unit/test_simple_procedure_validation.py) | 更新 | `NO_ERROR_TEST` のコード・重要度・直す先 |
| [`tests/unit/test_procedure_doc_drafting.py`](../samples/backend/tests/unit/test_procedure_doc_drafting.py) | 更新 | 簡易だけの指示の文言 |

依存の向き: `api_list` ← `obligations`・`refs` ← `simple_procedure/__init__` ← `validation` → `procedure_coverage`。

## 1. エラー欄を読む(`app/detailed_design/api_list.py`)

責務: 外部設計書 2.6 の API 一覧の表を読む純粋関数(Phase 16)。

```python
# app/detailed_design/api_list.py
_STATUS = re.compile(r"(?<!\d)([45]\d\d)(?!\d)")

@dataclass(frozen=True)
class ApiEndpoint:
    method: str
    path: str
    summary: str
    screens: tuple[str, ...]
    errors: str = ""  # 「エラー」の列(内部設計書 3.3節の表のように列が無ければ空)

def error_statuses(errors: str) -> list[str]: ...
# _header_columns の names に "errors": "エラー"
```

- 非自明な判断(#17): `error_statuses` は Phase 56 でテスト仕様書の `obligations.py` に作った関数である。手順書の検証も「エラー欄の HTTP ステータス」という同じ事実を要るので、コピーせず共有した。置き場所は `app/detailed_design/api_list.py` にした。`app/documents/test_spec` は既に `app/detailed_design` を import している(`assemble`・`links`)ため、逆向きに import すると循環する。エラー欄は API 一覧の列の話なので、API 一覧を読む葉のモジュールに置くのが自然である。`obligations.py` は `api_list` から import し、パッケージの `__init__` の re-export(`app.documents.test_spec.error_statuses`)はそのまま残した。
- `errors` に既定値を付けたので、`ApiEndpoint` を作る既存の呼び出し(内部設計書 3.3 の表・`book_from_model`)は変えていない。

## 2. 簡易の参照にエラー欄を添える(`simple_procedure/refs.py`)

責務: 簡易モードの単位が参照する設計の導出と展開(純粋関数。Phase 31)。

```python
# app/detailed_design/simple_procedure/refs.py
errors = f" / エラー: {external.errors}" if external.errors.strip() else ""
lines.append(f"- API(外部設計書 2.6): {key} ── {external.summary or '—'}(関連画面: {screens}){errors}")

def unit_error_statuses(task: PlanTask, book: SimpleDesignBook) -> list[str]:
    """単位の処理(DF)の API の、外部設計書 2.6 の「エラー」欄の HTTP ステータス(出てきた順)。"""
```

- `__init__` は `unit_error_statuses` を re-export する(検証が `from app.detailed_design.simple_procedure import module_layer, unit_error_statuses` で使う)。
- 参照の md は、生成の入力・画面の単位の詳細・AI 向けの出力の3か所が同じ関数を使う(Phase 31)。そのため、エラー欄は画面と AI 向けの出力にも出る。

## 3. 生成の指示(`procedure_doc_drafting.py`)

```python
# app/detailed_design/procedure_doc_drafting.py(SIMPLE_PROCEDURE_DOC_SYSTEM_PROMPT の抜粋)
"- tests には、正常系の観点(処理が成功する)に加えて、参照の API(外部設計書 2.6)の"
"「エラー」にある HTTP ステータスごとに、異常系の観点を1つ入れ、観点にそのステータスを書く"
"(例: 「他人のプロジェクトを指すと 404」)\n"
```

- 非自明な判断: **「正常系に加えて」を書かないと、異常系だけになった**。最初の指示(「ステータスごとに異常系の観点を1つ」だけ)で作り直すと、機能の3単位すべての観点が異常系だけになり、正常系が消えた([59-6](./Phase-59-6.md))。指示に足した観点に引っぱられて、もとの観点が押し出された。Phase 58 のレビューの指示(観点を足したら件数の上限を外す)と同じ形の副作用である。
- 詳細設計モードの指示は変えていない(段階5 の分岐から異常系が出るため)。

## 4. 決定的な検証(`procedure_coverage.py`・`validation.py`)

```python
# app/detailed_design/procedure_coverage.py
_ERROR_WORDS = re.compile(r"エラー|失敗|拒否|異常|不正")

def error_test_gap(statuses: Sequence[str], doc: UnitProcedure) -> tuple[str, ...]:
    """ステータスが観点・SUT・GWT のどれかに出るか、観点の文に異常系の言葉があれば空。
    無ければ、そのステータスすべて。"""

# app/detailed_design/validation.py(簡易モードの分岐)
issues + _simple_procedure_issues(...) + _error_test_issues(basis, matched) + _coverage_issues(...)
# _error_test_issues: 機能の単位だけ。軽微・直す先は手順書(段階8)・コード NO_ERROR_TEST
```

- 重要度は軽微、直す先は手順書(`NO_TEST_FILE` と同じ)。見るのは機能の単位だけである(基盤の単位は処理を持たない)。
- 非自明な判断: **ステータスごとの網羅は見ない**。1つでも異常系があればよしとする。ステータスごとのテストは、テスト仕様書の必要なテスト(Phase 56)が受け持つ。手順書の観点は単体テストの手がかりなので、「異常系がまったく無い」穴だけをふさぐ。
- 非自明な判断: **観点の文の異常系の言葉も見る**。dev の DB の簡易の手順書 13本に流したところ、番号を書かずに「登録済みのメールアドレスでの重複登録時にエラーとなること」と異常系を書いた単位が1件、指摘された。そこで、観点の文にある言葉も見ることにした。Given / When / Then の文の言葉は見ない(「エラーなく保存される」のような正常系の文に当たるため)。
- 詳細設計モードは見ない(段階5 の分岐を写すので、Phase 58 の新しい詳細では 12単位中 9単位が異常系を持っていた)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_extract_api_endpoints_reads_error_column`(新規) | `extract_api_endpoints`・`error_statuses` | pytest | スタブ不要 ── 純粋関数。列があれば読み、無ければ空 |
| `test_dataflow_api_row_carries_error_column_and_statuses`(新規) | `expand_simple_ref`・`unit_error_statuses` | pytest | スタブ不要 ── 純粋関数。2.6 の行にエラー欄が添えられ、単位のステータスが取れる。エラー欄の無い外部設計書では空 |
| `test_error_test_gap`(新規。判定表6行) | `error_test_gap` | pytest(parametrize) | スタブ不要 ── 純粋関数。観点に無い / 観点に番号 / GWT に番号 / 観点に言葉 / GWT の言葉は見ない / ステータスなし |
| `test_feature_without_error_test_points_to_the_procedure`(新規) | `validate_procedure_doc`(簡易) | pytest | スタブ不要 ── 入力は4文書の本文と model だけ。コード・重要度・直す先・メッセージのステータス、観点に 409 を足すと指摘が消える |
| `test_simple_prompt_asks_error_test_per_status`(新規) | `SIMPLE_PROCEDURE_DOC_SYSTEM_PROMPT` | pytest | スタブ不要 ── 定数。正常系に加えて、の文言と、詳細の指示には無いこと |

- 既存の題材(`tests/fixtures/simple_procedure.py` の外部設計書)にはエラーの列が無いので、既存のテストの結果は変わらない(`test_consistent_documents_have_no_findings` は0件のまま)。新しいテストは、題材の外部設計書にエラーの列を足した版を、テストの中で作る。
- `obligations.py` の import の変更は、既存の `test_test_spec_obligations.py`(`app.documents.test_spec` から `error_statuses` を import して確かめる)が守る。更新した本体のファイルは、すべてこの章のテストか既存のテストが import している(#15)。
- 実 import 監査(#15): `obligations` → `api_list.error_statuses`・`refs` → `api_list.error_statuses`・`validation` → `procedure_coverage.error_test_gap`・`simple_procedure.unit_error_statuses`。どれもこの章で作ったもので、前方 import は無い。
