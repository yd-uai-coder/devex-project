# Phase-52-2: レビューの LLM と設定

## この章の目的

生成(Gemini)とは別に、レビューの LLM(Claude Sonnet)を取得する関数 `get_review_llm()` を作り、キー・モデル名・タイムアウト・1日の上限を設定に足す。あわせて、Claude の応答の形(429・`stop_reason`・トークン数)を今のリトライと失敗の分類に通し、E2E の偽 LLM にレビューの応答を足す。

自動実装モード: on([introduction](./Phase-52-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。`.env.example`(リポジトリ直下と `backend/`)にもキーと設定を足した(設定ファイルは samples にミラーしない。#21)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`pyproject.toml`](../samples/backend/pyproject.toml) | 更新 | `langchain-anthropic` を依存に足す(`uv.lock` も更新。`langchain-core` が 1.5.4 → 1.6.10 に上がった) |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | `ANTHROPIC_API_KEY`・`REVIEW_MODEL`・`REVIEW_TIMEOUT_SECONDS`・`REVIEW_MAX_TOKENS`・`REVIEW_RATE_LIMIT_PER_DAY` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | レビューの例外5つ(使えない403・キー無し502・上限429・実行中409・文書が無い409) |
| [`app/uml/generation/failures.py`](../samples/backend/app/uml/generation/failures.py) | 更新 | `unwrap_structured_result` が Claude の `stop_reason == "max_tokens"` もトークン上限にする |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | Anthropic の 429 をクォータ超過にする・`invoke_structured_with_usage`(方式の指定とトークン数) |
| `app/ai/llm/claude.py` | 新規 | `get_review_llm()` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | `ReviewOutput` の偽の応答・`with_structured_output` が `method` を受ける |
| ── ここからテスト ── | | |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py) | 更新 | `with_structured_output` が `method` を受け、`structured_output_methods` に記録する |
| [`tests/unit/test_review_llm.py`](../samples/backend/tests/unit/test_review_llm.py) | 新規 | 上の LLM まわりのテスト |

## 要点の抜粋

### 1. 取得関数

```python
# app/ai/llm/claude.py
@lru_cache
def get_review_llm() -> Any:
    if settings.E2E_FAKE_LLM:
        return get_e2e_fake_llm()
    if not settings.ANTHROPIC_API_KEY:
        raise ReviewUnavailableError("設計レビューのAPIキーが設定されていません。")
    return ChatAnthropic(
        model_name=settings.REVIEW_MODEL, api_key=SecretStr(settings.ANTHROPIC_API_KEY),
        max_tokens_to_sample=settings.REVIEW_MAX_TOKENS, timeout=settings.REVIEW_TIMEOUT_SECONDS,
        max_retries=0, stop=None,
    )
```

- 引数は pydantic の別名(`model_name` など)で渡す。pyright が `ChatAnthropic` の `__init__` を別名で読むため。
- `max_retries=0`: SDK の再試行を切り、再試行は `invoke_with_retry`(3回)に任せる。重ねると、180秒 × 3 × 3 で止まった回の回収のしきい値(15分)を超えうる。
- `get_judge_llm()`(Haiku の狭い判定)は、使う章([Phase 54](../Phase-51/Phase-51-5.md) の「直ったか」のシャドーモード)で作る(#17 の「今の消費者」)。

### 2. トークン数を返す構造化出力

```python
# app/services/llm_retry.py
async def invoke_structured_with_usage[S: BaseModel](
    llm, schema: type[S], messages, *, method: str | None = None
) -> tuple[S, dict[str, Any]]:
```

既存の `invoke_structured` はこれを呼んで構造だけを返す形にした(呼び出し側は変えない)。レビューは `method="json_schema"` を渡す(Sonnet 5.5 はツール呼び出しの強制による構造化出力を推奨しない。51-1)。

### 3. 設定

```python
# app/core/config.py
ANTHROPIC_API_KEY: str | None = None
REVIEW_MODEL: str = "claude-sonnet-5-5"
REVIEW_TIMEOUT_SECONDS: float = 180.0   # 実測 25〜43 秒の約4倍
REVIEW_MAX_TOKENS: int = 16000
REVIEW_RATE_LIMIT_PER_DAY: int = 20     # superuser ごと(着手時の決定)
```

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `get_review_llm` | pytest(`test_review_llm.py`。`settings` を monkeypatch) | スタブ不要 ── 実クライアントはネットワークを呼ばないコンストラクタだけなので、そのまま確かめる | E2E の偽物になる・キーが無いと `ReviewUnavailableError`・モデル名・タイムアウト・`max_retries=0` |
| `invoke_structured_with_usage` | 同上 | `FakeLLM`(`structured_sequence` に生の応答の形を入れる) | 方式 `json_schema` が渡る・`usage_metadata` が返る |
| `_is_quota_error`・`unwrap_structured_result` | 同上 | スタブ不要 ── 例外・辞書を作って渡すだけ | Anthropic の 429 はクォータ・`stop_reason=max_tokens` はトークン上限 |
| `E2eFakeLLM` | 同上 | スタブ不要 ── 偽物そのものが SUT | `ReviewOutput` を返し、ヒアリングの指摘に観点のキーがある |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_llm.py
```
