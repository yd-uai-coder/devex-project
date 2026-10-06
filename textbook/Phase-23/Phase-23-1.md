# Phase-23-1: 段階7の意味モデルと検証(BE)

## この章の目的

段階7(横断事項と実装計画)の意味モデル `PlanModel` と、その検証 `validate_plan` を作る。07 横断事項と実装計画を1つの model に持ち、処理ID は段階1の ID で書き、検証で突き合わせる。ファイルの欄(`modules`)は「作成・変更するファイルの例」で、検証しない。

- 横断事項(07章)・マイルストーン(中にタスク)・開発環境・リスクの4つを持つ(着手時の決定1・2)。
- AI の下書きは `normalize_plan` で整える。ファイルは、段階5の呼び出し先と同じ規則で、当たるものだけモジュール一覧のパスにそろえる。

自動実装モード: on([introduction](./Phase-23-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 新規 | **コア** | `PLAN_STAGE`・`PRIORITIES`・`TASK_AREAS`・`CROSSCUTTING_TOPICS`、`CrossCuttingRow`・`PlanTask`・`Milestone`・`Risk`・`PlanModel`、`milestone_id`・`planned_function_ids`・`unplanned_functions`・`missing_topics`・`normalize_plan`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `validate_plan` を足し、`STAGE_VALIDATORS[7]` に登録する |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | `plan` の公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `plan_model(function_ids?, module?)`(段階7の検証を通る内容) |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 新規 | **コア** | 純粋関数と、検証のエラー・警告の分け方 |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 検証の登録が段階1〜7になったこと(登録の無い番号は 8 で確かめる) |

## 要点の抜粋

```python
# app/detailed_design/plan.py
PLAN_STAGE = 7
Priority = Literal["Must", "Should", "Could"]
TaskArea = Literal["準備", "バックエンド", "フロントエンド", "テスト", "デプロイ"]
CROSSCUTTING_TOPICS = ("例外と HTTP", "認証", "トランザクション", "ログ")

class CrossCuttingRow(BaseModel):  topic: str; policy: str = ""; modules: list[str]
class PlanTask(BaseModel):         area: TaskArea = "バックエンド"; title: str = ""; modules: list[str]; function_ids: list[str]
class Milestone(BaseModel):        name: str; goal: str = ""; priority: Priority = "Must"; function_ids: list[str]; tasks: list[PlanTask]
class Risk(BaseModel):             risk: str; mitigation: str = ""
class PlanModel(BaseModel):        crosscutting: list[CrossCuttingRow]; milestones: list[Milestone]; environment: str = ""; risks: list[Risk]

def milestone_id(index: int) -> str:                 # 0 → "M-01"(並び順から。保存しない)
def unplanned_functions(model, function_ids) -> list[str]   # どのマイルストーン・タスクにも無い処理
def missing_topics(model) -> list[str]               # CROSSCUTTING_TOPICS のうち行の無いもの
def normalize_plan(model, module_paths) -> PlanModel # 空白・空の行・重複を除き、モジュールを resolve_callee でパスにそろえる
```

```python
# app/detailed_design/validation.py(追記)
def validate_plan(model, sources) -> list[StageIssue]:
    # エラー: INVALID_MODEL / NO_MILESTONE / EMPTY_MILESTONE_NAME / DUPLICATE_MILESTONE / EMPTY_TASK /
    #         EMPTY_TOPIC / UNKNOWN_FUNCTION(段階1に無い)。ファイルの欄は検証しない
    # 警告:   UNPLANNED_FUNCTION / EMPTY_TASKS / MISSING_TOPIC / EMPTY_POLICY / NO_RISKS
STAGE_VALIDATORS = {..., 6: validate_logics, 7: validate_plan}
```

依存の向きは `plan → procedure(resolve_callee)`、`validation → plan`。段階1の機能一覧は、DB から読まずに `StageSources.stages` で受け取る(Phase 16 からの形)。

## 設計判断

### タスクはマイルストーンの中に入れ子で持つ

着手時に了承した見本では、タスクの表に「マイルストーン」の列があった。保存の形は次の2案を比べた。

| 案 | 採否 | 理由 |
|---|---|---|
| タスクをマイルストーンの中に入れ子で持つ | **採用** | マイルストーンを改名しても、タスクとのつながりが切れない。WBS も本来は階層になっている |
| タスクを平らな表にし、マイルストーンの名前で参照する | 不採用 | 改名すると参照が切れる。名前の重複・打ち間違いの検証も要る |
| マイルストーンに ID を保存し、タスクは ID で参照する | 不採用 | 段階1の処理ID のような「消えた番号を再利用しない」管理が要る。段階7の規模では見合わない |

マイルストーンの番号(`M-01`…)は保存しない。並び順から `milestone_id` で導く。段階6の L-ID と同じ考え方で、並べ替えると番号が振り直されるだけで、何も切れない(番号で参照しているものが無いため)。

### 計画の漏れは警告、無い ID はエラー

| 指摘 | 重さ | 理由 |
|---|---|---|
| 段階1に無い処理ID(`UNKNOWN_FUNCTION`) | エラー | 打ち間違いか、段階1を直した後の古い ID。どの処理の計画か分からない |
| どのマイルストーンにも入らない処理(`UNPLANNED_FUNCTION`) | 警告 | 次のリリースに回す処理を、わざと計画に入れないことがある。承認は止めない |
| 既定の横断事項(例外と HTTP・認証・トランザクション・ログ)が無い | 警告 | 07章の章立ての既定。システムによっては不要な項目もある |

### ファイルの欄は検証しない(画面確認後の決定)

当初は、横断事項とタスクのモジュールを段階4のモジュール一覧と突き合わせ、当たらなければエラー(`UNKNOWN_MODULE`)にしていた。ところが画面確認で、AI の下書きの `Dockerfile`・`docker-compose.yml` がエラーになった。実装計画のタスクには、環境構築・デプロイのように、アプリのモジュールではないファイルを作る作業がある。これらは詳細設計のモジュール一覧には入らない。

そこで、この欄を「作成・変更するファイルの例」とし、表示はするが検証はしないことにした(ユーザーの決定)。表の見出しも「作成・変更するファイル(例)」「関わるファイル(例)」に改めた(23-2・23-6)。欄の名前は `modules` のままにした(保存の形を変えないため)。

### 下書きのファイルは、当たるものだけパスにそろえる

AI は `routes/reservations` のように、パスを短く書くことがある。`normalize_plan` は、段階5の `resolve_callee` と同じ規則でそろえる。完全一致ならそのまま残し、部分一致で1行だけに当たれば、その行のパスに置き換える。どの行にも当たらないもの(`Dockerfile` などの環境のファイル)は、そのまま残す。検証はしないので、エラーにはならない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `PLAN_STAGE`・`STAGE_VALIDATORS[7]`・`validate_stage` | pytest | スタブ不要。純粋(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(fixture の `plan_model` が検証を通る) |
| `milestone_id`・`planned_function_ids`・`unplanned_functions`・`missing_topics` | pytest | スタブ不要。同上 | タスクの処理ID も「計画あり」に数える |
| `normalize_plan` | pytest | スタブ不要。同上 | 空の行を捨て、短い書き方のファイルをパスにそろえる |
| `validate_plan` | pytest | スタブ不要。段階1の内容は dict で渡す(読み取りはサービス層の責務) | エラー(形・0件・名前・無い ID)と警告(漏れ・既定の項目・リスク)の分け方。モジュール一覧に無いファイル(`Dockerfile` など)は指摘しない。指摘の `target` は M-ID・項目名・処理ID |
| `STAGE_VALIDATORS` の登録(`test_function_list.py`) | pytest | スタブ不要。同上 | 段階1〜7のすべてに検証がある。登録の無い番号(8)は指摘なし |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_plan.py tests/unit/test_function_list.py
# 13 passed(test_plan.py)を含めて成功
```
