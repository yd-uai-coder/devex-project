# Phase-20-3: 生成の対象の受け渡しと、処理ごとの生成(BE)

## この章の目的

段階5の下書きを、処理ごとに生成できるようにする。生成のリクエストに、下書きを作る処理(`function_ids`)を任意で付けられるようにし、受け付け → background task → 実行まで値で渡す。実行は、対象の処理ごとに LLM を1回呼び、対象の処理の手順だけを置き換えて1回で commit する。

自動実装モード: on([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/procedure.py`](../samples/backend/app/detailed_design/procedure.py) | 更新 | **コア** | `generation_targets`(指定が無ければ手順の無い処理、あれば空白・重複を除いた指定) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | `generation_targets` の re-export |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | 定型 | `DesignStageGenerate`(`function_ids: list[str] \| None`) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `StageGenerationContext.targets`、`generate_procedures` を `STAGE_GENERATORS[5]` に登録、`_targets`・`_check_request`・`_has_draft` の段階5、`request_generation`・`execute`・`run_design_stage_generation` に `function_ids` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | 生成の本文(省略可)を受け、`function_ids` をサービスと background task に渡す |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `create_stage5_project()`(段階1〜4を承認。構成図と、モジュール1行の段階4) |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | **コア** | 段階5の受け付け・生成・承認、1処理だけの作り直し、断る条件、失敗の取り消し、段階1から消えた処理を飛ばすこと。「生成に対応していない段階」の例を段階6にした |

## 要点の抜粋

```python
# app/schemas/design_stage.py
class DesignStageGenerate(BaseModel):
    function_ids: list[str] | None = None        # 段階5だけが使う。省略 = 手順の無い処理

# app/api/routes/design_stages.py(抜粋)
async def generate_design_stage(stage, session, current_project, background_tasks,
                                payload: DesignStageGenerate | None = None):
    function_ids = payload.function_ids if payload is not None else None
    accepted = await DesignStageGenerationService(session).request_generation(
        current_project, stage=stage, function_ids=function_ids)
    background_tasks.add_task(run_design_stage_generation,
                              current_project.id, current_project.user_id, stage, function_ids)
```

```python
# app/services/design_stage_generation_service.py(抜粋)
@dataclass(frozen=True)
class StageGenerationContext:
    ...
    targets: tuple[str, ...] = ()                # 段階5で下書きを作る処理(他の段階は空)

async def generate_procedures(context) -> dict:
    model = ProcedureModel.model_validate(context.previous or {})
    for function_id in context.targets:          # 1処理 LLM 1回
        function = functions.get(function_id)
        if function is None:
            continue                             # 受け付けの後に段階1から消えた処理
        output = await _invoke_structured(context.llm, ProcedureGenerationOutput,
                                          build_procedure_messages(...))
        model = merge_procedure(model, function_id, to_procedure_draft(output), paths)
    return model.model_dump(mode="json")

def _check_request(stage, model, function_ids) -> None:
    # 段階5以外で処理を指定 → 409。段階5: 対象が空・選ばれていない処理・5件超 → 409 DESIGN_STAGE_INVALID

def _has_draft(stage, model, targets=()) -> bool:
    # 段階5: 対象の処理にもともと手順があったか(→ regenerated)。他の処理の手順は数えない
```

## 設計判断

### 対象は値で渡し、実行時にも同じ規則で導く

background task には、ルートが受け取った `function_ids`(または `None`)をそのまま渡す。実行(`execute`)は、`_targets` で受け付けと同じ規則を使って対象を導く。

- 指定があれば、その処理(前後の空白と重複を除く)。
- 指定が無ければ、その時点の `model` の「手順の無い処理」。

受け付けから実行までの間に `model` が変わると、指定が無いときの対象がずれるおそれがある。しかし、生成中の段階は保存・承認・生成をすべて 409 で断る(Phase 16)。そのため、受け付けの時点と実行の時点で `model` は同じであり、対象も同じになる。対象を DB に保存する案も考えたが、列が増えるだけで得るものが無いので採らなかった。

### 受け付けで断る条件

| 条件 | 理由 |
|---|---|
| 段階5以外で処理を指定した | 他の段階は段階全体を作り直す。指定を黙って無視すると、画面の意図と食い違う |
| 対象が空(処理を選んでいない・全部に手順がある) | 何もせずに「生成済み」にすると、版だけが上がる |
| 選ばれていない処理を指定した | 生成の結果を入れる行が無い。選択は保存してから生成する(段階2と同じ) |
| 対象が5件を超える | 1処理 LLM 1回なので、件数に比例して時間がかかる。15分の回収のしきい値に収める |

どれも `DesignStageInvalidError`(409 `DESIGN_STAGE_INVALID`)で、理由をそのまま返す。画面は承認の文言ではなく、この理由を出す(20-4)。

### 1トランザクションと「再生成済」の判定

- 複数の処理を生成するとき、途中で失敗したら全部取り消す(段階2〜4と同じ1トランザクション)。1つ目の処理の下書きだけが残ると、人はどれが新しいか分からない。
- 状態は、対象の処理にもともと手順があれば `regenerated`、無ければ `draft` にする。他の処理に手順があっても、それは置き換えていないので数えない。

### 段階1から消えた処理

受け付けの後に段階1が変わることは無い(段階5が開いているのは、段階1〜4が承認済みのとき)。しかし、段階5の `model` には、前に選んで今は機能一覧に無い処理が残りうる。生成ではその処理を飛ばし(LLM を呼ばない)、検証のエラー(`UNKNOWN_FUNCTION`)で人に知らせる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `generate_design_stage`(ルート)・`request_generation`・`execute`・`generate_procedures`・`STAGE_GENERATORS[5]` | pytest(ルート関数とサービスのメソッドを直接呼ぶ) | FakeLLM(構造化出力の代わり)。DB はインメモリ SQLite でスタブにしない(段階の行の状態の移り変わりそのものが検証対象のため) | 段階5の統合スモーク: 本文なしで受け付け → 手順の無い処理を下書き → 呼び出し先がパスにそろう → そのまま承認できる。下書きに段階3・4の内容が渡ること(`build_procedure_messages` を spy で見る) |
| 1処理だけの作り直し | 同上 | 同上 | `DesignStageGenerate(function_ids=["F-01"])` で F-01 だけ置き換わり、人が手直しした F-02 は残る。状態は `regenerated` |
| `_check_request`(段階5) | 同上 | スタブ不要(LLM を呼ぶ前に断る) | 未選択、選ばれていない処理、6件、段階4への指定、空白・重複を除いて受け付けること |
| 失敗の取り消し・消えた処理 | 同上 | FakeLLM が例外を返す / 呼ばれないことを見る | 失敗しても人の手直しが残ること。機能一覧に無い処理は LLM を呼ばずに飛ばすこと(`StageGenerationContext` を直接作って `generate_procedures` を呼ぶ) |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py
# 26 passed
```
