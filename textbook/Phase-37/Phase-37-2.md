# Phase-37-2: 外部設計書の生成の構造化と API(BE)

## この章の目的

外部設計書の生成を、自由な Markdown の1回の呼び出しから「構造化出力 → model([37-1](./Phase-37-1.md))→ md」に替える。入力は今と同じ要件定義書の md と、画面ID を引き継ぐための前の版の画面。同じ生成で作った要件定義書の model から要件ID を写す。文書の応答に、外部設計書の行数と検証の指摘を付ける。E2E 用の偽 LLM も構造化出力で外部設計書を返すようにし、外部設計書の md を前提にしていた既存のテストを合わせる。

自動実装モード: on([introduction](./Phase-37-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/external_design/drafting.py`](../samples/backend/app/documents/external_design/drafting.py) | 新規 | 構造化出力のスキーマ(`ExternalDesignGenerationOutput`)・プロンプト・入力の組み立て・下書きへの変換 |
| [`app/detailed_design/api_list.py`](../samples/backend/app/detailed_design/api_list.py) | 更新 | docstring だけ(2.6 の表を組み立てる場所が `markdown.py` に移った) |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `DocumentIssueRead`(旧 `RequirementIssueRead`)・`ExternalDesignSummaryRead`・`GeneratedDocumentRead.external_design` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 外部設計書の自由記述のプロンプトを外し、`_generate_external_design`・`parse_external_design_model`・`external_design_summary` を足す |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽 LLM の外部設計書を構造化出力(`_EXTERNAL_DESIGN_OUTPUT`)に |
| ── ここからテスト ── | | |
| [`tests/fixtures/external_design.py`](../samples/backend/tests/fixtures/external_design.py) | 新規 | 外部設計書の構造化出力の見本・上流の2文書の偽の出力(`upstream_outputs`)・偽 LLM の外部設計書の md(`e2e_fake_external_design_md`) |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 構造化出力の連鎖、外部設計書の model と要約、画面ID の引き継ぎ |
| [`tests/unit/test_project_mode.py`](../samples/backend/tests/unit/test_project_mode.py) | 更新 | 詳細設計モードの2文書(外部設計書も構造化出力) |
| [`tests/unit/test_doc_generation_guard.py`](../samples/backend/tests/unit/test_doc_generation_guard.py) | 更新 | 途中の失敗の理由の注記だけ |
| [`tests/unit/test_external_api_list.py`](../samples/backend/tests/unit/test_external_api_list.py) | 更新 | 偽 LLM の外部設計書の 2.6 が読める・パスの形はスキーマで指示 |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 文の生成のプロンプトは2種類・偽の外部設計書の md |
| [`tests/unit/test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) | 更新 | 段階8の入力の外部設計書を組み立てた md に |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 更新 | 段階1の入力の外部設計書を組み立てた md に |
| [`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | 結合の偽 LLM に外部設計書の構造化出力 |

## 要点の抜粋

```python
# app/documents/external_design/drafting.py
class GeneratedScreen(BaseModel):
    id: str          # 仮の画面ID(前の版と同じ画面なら前の版の ID)
    name: str; role: str
    priority: Literal["Must", "Should", "Could"]
    req_ids: list[str]
    ui_spec: str     # 主要画面の構成要素(箇条書き)

class GeneratedApi(BaseModel):
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
    path: str        # /api/v1/<リソース>、個別は {id}(段階1の機能グループの初期値が読む形)
    summary: str; screens: list[str]; req_ids: list[str]
    body: str        # POST・PUT・PATCH は必ず書く
    response: str; errors: str

class ExternalDesignGenerationOutput(BaseModel):
    overview: str; screens: list[GeneratedScreen]; transition: str
    integrations: list[GeneratedIntegration]; data_io: str; apis: list[GeneratedApi]

def build_external_design_messages(requirements_md: str, previous: ExternalDesignModel | None): ...
def to_draft(output: ExternalDesignGenerationOutput) -> ExternalDesignDraft: ...
```

```python
# app/services/doc_generator_service.py(generate の文書ごとの分岐)
if doc_type == "requirements":
    content, requirements = await self._generate_requirements(project, transcript, llm=llm)
    model = requirements.model_dump(mode="json")
elif doc_type == "external_design":
    content, model = await self._generate_external_design(
        project, generated["requirements"], requirements, llm=llm
    )
else:
    content = await self._generate_one(doc_type, transcript, generated, llm=llm)

async def _generate_external_design(self, project, requirements_md, requirements, *, llm):
    previous = parse_external_design_model(current.model if current else None)
    messages = build_external_design_messages(requirements_md, previous)
    output = await invoke_structured(llm, ExternalDesignGenerationOutput, messages)
    model = build_external_design_model(to_external_design_draft(output), previous, requirements)
    return render_external_design(model), model.model_dump(mode="json")
```

```python
# app/schemas/document.py
class ExternalDesignSummaryRead(BaseModel):
    counts: dict[str, int]          # screens / apis / integrations
    issues: list[DocumentIssueRead]

class GeneratedDocumentRead(BaseModel):
    ...
    requirements: RequirementsSummaryRead | None = None
    external_design: ExternalDesignSummaryRead | None = None   # document_read が入れる
```

依存の向き: `drafting.py` は `external_design/assemble.py`・`model.py`([37-1](./Phase-37-1.md))だけを読む。サービスは `app.documents.external_design`・`drafting.py`・`app.documents.issues`・スキーマを読む。`fake.py` は `drafting.py` を読む。ルート(`routes/projects.py`)は既存の `document_read` を呼ぶだけなので変えていない。

## 設計判断

### 入力は要件定義書の md と、前の版の画面

会話は今と同じく渡さない。外部設計書は「確定した要件定義書だけ」から作る連鎖構成(Phase 2)を保つ。要件定義書の md には要件ID の表があるので、AI はそこから ID を拾える。前の版の画面は「ID|画面名」の行で渡し、同じ画面には前の ID を書かせる([37-1](./Phase-37-1.md) の引き継ぎ)。

### 要件定義書の model をそのまま渡す

`_generate_requirements` は md と `RequirementsModel` を返すようにし、`generate` が同じ生成の外部設計書に渡す。DB から読み直さないのは、同じトランザクションの中で作ったばかりの値だから。model に写すのは要件ID の一覧と Must の機能要件ID だけ(検証と付録に要る分)。

### 自由記述のプロンプトを外す

`_DOC_TYPE_PROMPTS` から外部設計書を外した(要件定義書と同じく `drafting.py` の `SYSTEM_PROMPT` とスキーマの説明に移した)。見出しと 2.6 の列名は `markdown.py` が決めるので、プロンプトで「出力フォーマット」を指示しなくてよくなった。パスの書き方(`/api/v1/<リソース>`・`{id}`)は段階1の機能グループの初期値が読むので、スキーマの `path` の説明に残した。`_DOC_TYPE_INPUTS` の外部設計書の行は、文書の順序の確認(`test_project_mode.py`)のために残している。

### 失敗は生成全体の失敗

構造化出力を解釈できなければ、今と同じく生成全体を失敗にして版を巻き戻す(自由な md への退避はしない)。要件定義書と同じ扱い。

### 偽 LLM と、md を前提にしていたテスト

偽 LLM(E2E 用)は `ExternalDesignGenerationOutput` に固定の出力を返す。画面は `SCR-001` の1つ、API は段階1の偽の下書きと同じ2つ(POST・GET `/api/v1/reservations`)、要件ID は偽の要件定義書の FR-001・FR-002。overview に「[E2E Fake]」を入れたので、E2E が外部設計書のタブで「E2E Fake」を見つけられる。

偽 LLM に外部設計書のプロンプトを `ainvoke` で渡して md を得ていたテスト(段階1・段階8・API 一覧)は、`tests/fixtures/external_design.py` の `e2e_fake_external_design_md` で、本物の生成と同じく「構造化出力 → model → md」で組み立てた md を使うようにした。生成のテストの偽 LLM(`FakeLLM`)には、`structured_by_schema` に `upstream_outputs()`(要件定義書と外部設計書の2つ)を渡す。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DocGeneratorService.generate`(`_generate_external_design`)・`document_read`・`external_design_summary` | pytest(`test_doc_generator_service.py`) | `FakeLLM`(`structured_by_schema` = `upstream_outputs`)── LLM は外部依存なので、スキーマごとの固定の出力に差し替える。DB はインメモリ SQLite | 第一テスト(統合スモーク): 4文書がそろう。外部設計書の入力は要件定義書の md だけ(会話は入らない)、内部設計書には組み立てた外部設計書の md が渡る(連鎖構成)、構造化出力は要件定義書 → 外部設計書の順、model に要件ID の写し・md の 2.6 の行・応答の行数と指摘(見本の POST は本文が空 → `API_BODY_MISSING`)、再生成で前の版の画面がプロンプトに入り、前の版に無い仮の ID は次の番号に振り直して API の参照も付け替える |
| 詳細設計モードの生成・途中の失敗の巻き戻し | pytest(`test_project_mode.py`・`test_doc_generation_guard.py`) | `FakeLLM`(同上。途中の失敗は、外部設計書のスキーマに要件定義書の出力を返して解釈を失敗させる) | 2文書だけを作る / 外部設計書で失敗したら要件定義書の版も残らない |
| 偽 LLM(`E2eFakeLLM`)の外部設計書、2.6 の読み取り、構造化出力のスキーマ | pytest(`test_fake_llm_e2e.py`・`test_external_api_list.py`) | スタブ不要 ── 偽 LLM そのものが対象(固定の出力を返すだけで外部を呼ばない) | 組み立てた md に「E2E Fake」・見出し・画面・要件ID、`extract_api_endpoints` で2つの API、パスの形の説明、文の生成のプロンプトは内部設計書・実装計画書の2種類 |
| 偽 LLM の文書で段階1・段階8を通す | pytest(`test_fake_llm_detailed_design.py`・`test_fake_llm_simple_procedure.py`) | スタブ不要(同上)。DB はインメモリ SQLite | 組み立てた外部設計書の md で、段階1の検証・段階8の指摘が0件のまま |
| ルート・スキーマ・DI の配線 | pytest(`tests/integration/test_projects_flow.py`、結合) | `FakeLLM`(`structured_by_schema` に `upstream_outputs`)。DB は専用の PostgreSQL | ヒアリング → 生成 → 文書の取得が通る |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_doc_generator_service.py tests/unit/test_project_mode.py \
  tests/unit/test_doc_generation_guard.py tests/unit/test_external_api_list.py tests/unit/test_fake_llm_e2e.py \
  tests/unit/test_fake_llm_detailed_design.py tests/unit/test_fake_llm_simple_procedure.py
```
