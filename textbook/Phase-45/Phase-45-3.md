# Phase-45-3: 生成への組み込みと文書の応答

## この章の目的

45-1・45-2 の部品を4文書の生成(`DocGeneratorService.generate`)につなぐ。内部設計書・実装計画書も構造化出力 → model → md で作り、前段の model から照合の写しを取り、文書の応答に行数と検証の指摘を付ける。これで4文書すべてが構造化出力になり、md をそのまま書かせる経路は消える。E2E 用の偽 LLM も構造化出力を返すようにする。

自動実装モード: on([introduction](./Phase-45-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `DocumentSummaryRead`(行数と指摘)、`GeneratedDocumentRead.internal_design`・`implementation_plan`。`ExternalDesignSummaryRead` はその派生にした |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E 用の偽 LLM: 内部設計書・実装計画書の md の返信を、構造化出力(`_INTERNAL_DESIGN_OUTPUT`・`_IMPLEMENTATION_PLAN_OUTPUT`)に置き換え |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `_generate_internal_design`・`_generate_implementation_plan`、`parse_*_model`・`*_summary`、`document_read`。`_DOC_TYPE_PROMPTS`・`_generate_one`・`_collapse_doubled_headings` を削除 |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_documents.py`](../samples/backend/tests/fixtures/simple_documents.py) | 新規 | 内部設計書・実装計画書の構造化出力の見本、偽 LLM の2文書を model → md にする `e2e_fake_simple_documents` |
| [`tests/fixtures/external_design.py`](../samples/backend/tests/fixtures/external_design.py) | 更新 | `upstream_outputs` を4文書の構造化出力に |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `create_simple_procedure_project(models=...)`(内部設計書・実装計画書の model も持たせる) |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 4文書とも構造化出力の連鎖、2文書の model と応答、再生成で DF の ID とキーを引き継ぐ。プロンプトの文言のテストと見出しの重なりのテストを削除 |
| [`tests/unit/test_external_api_list.py`](../samples/backend/tests/unit/test_external_api_list.py) | 更新 | 内部設計書の API の「2.6 と同じパス」を、プロンプトでなくスキーマの説明で確かめる |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽 LLM の2文書が構造化出力で返り、md を古い版の解析が指摘0件で読む |
| [`tests/unit/test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) | 更新 | 偽 LLM の4文書を、生成と同じく model → md にしてから段階8を通す |
| [`tests/unit/test_project_mode.py`](../samples/backend/tests/unit/test_project_mode.py) | 更新 | 内部設計書のモジュール一覧の表を、プロンプトでなく model の md で確かめる |

## 要点の抜粋

### 1. 生成

```python
# app/services/doc_generator_service.py(generate の中)
elif doc_type == "internal_design":
    content, internal = await self._generate_internal_design(project, generated, external, llm=llm)
    model = internal.model_dump(mode="json")
else:
    content, plan = await self._generate_implementation_plan(
        project, generated, requirements, internal, llm=llm)
```

- 入力は今までと同じ(`_DOC_TYPE_INPUTS`): 内部設計書は要件定義書・外部設計書の md、実装計画書は要件定義書・内部設計書の md。後段は前段の model から組み立てた md を読む。
- 照合の写しは前段の model から取る: 内部設計書 ← 外部設計書の API(`a.label`)、実装計画書 ← 内部設計書の DF の ID と要件定義書の要件ID。
- 前の版の model(DF の ID・キーの引き継ぎ)は、その文書の表示中の版から読む。壊れた model は無いものとして扱う(`parse_*_model`。外部設計書と同じ)。
- 自己診断は今までどおり4文書の md をまとめて読む。

### 2. 文書の応答

```python
# app/schemas/document.py
class DocumentSummaryRead(BaseModel):
    counts: dict[str, int]
    issues: list[DocumentIssueRead]

class GeneratedDocumentRead(BaseModel):
    ...
    internal_design: DocumentSummaryRead | None = None
    implementation_plan: DocumentSummaryRead | None = None
```

model を持つ版だけに付ける(以前の版・ほかの文書は None)。画面は 45-5。

### 3. 消したもの

- `_DOC_TYPE_PROMPTS`(2文書のプロンプト)と `_COMMON_FORMAT_GUIDANCE` → 各 `drafting.py` の `SYSTEM_PROMPT` とスキーマの説明に移した(「表の多用・番号付きの小見出し・コードブロックの図」の心がけは、行と本文の節に分けたので要らなくなった)。
- `_generate_one`(md をそのまま書かせる生成)・`_collapse_doubled_headings`(AI の md の見出しの重なりの修正。本文の見出しは 45-1 の `body_text` が太字にする)。

### 4. E2E 用の偽 LLM

`_DOC_TYPE_MARKERS`(システムプロンプトの見出しで文書を見分ける仕組み)と md の返信を消し、スキーマごとの構造化出力を返す。中身は今までの md と同じ(DF-1 = `POST /api/v1/reservations`、単位 `M-01-T01`・`M-01-T02`)。E2E(`devex-flow.spec.ts`)が見る「E2E Fake」の文字は、3.1・4.1 の本文に入れた。名前が他の構造化出力(段階7の `GeneratedMilestone` など)と重なるので、`internal_doc`・`plan_doc` のモジュール名で読む。

## 設計判断

- **見本の外部設計書の GET には DF を足さなかった**: 偽 LLM の外部設計書は API が2つ(POST・GET)で、内部設計書の DF は POST だけ。プレビューには `API_WITHOUT_DATAFLOW`(中程度)が1件出るが、DF を足すと段階8の単位が増え、E2E の操作(単位を2つ生成する)と契約テストが変わる。見本の質は E2E の検証対象でないので変えなかった。
- **`ExternalDesignSummaryRead` を残した**: 型は `DocumentSummaryRead` と同じだが、OpenAPI の名前と devex-ui の型(画面・API・外部連携の件数)が既にあるため、派生クラスにして名前を残した。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `DocGeneratorService.generate`(4文書の連鎖) | pytest(`test_doc_generator_service.py`) | `FakeLLM`(スキーマごとの構造化出力 + 自己診断の文字列。`tests/fixtures/fake_llm.py`) | 入力の連鎖(マーカー)、構造化出力の呼び出し順(4スキーマ)、DB はインメモリ SQLite |
| `_generate_internal_design`・`_generate_implementation_plan`・`document_read` | 同上 | 同上 | 写し(`external_apis`・`known_dataflow_ids`・`must_fr_ids`)、キー `U-001`、md の DF の見出しと WBS の行、応答の件数と指摘0件 |
| 再生成 | 同上 | 同上 | 別の API の処理は `DF-2`、同じ名前のタスクは `U-001` を引き継ぐ、計画の古い DF を `UNKNOWN_DATAFLOW`・`UNPLANNED_DATAFLOW` で指摘 |
| `E2eFakeLLM` の2文書(契約) | pytest(`test_fake_llm_e2e.py`・`test_fake_llm_simple_procedure.py`) | なし ── 偽 LLM は検証される側 | md を `parse_internal_design`・`parse_wbs` が指摘0件で読む、段階8の生成・承認・zip まで通る |
| 内部設計書のスキーマの説明・md の表 | pytest(`test_external_api_list.py`・`test_project_mode.py`) | スタブ不要 ── 定数と純粋関数のため | 2.6 と同じパス、モジュール一覧の列 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_doc_generator_service.py tests/unit/test_fake_llm_e2e.py \
  tests/unit/test_fake_llm_simple_procedure.py tests/unit/test_external_api_list.py tests/unit/test_project_mode.py -q
```
