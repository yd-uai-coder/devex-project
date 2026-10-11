# Phase-38-2: 生成・出力・API の配線(BE)

## この章の目的

[38-1](./Phase-38-1.md) の純粋関数を、段階の読み書き・下書きの生成・実装計画書のプロンプト・詳細設計書と実装手順書の出力につなぐ。段階1の下書きが API の要件ID を外部設計書の model から写し、簡易モードの実装計画書が WBS に「要件」欄を書き、手順書の index に「要件との対応」と非機能要件・制約の表が載り、段階8の応答が単位ごとの要件を返すようにする。

自動実装モード: on([introduction](./Phase-38-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_basis.py`](../samples/backend/app/detailed_design/procedure_basis.py) | 更新 | `ProcedureBasis.functions()`・`unit_req_ids()`(モードごとの単位の要件) |
| [`app/detailed_design/procedure_output/source.py`](../samples/backend/app/detailed_design/procedure_output/source.py) | 更新 | 要件定義書の model から、単位の要件・要件との対応・NFR と CON・本文を持つ |
| [`app/detailed_design/procedure_output/markdown.py`](../samples/backend/app/detailed_design/procedure_output/markdown.py) | 更新 | index に「4. 要件との対応」と非機能要件・制約の表、単位一覧と単位の md・AI 向けの版に要件 |
| [`app/detailed_design/procedure_output/html.py`](../samples/backend/app/detailed_design/procedure_output/html.py) | 更新 | HTML も md と同じ節と列 |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | 詳細設計書の 01 機能一覧に「要件」の列 |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | 同じ列を HTML にも |
| [`app/detailed_design/drafting.py`](../samples/backend/app/detailed_design/drafting.py) | 更新 | 段階1の構造化出力に `req_ids`(API でない処理だけ)とプロンプト |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignStageRead.unit_req_ids`(段階8だけ) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `StageSources.document_models` を詰める、段階8の `unit_req_ids`、AI 向けの版に要件定義書の model |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | 手順書の zip に要件定義書の model を渡す |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 段階1の下書きで、外部設計書の model の API の要件ID を `merge_draft` へ |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 実装計画書の WBS のプロンプトと例に「要件: FR-001」 |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽 LLM の WBS に「要件」欄 |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `DOCUMENT_MODELS`(要件定義書・外部設計書の model)をプロジェクトの文書に、手順書の出力の入力に要件定義書の model |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | 簡易モードのプロジェクトの要件定義書に model、手順書の出力の入力に `REQUIREMENTS_MODEL` |
| [`tests/fixtures/external_design.py`](../samples/backend/tests/fixtures/external_design.py) | 更新 | `e2e_fake_upstream`(偽 LLM の要件定義書と外部設計書を model → md に) |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | 段階1の下書きの要件ID の写し、偽 LLM の段階1が指摘0件 |
| [`tests/unit/test_detailed_design_document_markdown.py`](../samples/backend/tests/unit/test_detailed_design_document_markdown.py) | 更新 | 01 の「要件」の列 |
| [`tests/unit/test_procedure_markdown.py`](../samples/backend/tests/unit/test_procedure_markdown.py) | 更新 | index の6つの節・要件との対応・NFR と CON の表・単位の要件、要件ID の無い要件定義書 |
| [`tests/unit/test_procedure_html.py`](../samples/backend/tests/unit/test_procedure_html.py) | 更新 | HTML の節と表 |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | WBS のプロンプトの「要件」欄と、例の WBS が `parse_wbs` で読めること |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 更新 | 偽 LLM の段階1〜8で、段階1の要件と手順書の「要件との対応」 |
| [`tests/unit/test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) | 更新 | 簡易モードの段階8の `unit_req_ids` |

並びは import の依存順(#30)。`source.py` が `procedure_basis.py` の新しいメソッドを使い、`markdown.py` が `source.py` の `REQUIREMENTS_MISSING_TEXT` を、`html.py` が `markdown.py` の表の見出しと行の関数を読む。`design_stage_generation_service.py` は `design_stage_service.py`・`detailed_design_export_service.py` を読むので、その後に置いた。

## 要点の抜粋

```python
# app/detailed_design/procedure_basis.py
class ProcedureBasis:
    def functions(self) -> list[FunctionRow] | None: ...       # 簡易モードは None
    def unit_req_ids(self) -> dict[str, list[str]]:
        return unit_req_ids(self.units, self.functions())
```

```python
# app/detailed_design/procedure_output/source.py
REQUIREMENTS_MISSING_TEXT = "要件定義書に要件ID がありません(要件定義書を再生成すると、要件との対応が載ります)。"

@dataclass(frozen=True)
class ProcedureOutputSource:
    ...
    requirements_available: bool = False
    unit_reqs: Mapping[str, Sequence[str]]        # 単位 → 要件ID
    trace: tuple[TraceRow, ...] = ()               # 「要件との対応」
    constraints: tuple[RequirementRow, ...] = ()   # NFR と CON
    requirement_texts: Mapping[str, str]           # 要件ID → 本文(AI 向けの版)
    def unit_requirements(self, unit_id: str) -> list[str]: ...

def procedure_output_source(title, state, basis, model, issues, requirements="",
                            requirements_model=None) -> ProcedureOutputSource: ...
```

```python
# app/detailed_design/procedure_output/markdown.py(index の節)
# 1. 実装概要 / 2. 実装前提・制約(+ ### 非機能要件・制約(要件定義書))/ 3. 単位の一覧(「要件」の列)
# 4. 要件との対応 / 5. 未定義・要決定の一覧 / 6. 完了条件
TRACE_HEADERS = ("要件ID", "優先度", "要件", "処理", "単位")
CONSTRAINT_HEADERS = ("要件ID", "大項目・種類", "要件", "出どころ")
def trace_table_rows(source) -> list[list[str]]: ...       # HTML も同じ行を使う
def constraint_table_rows(source) -> list[list[str]]: ...
```

```python
# app/services/design_stage_generation_service.py
async def generate_function_list(context: StageGenerationContext) -> dict:
    ...
    requirements = api_req_ids(context.sources.document_models.get("external_design"))
    return merge_draft(to_drafts(output), previous_model, requirements).model_dump(mode="json")
```

```python
# app/services/design_stage_service.py(_sources)
models = {doc_type: d.model for doc_type, d in documents.items() if d is not None and d.model}
return StageSources(documents=texts, stages=approved, document_models=models, ...)
```

依存の向き: `procedure_basis.py` は `function_list.py`・`requirement_trace.py`(38-1)を読む。`source.py` は `requirement_trace.py` と `app.documents.requirements.model.RequirementRow` を、`markdown.py` は `source.py` と `SOURCE_LABEL` を読む。サービスは model を集めて渡すだけで、要件の計算は 38-1 の純粋関数に任せる。

## 設計判断

### 文書の model は `StageSources` で渡す

段階の検証・下書き・出力は `StageSources` を入力にしている。要件の追跡に要る文書の model を同じ入れ物(`document_models`)に入れ、`DesignStageService._sources` が表示中の版の model を詰める。検証・下書き・zip・画面の「AI 向けにコピー」が同じ `_sources` を通るので、どれも同じ要件を見る。model の無い文書は入れない(`available` が偽になり、再生成の案内になる)。

### 手順書の index に節を1つ足す

「要件との対応」は単位の一覧の後、未定義の一覧の前に「4.」として置き、未定義と完了条件を 5・6 に下げた。見出しの番号を読むコードは無く、変わるのはテストの期待だけ。HTML も同じ順で、節のアンカーは `proc1`〜`proc7` になる。行の作り方(`trace_table_rows`・`constraint_table_rows`)は md と HTML で共有し、表示の食い違いを防ぐ。

NFR と CON は処理に結ばないので、「2. 実装前提・制約」に要件定義書の行をそのまま表にする(ユーザーの選択、案1)。出どころ(ユーザー・採用・推測)を列に出すので、推測の制約を実装者が見分けられる。横断事項の行との結び付け(案2)は、Phase 39 の実 LLM の結果を見て決める([introduction](./Phase-38-introduction.md)「未消化の申し送り」)。

### 単位の md と AI 向けの版にも要件を書く

人向けの単位の md は先頭の行に「要件: FR-001」、AI 向けの版は「今回の実装単位」に「実現する要件: - FR-001: 本文」を書く。AI に単位を渡すとき、その単位が何の要件のためにあるかを、設計を辿らずに読めるようにするため。

### 段階8の応答に単位の要件を足す

段階8の画面は単位の一覧を `plan`(段階7・WBS の形)から作っているが、詳細設計モードの単位の要件は段階1から導くので、画面だけでは計算できない(段階1の内容を持っていない)。そこで `DesignStageRead.unit_req_ids`(段階8だけ)に、`ProcedureBasis.unit_req_ids()` の結果を入れて返す。段階7のパネルも段階1を持たないので、要件は段階8のパネルに出す(計画で決めた)。

### 実装計画書の WBS に「要件」欄

簡易モードの実装計画書のプロンプトに「要件: FR-<3桁>, ...」の欄と、「Must の機能要件は、すべていずれかのタスクの『要件』に入れる」を足した。実装計画書は要件定義書の md を読むので、要件ID を参照できる。プロンプトの例の WBS は `parse_wbs` で読めることをテストで確かめる(例がずれると、AI が例を真似て読めない WBS を書くため)。

### 偽 LLM とテストの土台

偽 LLM の段階1の下書きは要件ID を書かない(API の処理は外部設計書の model から写るので、それで指摘0件になる ── 「コードが写す」の契約をそのまま確かめる)。偽 LLM の WBS には「要件: FR-001」を足した。詳細設計モードの契約テストは、要件定義書・外部設計書を `e2e_fake_upstream` で生成と同じく model → md にして作り、段階1の要件と手順書の「要件との対応」まで確かめる。テスト用のプロジェクト(`create_detailed_project`・`create_simple_procedure_project`)の文書にも model を持たせ、既存のテストが `REQUIREMENT_IDS_MISSING` を出さない形にした。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_index_markdown`・`to_unit_markdown`・`to_ai_markdown` | pytest(`test_procedure_markdown.py`) | スタブ不要 ── `ProcedureOutputSource`(fixture)だけから決まる純粋関数のため | 第一テスト(統合スモーク): index の6つの節。単位一覧の「要件」の列、単位の md の先頭行、要件との対応(詳細: 処理 F-01、簡易: 処理の列は DF、Won't は載せない)、NFR の表、AI 向けの「実現する要件」、要件ID の無い要件定義書では2か所に案内 |
| `to_procedure_html` | pytest(`test_procedure_html.py`) | スタブ不要(同上) | 節のアンカーが7つ、要件との対応と NFR の表のセル、単位の見出しの要件 |
| `to_markdown`(詳細設計書) | pytest(`test_detailed_design_document_markdown.py`) | スタブ不要(同上) | 01 の列名と、処理の要件ID |
| `generate_function_list`・段階1のルートと実行 | pytest(`test_design_stage_generation.py`) | `FakeLLM`(構造化出力を返すスタブ)・`E2eFakeLLM`。DB はインメモリ SQLite | API の処理の要件ID が外部設計書の model から写る、構造化出力の `req_ids` が下書きに入る、偽 LLM の段階1が外部設計書の model と照らして指摘0件 |
| 実装計画書のプロンプト | pytest(`test_doc_generator_service.py`) | スタブ不要 ── 文字列の定数を読むだけのため | 「要件」の欄の指示と、例の WBS が `parse_wbs` で読める |
| 偽 LLM の段階1〜8(詳細)・段階8(簡易) | pytest(`test_fake_llm_detailed_design.py`・`test_fake_llm_simple_procedure.py`) | `E2eFakeLLM`(LLM のスタブ)。DB はインメモリ SQLite | 段階1の要件(F-01 → FR-001、F-02 → FR-002)と指摘0件、手順書の zip の「要件との対応」、簡易モードの段階8の `unit_req_ids` |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_procedure_markdown.py tests/unit/test_procedure_html.py tests/unit/test_detailed_design_document_markdown.py tests/unit/test_design_stage_generation.py tests/unit/test_doc_generator_service.py tests/unit/test_fake_llm_detailed_design.py tests/unit/test_fake_llm_simple_procedure.py
```
