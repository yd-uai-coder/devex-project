# Phase-21-3: 生成の対象の受け渡し(段階6)(BE)

## この章の目的

段階6の生成を、段階5と同じ「関数ごと」の形で動かす。リクエストの本文で下書きを作る関数を指定でき、省略すると選んだ関数のうち下書きの無いものをまとめて作る。対象の関数の詳細だけを置き換え、他の関数の手直しは残す。あわせて、0件の承認(段階6を飛ばす)で段階7が開くことを確かめる。

自動実装モード: on([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | 定型 | `LogicTarget{module, function}`、`DesignStageGenerate.logics` |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `generate_logics`・`STAGE_GENERATORS[6]`、`_targets`・`_check_request`・`_has_draft` の段階6、`logics` を受け付けから実行まで渡す |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | 本文の `logics` を (モジュール, 関数) の組にして、受け付けと background task へ渡す |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `create_stage6_project`(段階1〜5を承認。段階5は `procedure_model()`) |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | **コア** | 段階6の受け付け・生成・承認、1関数だけの作り直し、断る条件、0件の承認で段階7が開くこと、選ばれていない鍵を飛ばすこと。既存のテストは background task の引数の末尾と「生成に対応していない段階」の例(段階7)を直した |

## 要点の抜粋

```python
# app/schemas/design_stage.py
class LogicTarget(BaseModel):
    module: str
    function: str

class DesignStageGenerate(BaseModel):
    function_ids: list[str] | None = None     # 段階5だけ(Phase 20)
    logics: list[LogicTarget] | None = None   # 段階6だけ(Phase 21)
```

```python
# app/services/design_stage_generation_service.py
LogicTargets = list[tuple[str, str]]

def _targets(stage, model, function_ids, logics=None) -> tuple[str, ...]:
    # 段階5: 処理ID / 段階6: logic_key("module::function") / 他: ()

def _check_request(stage, model, function_ids, logics=None) -> None:
    # 関数の指定は段階6だけ。段階6は 対象が空・選ばれていない関数・5件超 を 409 DESIGN_STAGE_INVALID

async def generate_logics(context) -> dict:
    # 対象の鍵ごとに LLM 1回 → merge_logic。入力は段階1・4・5(承認済み)と ER のテーブル名

STAGE_GENERATORS = {..., 5: generate_procedures, 6: generate_logics}
```

```python
# app/api/routes/design_stages.py(generate_design_stage)
logics = [(t.module, t.function) for t in payload.logics] if payload and payload.logics is not None else None
accepted = await service.request_generation(project, stage=stage, function_ids=function_ids, logics=logics)
background_tasks.add_task(run_design_stage_generation, project.id, project.user_id, stage, function_ids, logics)
```

## 設計判断

### 段階5と同じ形にする

段階6も、人の手直しが多くなる表(詳細)を持つ。そこで段階5の決定4(処理ごとに置き換える)をそのまま当てはめた。

| 場面 | 段階5(Phase 20) | 段階6(本章) |
|---|---|---|
| 対象の単位 | 処理(処理ID) | 関数((モジュール, 関数) の鍵) |
| 本文で指定しない | 手順の無い処理 | 下書きの無い関数(`pending_logic_keys`) |
| 1回の上限 | 5(`MAX_PROCEDURE_TARGETS`) | 5(`MAX_LOGIC_TARGETS`) |
| 置き換え | `merge_procedure`(他の処理は残す) | `merge_logic`(他の関数は残す) |
| `regenerated` の判定 | 対象の処理にもともと手順があったか | 対象の関数にもともと詳細があったか |

### 対象は鍵の文字列で受け渡す

`StageGenerationContext.targets` は `tuple[str, ...]` のまま、段階6では `logic_key`(`module::function`)を入れた。型を段階ごとに分けると、生成の関数の共通の形(`StageGenerator`)が崩れるためである。`generate_logics` は、選んだ関数の行を鍵で引き、見つからない鍵は LLM を呼ばずに飛ばす。受け付けの後は生成中で保存できないので、通常は全部見つかる。

本文の `logics` は `{module, function}` の配列にした。鍵の文字列(`::` でつなぐ)をそのまま API に出さず、区切りの約束をサーバーの中に閉じるためである。

### 段階6を飛ばすのに専用の API を作らない

着手時の決定1のとおり、飛ばす操作は「`{logics: []}` を保存して承認する」だけで、既存の保存・承認の API で足りる。21-1 で0件を検証のエラーにしなかったので、承認の共通の条件(内容が空でない)も `{"logics": []}` は通る(空の dict ではないため)。承認した段階6の版が段階7の入力の版として記録され、段階5が変わったときの「古い」の伝わり方も他の段階と同じになる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| ルート `generate_design_stage` → `request_generation` → `execute` → `generate_logics` | テスト関数(ルート関数を直接呼ぶ) | FakeLLM(構造化出力の代わり。関数ごとに1回)。`build_logic_messages` は spy で包んでプロンプトを見る | 第一テストの統合スモーク(本文なしで受け付け → 下書き → そのまま承認)。プロンプトに手順ID・分岐・層が載る |
| 1関数だけの作り直し | 同上 | FakeLLM | 本文の `logics` が background task に渡ること、対象だけ置き換わり他の関数の手直しが残ること、`regenerated` |
| 断る条件 | `request_generation` を直接呼ぶ | スタブ不要(LLM を呼ぶ前に断るため) | 対象が空・選ばれていない関数・6件以上・段階5への関数の指定 |
| 0件の承認(飛ばす) | `DesignStageService.save`・`approve` | スタブ不要(LLM を使わないため) | 指摘なしで承認でき、段階7が開く |
| `generate_logics` 単体 | `StageGenerationContext` を直接作って呼ぶ | FakeLLM(呼ばれないことを見る) | 選ばれていない鍵は飛ばす |

DB はインメモリ SQLite で、スタブにしない(段階の行の状態の移り変わりそのものが検証の対象のため)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py
# 31 passed
```
