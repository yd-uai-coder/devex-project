# Phase-95-2: 履歴の API

## この章の目的

95-1 の純粋関数に、DB から材料(要素の合意の記録・合意を守った版・プロジェクトの CR)を渡し、`GET /projects/{id}/agreements/history?key=` で返す。画面は Phase 97(要件定義書・外部設計書のプレビューで行を押して開く使い方を見込む)。

自動実装モード: on([introduction](./Phase-95-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/repositories/agreement.py`](../samples/backend/app/repositories/agreement.py) | 更新 | `list_for_key`(要素1つの記録を記録の順に) |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `list_protected`(合意を守った版) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `AgreementKeyInvalidError`(422 `AGREEMENT_KEY_INVALID`) |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `history` と、記録の行から材料を作る `_record_facts` |
| [`app/schemas/agreement.py`](../samples/backend/app/schemas/agreement.py) | 更新 | `AgreementHistoryRead`・`HistoryEntryRead`・`RelatedChangeRequestRead`・`agreement_history_read` |
| [`app/api/routes/agreements.py`](../samples/backend/app/api/routes/agreements.py) | 更新 | `GET /history` |
| [`tests/unit/test_agreement_history_service.py`](../samples/backend/tests/unit/test_agreement_history_service.py) | 新規 | サービス・ルートの流れ |
| [`tests/integration/test_agreements_flow.py`](../samples/backend/tests/integration/test_agreements_flow.py) | 更新 | 実 PostgreSQL での履歴・422・409 |

## 1. 読み出し

- `AgreementRepository.list_for_key(project_id, key)`: 要素1つの記録を `seq` の順に。出どころの束・CR は今までどおり selectinload(番号を出すため)。
- `GeneratedDocumentRepository.list_protected(project_id, doc_types)`: 要件定義書・外部設計書の版のうち `protection` が一覧のもの。**JSON の中身では DB で絞らない**。版の数は巡回で小さく、`PortableJSON` は Python の None を JSON の `null` として保存するので、SQL の `IS NOT NULL` では「守らなかった版」と区別できないためである。
- CR は既存の `ChangeRequestRepository.list_for_project` で読み、版の `change_request_id` を番号に直す。

## 2. サービスと API

```python
# app/services/agreement_service.py(抜粋)
async def history(self, project: Project, key: str) -> ElementHistory:
    require_detailed(project, "Agreements")       # 簡易モードは 409
    if kind_of(key) is None:
        raise AgreementKeyInvalidError(...)        # 422
    ...
    return element_history(key, records, versions, change_requests)
```

```python
# app/api/routes/agreements.py(抜粋)
@router.get("/history", response_model=AgreementHistoryRead)
async def get_agreement_history(session, current_project, key: Annotated[str, Query(min_length=1, max_length=300)])
```

- キーは**クエリ**で受ける。`api:GET /api/v1/x` のように空白と `/` を含むためである(確認事項の `PATCH .../confirmations/{key:path}` はパスの末尾なので `:path` で受けられたが、ここは `/history` の後ろに続けられない)。
- 記録も CR も無いキーは 200 で空の履歴にした。まだ合意していない要素(CR で足された新しい要件など)でも、関わる CR の欄は出せるためである。
- 応答の形は内部設計書の API 一覧を参照。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_history_service.py`(新規) | `AgreementService.history`・`list_for_key`・`list_protected`・`agreement_history_read`・ルート `get_agreement_history`・`AgreementKeyInvalidError` | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)と本物のリポジトリ。CR の反映までは `tests/fixtures/change_requests.py`(文書の生成の LLM は FakeLLM)。戻した版は `protection` を付けてリポジトリで直接作る |
| `test_agreements_flow.py`(更新、統合) | `GET .../agreements/history`(ルート → サービス → リポジトリ)と、束の作成・「採用にする」での記録 | httpx の AsyncClient | スタブ不要 ── LLM を呼ばない。実 PostgreSQL(専用のテスト DB) |

- 統合スモーク: B-1 で合意 → CR-1 の反映で中身が変わった、が並び、CR-1 は対象(内容の変更)として出る。
- 戻した版: CR-1 の反映の再生成(偽の LLM は FR-002 を書かない)でも戻しており、それも CR-1 の版として出る。SQLite の版の日時は秒の単位なので、同じ秒の記録との前後はユニットでは見ない(並びが日時の順であることだけを見る)。
- 合意していないキーは空の履歴。合意の対象でないキーは 422、簡易モードは 409。
- 統合: 推測のまま束に入った FR-002 を「採用にする」と、`changed`(採用にする)になる。`key` を渡さないと 422(FastAPI の検証)。
