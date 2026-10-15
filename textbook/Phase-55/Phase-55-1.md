# Phase-55-1: 判定の部品(単位が作るファイルの網羅と順序)

## この章の目的

実装手順書に固有の欠陥のうち、機械で調べられる3つ(依存先が後の単位で作られる・テスト観点があるのにテストのファイルが無い・テーブルを作る単位が無い)を判定する純粋関数を、新しいモジュール `procedure_coverage.py` にまとめる。モード(詳細設計 / 簡易)の違いは「ファイルからモジュール一覧の行を引く関数」を引数で受け取るだけにし、検証への組み込みと重要度・直す先は [55-2](./Phase-55-2.md) で決める。

自動実装モード: on([introduction](./Phase-55-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_coverage.py`](../samples/backend/app/detailed_design/procedure_coverage.py) | 新規 | `UnitFileRef`・`unit_files`・`LateDependency`・`late_dependencies`・`is_test_path`・`has_test_file`・`is_schema_path`・`table_mentioned`・`TableCoverage`・`table_coverage` |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_coverage.py`](../samples/backend/tests/unit/test_procedure_coverage.py) | 新規 | 上の各関数 |

パッケージの `__init__` からは re-export しない(使うのは段階8の検証だけ。`app.detailed_design.validation` が `app.detailed_design.procedure_coverage` から直接 import する)。依存の向きは `procedure_coverage` → `procedure_doc`(`PlanUnit`・`UnitFileKind`・`UnitProcedure`)・`structure`(`ModuleRow`・`module_ref_matches`・`path_variants`)。`procedure_basis` と同じく、ここから `validation` は import しない。

## 要点の抜粋

### 1. 単位が作るファイル

```python
# app/detailed_design/procedure_coverage.py
RowOf = Callable[[str], ModuleRow | None]   # ファイルのパス → モジュール一覧の行

def unit_files(unit: PlanUnit, doc: UnitProcedure | None, row_of: RowOf) -> list[UnitFileRef]:
    # 手順書のファイル(責務つき)を先に、段階7(WBS)の modules・config_files のうち
    # 手順書に無いものを後に。同じパスは1つ。責務が無ければモジュール一覧の行の責務。
```

手順書がまだ無い単位も、段階7(簡易は WBS)の単位からファイルが決まる。依存とテーブルの指摘は、手順書を生成する前から出る。

### 2. 依存先が後の単位で作られる

```python
def late_dependencies(units, rows, row_of, exempt=frozenset()) -> list[LateDependency]:
    # units = [(単位の ID, 作るモジュールのパス), ...](計画の並び順)
    # 行の作り手 = その行のファイルを最初に作る単位
    # 行の depends_on → 一覧の行(_refers_to)→ 作り手の最も早い単位が自分より後ろなら1件
```

除くもの(どれも dev の DB の生成物で誤検知を見て足した。[55-3](./Phase-55-3.md)):

| 除くもの | 理由 |
|---|---|
| `exempt` の単位(基盤の単位)のファイル | `main.py` が後の単位のルーターに依存する形は普通(後の単位がつなぐ) |
| 依存先を作る単位か、それより後の単位が、依存する側の行のファイルも変更する | そこでつなぐ形(`api/projects.py` を作り、後の単位がサービスを足しながら `projects.py` も変更する) |
| 依存先が一覧の行の `*` だけに当たる | `FastAPI` のような外部のライブラリが、層の行 `app/*` に当たらないように(`_refers_to`) |
| 一覧に無い依存先・どの単位も作らない行・自分の行 | 順序の問題ではない |

### 3. テストのファイル

`is_test_path` は `tests/`・`__tests__/`・`e2e/` の下、`test_*`・`*_test.py`・`*.test.ts(x)`・`*.spec.ts(x)`・`conftest.py`。`has_test_file` は手順書のファイルに、種類 `test` か、この形のパスがあるか(着手時の相談 4)。

### 4. テーブルを作る単位

```python
def is_schema_path(path) -> bool:   # 区切りに models・migrations・alembic・entities など、または .sql・.prisma
def table_mentioned(table, texts) -> bool:   # 小文字・_ と - を除き、単数形(ies→y・ses→s・s)も
def table_coverage(tables, files) -> TableCoverage:   # schema_files と uncovered
```

- 層の名前は見ない。題材(simple-2)では `backend/core/security.py` の層が「モデル」で、層で見るとスキーマのファイルと誤る。`schemas/` は API の型(Pydantic)なので含めない。
- テーブル名の出ないスキーマのファイル(`orm.py`・`models.py` のように全テーブルをまとめたもの)があれば、全テーブルを作るとみなして `uncovered` を空にする(dev の DB の簡易モードの生成物で4件の誤検知が出た)。

## テスト観点

用語: SUT = テスト対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ相手の代わり(初出は Phase 1。ここでは関係だけを書く)。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `unit_files` | pytest(`test_procedure_coverage.py`) | スタブ不要 ── 対象が純粋で、引数の単位・手順書・行だけから決まるため(`row_of` は辞書の `get`) | 統合スモーク: 手順書が先・責務の補い・重複 |
| `late_dependencies` | 同上 | 同上 | 後の単位・同じか前の単位・外部 / 作られない / 基盤・つなぎ直し・`*` の行・ディレクトリの依存先 |
| `is_test_path`・`has_test_file` | 同上 | 同上 | 判定表(parametrize)・種類かパス |
| `is_schema_path`・`table_mentioned`・`table_coverage` | 同上 | 同上 | 判定表・単数形・スキーマのファイルの有無・まとめたファイル |

純粋関数だけの章なので、テストダブルは要らない。モードの違いを `row_of` の引数に押し出したことで、詳細設計モードの段階4も簡易モードの `module_layer` も、テストでは辞書1つで代われる。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_procedure_coverage.py
```
