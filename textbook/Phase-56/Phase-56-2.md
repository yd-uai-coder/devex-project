# Phase-56-2: 生成と API(両モード)

## この章の目的

[56-1](./Phase-56-1.md) の部品で、テスト仕様書を実際に生成して保存し、読み出せるようにする。簡易モードは4文書の生成に続けて自動で作り、詳細設計モードは段階1・段階7 を承認した後に `POST /projects/{id}/generate {start_from: "test_spec"}` で作る。保存した版には生成時の入力の版を写し、`GET /projects/{id}/test-spec` が件数・検証の指摘・「古い」を返す。レビュー・自己診断・変更の影響の印には渡さない。

自動実装モード: on([introduction](./Phase-56-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは devex-api は `devex-api/backend/` から、devex-ui は `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/test_spec/drafting.py`](../samples/backend/app/documents/test_spec/drafting.py) | 新規 | `GeneratedCase`・`TestSpecGenerationOutput`(構造化出力)・`SYSTEM_PROMPT`・`build_test_spec_messages`・`to_draft` |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `TEST_SPEC = "test_spec"`(`DOC_TYPES_BY_MODE` とは別) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `TestSpecUpstreamNotReadyError`(409 `TEST_SPEC_UPSTREAM_NOT_READY`) |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `DocType` に `test_spec`・`TestSpecRead`(`document`・`counts`・`issues`・`outdated`) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `approved_stages(project, stages)`(承認済みで古くない段階の版と内容) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `generation_targets` の拡張・`request_generation` の詳細の前提・`generate` の最後でテスト仕様書・`_generate_test_spec`・`_test_spec_inputs`・`get_test_spec`・`_parse` |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `GET /{project_id}/test-spec` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E 用の偽 LLM のテスト仕様書の応答(`_TEST_SPEC_OUTPUT`) |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | `DocType` に `test_spec` |
| [`src/features/documents/regenerationOps.ts`](../samples/frontend/src/features/documents/regenerationOps.ts) | 更新 | `DOC_LABEL.test_spec`(「テスト仕様」) |
| [`src/features/documents/components/DocumentTabs.tsx`](../samples/frontend/src/features/documents/components/DocumentTabs.tsx) | 更新 | 表示名に `test_spec`(`Record<DocType, string>` を満たすため。タブの並びには入れない) |
| ── ここからテスト ── | | |
| [`tests/fixtures/spec_documents.py`](../samples/backend/tests/fixtures/spec_documents.py) | 更新 | `spec_output`(テスト仕様書の構造化出力の見本) |
| [`tests/fixtures/external_design.py`](../samples/backend/tests/fixtures/external_design.py) | 更新 | `upstream_outputs` にテスト仕様書の構造化出力 |
| [`tests/unit/test_test_spec_drafting.py`](../samples/backend/tests/unit/test_test_spec_drafting.py) | 新規 | 生成の入出力 |
| [`tests/unit/test_test_spec_generation.py`](../samples/backend/tests/unit/test_test_spec_generation.py) | 新規 | 生成・読み出し・詳細の前提・偽 LLM の契約 |
| [`tests/unit/test_doc_generation_start.py`](../samples/backend/tests/unit/test_doc_generation_start.py) | 更新 | 起点にテスト仕様書が加わった |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 生成の件数と構造化出力の順 |
| [`tests/unit/test_review_sendback.py`](../samples/backend/tests/unit/test_review_sendback.py) | 更新 | テスト仕様書は修正指示を受け取らない |
| [`src/features/documents/__tests__/regenerationOps.test.ts`](../samples/frontend/src/features/documents/__tests__/regenerationOps.test.ts) | 更新 | 進み具合にテスト仕様書が来ても、プレビューの並びには入れない |

## 要点の抜粋

### 1. 生成の入出力

```python
# app/documents/test_spec/drafting.py
class TestSpecGenerationOutput(BaseModel):
    __test__ = False
    target: str; out_of_scope: str; environment: str; done_criteria: str
    cases: list[GeneratedCase]   # level・target・viewpoint・precondition・steps・expected・
                                 # design_gap・req_ids・screens(ID・処理・単位は書かせない)

def build_test_spec_messages(requirements_md: str, external: ExternalDesignModel | None,
                             obligations: Sequence[Obligation]) -> list[BaseMessage]:
    # ## 必要なテスト(表)/ ## 外部設計書の画面(UI 仕様の本文を除く)/ ## 外部設計書の API / ## 要件定義書
```

規則(`SYSTEM_PROMPT`)の要点: 必要なテストの各行に少なくとも1件 / 技法(同値分割・エラーの起こし方・境界値分析・認証と認可・非機能の測り方)/ 手順と期待結果は具体的な値で、期待結果は HTTP ステータスと保存される・されないデータ / **決まっていない値は推測で埋めずに `design_gap`** / ID は入力にあるものだけ / 一覧に無いテストを足してもよい / 日本語で書く([56-3](./Phase-56-3.md) で足した)。レビューの対象にしないので、修正指示(`finding_ids`)は受け取らない。

### 2. 生成の経路

```python
# app/services/doc_generator_service.py
def generation_targets(mode: str, start_from: str | None) -> tuple[str, ...]:
    if start_from == TEST_SPEC:
        return (TEST_SPEC,)
    ...
    targets = doc_types if start_from is None else doc_types[doc_types.index(start_from):]
    return (*targets, TEST_SPEC) if mode == "simple" else targets
```

- 今の `POST /generate` の経路をそのまま使う。状態(`generating`)・進み具合(Redis)・失敗したときの rollback と状態の巻き戻し・チャットへの失敗の知らせが、何も足さずに効く。
- 簡易モードは4文書の後に必ず作り直す(下流は上流を入力にするので、どこから再生成してもテスト仕様書は作り直す)。**4文書と同じトランザクション**なので、テスト仕様書で失敗すれば4文書も戻る(「組がそろわない状態を残さない」に合わせた)。
- 詳細設計モードは、設計書(要件・外部)の再生成では作らない。`start_from="test_spec"` のときだけ。`request_generation` が段階1・段階7 の承認を確かめる(`DesignStageService.approved_stages`。承認されていない・古いと 409)。
- 生成のループ(`doc_types`)は変えず、ループの後でテスト仕様書を作る。上流は `start_from` より前なら表示中の版を読む既存の仕組みで揃う(実装計画書の model も読むようにした)。
- **渡さないもの**: `record_document_change`(影響の印)は設計書(`designed`)だけ。自己診断は `generated`(設計書の md)だけを読む。テスト仕様書だけを作ったとき(`designed` が空)は、自己診断も設計レビューも「直ったか」の判定も流さない。

### 3. 入力の版と「古い」

```python
async def _test_spec_inputs(self, project) -> dict[str, int | None]:
    # 簡易: doc:requirements・doc:external_design・doc:internal_design・doc:implementation_plan
    # 詳細: doc:requirements・doc:external_design・stage:1・stage:7(承認した版。古ければ None)
```

生成のときに model の `inputs` に写し、`get_test_spec` が今の値と比べる(`is_outdated`)。段階の指紋(`input_fingerprint`)と同じ考え方で、ステージ7の変更の影響の印(段階の行にしか付かない)は使わない。

### 4. 読み出し

```python
# app/api/routes/projects.py
@router.get("/{project_id}/test-spec", response_model=TestSpecRead)
async def get_test_spec(session, current_project) -> TestSpecRead:
```

文書の一覧(`GET /documents`。`list_current_for_project` は `DOC_TYPES` だけ)には出さない。プレビューのタブに出すかは Phase 57 で決める。版の一覧・復元・ダウンロードは今の文書の API がそのまま使える(`DocType` に `test_spec` を足した)。

### 5. 偽 LLM と UI の型

- E2E 用の偽 LLM(`fake.py`)に、偽の外部設計書の2つの API の正常・異常と画面の流れを返す `_TEST_SPEC_OUTPUT` を足した(検証の指摘が minor だけになる形。契約は `test_test_spec_generation.py` の詳細のテスト)。足さないと簡易モードの生成が `NotImplementedError` で止まる。
- devex-ui は `DocType` に `test_spec` を足し、`Record<DocType, string>` の表示名を2か所に足しただけ。生成の進み具合の応答に `test_spec` が来るため(型を実際の応答に合わせる)。プレビューの文書の並び(`modeDocTypes`・`DOC_TYPE_ORDER`)には入れないので、画面は変わらない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_test_spec_messages`・`to_draft` | pytest(`test_test_spec_drafting.py`) | スタブ不要 ── 対象が純粋で、上流の model と構造化出力だけから決まるため | 必要なテストの表・画面と API の行・UI 仕様の本文を除く・外部設計書が無いとき |
| `DocGeneratorService.generate`(簡易) | pytest(`test_test_spec_generation.py`) | FakeLLM(4文書・テスト仕様書の構造化出力と自己診断)。DB はインメモリの SQLite(作った版と写しそのものが検証対象のため、スタブにしない) | 5つ目ができる・処理と単位・入力の版・生成の入力・自己診断に渡らない・テスト仕様書で失敗すれば組ごと戻る |
| `get_test_spec`(ルートとサービス) | 同上 | 同上 | 無ければ 404・件数・指摘・要件定義書を前の版に戻すと古い |
| `request_generation`(詳細) | 同上 | DB だけ(段階の行が無いプロジェクト) | 段階1・7 が無いと 409、状態は変えない |
| `generate`(詳細)と E2E 用の偽 LLM | 同上 | `E2eFakeLLM`(段階1〜7 を画面と同じ順に作って承認する `fake_llm_flow`) | 偽 LLM の契約: critical / major 0・処理と単位が段階1・7 から・入力の版に None が無い・チャットが増えない |
| `generation_targets` ほか既存 | `test_doc_generation_start.py`・`test_doc_generator_service.py`・`test_review_sendback.py` | 既存のまま(FakeLLM に `spec_output` を足した) | 起点ごとの対象・件数・構造化出力の順・修正指示は設計書だけ |
| `progressText`・`DOC_LABEL`(devex-ui) | vitest(`regenerationOps.test.ts`) | スタブ不要 ── 純粋関数 | 進み具合に `test_spec` が来ても、プレビューの並びには入れない |

既存のテストのうち、生成の構造化出力を数えるもの・並びを見るものは、テスト仕様書の分を足して直した(`FakeLLM` の `structured_by_schema` に無いスキーマは None を返し、生成が失敗するため、`upstream_outputs` に `spec_output` を足した)。

```sh
cd devex-api/backend && uv run pytest tests/unit -k "test_spec or doc_generat or sendback"
cd devex-ui && npx vitest run src/features/documents
```
