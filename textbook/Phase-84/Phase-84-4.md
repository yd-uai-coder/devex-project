# Phase-84-4: 任意の要約

## この章の目的

説明書に、ボタンで LLM のクライアント向けの要約を足せるようにする。要約は「未確認」ででき、未確認の間は出力に載らない。人が直して「確認した」を押すと載る(誰が・いつを残す)。CR の内容や影響が変わって5節が変わったら、要約は「古い」になり出力から外れる。要約に出る要件 ID・数字は5節と照合し、合わない所を返す([84-2](./Phase-84-2.md) の `check_summary`)。

自動実装モード: on([introduction](./Phase-84-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/summary.py`](../samples/backend/app/change_requests/summary.py) | 新規 | `SUMMARY_SYSTEM_PROMPT`・`build_summary_messages`・`clip_summary`・`summary_state`・状態の表示名 |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `summary` の re-export |
| [`app/models/change_request_summary.py`](../samples/backend/app/models/change_request_summary.py) | 新規 | `ChangeRequestSummary`(⑱) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | re-export |
| [`alembic/versions/fee4fbc2a00c_add_change_request_summaries.py`](../samples/backend/alembic/versions/fee4fbc2a00c_add_change_request_summaries.py) | 新規 | ⑱の表 |
| [`app/repositories/change_request_summary.py`](../samples/backend/app/repositories/change_request_summary.py) | 新規 | `get_for`・`replace`(作るか上書き) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestSummaryNotFoundError`(404 `CR_SUMMARY_NOT_FOUND`) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `SummaryEdit`・`ExplanationSummaryRead`、`ChangeRequestExplanationRead` に `output`・`summary` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `llm` の注入、`ExplanationView` に要約と `summary_state`・`output`、`generate_summary`・`edit_summary`・`confirm_summary` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `POST`・`PATCH .../explanation/summary`・`POST .../summary/confirm`、ダウンロードは `output` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E の偽の LLM に要約の固定の応答 |
| [`tests/unit/test_change_request_summary.py`](../samples/backend/tests/unit/test_change_request_summary.py) | 新規 | 入力・文の整え・状態・表とリポジトリ |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 作る・直す・確かめる・古い・作り直し |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | 要約のルートと照合・登録 |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽の LLM の要約の応答 |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 説明書と要約の流れ・CASCADE |

依存の向き: サービス → `summary.py`(純粋)・`ChangeRequestSummaryRepository`・`LlmResolver`・`invoke_with_retry`。スキーマ → `check_summary`・状態の表示名。

## 1. 純粋な部分

```python
# app/change_requests/summary.py(抜粋)
SummaryState = Literal["unconfirmed", "confirmed", "stale"]
def build_summary_messages(explanation_markdown) -> list[BaseMessage]   # 入力は5節だけ
def clip_summary(text) -> str                                           # 空白を除き 4000字で切る
def summary_state(status, fingerprint, current_fingerprint) -> SummaryState
    # fingerprint が今の5節と違えば stale、同じなら保存した状態
```

- **入力は5節だけ**: CR の元の値や設計の全文を渡さない。要約が5節に無いことを書く余地を減らし、照合で確かめられる範囲にとどめる。プロンプトは「説明書に無い数字(工数・日数・費用)を推測して書かない」と指示する。
- **「古い」は保存しない**: 状態の列は未確認 / 確認済みだけで、古いかは読むたびに今の5節の fingerprint と比べて決める(段階の「古い」と同じ考え方)。

## 2. 表と操作

⑱ `change_request_summaries`(CR ごとに1行。[内部設計書](../../docs/internal_design.md) 3.2節): `generated_text`(LLM の元の文)・`text`(今の文)・`status`・`fingerprint`・`generated_model`・作った人と日時・`edited_at`・確かめた人と日時。

| 操作 | 何が起きるか |
|---|---|
| 作る(POST) | 利用者の生成の用途で LLM を解決し、5節から要約を作る。未確認・fingerprint は今の5節。前の要約(直した文・確かめた記録)は上書き |
| 直す(PATCH `{text}`) | 今の文を替え、未確認に戻す。元の文は残す |
| 確かめる(POST `.../confirm`) | 確認済みにし、確かめた人と日時、今の5節の fingerprint を残す |

- **元の文を残す**(ユーザー決定): 人がどこを直したかを後で見られるように、LLM の元の文を別の列に持つ(`edited` は2つの文が違うか)。
- **確かめは古い要約も受け付ける**: 確かめると fingerprint を今の5節に合わせるので、古くなった要約も、今の5節と見比べて確かめれば載る。照合で合わない所があっても止めない(Claude の判断。工数の「2週間」のように、5節に無くても正しい数字がありうるので、人が判断する)。
- **出力の md**: `ExplanationView.output` が、要約が確認済みで古くないときだけ `with_summary` で載せる。ダウンロードとプレビューの `output` は同じもの。
- **LLM の解決**: 生成の用途(`Purpose.GENERATION`)。テストは `ChangeRequestService(session, llm=...)` でフェイクを注入する(`injected_llm`)。回数の上限は置いていない(文書の生成と同じ扱い)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_summary.py`(新規) | `build_summary_messages`・`clip_summary`・`summary_state`、`ChangeRequestSummaryRepository`・ORM | pytest のテスト関数 | 純粋な部分はスタブ不要 ── 副作用が無いため。リポジトリは永続化が検証対象なので SQLite のセッション |
| `test_change_request_service.py`(更新) | `generate_summary`・`edit_summary`・`confirm_summary`・`ExplanationView.summary_state`/`output` | pytest のテスト関数 | 要約の LLM は固定の文を返すフェイク(`FakeLLM`)をサービスに注入する ── 外部の API を呼ばず、渡したメッセージも確かめられるため |
| `test_change_requests_api.py`(更新) | 要約の3つのルート・ダウンロード | pytest のテスト関数 | `LlmResolver.resolve` をフェイクに差し替える(`stub_llm_resolver`)── ルートはサービスを自分で作るため、解決の側で差し替える |
| `test_fake_llm_e2e.py`(更新) | E2E の偽の LLM | pytest のテスト関数 | スタブ不要 ── 偽の LLM そのものが SUT |
| `test_change_requests_flow.py`(integration) | 説明書と要約の API(実際の PostgreSQL)・CASCADE | httpx の AsyncClient | `stub_llm_resolver` |

- 作る: 元の文と今の文が同じ・未確認・出力に載らない・LLM に5節だけを渡した / 用途は生成。
- 直す: 元の文が残り未確認 / 要約が無ければ 404 / 空の文は 422。
- 確かめる: 確認済み・確かめた人・出力の「## 要約」が1節の前。
- 古い: CR を直すと stale になり出力から外れる / 確かめ直すと載る / 作り直すと確かめた記録が消える。
- 照合: 5節に無い ID・数字が応答に出る。
- 表: CR ごとに1行(2行目は一意の制約で失敗)/ プロジェクトの削除で消える(integration)。
