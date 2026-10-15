# Phase-57-1: 詳細設計書の zip への同梱

## この章の目的

詳細設計書の zip(`detailed_design.zip`)に、テスト仕様書の md(`test_spec.md`)を入れる。入れるのは今の版があり、古くないときだけ(着手時の相談の決定4)。「古いか」の判定は `GET /test-spec` と同じものを使うので、`DocGeneratorService` の中にあった入力の版と「古い」の判定を、小さなモジュール `app/services/test_spec_state.py` に切り出して共用する。

自動実装モード: on([introduction](./Phase-57-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/test_spec_state.py`](../samples/backend/app/services/test_spec_state.py) | 新規 | `FUNCTION_STAGE`・`TEST_SPEC_STAGES`・`CurrentTestSpec`・`spec_inputs`(入力の今の版)・`current_test_spec`(今の版・model・古いか) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `_test_spec_inputs` と段階の定数を `test_spec_state` へ移し、`get_test_spec` は `current_test_spec` を使う |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | `TEST_SPEC_MARKDOWN_NAME`・`bundle` で古くなければ `test_spec.md` を入れる |
| ── ここからテスト ── | | |
| [`tests/unit/test_detailed_design_export.py`](../samples/backend/tests/unit/test_detailed_design_export.py) | 更新 | 入る / 無い / 古い |

## 要点の抜粋

### 1. 今の版と「古い」を共用のモジュールへ

```python
# app/services/test_spec_state.py
FUNCTION_STAGE = 1
TEST_SPEC_STAGES = (FUNCTION_STAGE, PLAN_STAGE)

@dataclass(frozen=True)
class CurrentTestSpec:
    document: GeneratedDocument
    model: TestSpecModel      # 無い・壊れた model は空の TestSpecModel
    outdated: bool

async def spec_inputs(session, project) -> dict[str, int | None]: ...
async def current_test_spec(session, project) -> CurrentTestSpec | None: ...
```

- **なぜサービスのメソッドでなく別のモジュールか**: `doc_generator_service` は `review_service` を import し、`review_service` は `detailed_design_export_service` を import する。zip のサービスから `DocGeneratorService` を import すると循環する。入力の版の判定はリポジトリと `DesignStageService` だけで書けるので、どちらからも読める葉のモジュールにした(#17: 共通化を駆動する消費者 = zip)。
- 関数名を `test_` で始めない(`spec_inputs`)。テストのモジュールに import すると pytest がテストとして集めるため(Phase 56 と同じ注意)。

```python
# app/services/doc_generator_service.py
async def get_test_spec(self, project: Project) -> TestSpecRead:
    current = await current_test_spec(self._session, project)
    if current is None:
        raise DocumentNotFoundError("test_spec not found")
    return TestSpecRead(document=document_read(current.document),
                        counts=test_spec_counts(current.model),
                        issues=_issues_read(validate_test_spec(current.model)),
                        outdated=current.outdated,
                        design_gaps=design_gap_count(current.model))   # 57-2 で足した
```

### 2. zip に入れる条件

```python
# app/services/detailed_design_export_service.py
TEST_SPEC_MARKDOWN_NAME = "test_spec.md"

async def bundle(self, project: Project) -> BundleFile:
    ...
    test_spec = await current_test_spec(self._session, project)
    with zipfile.ZipFile(buffer, "w", ...) as archive:
        ...
        if test_spec is not None and not test_spec.outdated:
            archive.writestr(TEST_SPEC_MARKDOWN_NAME, test_spec.document.content)
```

- 本文は保存済みの md(`content`)をそのまま入れる。HTML は入れない(devex-api に md → HTML の変換が無く、詳細設計書の HTML は model から専用に組んでいるため。introduction の Claude の判断)。
- 段階1〜7 が承認済みでなければ zip そのものを断る(既存)。テスト仕様書の有無は zip を断る理由にしない。

## テスト観点

用語(SUT / ドライバ / スタブ)は [Phase 1](../Phase-1/Phase-1-introduction.md) で定義済み。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DetailedDesignExportService.bundle`・`current_test_spec`・`spec_inputs` | pytest(`test_detailed_design_export.py`) | なし ── DB はインメモリの SQLite(テスト仕様書の版と入力の版の写しそのものが検証対象のため)。テスト仕様書は model の `inputs` を指定して直接保存する(LLM は要らない) | 今の入力の版を写した版は入る / 無ければ入らない / `stage:7` の版をずらした版は古く、入らない |
| `get_test_spec`(リファクタの番人) | 既存の `test_test_spec_generation.py` | 既存のまま | 公開挙動を変えない切り出しなので、既存の「件数・指摘・古い」のテストが統合スモーク(#12-4) |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_detailed_design_export.py tests/unit/test_test_spec_generation.py
```
