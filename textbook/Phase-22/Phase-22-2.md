# Phase-22-2: 表の導出(BE)

## この章の目的

md と HTML が同じ中身を出せるよう、詳細設計書の表の中身を承認済みの意味モデルから導く純粋関数をまとめる。導く値は保存しない。

- 05: 手順番号・手順ID、各手順が呼ぶ関数の L-ID、索引の「詳細(06)」、処理 × モジュールの関与表。
- 06: L-ID と「呼ばれる手順」(逆引き表も同じ値)。
- 02: データ辞書の「使う処理」。
- 03: CRUD 図の記号(DFD の線から決まる部分と、人が確定した部分の書き分け。Phase 18 からの持ち越し)。

自動実装モード: on([introduction](./Phase-22-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/document/views.py`](../samples/backend/app/detailed_design/document/views.py) | 新規 | **コア** | `anchor`・`functions_by_id`、`StepView`・`LogicView`・`logic_ids`・`procedure_steps`・`linked_logic_ids`・`main_step_count`・`logic_views`、`Involvement`・`involvement`、`data_item_usage`、`CrudMark`・`CrudMatrix`・`crud_matrix`(純粋) |
| [`app/detailed_design/document/__init__.py`](../samples/backend/app/detailed_design/document/__init__.py) | 更新 | 定型 | `views` の公開名の re-export を追記 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_detailed_design_document_views.py`](../samples/backend/tests/unit/test_detailed_design_document_views.py) | 新規 | **コア** | 各導出の結果(05↔06・関与表の列・データ辞書・CRUD の3分類) |

## 要点の抜粋

```python
# app/detailed_design/document/views.py
def anchor(identifier) -> str: ...            # "F-01#4a" → "f-01-4a"(# は URL の区切りと重なる)

@dataclass(frozen=True)
class StepView:                               # 手順の表の1行
    number: str; step_id: str; step: ProcedureStep
    logic_id: str | None                      # この手順が呼ぶ関数の L-ID(06 が無ければ None)

def logic_ids(logics) -> dict[str, str]:      # logic_key → L-ID(段階6が未承認・省略なら空)
def procedure_steps(procedure, ids) -> list[StepView]:
    numbers = number_steps(procedure.steps)   # Phase 20 の規則
    ... linked = ids.get(logic_key(step.callee, step.call))   # 分岐の行・関数が空の行は None

def logic_views(logics, procedures) -> list[LogicView]:   # L-ID と calling_steps(Phase 21)
def involvement(procedures, modules) -> Involvement:       # 列 = モジュール一覧の並び(呼ばれたものだけ)
def data_item_usage(dfd_models) -> dict[str, list[str]]:  # データ項目 id → 線の端の処理の箱(= 処理ID)

CrudMarkKind = Literal["dfd", "dfd_write", "human"]
def crud_matrix(crud, er, dfd_models, function_order=()) -> CrudMatrix:
    accesses = {(a.function_id, a.table, a.kind) for a in dfd_accesses(dfd_models)}   # Phase 18
    # R かつ DFD に読みの線 → dfd / C・U・D かつ DFD に書き込みの線 → dfd_write / それ以外 → human
```

`views.py` は `source.py` を import しない。以前の Phase の `procedure`(`number_steps`・`step_id`・`is_external_actor`)、`logic`(`logic_id`・`logic_key`・`calling_steps`)、`data_model`(`dfd_accesses`・`table_key`)、`function_list`・`structure`・ER の型だけに依存する。

## 設計判断

### 画面と同じ規則で、保存せずに導く

手順番号(Phase 20)、L-ID と 05↔06 の紐づけ(Phase 21)は、どれも保存しない値である。組み立てでも、画面が使う規則と同じ関数で導く。

| 値 | 導き方 | 同じ規則を使う場所 |
|---|---|---|
| 手順番号・手順ID | `number_steps`・`step_id` | 段階5の画面・検証 |
| L-ID | `logic_id`(並び順) | 段階6の画面・検証の `target` |
| 05 → 06 | 手順の (callee, call) の `logic_key` が段階6にあるか | 段階5の詳細バッジ |
| 06 → 05 | `calling_steps` | 段階6の「呼ばれる手順」・逆引き |

デモ(`procedureModel.ts`)と出力見本(`build.py`)は手順の行の `logic` 欄を正本にしていたが、Phase 20 でその欄を撤回した。そのため、デモの `toHtml`・`toMarkdown` を写すのではなく、この表の規則で作り直した。

### 関与表の列はモジュール一覧の並び

列の順を「手順に現れた順」にすると、処理を並べ替えただけで列が動く。段階4のモジュール一覧の並び(層の順に人が並べたもの)にそろえ、呼ばれたものだけを残す。外部の役者(「/」を含まない呼び出し先)と分岐の行は除く(内部設計書の決定)。

### CRUD 図の記号の3分類

段階3では、R と W(書き込みがあること)は DFD の線から決定的に決まり、C/U/D の区別と DFD に描いていない分は人が確定する(Phase 18)。承認すると `draft` の印は外れるので、承認済みの model だけでは「どこまでが DFD から決まったか」が分からない。そこで、組み立てのときに DFD の線(`dfd_accesses`)と突き合わせて記号を決める。

| 記号 | 条件 | HTML | md |
|---|---|---|---|
| `dfd` | R で、DFD に読みの線(ストア → 処理)がある | 青 | 印なし |
| `dfd_write` | C/U/D で、DFD に書き込みの線(処理 → ストア)がある | 橙+青の下線 | `+` |
| `human` | それ以外(DFD に描いていない処理・線) | 橙 | `*` |

テーブル名は `table_key`(前後の空白を除いて小文字)で突き合わせる。段階3の R/W の導出と同じ規則。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `anchor`・`functions_by_id` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | `#` の置き換え、段階1が未承認なら空 |
| `procedure_steps`・`logic_ids`・`linked_logic_ids`・`main_step_count` | pytest | スタブ不要。同上 | 第一テストの統合スモーク(fixture の手順 F-01#1 が L-01 に紐づく)。分岐の行は紐づかない。段階6が無ければ紐づかない |
| `logic_views` | pytest | スタブ不要。同上 | 呼ばれる手順が `F-01#1` |
| `involvement` | pytest | スタブ不要。同上 | 列はモジュール一覧の並びで呼ばれたものだけ |
| `data_item_usage`・`crud_matrix` | pytest | スタブ不要。DFD・ER は dict / model で渡す | 3分類、列は ER の並び、行は渡した機能一覧の並び |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_document_views.py
# 9 passed
```
