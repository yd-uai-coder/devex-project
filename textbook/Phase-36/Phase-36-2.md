# Phase-36-2: 生成の構造化と API(BE)

## この章の目的

要件定義書の生成を、自由な Markdown の1回から「構造化出力 → model → md」に変える。入力は会話に加えて観点の表(状態・決めたこと)と前の版の要件(ID の引き継ぎ用)。出どころは [36-1](./Phase-36-1.md) の上限で直す。プレビューのために、文書の応答に出どころの件数・推測の要件・検証の指摘を付け、推測の要件を「採用」にする API を足す。1.4 が表になるので、手順書の対象外の解析を表に合わせる。両モード共通(詳細設計モードも簡易モードも要件定義書は同じ作り方)。

自動実装モード: on([introduction](./Phase-36-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/repositories/hearing_point.py`](../samples/backend/app/repositories/hearing_point.py) | 更新 | `load_states`・`states_from_rows`(行 → 観点の表。チャットのサービスから移した) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | `states_from_rows`・`as_scale` を共通の物に置き換え(挙動は変えない) |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | `invoke_structured`(構造化出力 + 再試行。段階の生成から移した) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `_invoke_structured` を `invoke_structured` に置き換え(挙動は変えない) |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 新規 | 構造化出力のスキーマ・プロンプト・入力(観点の表・前の版の要件・会話)・下書きへの変換 |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `RequirementsSummaryRead`(件数・推測の要件・指摘)を `GeneratedDocumentRead.requirements` に |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `RequirementNotFoundError`(404)・`RequirementNotAssumedError`(409) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 要件定義書の生成(`_generate_requirements`)・`adopt_requirement`・`document_read`。自由な md のプロンプトを削除 |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 文書の応答に要約を付ける・`POST /projects/{id}/documents/requirements/rows/{req_id}/adopt` |
| [`app/detailed_design/procedure_output/source.py`](../samples/backend/app/detailed_design/procedure_output/source.py) | 更新 | `out_of_scope_lines` が 1.4 の表の行も読む |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E の偽 LLM の要件定義書(前の版の ID を引き継ぐ・推測を1つ含む) |
| ── ここからテスト ── | | |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py) | 更新 | 構造化出力に渡った messages を記録する(`structured_messages`) |
| [`tests/fixtures/requirements.py`](../samples/backend/tests/fixtures/requirements.py) | 新規 | 要件定義書の構造化出力の見本(`requirements_output`) |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 観点の表と前の版が入力に入る・上限・ID の引き継ぎ・採用 |
| [`tests/unit/test_project_mode.py`](../samples/backend/tests/unit/test_project_mode.py) | 更新 | 詳細設計モードの2文書(要件定義書は構造化出力) |
| [`tests/unit/test_doc_generation_guard.py`](../samples/backend/tests/unit/test_doc_generation_guard.py) | 更新 | 途中の失敗で版を残さない(要件定義書は構造化出力) |
| [`tests/unit/test_document_versions.py`](../samples/backend/tests/unit/test_document_versions.py) | 更新 | ルートの要約と「採用にする」 |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽 LLM の契約(本物のプロンプトから ID を引き継ぐ) |
| [`tests/unit/test_procedure_output_source.py`](../samples/backend/tests/unit/test_procedure_output_source.py) | 更新 | 1.4 の表の行 |
| [`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | 作成 → チャット → 生成の流れで、要件定義書の要約と md |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/documents/requirements/drafting.py
class GeneratedRequirement(BaseModel):
    kind: Literal["FR", "NFR", "CON"]
    prev_id: str = ""        # 前の版の同じ要件の ID(新しい要件は空)
    priority: Literal["Must", "Should", "Could", "Won't", ""] = ""
    category: str = ""
    text: str
    source: Literal["user", "adopted", "assumed"]
    points: list[str]        # 観点のキー

def build_requirements_messages(transcript, states, scale, previous) -> list[BaseMessage]:
    human = (f"## 観点の表\nkey|名前|状態|決めたこと\n{points_table(states, scale)}\n\n"
             f"## 前の版の要件\n{previous_rows_text(previous)}\n\n"
             f"## 会話\n{transcript}")
    return [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=human)]
```

```python
# app/services/doc_generator_service.py
async def _generate_requirements(self, project, transcript, *, llm) -> tuple[str, dict]:
    states = await self._hearing_points.load_states(project.id)
    scale = as_scale(project.hearing_scale)
    current = await self._documents.get_current(project_id=project.id, doc_type="requirements")
    previous = parse_requirements_model(current.model if current else None)
    messages = build_requirements_messages(transcript, states, scale, previous)
    output = await invoke_structured(llm, RequirementsGenerationOutput, messages)
    model = build_model(to_draft(output), previous, states, scale)
    return render_requirements(model), model.model_dump(mode="json")

async def adopt_requirement(self, project, req_id) -> GeneratedDocument:
    """同じ版の model と md を書き換える(版を増やさない)。生成中 409・無い 404・推測でない 409。"""
```

```python
# app/api/routes/projects.py
@router.post("/{project_id}/documents/requirements/rows/{req_id}/adopt",
             response_model=GeneratedDocumentRead)
async def adopt_requirement(req_id, session, current_project) -> GeneratedDocumentRead:
    document = await DocGeneratorService(session).adopt_requirement(current_project, req_id)
    return document_read(document)   # 要件定義書は requirements(件数・推測・指摘)を付ける
```

依存の向き: サービスが `app.documents.requirements`(36-1 と `drafting.py`)・`app.repositories.hearing_point`・`app.schemas.document` を読む。`drafting.py` は `app.hearing` と `assemble.py`・`model.py` を読む(サービスやスキーマは読まない)。ルートはサービスの `document_read` だけを読み、要約の組み立てはサービスに置く(ルートが model を知らない)。偽 LLM(`fake.py`)は `drafting.py` のスキーマを読む。

## 設計判断

### 要件定義書だけ構造化出力にする

後続の3文書(外部設計書・内部設計書・実装計画書)は今のまま md を生成し、要件定義書の md を入力に読む。要件定義書の md は model から組み立てたものなので、後続から見ると見出しも同じで、要件ID と出どころが増えただけ。外部設計書のモデル化は Phase 37。生成に失敗したときは今と同じく生成全体の失敗にする(自由な md に退避しない。退避すると model の無い版が混ざり、ID の引き継ぎが切れる)。

### 入力に観点の表と前の版の要件を渡す

観点の表は「key|名前|状態|決めたこと」の行で渡す。AI が出どころと観点を付ける手がかりにする(付けた値はコードが上限で直す)。前の版の要件は「ID|本文」の行で渡し、同じ要件には `prev_id` を返させる。言い直しただけの要件も同じ要件として扱うよう指示した。再生成で本文が少し変わっても ID を保つため。

### 共通化した2つ(#17)

- `invoke_structured`: 段階の生成(`design_stage_generation_service`)にあった `_invoke_structured` を `llm_retry.py` に移し、要件定義書の生成と共有した。消費者は `_generate_requirements`。
- `states_from_rows`・`load_states`・`as_scale`: チャットのサービスにあった「行 → 観点の表」「規模の値」を、リポジトリと `app.hearing` に移した。消費者は `_generate_requirements`(観点の表を読む2つ目の場所)。

どちらも挙動は変えていない(既存のテストがそのまま通る)。

### 「採用にする」は版を増やさない

推測の要件を利用者が確かめたとき、中身は変わらず出どころだけが変わる。版を増やすと、段階の入力の指紋(文書の版)が変わり、詳細設計モードの段階2・4・7・8が「古い」になる。中身が同じなのに作り直しを求めるのは過剰なので、同じ版の model と md を書き換える(`replace_model`)。付録は model に写した生成時点の状態から組み立てるので変わらない([36-1](./Phase-36-1.md))。違う内容にしたいときは、チャットで答えて再生成する。

### 手順書の対象外は表の行も読む

`out_of_scope_lines` は 1.4 の箇条書き(`- **Should have**: …`)から手順書の「対象外」を作っていた。1.4 が表になると何も拾えなくなるので、表の行は優先度の列が Should / Could / Won't の行を「Should(FR-010): 要件」にする。以前の箇条書きの文書(model の無い版)も読み続ける。

### 偽 LLM は ID の引き継ぎを契約として持つ

E2E の偽 LLM は、プロンプトの「## 前の版の要件」を読み、同じ本文の要件に `prev_id` を返す。プロンプトの書式を変えたときに偽物が追従しているかを `test_fake_llm_e2e.py` が本物の `build_requirements_messages` で確かめる。推測の要件を1つ含め、E2E で「採用にする」を試せるようにした(E2E を足すかは Phase 40)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DocGeneratorService.generate`(要件定義書)・`adopt_requirement`・`document_read` | pytest(`test_doc_generator_service.py`) | `FakeLLM`(構造化出力は `requirements_output`、文の応答は3文書 + 自己診断)。DB はインメモリ SQLite | 第一テスト(統合スモーク): 4文書の生成。観点の表がプロンプトに入り出どころに上限がかかる、前の版の ID が入力に入り `prev_id` で引き継ぐ(消えた番号は使い回さない)、採用で版が増えない・推測でない/無い/model の無い版/生成中の拒否、model の無い版は要約なし。連鎖構成(要件定義書は会話、後続は前段の md)も確かめる |
| 生成のモード・失敗の巻き戻し | pytest(`test_project_mode.py`・`test_doc_generation_guard.py`) | `FakeLLM` | 詳細設計モードは2文書、途中の失敗で版を残さない(既存の観点を新しい呼び出しの形で保つ) |
| ルート `list_generated_documents`・`adopt_requirement` | pytest(`test_document_versions.py`) | スタブ不要 ── 文書を DB に直接作るので LLM を呼ばない | 要件定義書だけが要約を持ち、採用で件数が変わる、無い要件は 404 |
| `out_of_scope_lines` | pytest(`test_procedure_output_source.py`) | スタブ不要 ── 純粋関数のため | 表の行(Must は除く・`\|` の戻し・1.5 は読まない) |
| `E2eFakeLLM` の要件定義書 | pytest(`test_fake_llm_e2e.py`) | スタブ不要 ── 偽 LLM 自体が対象 | 本物のプロンプトの前の版から ID を引き継ぐ契約、推測が1つ、md に「E2E Fake」 |
| 作成 → チャット → 生成 → ダウンロード | pytest(`test_projects_flow.py`、`-m integration`) | `FakeLLM`(`get_gemini_llm` を差し替え) | 専用 DB(`docker-compose.test.yml`)で流す。要件定義書の要約(すべてユーザー)と md の表の行 |

`llm_retry.py`・`design_stage_generation_service.py` の置き換えは既存の `test_llm_retry.py`・`test_fake_llm_detailed_design.py` などが、`chat_service.py` は `test_fake_llm_e2e.py`・`test_chat_service.py` が、`hearing_point.py` は `test_doc_generator_service.py` が import して確かめる。

```sh
cd devex-api/backend && uv run pytest -k "doc_generat or document or procedure_output or fake_llm or project_mode or requirements"
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm --no-deps backend \
  uv run pytest -m integration tests/integration/test_projects_flow.py   # devex-api/ で
```
