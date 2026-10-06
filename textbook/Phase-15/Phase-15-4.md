# Phase-15-4: 整理 ── 汎用チャットの再試行・refresh の寿命・未使用ファイル(BE)

## この章の目的

出力見本の付録の気づき#7〜#9を直す。

- **#7**: 汎用チャット(`POST /chat`、テンプレート由来の LangGraph のデモ)は、独自の再試行を持っていた。クォータ超過を `code` の無い `RateLimitExceededError` にし、文言も英語だった。共通の `invoke_with_retry` に寄せ、`LLM_QUOTA_EXCEEDED` にする。
- **#8**: refresh の Cookie は14日、JWT と Redis の TTL は30日だった。15〜30日目は、サーバーでは有効なのに Cookie が消えていて使えない。14日に揃え、Cookie の寿命を設定から導く。
- **#9**: `app/infrastructure/http.py` はどこからも使われていない。削除する。

自動実装モード: on([introduction](./Phase-15-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。テストは「動くこと」まで確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | 定型 | `REFRESH_TOKEN_EXPIRE_DAYS = 14` |
| [`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | 定型 | Cookie の `max_age` を設定から導く |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | 定型 | `_is_quota_error` に Tavily の利用上限超過を足す |
| [`app/services/chat.py`](../samples/backend/app/services/chat.py) | 更新 | 定型 | 独自の再試行を削除し、`invoke_with_retry` を使う(samples へは初めて載せた) |
| `app/infrastructure/http.py` | 削除 | ── | samples には元から無い |
| ── ここからテスト ── | | | |
| [`tests/unit/test_generic_chat_and_refresh.py`](../samples/backend/tests/unit/test_generic_chat_and_refresh.py) | 新規 | 定型 | Tavily の上限超過の判定、汎用チャットのクォータ超過、Cookie の寿命 |

本体ではあわせて次の2つも直した。

- `.env.example`(2つ)の `REFRESH_TOKEN_EXPIRE_DAYS` を14にした。
- devex-api の `CLAUDE.md` の「LLM/LangGraph連携」節の記述を、`llm_retry.invoke_with_retry` を指すように直した。

## 要点の抜粋

```python
# app/services/chat.py(send_message の中)
initial_state = {"question": message, "messages": [], ...}
result = await invoke_with_retry(lambda: workflow.ainvoke(initial_state))
```

```python
# app/api/routes/auth.py
_REFRESH_TOKEN_MAX_AGE_SECONDS = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
```

## 設計判断

- **共通の判定を広げてから寄せた**: 汎用チャットは、検索ツールの Tavily の利用上限超過もクォータ超過として扱っていた。共通の `_is_quota_error` は Gemini の 429 しか見ていなかった。寄せる前に共通の側を広げないと、Tavily の上限超過が3回再試行されてしまう。
- **Cookie の寿命を設定から導く**: 定数を14日に揃えるだけでは、`.env` で `REFRESH_TOKEN_EXPIRE_DAYS` を上書きしたときに、また食い違う。実際に、手元の `.env` は30を指定していた。Cookie を設定から導けば、`.env` の値がいくつでも JWT・Redis・Cookie の3つは揃う。

## テスト観点

旧ルールの納期モード(旧 #21)で書いたため、SUT・ドライバ・スタブの言語化は省略している。`_QuotaWorkflow`(Tavily の上限超過を出すワークフロー)で、例外が `LLM_QUOTA_EXCEEDED` になり、再試行しない(呼び出しが1回)ことを確かめた。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_generic_chat_and_refresh.py tests/unit/test_llm_retry.py
# 15 passed
```

手元の `devex-api/.env` は `REFRESH_TOKEN_EXPIRE_DAYS=30` のままである。Cookie はこの値から導くので食い違いは起きないが、決定(14日)に合わせるなら14に書き換える。
