# Phase-81-1: 文書の版に、生成したモデル名を残す

## この章の目的

文書の版(`generated_documents`)に、その版を生成したモデル名(`generated_model`)を残す。振り返り 6節の「どこに何で反映したか」をたどるための列で、[80-1](../Phase-80/Phase-80-1.md) の決定12 でステージ11 に入れた。束([81-2](./Phase-81-2.md))は文書の版を写すときにこの列も写すので、束より先に足す。Phase 85(反映)では、同じ表に `change_request_id` だけを足す。

自動実装モード: on([introduction](./Phase-81-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/9dde45561e02_add_generated_model_to_documents.py`](../samples/backend/alembic/versions/9dde45561e02_add_generated_model_to_documents.py) | 新規 | `generated_documents.generated_model`(VARCHAR(100)・NULL 可)を足す。往復できる |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | `generated_model: Mapped[str \| None]` |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `create_version(..., generated_model: str \| None = None)` |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `GeneratedDocumentRead.generated_model`(既定 `None`) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 解決した `ResolvedLlm` を持ち、`.model` を各版(テスト仕様書も)に渡す |
| [`tests/unit/test_generated_model.py`](../samples/backend/tests/unit/test_generated_model.py) | 新規 | リポジトリが列を残す・生成で全文書の版にモデル名が入る・応答に出る |

## 1. 列とマイグレーション

```python
# alembic/versions/9dde45561e02_add_generated_model_to_documents.py
revision = '9dde45561e02'
down_revision = 'd7e2a9c4f1b3'   # テンプレートの汎用チャットの表の削除

def upgrade() -> None:
    op.add_column(
        'generated_documents', sa.Column('generated_model', sa.String(length=100), nullable=True)
    )
```

- **NULL 可**: 既存の版は、どのモデルで作ったか分からない。推測で埋めず NULL のままにする。
- 長さはレビューの回の `review_runs.model`(VARCHAR(100))にそろえた。

## 2. 生成で、モデル名を渡す

```python
# app/services/doc_generator_service.py(generate_documents の抜粋)
resolved = (
    injected_llm(llm, Purpose.GENERATION)
    if llm is not None
    else await LlmResolver(self._session).resolve(user_id, Purpose.GENERATION)
)
llm = resolved.llm
...
await self._documents.create_version(
    project_id=project_id, doc_type=doc_type, content=content, model=model,
    generated_model=resolved.model,
)
```

- それまでは `resolve(...).llm` だけを取り出していた。モデル名を版に残すため、`ResolvedLlm` を持つ形にした。
- **渡された LLM**(テストが差し替えた偽物): `injected_llm`(`app/services/llm_resolver.py`)で `.env` の既定のモデルとみなす。設計レビュー・直ったかの判定(`review_service`・`fix_check_service`)と同じ扱いである。E2E の偽 LLM(`E2E_FAKE_LLM`)は `LlmResolver` を通るので、利用者の選んだモデル名が入る。
- 要件定義書・外部設計書(詳細設計モード)、4文書(簡易モード)、テスト仕様書のすべての版に入る。推測の要件の採用(`replace_model`)と版の復元(`set_current`)は版を作らないので、列は変わらない。
- `GeneratedDocumentRead` に出すので、版の一覧(`GET .../documents/{doc_type}/versions`)にも出る。画面で使うのは Phase 88。

## テスト観点

用語(SUT = テストの対象、ドライバ = 対象を呼ぶもの、スタブ = 対象の依存の代わり)は、以前の Phase と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_generated_model.py`(新規) | `GeneratedDocumentRepository.create_version`・`DocGeneratorService.generate`・`GeneratedDocumentRead` | pytest のテスト関数 | `FakeLLM`(生成の LLM。渡した LLM は `.env` の既定のモデルとして記録される)。DB はインメモリの SQLite |

- 名前を渡した版は残り、渡さない版は `None` / 生成した4文書の版がすべて `settings.GEMINI_MODEL` を持つ / 応答のスキーマに出る。
- マイグレーションはテストが import しない。dev の DB で往復を流した(introduction の「検証結果」)。
- 既存の生成・版のテスト(`test_doc_generator_service.py`・`test_document_versions.py`)はそのまま通る(`generated_model` は省略できる引数のため)。
