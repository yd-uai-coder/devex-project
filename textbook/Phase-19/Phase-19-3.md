# Phase-19-3: 段階4の生成と、段階の入力への構成図の要約(BE)

## この章の目的

段階4の下書きの生成を、段階1〜3と同じ「受け付け → バックグラウンドで実行」の仕組みに載せる。1回の生成で構成図(LLM 1回)→ モジュール一覧(LLM 1回)を作り、構成図(`uml_diagrams`)と段階4の行を1つのトランザクションで書く。あわせて、段階の検証・生成の入力(`StageSources`)に構成図の要約を足す。

自動実装モード: on([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | `_sources` で構成図(notation=component、subject='')を読み、`_component_summary` で要約にする |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `generate_structure`(構成図 → `_save_diagram` → モジュール一覧 → `merge_modules`)を `STAGE_GENERATORS[4]` に登録 |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `create_stage4_project()`(段階1〜3を承認済み。ER は承認済みで、CRUD 図は F-01 × reservations) |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | **コア** | 段階4の生成・承認、作り直し(構成図の上書き)、失敗の取り消し。「生成に対応していない段階」の例を段階5にした |

## 要点の抜粋

```python
# app/services/design_stage_generation_service.py
async def generate_structure(context: StageGenerationContext) -> dict:
    function_list = FunctionListModel.model_validate(context.sources.stages.get(1) or {})
    data_flow = DataFlowModel.model_validate(context.sources.stages.get(2) or {})
    crud = CrudModel.model_validate(context.sources.stages.get(3) or {})
    requirements = context.sources.documents.get("requirements", "")
    er = context.sources.er_diagram
    tables = list(er.tables) if er is not None else []

    component_output = await _invoke_structured(            # LLM 1回目(ステージ3のスキーマ)
        context.llm, ComponentGenerationOutput,
        build_component_messages(requirements, function_list.functions, data_flow.summaries, tables))
    component = to_component(component_output)               # ステージ3の写像
    await _save_diagram(context, "component", STRUCTURE_SUBJECT, component)   # commit しない

    module_output = await _invoke_structured(                # LLM 2回目
        context.llm, ModuleListGenerationOutput,
        build_module_messages(component, requirements, function_list.functions,
                              data_flow.summaries, crud.cells, tables))
    return merge_modules(to_module_drafts(module_output), function_list).model_dump(mode="json")

STAGE_GENERATORS = {1: ..., 2: ..., 3: ..., 4: generate_structure}
```

```python
# app/services/design_stage_service.py(_sources の抜粋)
component = await self._diagrams.get_by_subject(
    project_id=project_id, notation="component", subject=STRUCTURE_SUBJECT)
return StageSources(..., component_diagram=_component_summary(component) if component else None)

def _component_summary(diagram) -> ComponentDiagramSummary:    # 状態と層(component_layers)
```

## 設計判断

### 段階3と同じ「2回の LLM・1トランザクション」

| 段階3(Phase 18) | 段階4(この章) |
|---|---|
| ER(LLM 1回)→ `_save_diagram(context, "er", ER_SUBJECT, er)` | 構成図(LLM 1回)→ `_save_diagram(context, "component", STRUCTURE_SUBJECT, component)` |
| CRUD 図(LLM 1回。ER のテーブル名を渡す) | モジュール一覧(LLM 1回。構成図を渡す) |
| `merge_crud` | `merge_modules` |

2回目の LLM が失敗したら、`execute` が rollback し、1回目で書いた構成図も残さない(テストの「失敗の取り消し」)。図だけが新しく、段階の内容が古い、という食い違いを作らないためである。

`_save_diagram` は Phase 18 で段階2の DFD と段階3の ER のために共通化した関数で、記法と対象を引数に取る。段階4はそのまま使える(新しいコードは要らない)。`NOTATION_TO_VIEW["component"]` は `"structure"` なので、作られた図の view も正しい。

### 作り直しは置き換え

構成図は同じ行(notation=component、subject='')を上書きし、図の状態は `draft`・version+1 になる(承認はやり直し)。モジュール一覧も前の版を使わずに置き換える。作り直すのは、前の段階(機能一覧・データモデル)が変わって「古い」になったときなので、前の版の人の手直しを機械的に引き継ぐより、作り直してから人が見直すほうが食い違いが少ない(段階3と同じ判断)。画面は、作り直しの前に確認ダイアログで「手直しが失われる」ことを示す(19-7)。

### 入力の ER は「要約」から読む

モジュール一覧に渡すテーブル名は、`StageSources.er_diagram`(段階3で足した ER の要約)の `tables` から取る。ER の行を読み直さない。CRUD 図は承認済みの段階3の `model` から読む(`context.sources.stages[3]`。段階3は承認で下書きの印を外しているので、そのまま渡せる)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `generate_structure`・`STAGE_GENERATORS`・`DesignStageGenerationService.request_generation / execute`・`DesignStageService` の入力(構成図の要約)と段階4の承認 | pytest(サービスのメソッドを直接呼ぶ) | `FakeLLM` ── 構造化出力(Gemini)の代わり。構成図 → モジュール一覧の順に呼ぶので `structured_sequence` で順に返す。モジュール一覧のメッセージは `build_module_messages` を包んだ spy(`monkeypatch`)で受け取る | 第一テストの統合スモーク(生成 → 構成図を承認 → 段階4を承認)。DB はインメモリ SQLite でスタブにしない(段階と図の行の状態の移り変わりそのものが検証対象のため) |

- 統合スモーク: 構成図とモジュール一覧が書かれ、機能一覧に無い `F-99` は捨てられる。構成図の `source_doc_versions` は生成時の入力の版。構成図が未承認の間は `COMPONENT_NOT_APPROVED` が出て、承認すれば段階4を承認できる。モジュール一覧のプロンプトに構成図・CRUD 図・テーブルが載る。
- 作り直し: 構成図は同じ行を上書きし(図は1枚のまま)、`draft`・version+1。段階は `regenerated`。構成図の層が変わると、モジュール一覧の層は警告(`UNKNOWN_LAYER`)になる。
- 失敗: 2回目の LLM が止まると、段階は `failed` で内容は空のまま、構成図も残らない。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_design_stage_service.py
# 34 passed
```
