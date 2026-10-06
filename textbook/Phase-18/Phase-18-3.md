# Phase-18-3: 段階3の下書きの生成と、承認での確定(BE)

## この章の目的

段階3の生成を `STAGE_GENERATORS` に登録し、1回の生成で ER と CRUD 図を1トランザクションで書く。段階の入力(`StageSources`)に ER の要約と DFD の R/W を足し、画面にも DFD の R/W を返す。段階3の承認で、CRUD 図の下書きの印を外す。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | 定型 | `DfdAccessRead`、`DesignStageRead.dfd_accesses` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | `_sources` に ER の要約・DFD の R/W、`_to_read` に段階3の `dfd_accesses`、`approve` で `confirm_drafts` |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `generate_data_model` を `STAGE_GENERATORS[3]` に登録、`_save_group_dfd` を `_save_diagram` に共通化 |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `group_dfd_model()`・`create_stage3_project()`(段階1・2を承認し、承認済みの DFD を1枚持つ) |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | **コア** | 段階3の生成・作り直し・失敗の取り消し・承認での確定、「未対応の段階」の例を段階4に |

## 要点の抜粋

```python
# app/services/design_stage_generation_service.py
async def generate_data_model(context: StageGenerationContext) -> dict:
    function_list = FunctionListModel.model_validate(context.sources.stages.get(1) or {})
    data_flow = DataFlowModel.model_validate(context.sources.stages.get(2) or {})
    accesses = selected_dfd_accesses(context.sources)            # DFD の R/W(要約から)
    existing = [... data_items ...]
    er_output = await _invoke_structured(context.llm, DataModelErOutput,
                                         build_er_messages(data_store_names(accesses), existing, data_flow.summaries))
    er = to_er_model(er_output)
    await _save_diagram(context, "er", ER_SUBJECT, er)            # commit しない
    tables = [element.name for element in er.elements]
    crud_output = await _invoke_structured(context.llm, CrudGenerationOutput,
                                           build_crud_messages(function_list.functions, data_flow.summaries, tables, accesses))
    return merge_crud(to_crud_drafts(crud_output), accesses, function_list, tables).model_dump(mode="json")

STAGE_GENERATORS = {1: generate_function_list, 2: generate_data_flow, 3: generate_data_model}
```

```python
# app/services/design_stage_service.py
async def approve(...):
    ...
    if stage == DATA_MODEL_STAGE:
        row.model = confirm_drafts(row.model)     # 承認 = 人の確定。version は増やさない
    row.status = "approved"

def _dfd_summary(diagram) -> DfdDiagramSummary:  # accesses=dfd_accesses([semantic_model]) を足した
def _er_summary(diagram) -> ErDiagramSummary:    # テーブル名・主キーの無いテーブル
def _dfd_access_reads(sources) -> list[DfdAccessRead]:  # 段階3の画面用。テーブル名は ER の名前に戻す
```

## 設計判断

### 2回の LLM を1トランザクションで書く

段階2(17-3)と同じく、ER の上書きと段階3の保存を1回の commit にまとめる。CRUD 図の LLM で失敗したら、先に書いた ER もまとめて取り消す(`execute` の rollback)。ER だけが新しくなり CRUD 図が古いまま、という食い違いを残さないため。

CRUD 図の生成は ER の後に呼ぶ。CRUD 図の列は ER のテーブルなので、ER のテーブル名を渡す必要がある。

### `_save_group_dfd` を `_save_diagram` に共通化する(#17)

段階2の DFD と段階3の ER は、どちらも「同じ notation・subject の行を上書きし、配置を消し、承認をやり直しにし、生成時の入力の版を記録する」。この共通化を今駆動している消費者は、段階3の ER である(#17 の判定の一問に具体名で答えられる)。notation と subject を引数に取る `_save_diagram` にした。

### 再生成は置き換え(前の版の人の確定を引き継がない)

段階2の処理概要表は、AI が書き漏らした行に前の版を残した(17-1)。段階3の CRUD 図は前の版を使わずに置き換える。作り直すのは、段階2が変わって DFD の R/W が変わったとき(段階3が「古い」になったとき)が主で、前の版のセルが新しい DFD と食い違っている可能性が高いためである。人の確定が失われることは、画面の確認ダイアログで示す(18-9)。

### 画面には、導いた R/W を返す

CRUD 図の画面は「DFD から決まるセル」を区別して表示し、R を外させない(18-8)。画面で DFD を読み直して同じ導出をすると、導出の規則が2か所に分かれる。段階の一覧(`GET /design-stages`)の段階3に、バックエンドが導いた `dfd_accesses` を載せて返す。テーブル名は ER の名前に戻して返す(画面は ER の列名で CRUD 図の列を引くため)。

### 承認で下書きの印を外す

着手時の決定3。印を外さずに「承認済みなら下書きを表示しない」とすると、承認後に差し戻されたとき(18-4)に、もう確認したはずのセルが下書きに戻ってしまう。承認のときに `model` から印を外す。承認は内容を変えない操作なので、version は増やさない(段階の承認の共通の規則)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageGenerationService`(段階3の受け付け・実行)・`generate_data_model`・`STAGE_GENERATORS` | テスト関数(サービスのメソッドを直接呼ぶ) | FakeLLM(`structured_sequence` で ER → CRUD 図の順に返す) | 第一テストの統合スモーク(ER と CRUD 図を書き、ER を承認すると段階3を承認でき、承認で下書きの印が外れる)。`dfd_accesses` を `DfdAccessRead` の値で比べる |
| 作り直し | 同上 | 同上 | ER は同じ行を上書き(version+1・下書き)、CRUD 図は置き換え、段階は「再生成済」 |
| 失敗の取り消し | 同上 | FakeLLM(2回目でクォータ超過) | ER が残らず、段階の model も変わらない |

DB はインメモリ SQLite でスタブにしない(段階・図の行の状態の移り変わりそのものが検証対象のため)。fixture の `create_stage3_project` が、段階1・2の承認と DFD の承認までを組み立てる。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_design_stage_service.py
# 31 passed
```
