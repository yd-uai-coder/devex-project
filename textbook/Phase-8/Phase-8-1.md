# Phase-8-1: 意味モデル(`app/uml/domain/`)

## この章の目的

UML設計図パイプラインの正本(Single Source of Truth)となる意味モデルを、component/ER/DFDの3notationについてPydanticで定義する。DBにも他レイヤーにも依存しない純粋な型定義であり、以降の章(永続化・バリデーション・API)がすべてこの型を再利用する。

学習モード([introduction](./Phase-8-introduction.md)参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/__init__.py`](../samples/backend/app/uml/__init__.py) | 新規 | 定型 | パッケージマーカー(空) |
| [`app/uml/domain/base.py`](../samples/backend/app/uml/domain/base.py) | 新規 | **コア** | `NotationType`・`NOTATION_TO_VIEW`(D5対応表の定数化)・`UmlElement`/`UmlRelation`(3notation共通の最小形) |
| [`app/uml/domain/data_item.py`](../samples/backend/app/uml/domain/data_item.py) | 新規 | **コア** | `DataItemField`(データ辞書1項目のフィールド定義。型・必須は任意項目) |
| [`app/uml/domain/component.py`](../samples/backend/app/uml/domain/component.py) | 新規 | **コア** | `ComponentElement`/`ComponentRelation`/`ComponentSemanticModel` |
| [`app/uml/domain/er.py`](../samples/backend/app/uml/domain/er.py) | 新規 | **コア** | `ErColumn`/`ErElement`/`ErRelation`/`ErSemanticModel` |
| [`app/uml/domain/dfd.py`](../samples/backend/app/uml/domain/dfd.py) | 新規 | **コア** | `DfdProcess`/`DfdExternalEntity`/`DfdDataStore`(discriminated union)・`DfdFlow`(`data_item_id`参照必須)・`DfdSemanticModel` |
| [`app/uml/domain/__init__.py`](../samples/backend/app/uml/domain/__init__.py) | 新規 | **コア** | `SemanticModel`(3notationのdiscriminated union)・`SemanticModelAdapter`(生dict→型付きモデルの復元)・`empty_semantic_model`(notation別の空モデル生成)・re-export |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_domain_models.py`](../samples/backend/tests/unit/test_uml_domain_models.py) | 新規 | **コア** | discriminated unionの解決、DFDフローの`data_item_id`必須チェック、`empty_semantic_model`の網羅性 |

## 設計判断

### なぜ`elements`/`relations`という属性名をcomponent/er/dfdで統一するか

DFDの用語としては「フロー(flow)」の方が自然だが、`app/uml/validation/structural.py`(Phase-8-3)が3notation共通の構造検証(ID重複・参照切れ)を「`model.elements`/`model.relations`を見るだけ」の1実装で書けるようにするため、あえて`DfdSemanticModel.relations: list[DfdFlow]`という命名にした。DFD固有の規則(診断8)は別途`app/uml/validation/dfd_rules.py`が同じ`model.relations`を見て判定する。

### なぜ`DfdFlow`に`label`のような自由記述フィールドを持たせないか

M2bの決定(「DFDの全フローは`DataItem`への参照にする、自由記述ラベルを禁止する」)を型レベルで強制するため、`DfdFlow`は`UmlRelation`の`id`/`source_id`/`target_id`に`data_item_id: uuid.UUID`を追加しただけで、任意の文字列ラベルを受け付けるフィールドを持たない。`data_item_id`を欠いたフロー(自由記述ラベルのみの入力)はPydanticのバリデーションエラーになる(`test_dfd_flow_rejects_free_text_label_without_data_item_id`)。

### なぜ`SemanticModelAdapter`(`TypeAdapter`)を用意するか

DBの`uml_diagrams.semantic_model`カラムは生`dict`(JSONB)として保持する(Phase-8-2参照)。この生`dict`を型付きモデルへ戻す処理が、Phase-8-3のバリデーション・Phase-8-4のAPI応答の両方で必要になるため、`SemanticModel`(discriminated unionの型エイリアス)から`TypeAdapter`を1つ作って`app/uml/domain/__init__.py`にまとめて置いた。各呼び出し側は`SemanticModelAdapter.validate_python(raw_dict)`を呼ぶだけでよい。

### なぜ`empty_semantic_model`をこの章で用意するか

Phase-8-3の`UmlDiagramService.create`(生成トリガーのプレースホルダー)が、notationごとに「要素・関係が空の意味モデル」を必要とする。実際のAI生成(Phase 10)に差し替わってもこの関数自体は不要にならない(バリデーションのテストフィクスチャ等でも使う)ため、ドメイン層に置いた。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `SemanticModelAdapter.validate_python` | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(Pydanticのバリデーションのみ、DB・外部依存を一切呼ばない)なため | `test_uml_domain_models.py`。**SUT/ドライバ/スタブ**の用語定義: SUT=テスト対象そのもの、ドライバ=SUTを呼び出す側(ここではpytestが直接)、スタブ=SUTが依存する外部要素を置き換える代役(本章はSUTが外部依存を持たないため一貫して「スタブ不要」)。以降の章はこの定義を前提に関係の明記のみ行う |
| `empty_semantic_model` | pytest(直接呼び出し、`@pytest.mark.parametrize`で3notation網羅) | スタブ不要 ── 同上 | 同上 |
