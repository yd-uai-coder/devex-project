# Phase-46-1: 簡易モードの要素とたどり方

## この章の目的

簡易ドキュメントモードの4文書の model と段階8の model から、変更の影響を求めるための要素と参照を作る。詳細設計モードの「処理を軸」のたどり方を、処理別データフロー(DF)と実装計画書のタスクを軸にして簡易モードでも使えるようにする。どれも純粋関数で、記録(46-2)と画面(46-3)はこの章の部品を使う。

自動実装モード: on([introduction](./Phase-46-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/impact/elements.py`](../samples/backend/app/detailed_design/impact/elements.py) | 更新 | 要素の種類 `dataflow` を足す。文書の要素の組み立て(`add_document_elements`)と入れ物(`ElementBuilder`)・`row_body`・`parse_model` を簡易モードと共有できる名前にした |
| [`app/detailed_design/impact/trace.py`](../samples/backend/app/detailed_design/impact/trace.py) | 更新 | たどり方の軸の判定 `_is_axis`(処理・DF・文書のタスク) |
| [`app/detailed_design/impact/simple.py`](../samples/backend/app/detailed_design/impact/simple.py) | 新規 | `SimpleModels`(4文書と段階8の model)と `build_simple_elements` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 更新 | `SimpleModels`・`build_simple_elements` を re-export |
| ── ここからテスト ── | | |
| [`tests/fixtures/change_impact.py`](../samples/backend/tests/fixtures/change_impact.py) | 更新 | 簡易モードの見本(`simple_impact_documents`・`simple_impact_stage8`)と、段階8承認済みのプロジェクトを作る `create_simple_impact_project`(46-2 が使う) |
| [`tests/unit/test_impact_simple.py`](../samples/backend/tests/unit/test_impact_simple.py) | 新規 | 要素と参照、軸のたどり方、前後の版の差分と印 |

依存の向き: `simple` → `elements`(共有の部品)・`app.detailed_design.simple_procedure`(段階8と同じ規則)・`app.documents.*.model`。`trace` は `elements` だけを読む(`simple` を知らない。軸は要素の種類と置き場で決まる)。

```python
# app/detailed_design/impact/__init__.py(追記分)
from app.detailed_design.impact.simple import SimpleModels, build_simple_elements
```

## 要点の抜粋

### 1. 要素(simple.py)

```python
# app/detailed_design/impact/simple.py
@dataclass(frozen=True)
class SimpleModels:
    requirements: RequirementsModel | None = None
    external_design: ExternalDesignModel | None = None
    internal_design: InternalDesignModel | None = None
    implementation_plan: ImplementationPlanModel | None = None
    procedure_docs: ProcedureDocModel = field(default_factory=ProcedureDocModel)

    @classmethod
    def from_dicts(cls, stage8, documents=None) -> "SimpleModels": ...

def build_simple_elements(models: SimpleModels) -> list[Element]: ...
```

| キー | 置き場 | 参照する要素(辺の種類) |
| --- | --- | --- |
| `req:FR-001`・`screen:SCR-001`・`api:POST /api/v1/x` | 0 | 詳細設計モードと同じ(`add_document_elements` を共有) |
| `df:DF-1`(種類 `dataflow`) | 0 | トリガーの `api:`(trigger)・本文に名前の出るテーブル `table:`(table) |
| `table:<名前>` | 0 | なし(内部設計書 3.2 の列と説明が内容) |
| `module:<一覧の行のパス>` | 0 | 依存先のモジュール(depends) |
| `task:U-001` | 0 | `df:`(function)・`req:`(requirement)・`module:`(depends) |
| `unit:U-001` | 8 | `task:`(unit)・`df:`(implements)・`module:`(depends) |

- **単位の参照は段階8と同じ規則**で導く。計画は `normalize_plan(model.to_plan(), モジュール一覧)`、単位の DF とモジュールは `simple_unit_refs`、ファイルのパスは `module_layer` で一覧の層の行(`app/services/*.py` など)にそろえる。段階8の画面・生成が見ている参照と、影響の辺が食い違わないようにするため。
- **DF のテーブル**は `book_from_model` の `DataFlow.tables`(本文に名前が出るテーブル。Phase 31 の完了後の調整と同じ拾い方)。
- **内部設計書 3.3 の API 行は要素にしない**。API の要素は外部設計書 2.6 の行で、DF はトリガーでそこにつなぐ。2つの一覧は同じメソッド・パスにそろえてあるため(Phase 16)。
- **WBS の依存(`depends_on`)は辺にしない**。「先に終わっている必要がある」で中身の依存ではない(ベースライン S8 で、依存の連鎖をたどると後ろの単位まで広がった)。
- 手順書のキーで実装計画書のタスクに付かない単位(改名の後など)は要素にしない。前の版のグラフにだけ在れば、印は `marks_for` の前後を合わせたグラフで付く(テスト参照)。

### 2. たどり方の軸(trace.py)

```python
# app/detailed_design/impact/trace.py
def _is_axis(element: Element | None) -> bool:
    if element is None:
        return False
    if element.kind in ("function", "dataflow"):
        return True
    return element.kind == "task" and element.stage == DOCUMENT_STAGE
```

`_reached_functions` の「処理か」の判定をこれに替えた。簡易モードには段階1の処理が無いので、

- **DF を処理の代わり**にする。要件・画面・API は文書の要素を通って DF に届き、テーブルは DF から直接参照される。DF に届けば、その DF を持つタスク・単位を示す。
- **文書のタスク(置き場0)も軸に含める**。簡易モードでは要件はタスクが直接持つ(詳細設計モードで処理が `req_ids` を持つのに当たる)。タスクに届けば、その単位の手順書を示す(N4)。
- モジュールは軸ではない。モジュールの変更は直接の参照元(タスク・単位)と、そのタスクの単位までで止まり、共有の先へは広げない。

詳細設計モードの段階7のタスクは置き場7なので軸にならず、詳細設計モードの挙動は変わらない(既存の `test_impact_trace.py` が番人)。

### 3. elements.py の名前の変更

`_Builder`→`ElementBuilder`、`_documents(b, models)`→`add_document_elements(b, requirements, external_design)`、`_body`→`row_body`、`_parse`→`parse_model`。`simple.py` から使うので、モジュールの外から読む名前にした(#17: 同じ文書の要素を2か所で組み立てない)。

## 設計判断

- **要素の組み立ては別モジュール**にした。`DesignModels` に簡易モードの文書を足して `build_elements` を分岐させると、段階7の plan と実装計画書の plan のどちらから単位を作るかが入れ物の中で混ざる。モードはプロジェクトで決まり、同じグラフに両方が入ることは無い。
- **画面を通って別の DF に届く**(要件 → 画面 → 別の API → 別の DF)のは詳細設計モードと同じ規則のまま。見本では FR-001 の変更が、同じ画面を持つ GET の DF-2 の単位にも届く。過剰かどうかは Phase 42 からの申し送り(共有の画面)と一緒に Phase 49 で数える。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `build_simple_elements`・`SimpleModels.from_dicts` | pytest(`test_impact_simple.py`) | スタブ不要 ── 純粋関数(副作用なし)で、DB・LLM を呼ばないため | キーの形・置き場・辺、層の行へのそろえ方、タスクに付かない単位を除く、文書が無ければ空、WBS の依存は辺にしない |
| `impact_of`(簡易モードの軸) | 同上(要素は見本の model から素で作る) | スタブ不要 ── 同上 | DF の変更(スモーク)、タスクの変更は自分の単位だけ(S8)、要件はタスク経由で単位へ(N4)、テーブル → DF → 単位、モジュールは直接の参照元だけ、基盤の単位に届かない |
| `diff_elements`・`marks_for`(前後の版) | 同上 | スタブ不要 ── 同上 | DF のトリガーの変更(ID が変わる)で前の DF を持つ単位に印、タスクの改名(キーが変わる)で前のキーの単位に印、同じ版は差分0件 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_impact_simple.py tests/unit/test_impact_trace.py tests/unit/test_impact_elements.py -q
```
