# Phase-10-3: 出力から意味モデルへの変換(mapper)

## この章の目的

10-2 の出力スキーマを、Phase 8 のドメインの意味モデル(`ComponentSemanticModel`/`ErSemanticModel`/`DfdSemanticModel`)へ変換する純粋関数を作る。DFD だけは、データ項目の名前から UUID への対応表を外から受け取る。

自動実装モード: on([introduction](./Phase-10-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/generation/mapper.py`](../samples/backend/app/uml/generation/mapper.py) | 新規 | **コア** | `to_component`・`to_er`・`to_dfd`・`to_semantic_model`・`required_data_items` |
| [`app/uml/generation/__init__.py`](../samples/backend/app/uml/generation/__init__.py) | 更新 | 定型 | 本章の担当分として、`mapper` の公開シンボルを re-export する |
| ── ここからテスト ── | | | |
| [`tests/fixtures/uml.py`](../samples/backend/tests/fixtures/uml.py) | 更新 | 定型 | 本章の担当分として、`component_output()`/`er_output()`/`dfd_output()`(出力スキーマのサンプル)を追加する |
| [`tests/unit/test_uml_generation_mapper.py`](../samples/backend/tests/unit/test_uml_generation_mapper.py) | 新規 | **コア** | layer の引き継ぎ、ER のカラム・多重度、未定義の名前の補完、名前→UUID の解決、変換結果が M4 検証を通ること |

## 要点の抜粋

```python
# app/uml/generation/mapper.py
def required_data_items(output: DfdGenerationOutput) -> dict[str, list[DataItemField]]:
    """data_items で定義された項目 + フローが参照しているのに未定義の名前(フィールド無し)"""

def to_dfd(output: DfdGenerationOutput,
           data_item_ids_by_name: Mapping[str, uuid.UUID]) -> DfdSemanticModel:
    # processes / external_entities / data_stores を1つの elements に並べ、
    # flows の data_item_name を data_item_ids_by_name で UUID に置き換える

def to_semantic_model(output, data_item_ids_by_name=None): ...  # 出力の型で振り分ける
```

依存の向きは、`mapper` → `schemas`(10-2)・`app.uml.domain`(Phase 8)。

## 設計判断

### なぜ名前→UUID の対応表を「作る」処理と「使う」処理を分けたか

対応表を作るには DB を読み書きする。既存の項目を名前で引き、無ければ作成する必要がある。これをサービス層(10-5 の `_resolve_data_items`)に置き、mapper は出来上がった対応表を受け取って組み替えるだけにした。こうすると mapper は純粋関数になり、スタブ無しでテストできる。「どの項目を新しく作り、どれを再利用するか」という判断(ユーザーの編集を上書きしない)はサービス層のテストで確かめる。

### なぜフローが参照する未定義の名前も「必要なデータ項目」に含めるのか

LLM は `data_items` への定義を書き落とすことがある。そのときフローを捨てると、DFD の意味(どのデータが流れるか)が失われる。フィールドの無いデータ項目として作っておけば、図は成立する。フィールドは、あとでレビューするときに人が埋められる(診断8「図の下書きの品質は、承認前のレビューで人が直す」)。

### 空文字列の型を None にする理由

出力スキーマでは型を必須(`type: str`)にして、不明なら空文字列を返させている。データ辞書(`DataItemField.type: str | None`)では「不明」を None で表すので、変換で合わせる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `mapper.py` の各関数 | pytest(直接呼び出し) | スタブ不要。対象が純粋で、名前→UUID の対応表もテスト側で `uuid.uuid4()` を渡すだけのため | 変換結果を `validate_diagram`(Phase 8)に通し、エラーが無いことも確認する。出力のサンプルは共有フィクスチャ `tests/fixtures/uml.py` |
