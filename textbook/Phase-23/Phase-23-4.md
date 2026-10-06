# Phase-23-4: 段階7の下書きと生成の登録(BE)

## この章の目的

段階7の下書きを AI に作らせる。入力は、要件定義・外部設計と、承認済みの段階1〜6を組み立てた詳細設計書の md(01〜06章)にする(着手時の決定3)。LLM は2回呼ぶ。1回目で横断事項を作り、2回目でその横断事項も入力にして実装計画を作る。

これで、段階1〜7のすべてに生成がそろう(`STAGE_GENERATORS[7]`)。E2E 用の偽の LLM にも、段階7の固定の出力を登録する。

自動実装モード: on([introduction](./Phase-23-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/plan_drafting.py`](../samples/backend/app/detailed_design/plan_drafting.py) | 新規 | **コア** | 出力スキーマ(`CrossCuttingGenerationOutput`・`PlanGenerationOutput` ほか)、`CROSSCUTTING_SYSTEM_PROMPT`・`PLAN_SYSTEM_PROMPT`、`build_crosscutting_messages`・`build_plan_messages`、`to_crosscutting`・`to_plan_model`(純粋) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `generate_plan`(`collect(render=False)` → 01〜06章の md → LLM 2回 → `normalize_plan`)、`STAGE_GENERATORS[7]` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の段階7の固定の出力(段階1の F-01・F-02 と、段階4のパスにそろえる) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | 生成の docstring(段階1〜7のすべて) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_plan_drafting.py`](../samples/backend/tests/unit/test_plan_drafting.py) | 新規 | 定型 | メッセージの組み立て、出力の変換、E2E の固定の出力が検証を通ること |
| [`tests/unit/test_design_stage_plan_generation.py`](../samples/backend/tests/unit/test_design_stage_plan_generation.py) | 新規 | **コア** | 受け付け → 2回の生成 → 保存 → 承認、入力が 01〜06章の md であること、失敗の記録 |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | 定型 | 「生成に対応していない段階」の断りを、登録を外して確かめる形に改めた |

## 要点の抜粋

```python
# app/detailed_design/plan_drafting.py
class CrossCuttingGenerationOutput(BaseModel):  crosscutting: list[GeneratedCrossCutting]   # topic / policy / modules
class PlanGenerationOutput(BaseModel):
    milestones: list[GeneratedMilestone]   # name / goal / priority / function_ids / tasks[area, title, modules, function_ids]
    environment: str
    risks: list[GeneratedRisk]

def build_crosscutting_messages(requirements, external_design, design_markdown) -> list[BaseMessage]
def build_plan_messages(requirements, design_markdown, crosscutting, functions) -> list[BaseMessage]
#   本文: 要件定義書 / 詳細設計書 / 横断事項(1回目の結果)/ 処理ID の一覧
def to_crosscutting(output) -> list[CrossCuttingRow]
def to_plan_model(crosscutting, output) -> PlanModel          # 整える前(normalize_plan はサービスで)
```

```python
# app/services/design_stage_generation_service.py
async def generate_plan(context: StageGenerationContext) -> dict:
    project = await context.session.get(Project, context.project_id)
    collected = await DetailedDesignExportService(context.session).collect(project, render=False)
    chapters = [c for c in CHAPTERS if c.stage < PLAN_STAGE]          # 01〜06章
    design = to_markdown(collected.source, chapters)
    crosscutting = to_crosscutting(await _invoke_structured(llm, CrossCuttingGenerationOutput,
                                   build_crosscutting_messages(requirements, external_design, design)))
    output = await _invoke_structured(llm, PlanGenerationOutput,
                                      build_plan_messages(requirements, design, crosscutting, functions))
    return normalize_plan(to_plan_model(crosscutting, output), module_paths).model_dump(mode="json")

STAGE_GENERATORS = {..., 6: generate_logics, 7: generate_plan}
```

## 設計判断

### 入力は「組み立てた md」(01〜06章)

| 案 | 採否 | 理由 |
|---|---|---|
| 出力と同じ組み立てで、詳細設計書の md(01〜06章)を作って渡す | **採用** | 簡易モードの「内部設計書」に当たるものを、そのまま作れる。人が読む成果物と同じ形なので、AI も同じ内容を読む。組み立ての規則(05↔06・CRUD の記号など)を共有できる |
| 段階の model を、計画に要る部分だけ要約して渡す | 不採用 | 要約の関数を新しく書くことになる。何を落とすかの判断が、成果物と食い違う |

07 は段階7自身が作るので、`chapters` で外す(23-2)。図は描かない。md の画像は AI の入力に要らず、図を `exported` にすると「出力した」という記録が実際と合わなくなるため(23-3)。

入力のトークン数は、処理や関数が多いプロジェクトほど大きくなる。上限を超えたときは、既存の失敗の理由(`TOKEN_LIMIT`)で人に知らせる(申し送りに記録した)。

### LLM を2回に分ける

1回の構造化出力で横断事項と実装計画の両方を作らせる案もあった。2回に分けたのは、次の2つの理由による。

- 計画の最初のマイルストーンに、横断事項(認証・例外・ログ)の実装を入れさせたい。先に横断事項を確定させ、その結果を計画の入力に渡す。
- 出力が大きくなるほど、構造化出力の解釈に失敗しやすい。

2回目の入力には、外部設計書を渡さない。外部設計の内容は、段階1〜6を通して詳細設計書に反映済みだからだ。代わりに「処理ID の一覧」を別に渡し、すべての処理をどこかのマイルストーンに入れるよう指示する(計画の漏れの警告を減らすため)。

### プロンプトの規則

- 両方のプロンプトの末尾に `NAMING_RULES`(Phase 19)を付ける。名称・説明は日本語、パス・識別子は英語、入力の名前は変えない。
- ファイルの欄には、作る・直すファイルのパスを例として書かせる。モジュール一覧にあるものはそのパスをそのまま使わせ、`Dockerfile`・`docker-compose.yml`・CI の設定などの環境・設定のファイルも書いてよいとする(ライブラリ名は書かせない)。この欄は検証しない(23-1。画面確認後の決定)。
- 設計書から決まらない値(有効期限の長さなど)は、創作させない。「(要決定)」と書かせ、決める必要があることを人に示す。

### 作り直しは全体の置き換え

段階4と同じく、作り直すと前の内容は置き換わる。段階5・6のような「対象ごとの作り直し」にしなかったのは、横断事項と計画が全体で1つの判断になっているから。マイルストーンを1つだけ作り直すと、順序や優先度の整合が崩れる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_crosscutting_messages`・`build_plan_messages`・`to_crosscutting`・`to_plan_model` | pytest | スタブ不要。純粋(副作用なし)で、LLM を呼ばないため(メッセージを組み立て、構造化出力を変換するだけ) | 第一テストの統合スモーク。本文の並び、計画に外部設計書を渡さないこと、空の入力の印、プロンプトの末尾が `NAMING_RULES` |
| E2E の固定の出力(`fake.py`) | pytest | スタブ不要。同上 | 整えた結果が段階7の検証を通る(段階1の F-01・F-02、段階4の3つのパス) |
| `generate_design_stage(7)` → `execute` → `generate_plan` | pytest(ルート関数・サービスを直接呼ぶ) | `FakeLLM` の `structured_sequence`(横断事項 → 実装計画の順に返す)。DB はインメモリ SQLite で、スタブにはしない | 第一テストの統合スモーク。入力に 01〜06章の md(07 と画像なし)、短い書き方のモジュールがパスにそろう、検証の指摘なし、承認できる、図は `approved` のまま |
| 生成の失敗 | pytest | `FakeLLM`(2回目で例外) | `failed` になり、途中の内容は残らない |
| 「未対応の段階」の断り(`test_design_stage_generation.py`) | pytest | `monkeypatch.context` で `STAGE_GENERATORS` から段階1を外す | 段階1〜7のすべてに生成があるので、登録を外して確かめる |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_plan_drafting.py tests/unit/test_design_stage_plan_generation.py tests/unit/test_design_stage_generation.py
# すべて成功(test_plan_drafting.py 6 passed、test_design_stage_plan_generation.py 2 passed)
```
