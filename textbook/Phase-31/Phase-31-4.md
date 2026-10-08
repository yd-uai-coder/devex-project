# Phase-31-4: サービスと API(BE)

## この章の目的

簡易モードのプロジェクトで、段階8の一覧・保存・承認・生成・単位の詳細・AI 向けの版・実装手順書の zip を使えるようにする。今までは、簡易モードのプロジェクトは段階のどの API でも 409(`DESIGN_STAGES_NOT_AVAILABLE`)だった。モードに無い段階(簡易モードの段階1〜7)だけを断る形に改める。

画面が作業単位の一覧を出せるように、段階8の応答に作業単位(`plan`)とモード(`mode`)も載せる。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `StageIssueRead.fix_document`・`DesignStageRead.mode`・`DesignStageRead.plan`・`DesignRefRead.kind` に `dataflow` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `_ensure_detailed` → `_ensure_stage(project, stage)`。`_load(project)` はモードの段階の行だけを読む。`_sources` は簡易モードなら文書だけ。`unit_context`・`unit_ai_markdown` は土台から作業単位と参照を取る。`_to_read` が `mode`・`plan` を詰める |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `generate_procedure_docs` が土台から作業単位と参照を取り、簡易モードは簡易モードのメッセージと出力の型で下書きする。`_plan` も土台から |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | `bundle_procedure` は `collect` を通らず、`procedure_source(title, states, sources)` で組み立てる。`bundle`・`collect` は詳細設計モードでなければ 409(`_ensure_detailed`) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | docstring(簡易モードは段階8だけ) |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `create_simple_procedure_project`(4文書を持つ簡易モードのプロジェクト)・`simple_procedure_output`(FakeLLM が返す構造化出力) |
| [`tests/unit/test_simple_procedure_stage.py`](../samples/backend/tests/unit/test_simple_procedure_stage.py) | 新規 | 生成 → 承認 → 参照 → AI 向けの版 → zip、ほかの段階・詳細設計書の 409、文書の再生成で「古い」、旧形式の文書 |
| [`tests/unit/test_design_stage_service.py`](../samples/backend/tests/unit/test_design_stage_service.py) | 更新 | 「簡易モードは段階を持たない」を「簡易モードは段階8だけを持つ」に書き換えた |

## 要点の抜粋

```python
# app/services/design_stage_service.py
def _ensure_stage(project: Project, stage: int) -> None:   # モードにその段階が無ければ 409
    if stage not in stage_inputs(project.mode):
        raise DesignStagesNotAvailableError(...)

async def _load(self, project):                            # モードの段階の行だけ。入力の文書もモードから
    inputs = stage_inputs(project.mode)
    rows = {row.stage: row for row in ... if row.stage in inputs}
    documents = await self._current_documents(project.id, inputs)
    views = derive_states(records, _doc_versions(documents), inputs)

def _basis(sources: StageSources) -> ProcedureBasis:
    return procedure_basis(sources.mode, sources.stages, sources.documents)
```

```python
# app/schemas/design_stage.py
class DesignStageRead(BaseModel):
    stage: int
    mode: Literal["simple", "detailed"] = "detailed"
    ...
    plan: dict[str, Any] | None = None   # 段階8だけ(開いているとき)。作業単位(段階7と同じ形)
```

```python
# app/services/detailed_design_export_service.py
async def bundle_procedure(self, project) -> BundleFile:
    await self._ensure_approved(project, PROCEDURE_STAGES)
    views, sources = await self._stages.overview(project)
    procedure = procedure_source(project.title, states, sources)   # collect を通らない

def procedure_source(title, states, sources) -> ProcedureOutputSource   # collect と bundle_procedure で共有
```

`read(project_id, stage)` は、呼び出し元(生成の受け付け・テスト)を変えないように引数をそのままにし、中でプロジェクトを読み直してモードを決める。

## 設計判断

### 「詳細設計モードか」でなく「モードにその段階があるか」で断る

`_ensure_detailed` を `_ensure_stage(project, stage)` にした。一覧(`list_stages`)・概要(`overview`)はモードの段階を返すだけで断らない。保存・承認・生成(`stage_view`)・単位の詳細・AI 向けの版は、その段階がモードにあるかを確かめる。段階5のシーケンス図は段階5で確かめるので、簡易モードでは 409 のまま。

### モードに無い段階の行は読まない

`derive_states` はモードの入力の段階だけを回すので、手で DB を直したなどで簡易モードのプロジェクトに段階1〜7の行があると、状態の無い行ができて落ちる。`_load` で読まないようにした。

### 簡易モードの入力は文書だけ

段階8の入力は4文書だけで、図(DFD・ER・構成図)は使わない。簡易モードのプロジェクトにも UML の行がありうる(ステージ3 で作った図)が、`_sources` は読まない。

### 作業単位を段階8の応答に載せる(`plan`)

画面の段階8の単位の一覧は、今まで段階7の model を読んでいた。簡易モードには段階7の行が無く、WBS の解析はサーバーにしか無い(31-1)。段階8の応答に、土台の作業単位(`plan`)を載せた。詳細設計モードでも同じ欄を使う(段階8が開くのは段階7が承認済みのときなので、中身は同じ)。画面はモードによらずこの欄だけを読めばよい。

### 実装手順書の zip は詳細設計書の組み立てを通らない

`bundle_procedure` は今まで `collect`(詳細設計書の組み立て。段階1〜7・図・データ辞書を読む)を通っていた。簡易モードには段階1〜7が無く、手順書の組み立てに図も要らない。承認済みの段階8と土台だけで組み立てる `procedure_source` を切り出し、`collect` と共有した。詳細設計書の zip(`bundle`)は、簡易モードでは今までどおり 409 にする(`_ensure_detailed` を出力のサービスへ移した)。

### 偽 LLM への登録は Phase 32

E2E の偽 LLM(`app/ai/llm/fake.py`)には、段階8の構造化出力(詳細設計モードのものも)をまだ登録していない。両方のモードの段階8を Phase 32 でまとめて登録する(Phase 28 からの申し送り)。この章のテストは、テスト用の FakeLLM(`tests/fixtures/fake_llm.py`)で生成を通す。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageService`・`DesignStageGenerationService`(`generate_procedure_docs`)・`DetailedDesignExportService.bundle_procedure` とルート | pytest(`test_simple_procedure_stage.py`)。DB はインメモリ SQLite(`db_session`) | 手順書の生成は FakeLLM ── 構造化出力(Gemini)の代わり。1単位で1回呼ぶ | 第一テスト(統合スモーク): 4文書から段階8が開き(`mode`・`plan`・指摘0件)、単位を選んで下書き(出力の型は簡易モードのもの。指摘は `fix_stage=8`・`fix_document`)→ 承認 → 参照(`dataflow` と `module`)→ AI 向けの版 → zip のファイル。段階5の保存・シーケンス図・詳細設計書の zip は 409。内部設計書を再生成すると「古い」。旧形式の計画書は単位0件と `WBS_MISSING` |
| `DesignStageService.list_stages`・`save` | pytest(`test_design_stage_service.py`) | スタブ不要 ── インメモリ DB を使うだけ | 簡易モード(要件定義・外部設計だけ)は段階8だけで、内部設計書・実装計画書が足りない。段階1の保存は 409 |
