# Phase-26-1: 段階7の model・単位の ID・検証(BE)

## この章の目的

段階7のタスクを、実装手順書の作業単位(単位)の形に改める。タスクに種別(機能/基盤)・依存・2つのファイルの欄(モジュール/環境・設定のファイル)を持たせ、単位の ID(`M-01-T01`)を並び順から導く。検証は、依存先(一覧にあるか・前の単位か)とモジュール(段階4にあるか)をエラーで、種別と処理の食い違い・処理の多すぎる単位などを警告で出す。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `UnitKind`・`UNIT_KINDS`・`MAX_UNIT_FUNCTIONS`、`PlanTask`(`kind`・`function_ids`・`depends_on`・`modules`・`config_files`)、`Milestone`(`function_ids` を削除)、`task_id`・`unit_ids`・`milestone_functions`・`is_file_path`、`normalize_plan` の新しい欄(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `validate_plan` を単位の形に。`_task_kind_issues`・`_dependency_issues`・`_module_issues` |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `plan` の新しい公開名の re-export(`TASK_AREAS` を外す) |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `plan_model(function_ids?, module?)` を、基盤の単位 M-01-T01 と、それに依存する機能の単位 M-01-T02 に |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 更新 | 純粋関数と、検証のエラー・警告の分け方 |

## 要点の抜粋

```python
# app/detailed_design/plan.py
UnitKind = Literal["feature", "base"]   # 機能(処理を持つ縦割り)/ 基盤(処理の無い準備・デプロイ)
UNIT_KINDS = ("feature", "base")
MAX_UNIT_FUNCTIONS = 3                   # 超えると警告(原則1処理)

class PlanTask(BaseModel):
    kind: UnitKind = "feature"
    title: str = ""
    function_ids: list[str]   # 段階1の処理ID
    depends_on: list[str]     # 先に終わっている必要がある単位の ID(前の単位だけ)
    modules: list[str]        # 段階4のモジュール一覧のパス(検証する)
    config_files: list[str]   # 環境・設定のファイルの例(検証しない)

class Milestone(BaseModel):   # function_ids は削除(タスクから導く)
    name: str; goal: str = ""; priority: Priority = "Must"; tasks: list[PlanTask]

def task_id(milestone_index, task_index) -> str      # (0, 1) → "M-01-T02"(保存しない)
def unit_ids(model) -> list[str]                      # 計画の並び順の全単位の ID
def milestone_functions(milestone) -> list[str]       # タスクの処理を並び順に重複なく
def is_file_path(path) -> bool                        # 最後の区切りに拡張子があるか(frontend は False)
```

```python
# app/detailed_design/validation.py
def validate_plan(model, sources) -> list[StageIssue]:
    paths = {段階4のモジュールのパス}; order = {単位の ID: 並びの位置}
    # 単位ごと(target は単位の ID):
    #   エラー: EMPTY_TASK / UNKNOWN_FUNCTION / UNKNOWN_DEPENDENCY / FORWARD_DEPENDENCY / UNKNOWN_MODULE
    #   警告:   KIND_MISMATCH / MANY_FUNCTIONS / NO_MODULES / MODULE_NOT_FILE
    # 全体: DUPLICATE_FUNCTION(複数の単位に同じ処理。target は処理ID)/ UNPLANNED_FUNCTION
```

依存の向きは今までどおり `plan → procedure(resolve_callee)`、`validation → plan・structure`。段階4のモジュール一覧は、段階7の入力(`STAGE_INPUTS[7]`)に元から入っているので、`StageSources.stages[4]` から読める(状態と陳腐化の仕組みは変えない)。

## 設計判断

### 単位の ID は保存せず、依存は「前の単位」だけ

マイルストーンの番号と同じく、単位の ID も並び順から導く。保存すると、段階1の処理ID のように「消えた番号を再利用しない」管理が要るためである(Phase 23 と同じ判断)。

ただし今回は、依存が単位の ID を参照する。並び順が変わると ID が変わり、依存先がずれる。

| 案 | 採否 | 理由 |
|---|---|---|
| ID は導出のまま、並べ替え・削除の操作が依存先を付け替える(26-5) | **採用** | 保存の形は単純なまま。付け替えは画面の純粋関数1つで済む。AI の下書きは並び順どおりの ID を書く |
| 単位に ID を保存し、依存は保存した ID で参照する | 不採用 | 採番と再利用の管理が要る。段階8(Phase 27)の鍵の決め方とも絡むため、今は増やさない |

依存先は**自分より前の単位**だけを指せる(後ろや自分を指すと `FORWARD_DEPENDENCY` のエラー)。こうすると、計画の並び順がそのまま依存順(依存される単位が先)になり、循環は起きない。デモの `sortUnitsByDependency` のような並べ替え・循環の検査は、段階7では要らない。後ろの単位に依存したいときは、並び順を入れ替える。

### マイルストーンの処理は導出にする

Phase 23 では、マイルストーンにも `function_ids` を書いていた。単位が処理を持つようになると、同じ処理をマイルストーンとタスクの両方に書くことになり、食い違ったときにどちらが正しいか決まらない。そこで `Milestone.function_ids` を消し、`milestone_functions` でタスクから導く(出力のマイルストーン一覧の「処理」列も導出。26-3)。

### 指摘の重さ

| 指摘 | 重さ | 理由 |
|---|---|---|
| 一覧に無い依存先(`UNKNOWN_DEPENDENCY`)・前でない依存先(`FORWARD_DEPENDENCY`) | エラー | 手順書を作る順番が決まらない |
| モジュール一覧に無いモジュール(`UNKNOWN_MODULE`) | エラー | モジュールの欄は、手順書が参照する設計(段階4)の鍵。環境・設定のファイルは別の欄に移せる |
| 機能なのに処理が無い・基盤なのに処理がある(`KIND_MISMATCH`) | 警告 | 区切り方の目安。承認は止めない |
| 処理が4つ以上の単位(`MANY_FUNCTIONS`) | 警告 | 原則1処理(着手時の決定4)。切り離せない処理をまとめることはある |
| 同じ処理が複数の単位にある(`DUPLICATE_FUNCTION`) | 警告 | 縦割りなら1処理は1単位。移行した旧データ(区分ごとの行)でも出る |
| 機能の単位にモジュールが無い(`NO_MODULES`)・ディレクトリのモジュール(`MODULE_NOT_FILE`) | 警告 | 作る・直すファイルが決まらない。ディレクトリは段階4の書き方の問題で、段階4で直す |

`MODULE_NOT_FILE` の判定(`is_file_path`)は、最後の区切りに拡張子があるかで見る。ゴール3の段階4には `frontend` というディレクトリの行があり、見本([`stage7-recut.md`](../../appendix/implementation-procedure-sample/stage7-recut.md))でもこの警告が出ることを確かめていた。

### Phase 23 の「ファイルの欄は検証しない」との関係

Phase 23 では、`Dockerfile` などの環境のファイルがモジュール一覧に無くエラーになったため、ファイルの欄の検証をやめた。今回は欄を2つに分け、モジュールの欄だけを検証する。環境・設定のファイルの欄と、横断事項のファイルの欄は、今までどおり検証しない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `PLAN_STAGE`・`STAGE_VALIDATORS[7]`・`validate_stage` | pytest | スタブ不要。純粋(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(fixture の `plan_model` が検証を通る) |
| `task_id`・`unit_ids`・`milestone_functions`・`planned_function_ids`・`unplanned_functions`・`is_file_path` | pytest | スタブ不要。同上 | ID の形、マイルストーンの処理はタスクから導く |
| `normalize_plan` | pytest | スタブ不要。同上 | 新しい欄(依存・環境・設定のファイル)の空白・重複を除く。モジュールは短い書き方をパスにそろえる |
| `validate_plan` | pytest | スタブ不要。段階1・4の内容は dict で渡す(読み取りはサービス層の責務) | 依存のエラー(一覧に無い・自分・後ろ)と、前のマイルストーンの単位への依存は通ること。モジュールのエラーと、環境・設定のファイル・横断事項のファイルは指摘しないこと。警告の種類と `target`(単位の ID・処理ID) |

## 動作確認(実施済み)

26-1〜26-3 を続けて写した後に流す([introduction](./Phase-26-introduction.md)「写経順序」の注意)。

```bash
cd devex-api/backend
uv run pytest tests/unit/test_plan.py
# 19 passed
```
