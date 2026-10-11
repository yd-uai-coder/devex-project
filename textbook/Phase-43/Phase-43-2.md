# Phase-43-2: 要素の差分

## この章の目的

前と後の model から作った要素([42-3](../Phase-42/Phase-42-3.md) の `build_elements`)を突き合わせ、「何が変わったか」を要素の単位で求める(内容の変更・改名・消えた・増えた)。結果は [42-4](../Phase-42/Phase-42-4.md) のたどり方に渡す `Change` にする。[41-2](../Phase-41/Phase-41-2.md) 決定2 と、[Phase 42](../Phase-42/Phase-42-introduction.md) で申し送った「キーが変わり中身が同じなら改名」の実装。

自動実装モード: on([introduction](./Phase-43-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/data_model.py`](../samples/backend/app/detailed_design/data_model.py) | 更新 | `er_table_definitions`(ER のテーブル名 → 列と説明) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `er_table_definitions` の re-export |
| [`app/detailed_design/impact/elements.py`](../samples/backend/app/detailed_design/impact/elements.py) | 更新 | `Element.body`(元の行の内容)・`DesignModels.table_bodies`(テーブルの定義) |
| [`app/detailed_design/impact/diff.py`](../samples/backend/app/detailed_design/impact/diff.py) | 新規 | `DiffKind`・`ElementChange`・`diff_elements`・`to_trace_changes` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 更新 | `diff` の re-export |
| ── ここからテスト ── | | |
| [`tests/unit/test_impact_elements.py`](../samples/backend/tests/unit/test_impact_elements.py) | 更新 | スモークを `body` 込みの形に合わせ、内容にキーの欄が入らないことを確かめる |
| [`tests/unit/test_impact_diff.py`](../samples/backend/tests/unit/test_impact_diff.py) | 新規 | 種類ごとの判定・改名の1対1・参照だけの書き換え・ER のテーブル定義 |

re-export(#7): `from app.detailed_design.impact.diff import (DiffKind, ElementChange, diff_elements, to_trace_changes)`。依存の向きは `diff` → `elements`・`trace`(`trace` の `Change` を作る)。`elements`・`trace` は `diff` を読まない。

## 要点の抜粋

### 1. 要素の内容

```python
# app/detailed_design/impact/elements.py
@dataclass(frozen=True)
class Element:
    key: str
    kind: ElementKind
    stage: int
    label: str
    refs: tuple[Ref, ...] = ()
    body: str = ""  # 元の行の内容(キーになる欄を除いた正規化した JSON)

def _body(row: BaseModel, *keys: str) -> str:
    return _json(row.model_dump(mode="json", exclude=set(keys)))
```

- キーになる欄(`id`・`path`・`function_id` など)は内容から除く。改名(キーだけ変わる)を「内容が同じ」と判定するため。
- CRUD の `draft`(AI の下書きの印)は除く。承認で外れる印なので、内容の変更ではない。
- テーブルの内容は、ER の定義(`er_table_definitions`)を `DesignModels.from_dicts(..., er_tables=定義)` で渡したときだけ入る。名前の並びだけを渡す今までの呼び方はそのまま動く。

### 2. 差分の判定

```python
# app/detailed_design/impact/diff.py
DiffKind = Literal["added", "removed", "content", "rename"]

def diff_elements(before, after, *, stages=None) -> list[ElementChange]:
```

| 前後 | 判定 |
|---|---|
| 同じキーで `body` が違う | `content`(前後の `body` を持つ) |
| 消えたキーと増えたキーが、同じ種類・同じ `body` で1対1 | `rename`(`new_key` に後のキー、前後は名前) |
| 残り | `removed`・`added` |

- 比べるのは `body` だけで、辺(`refs`)は比べない。手順の行から導くモジュール → テーブルの辺のように、別の段階の変更でも辺が変わるため。
- 改名とみなす種類は、ID が名前そのもので内容が十分に厚いもの(要件・画面・API・処理・テーブル・モジュール・処理ロジック・横断事項)。CRUD・要約などは別の行と偶然そろうので、消えた・増えたのまま。
- 改名に合わせて参照の文字列を書き換えただけの変更(依存先のパスを新しい名前にした、など)は、変わったものに入れない。内容の変更として処理へ広げると、改名なのに使う処理の全部に印が付くため(後述)。
- `stages` を渡すと、その置き場の要素だけを比べる(段階の承認では、その段階の要素だけが変わったものになる)。

### 3. たどり方への変換

```python
def to_trace_changes(changes) -> list[Change]:
    """増えた要素は除く。消えた要素は前のキーの内容の変更。改名は rename。"""
```

増えた要素は、まだ誰からも参照されないので影響を求めない。消えた要素は、前のキーを参照している要素が見直しの対象になる。

## 設計判断

### 参照だけの書き換えを変わったものから外す

最初は、改名と一緒に依存する側のモジュールも「内容の変更」になり、そのモジュールを使う処理(F-01・F-02 の要約・CRUD・手順・作業単位…)の全部に印が付いた。改名は直接の参照元だけ([41-2](../Phase-41/Phase-41-2.md) の Claude の判断)という規則が、差分の段階で崩れていた。改名の前後の名前で `body` の中の参照(JSON の文字列の値)を書き換え、それで後と一致すれば変わったものに入れないようにした。依存する側のモジュールは、改名の直接の参照元として印が付く。

### ER のテーブル定義を内容に入れる(計画からの変更)

計画では「ER は前後とも今のものを使う」としていた。ベースラインの S6(テーブルに列を足す)で確かめると、列は段階3の model の外(ER の図)にあるため差分が0件になり、印が付かず、承認の条件も素通りになる。そこで、テーブルの要素の内容に ER の定義(列と説明)を入れ、段階3の写しに承認したときの ER の定義を添えることにした(写しの側は 43-3)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `diff_elements`・`to_trace_changes`・`Element.body`・`er_table_definitions` | pytest(`test_impact_diff.py`) | スタブ不要 ── どれも純粋関数(副作用なし)で、DB や LLM を呼ばないため。前後の model は fixture の dict を書き換えて作る | 処理の内容の変更(スモーク: 前後の内容・`Change`)、変更なし、モジュールの改名と参照だけの書き換え、他の書き換えもあれば内容の変更、内容の違う消えた・増えた、1対1でない組、下書きの印と導いた辺は変更でない、置き場の絞り込み、文書の要素、空の前、ER の列の追加 |
| `build_elements` のスモーク | pytest(`test_impact_elements.py`) | 同上 | `body` を除いて今までの形と同じ・内容にキーの欄が無い |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_impact_diff.py tests/unit/test_impact_elements.py
```
